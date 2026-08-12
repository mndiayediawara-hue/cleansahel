router.get('/lots/:id', auth, (req, res) => {
  const l = db.prepare('SELECT * FROM lots WHERE id = ?').get(req.params.id)
  if (!l) return res.status(404).json({ error: 'No encontrado' })
  res.json(mapLot(l))
})

// PATCH /api/lots/:id/status — cambiar estado de una fabricación
router.patch('/lots/:id/status', auth, requireRole('admin', 'produccion'), (req, res) => {
  const { status } = req.body
  const validStatuses = ['pendiente', 'en_curso', 'completado', 'cancelado']
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido. Debe ser: pendiente, en_curso, completado, cancelado' })
  }
  const lot = db.prepare('SELECT * FROM lots WHERE id = ?').get(req.params.id)
  if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
  // Si pasa a completado, ya está completado (no hacemos nada extra)
  // Si pasa de completado a otro, no permitimos (regla de negocio)
  if (lot.status === 'completado' && status !== 'completado') {
    return res.status(400).json({ error: 'No se puede cambiar el estado de un lote ya completado' })
  }
  const allowedTransitions = {
    pendiente: ['pendiente', 'en_curso', 'cancelado'],
    en_curso: ['en_curso', 'completado', 'cancelado'],
    completado: ['completado'],
    cancelado: ['cancelado'],
  }
  if (!(allowedTransitions[lot.status] || []).includes(status)) {
    return res.status(400).json({ error: `Transición no permitida: ${lot.status} → ${status}` })
  }
  db.prepare('UPDATE lots SET status = ? WHERE id = ?').run(status, req.params.id)
  addHistory(req, { 
    action: 'cambiar_estado', 
    module: 'Producción', 
    entityId: req.params.id, 
    description: `Lote ${lot.lot_number} → ${status}` 
  })
  res.json({ ok: true, id: req.params.id, status })
})

// POST /api/lots — crear una nueva fabricación con estado 'pendiente' (sin descontar stock todavía)
router.post('/lots', auth, requireRole('admin', 'produccion'), (req, res) => {
  const { productId, plannedQuantity, notes, machineId } = req.body
  if (!productId) return res.status(400).json({ error: 'Falta productId' })
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
  const lotId = uid('l-')
  const year = new Date().getFullYear()
  const row = db.prepare("SELECT MAX(CAST(substr(lot_number, 10) AS INTEGER)) AS max_no FROM lots WHERE lot_number LIKE ?").get(`LOT-${year}-%`)
  const nextNo = Number(row?.max_no || 0) + 1
  const lotNumber = `LOT-${year}-${String(nextNo).padStart(4, '0')}`
  const orderNumber = `OP-${year}-${String(nextNo).padStart(4, '0')}`
  db.prepare(`INSERT INTO lots (id, lot_number, product_id, quantity, raw_materials_json, produced_by, produced_at, status, notes, machine_id, production_order_number) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(lotId, lotNumber, productId, plannedQuantity || 0, '[]', req.user.id, new Date().toISOString(), 'pendiente', notes || null, machineId || null, orderNumber)
  addHistory(req, { action: 'crear', module: 'Producción', entityId: lotId, description: `Nueva fabricación ${lotNumber} (${orderNumber}) en estado pendiente` })
  res.json({ ok: true, id: lotId, lotNumber, productionOrderNumber: orderNumber, status: 'pendiente' })
})

function nextProductionNumbers() {
  const year = new Date().getFullYear()
  const row = db.prepare("SELECT MAX(CAST(substr(lot_number, 10) AS INTEGER)) AS max_no FROM lots WHERE lot_number LIKE ?").get(`LOT-${year}-%`)
  const nextNo = Number(row?.max_no || 0) + 1
  return { lotNumber: `LOT-${year}-${String(nextNo).padStart(4, '0')}`, productionOrderNumber: `OP-${year}-${String(nextNo).padStart(4, '0')}` }
}

// PRODUCE-WITH-LOTS — alias de /produce con respuesta extendida (mantener compatibilidad frontend)
router.post('/produce-with-lots', auth, requireRole('admin', 'produccion'), (req, res) => {
  const { productId, quantity, notes, machineId } = req.body
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
  const recipe = db.prepare('SELECT * FROM recipes WHERE product_id = ?').get(productId)
  if (!recipe) return res.status(400).json({ error: 'El producto no tiene receta definida' })
  const items = JSON.parse(recipe.items_json)
  const recipeBatch = recipe.batch_size || 1000
  const liters = Number(quantity)
  if (!Number.isFinite(liters) || liters <= 0) return res.status(400).json({ error: 'La cantidad de fabricación debe ser mayor que 0 litros' })
  const bottleMl = Number(product.bottle_size || 0)
  if (bottleMl <= 0) return res.status(400).json({ error: 'El producto no tiene un tamaño de botella válido' })
  const producedBottles = Math.floor((liters * 1000) / bottleMl)
  if (producedBottles <= 0) return res.status(400).json({ error: 'El lote no produce ninguna botella con el formato configurado' })
  const ratio = liters / recipeBatch
  const needed = items.map(it => {
    const totalQty = it.quantity * ratio
    if (it.materialType === 'raw') {
      const m = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(it.materialId)
      return { ...it, totalQty, available: m ? m.stock : 0, name: m?.name || '?' }
    } else {
      const m = db.prepare('SELECT * FROM packaging WHERE id = ?').get(it.materialId)
      return { ...it, totalQty, available: m ? m.stock : 0, name: m?.name || '?' }
    }
  })
  const shortages = needed.filter(n => n.available < n.totalQty)
  if (shortages.length > 0) {
    return res.status(400).json({ error: 'Stock insuficiente para fabricar', shortages: shortages.map(s => ({ name: s.name, needed: s.totalQty, available: s.available, unit: s.unit })) })
  }
  const lotId = uid('l-')
  const { lotNumber, productionOrderNumber: orderNumber } = nextProductionNumbers()
  const tx = db.transaction(() => {
    for (const n of needed) {
      if (n.materialType === 'raw') db.prepare('UPDATE raw_materials SET stock = stock - ?, last_updated = ? WHERE id = ?').run(n.totalQty, new Date().toISOString(), n.materialId)
      else db.prepare('UPDATE packaging SET stock = stock - ?, last_updated = ? WHERE id = ?').run(n.totalQty, new Date().toISOString(), n.materialId)
    }
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(producedBottles, productId)
    db.prepare('INSERT INTO lots (id, lot_number, product_id, recipe_id, quantity, raw_materials_json, produced_by, produced_at, status, notes, machine_id, production_order_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(lotId, lotNumber, productId, recipe.id, producedBottles, JSON.stringify(needed.map(n => ({ materialId: n.materialId, materialType: n.materialType, quantity: n.totalQty, unit: n.unit }))), req.user.id, new Date().toISOString(), 'completado', notes || null, machineId || null, orderNumber)
    db.prepare('INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,0,?,?)')
      .run(uid('n-'), 'produccion', 'Producción completada', `Fabricado lote de ${liters}L de ${product.name} (${producedBottles} botellas) — Lote ${lotNumber} (${orderNumber})`, 'success', new Date().toISOString(), 'lot:'+lotId)
  })
  tx()
  addHistory(req, { action: 'produccion', module: 'Producción', entityId: lotId, description: `Fabricado lote de ${liters}L de ${product.name} (${producedBottles} botellas) — Lote ${lotNumber}` })
  maybeAddStockNotifications()
  res.json({ ok: true, lotId, lotNumber, productionOrderNumber: orderNumber })
})

// PRODUCE — the core action (calcula por lote de fabricación)
router.post('/produce', auth, requireRole('admin', 'produccion'), (req, res) => {
  const { productId, quantity, notes, machineId } = req.body
  // quantity = litros del lote a fabricar
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
  const recipe = db.prepare('SELECT * FROM recipes WHERE product_id = ?').get(productId)
  if (!recipe) return res.status(400).json({ error: 'El producto no tiene receta definida' })
  const items = JSON.parse(recipe.items_json)
  const recipeBatch = recipe.batch_size || 1000
  const liters = Number(quantity)
  if (!Number.isFinite(liters) || liters <= 0) return res.status(400).json({ error: 'La cantidad de fabricación debe ser mayor que 0 litros' })
  const bottleMl = Number(product.bottle_size || 0)
  if (bottleMl <= 0) return res.status(400).json({ error: 'El producto no tiene un tamaño de botella válido' })
  const producedBottles = Math.floor((liters * 1000) / bottleMl)
  if (producedBottles <= 0) return res.status(400).json({ error: 'El lote no produce ninguna botella con el formato configurado' })
  const ratio = liters / recipeBatch  // ratio de escala
  // Cada item: cantidad = item.quantity * ratio (la receta está definida para recipeBatch litros)
  const needed = items.map(it => {
    const totalQty = it.quantity * ratio
    if (it.materialType === 'raw') {
      const m = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(it.materialId)
      return { ...it, totalQty, available: m ? m.stock : 0, name: m?.name || '?' }
    } else {
      const m = db.prepare('SELECT * FROM packaging WHERE id = ?').get(it.materialId)
      return { ...it, totalQty, available: m ? m.stock : 0, name: m?.name || '?' }
    }
  })
  const shortages = needed.filter(n => n.available < n.totalQty)
  if (shortages.length > 0) {
    return res.status(400).json({ error: 'Stock insuficiente para fabricar', shortages: shortages.map(s => ({ name: s.name, needed: s.totalQty, available: s.available, unit: s.unit })) })
  }
  // Deduct stock and create lot
  const lotId = uid('l-')
  const lotCount = db.prepare("SELECT COUNT(*) c FROM lots WHERE lot_number LIKE 'LOT-%'").get().c
  const lotNumber = `LOT-${new Date().getFullYear()}-${String(lotCount + 1).padStart(4, '0')}`
  const tx = db.transaction(() => {
    for (const n of needed) {
      if (n.materialType === 'raw') db.prepare('UPDATE raw_materials SET stock = stock - ?, last_updated = ? WHERE id = ?').run(n.totalQty, new Date().toISOString(), n.materialId)
      else db.prepare('UPDATE packaging SET stock = stock - ?, last_updated = ? WHERE id = ?').run(n.totalQty, new Date().toISOString(), n.materialId)
    }
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, productId)
    db.prepare('INSERT INTO lots (id, lot_number, product_id, recipe_id, quantity, raw_materials_json, produced_by, produced_at, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(lotId, lotNumber, productId, recipe.id, quantity, JSON.stringify(needed.map(n => ({ materialId: n.materialId, materialType: n.materialType, quantity: n.totalQty, unit: n.unit }))), req.user.id, new Date().toISOString(), 'completado', notes || null)
    db.prepare('INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,0,?,?)')
      .run(uid('n-'), 'produccion', 'Producción completada', `Fabricadas ${quantity} ud de ${product.name} — Lote ${lotNumber}`, 'success', new Date().toISOString(), 'lot:'+lotId)
  })
  tx()
  addHistory(req, { action: 'produccion', module: 'Producción', entityId: lotId, description: `Fabricadas ${quantity} ud de ${product.name} — Lote ${lotNumber}` })
  maybeAddStockNotifications()
  res.json({ ok: true, lotId, lotNumber })
})

// ---------- NOTIFICATIONS ----------
router.get('/notifications', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100').all().map(n => ({
    id: n.id, type: n.type, title: n.title, message: n.message, severity: n.severity,
    read: !!n.read, createdAt: n.created_at, relatedId: n.related_id
  })))
})
router.post('/notifications/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})
router.post('/notifications/read-all', auth, (_req, res) => {
  db.prepare('UPDATE notifications SET read = 1').run()
  res.json({ ok: true })
})

// ---------- HISTORY ----------
router.get('/history', auth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 500, 5000)
  const rows = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT ?').all(limit)
  res.json(rows.map(h => ({
    id: h.id, userId: h.user_id, userName: h.user_name, action: h.action, module: h.module,
    entityId: h.entity_id, description: h.description, timestamp: h.timestamp
  })))
})

// ---------- CONFIG ----------
router.get('/config', auth, (_req, res) => {
  res.json({
    company: getConfig('company'),
    defaults: getConfig('defaults'),
    security: getConfig('security'),
  })
})
router.put('/config', auth, requireRole('admin'), (req, res) => {
  const { company, defaults, security } = req.body
  if (company) setConfig('company', company)
  if (defaults) setConfig('defaults', defaults)
  if (security) setConfig('security', security)
  addHistory(req, { action: 'modificar', module: 'Configuración', description: 'Configuración actualizada' })
  res.json({ ok: true })
})

// ---------- DASHBOARD ----------
router.get('/dashboard', auth, (_req, res) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const rawValue = db.prepare('SELECT SUM(stock * price) v FROM raw_materials').get().v || 0
  const pkgValue = db.prepare('SELECT SUM(stock * price) v FROM packaging').get().v || 0
  const prodValue = db.prepare('SELECT SUM(stock * price) v FROM products').get().v || 0
  const totalInventoryValue = rawValue + pkgValue + prodValue

  const rawStock = db.prepare('SELECT COUNT(*) c, SUM(stock) q FROM raw_materials').get()
  const pkgStock = db.prepare('SELECT COUNT(*) c, SUM(stock) q FROM packaging').get()
  const prodStock = db.prepare('SELECT COUNT(*) c, SUM(stock) q FROM products').get()
  const lowRaw = db.prepare('SELECT COUNT(*) c FROM raw_materials WHERE stock < min_stock').get().c
  const lowPkg = db.prepare('SELECT COUNT(*) c FROM packaging WHERE stock < min_stock').get().c
  const lowProd = db.prepare('SELECT COUNT(*) c FROM products WHERE stock < min_stock AND active = 1').get().c

  const ordersToday = db.prepare("SELECT COALESCE(SUM(total),0) t FROM orders WHERE created_at >= ?").get(todayStart.toISOString()).t
  const ordersMonth = db.prepare("SELECT COALESCE(SUM(total),0) t FROM orders WHERE created_at >= ?").get(monthStart.toISOString()).t
  const expensesMonth = db.prepare("SELECT COALESCE(SUM(amount),0) t FROM expenses WHERE date >= ?").get(monthStart.toISOString()).t
  const pendingOrders = db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('pendiente','confirmado','preparando')").get().c
  const productionToday = db.prepare("SELECT COALESCE(SUM(quantity),0) t FROM lots WHERE produced_at >= ? AND status = 'completado'").get(todayStart.toISOString()).t
  const productionWeek = db.prepare("SELECT COALESCE(SUM(quantity),0) t FROM lots WHERE produced_at >= ? AND status = 'completado'").get(weekStart.toISOString()).t
  const productionMonth = db.prepare("SELECT COALESCE(SUM(quantity),0) t FROM lots WHERE produced_at >= ? AND status = 'completado'").get(monthStart.toISOString()).t

  const benefit = ordersMonth - expensesMonth

  // Charts
  const last7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    const ventas = db.prepare("SELECT COALESCE(SUM(total),0) t FROM orders WHERE created_at >= ? AND created_at < ?").get(d.toISOString(), next.toISOString()).t
    const gastos = db.prepare("SELECT COALESCE(SUM(amount),0) t FROM expenses WHERE date >= ? AND date < ?").get(d.toISOString(), next.toISOString()).t
    last7.push({ date: d.toISOString().slice(5, 10), ventas, gastos })
  }
  const salesByProduct = db.prepare(`
    SELECT p.name, SUM(CAST(json_extract(item.value, '$.quantity') AS REAL)) qty
    FROM orders o, json_each(o.items_json) item
    JOIN products p ON p.id = json_extract(item.value, '$.productId')
    WHERE o.created_at >= ?
    GROUP BY p.id
    ORDER BY qty DESC LIMIT 5
  `).all(monthStart.toISOString())
  const topCustomers = db.prepare(`
    SELECT c.name, c.total_purchases as total
    FROM customers c
    ORDER BY c.total_purchases DESC LIMIT 5
  `).all()

  const recentOrders = db.prepare(`SELECT o.*, c.name as customer_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC LIMIT 5`).all()
    .map(o => ({ id: o.id, number: o.number, customer: o.customer_name, total: o.total, status: o.status, createdAt: o.created_at }))
  const recentPurchases = db.prepare(`SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.date DESC LIMIT 5`).all()
    .map(p => ({ id: p.id, number: p.number, supplier: p.supplier_name, total: p.total, date: p.date }))
  const recentLots = db.prepare(`SELECT l.*, p.name as product_name FROM lots l LEFT JOIN products p ON p.id = l.product_id ORDER BY l.produced_at DESC LIMIT 5`).all()
    .map(l => ({ id: l.id, lotNumber: l.lot_number, product: l.product_name, quantity: l.quantity, status: l.status, producedAt: l.produced_at }))
  const unreadNotifs = db.prepare("SELECT COUNT(*) c FROM notifications WHERE read = 0").get().c

  res.json({
    inventory: {
      totalValue: totalInventoryValue,
      rawValue, pkgValue, prodValue,
      rawCount: rawStock.c, rawQty: rawStock.q || 0,
      pkgCount: pkgStock.c, pkgQty: pkgStock.q || 0,
      prodCount: prodStock.c, prodQty: prodStock.q || 0,
      lowRaw, lowPkg, lowProd,
    },
    sales: { today: ordersToday, month: ordersMonth },
    expenses: { month: expensesMonth },
    benefit,
    production: { today: productionToday, week: productionWeek, month: productionMonth },
    pendingOrders,
    charts: { last7, salesByProduct, topCustomers },
    recent: { orders: recentOrders, purchases: recentPurchases, lots: recentLots },
    unreadNotifs,
  })
})

// ---------- REPORTS ----------
router.get('/reports/inventory', auth, (_req, res) => {
  const raw = db.prepare(`SELECT r.*, s.name as supplier_name FROM raw_materials r LEFT JOIN suppliers s ON s.id = r.supplier_id ORDER BY r.name`).all()
    .map(r => ({ tipo: 'Materia Prima', codigo: r.code, nombre: r.name, stock: r.stock, unidad: r.unit, minimo: r.min_stock, maximo: r.max_stock, precio: r.price, valor: r.stock * r.price, proveedor: r.supplier_name, ubicacion: r.location, lote: r.lot, caducidad: r.expiry_date }))
  const pkg = db.prepare(`SELECT p.*, s.name as supplier_name FROM packaging p LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.name`).all()
    .map(p => ({ tipo: 'Embalaje', codigo: p.code, nombre: p.name, stock: p.stock, unidad: 'ud', minimo: p.min_stock, maximo: p.max_stock, precio: p.price, valor: p.stock * p.price, proveedor: p.supplier_name, ubicacion: p.location, lote: '-', caducidad: '-' }))
  res.json([...raw, ...pkg])
})

router.get('/reports/production', auth, (_req, res) => {
  res.json(db.prepare(`SELECT l.*, p.name as product_name, u.full_name as produced_by_name FROM lots l LEFT JOIN products p ON p.id = l.product_id LEFT JOIN users u ON u.id = l.produced_by ORDER BY l.produced_at DESC LIMIT 200`).all()
    .map(l => ({ lote: l.lot_number, producto: l.product_name, cantidad: l.quantity, operario: l.produced_by_name, fecha: l.produced_at, estado: l.status })))
})

router.get('/reports/sales', auth, (_req, res) => {
  res.json(db.prepare(`SELECT o.*, c.name as customer_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC LIMIT 200`).all()
    .map(o => ({ numero: o.number, cliente: o.customer_name, subtotal: o.subtotal, iva: o.tax, descuento: o.discount, total: o.total, estado: o.status, fecha: o.created_at })))
})

router.get('/reports/expenses', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC LIMIT 500').all().map(e => ({ fecha: e.date, categoria: e.category, importe: e.amount, descripcion: e.description })))
})

router.get('/reports/consumption', auth, (_req, res) => {
  const rows = db.prepare(`
    SELECT json_extract(item.value, '$.materialId') as mid,
           json_extract(item.value, '$.materialType') as mtype,
           SUM(CAST(json_extract(item.value, '$.quantity') AS REAL)) as total
    FROM lots l, json_each(l.raw_materials_json) item
    WHERE l.status = 'completado'
    GROUP BY mid, mtype
  `).all()
  const out = rows.map(r => {
    let name = '-'
    if (r.mtype === 'raw') name = db.prepare('SELECT name FROM raw_materials WHERE id = ?').get(r.mid)?.name || '-'
    else name = db.prepare('SELECT name FROM packaging WHERE id = ?').get(r.mid)?.name || '-'
    return { material: name, tipo: r.mtype, totalConsumido: r.total }
  })
  res.json(out)
})

// ---------- BACKUP ----------
router.get('/backup', auth, requireRole('admin'), (_req, res) => {
  const tables = ['users','suppliers','raw_materials','packaging','products','recipes','customers','orders','purchases','expenses','lots','notifications','history','config']
  const dump = {}
  for (const t of tables) {
    if (t === 'config') dump[t] = db.prepare('SELECT * FROM config').all()
    else dump[t] = db.prepare(`SELECT * FROM ${t}`).all()
  }
  res.setHeader('Content-Disposition', `attachment; filename="cleanerp-backup-${new Date().toISOString().slice(0,10)}.json"`)
  res.json(dump)
})

router.post('/restore', auth, requireRole('admin'), (req, res) => {
  const dump = req.body
  if (!dump || typeof dump !== 'object') return res.status(400).json({ error: 'Datos inválidos' })
  try {
    const tables = ['users','suppliers','raw_materials','packaging','products','recipes','customers','orders','purchases','expenses','lots','notifications','history']
    const tx = db.transaction(() => {
      for (const t of tables) db.prepare(`DELETE FROM ${t}`).run()
      for (const t of tables) {
        if (Array.isArray(dump[t])) {
          for (const row of dump[t]) {
            const cols = Object.keys(row)
            const placeholders = cols.map(() => '?').join(',')
            db.prepare(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${placeholders})`).run(...cols.map(c => row[c]))
          }
        }
      }
    })
    tx()
    addHistory(req, { action: 'modificar', module: 'Sistema', description: 'Restauración desde backup' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ---------- GLOBAL SEARCH ----------
router.get('/search', auth, (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase()
  if (q.length < 2) return res.json({ results: [] })
  const results = []
  db.prepare('SELECT id, code, name FROM products WHERE LOWER(name) LIKE ? OR LOWER(code) LIKE ?').all(`%${q}%`, `%${q}%`).forEach(p => results.push({ type: 'producto', id: p.id, title: p.name, subtitle: p.code }))
  db.prepare('SELECT id, code, name FROM customers WHERE LOWER(name) LIKE ? OR LOWER(company) LIKE ? OR LOWER(cif) LIKE ?').all(`%${q}%`, `%${q}%`, `%${q}%`).forEach(c => results.push({ type: 'cliente', id: c.id, title: c.name, subtitle: c.company }))
  db.prepare('SELECT id, name, cif FROM suppliers WHERE LOWER(name) LIKE ? OR LOWER(cif) LIKE ?').all(`%${q}%`, `%${q}%`).forEach(s => results.push({ type: 'proveedor', id: s.id, title: s.name, subtitle: s.cif }))
  db.prepare('SELECT id, code, name FROM raw_materials WHERE LOWER(name) LIKE ? OR LOWER(code) LIKE ? OR LOWER(lot) LIKE ?').all(`%${q}%`, `%${q}%`, `%${q}%`).forEach(r => results.push({ type: 'materia_prima', id: r.id, title: r.name, subtitle: r.code }))
  db.prepare('SELECT id, lot_number, product_id FROM lots WHERE LOWER(lot_number) LIKE ?').all(`%${q}%`).forEach(l => results.push({ type: 'lote', id: l.id, title: l.lot_number, subtitle: 'Lote' }))
  db.prepare('SELECT id, number FROM orders WHERE LOWER(number) LIKE ?').all(`%${q}%`).forEach(o => results.push({ type: 'pedido', id: o.id, title: o.number, subtitle: 'Pedido' }))
  res.json({ results: results.slice(0, 30) })
})

// ---------- BARCODE LOOKUP ----------
router.get('/barcode/:code', auth, (req, res) => {
  const code = req.params.code
  let p = db.prepare('SELECT * FROM products WHERE code = ?').get(code)
  if (p) return res.json({ type: 'producto', data: mapProd(p) })
  p = db.prepare('SELECT * FROM raw_materials WHERE code = ?').get(code)
  if (p) return res.json({ type: 'materia_prima', data: mapRaw(p) })
  p = db.prepare('SELECT * FROM packaging WHERE code = ?').get(code)
  if (p) return res.json({ type: 'packaging', data: mapPkg(p) })
  p = db.prepare('SELECT * FROM customers WHERE code = ?').get(code)
  if (p) return res.json({ type: 'cliente', data: mapCust(p) })
  res.status(404).json({ error: 'No encontrado' })
})



// ---------- TEST ENDPOINT ----------
router.get('/_test_version', (_req, res) => {
  res.json({ version: 'TEST-v2-2026-08-12', deployed: true })
})

// ---------- EMERGENCY UNLOCK (uses RESET_TOKEN) ----------
// Resetea failed_attempts de TODOS los usuarios para desbloquear cuentas.
// Tambien permite cambiar la password de un usuario concreto.
router.post('/auth/emergency-unlock', (req, res) => {
  const token = (req.body || {}).token
  const expected = process.env.RESET_TOKEN
  if (!expected) return res.status(500).json({ error: 'RESET_TOKEN no configurado en el servidor' })
  if (token !== expected) return res.status(403).json({ error: 'Token de reset incorrecto' })
  
  const newPassword = (req.body || {}).newPassword
  const username = (req.body || {}).username
  
  try {
    // Resetear todos los failed_attempts
    db.prepare('UPDATE users SET failed_attempts = 0').run()
    
    // Si se quiere cambiar la contraseña
    if (newPassword && username) {
      const bcrypt = require('bcryptjs')
      const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
      if (!u) return res.status(404).json({ error: 'Usuario no encontrado' })
      const hash = bcrypt.hashSync(newPassword, 10)
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, u.id)
      return res.json({ ok: true, message: 'Cuenta desbloqueada y contraseña cambiada para ' + username, newPassword })
    }
    
    res.json({ ok: true, message: 'Todas las cuentas han sido desbloqueadas' })
  } catch (e) {
    res.status(500).json({ error: 'Error: ' + e.message })
  }
})

export default router

// ---------- RESET DB (dev only) ----------
router.post('/reset', auth, requireRole('admin'), async (_req, res) => {
  const { seed } = await import('./seed.js')
  seed({ force: true })
  res.json({ ok: true })
})