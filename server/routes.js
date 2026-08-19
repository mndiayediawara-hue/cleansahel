
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db, { uid, getConfig, setConfig } from './db.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'cleanerp-dev-secret-change-in-production-9f8e7d6c5b4a3210'

// ---------- MIDDLEWARE ----------
function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const token = header.slice(7)
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tiene permisos para esta acción' })
    }
    next()
  }
}

function addHistory(req, { action, module, entityId = null, description, before = null, after = null }) {
  db.prepare(`INSERT INTO history (id, user_id, user_name, action, module, entity_id, description, before_json, after_json, timestamp) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(uid('h-'), req.user?.id || null, req.user?.fullName || 'Sistema', action, module, entityId, description, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, new Date().toISOString())
}

function maybeAddStockNotifications() {
  // Auto-generate stock-low notifications
  const lowRaw = db.prepare(`SELECT id, name, stock, min_stock, unit FROM raw_materials WHERE stock < min_stock`).all()
  const lowPkg = db.prepare(`SELECT id, name, stock, min_stock FROM packaging WHERE stock < min_stock`).all()
  const lowProd = db.prepare(`SELECT id, name, stock, min_stock FROM products WHERE stock < min_stock AND active = 1`).all()
  const ins = db.prepare(`INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,0,?,?)`)
  const now = new Date().toISOString()
  for (const r of lowRaw) {
    // dedupe
    const exists = db.prepare(`SELECT id FROM notifications WHERE type='stock-bajo' AND related_id=? AND read=0`).get('raw:'+r.id)
    if (!exists) ins.run(uid('n-'), 'stock-bajo', 'Stock bajo materia prima', `${r.name} por debajo del mínimo (${r.stock} ${r.unit} / ${r.min_stock} ${r.unit})`, 'warning', now, 'raw:'+r.id)
  }
  for (const r of lowPkg) {
    const exists = db.prepare(`SELECT id FROM notifications WHERE type='stock-bajo' AND related_id=? AND read=0`).get('pkg:'+r.id)
    if (!exists) ins.run(uid('n-'), 'stock-bajo', 'Stock bajo material de embalaje', `${r.name} por debajo del mínimo (${r.stock} / ${r.min_stock})`, 'critical', now, 'pkg:'+r.id)
  }
  for (const r of lowProd) {
    const exists = db.prepare(`SELECT id FROM notifications WHERE type='stock-bajo' AND related_id=? AND read=0`).get('prd:'+r.id)
    if (!exists) ins.run(uid('n-'), 'stock-bajo', 'Stock bajo producto terminado', `${r.name} por debajo del mínimo (${r.stock} / ${r.min_stock})`, 'warning', now, 'prd:'+r.id)
  }
}

// ---------- AUTH ----------
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' })
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' })
  if (!user.active) return res.status(403).json({ error: 'Usuario desactivado' })
  const security = getConfig('security', { maxFailedAttempts: 5 })
  if ((user.failed_attempts || 0) >= security.maxFailedAttempts) {
    return res.status(403).json({ error: 'Cuenta bloqueada por múltiples intentos. Contacte al administrador.' })
  }
  const ok = bcrypt.compareSync(password, user.password_hash)
  if (!ok) {
    db.prepare('UPDATE users SET failed_attempts = COALESCE(failed_attempts,0) + 1 WHERE id = ?').run(user.id)
    return res.status(401).json({ error: 'Credenciales incorrectas' })
  }
  // FIX DEFINITIVO 3 ROLES: Si el username coincide con uno de los 3 roles oficiales
  // y su rol en BD no coincide, lo corregimos automáticamente.
  // Esto sobrevive a cualquier estado corrupto de la BD sin necesidad de redespliegue.
  const ROLE_BY_USERNAME = { admin: 'admin', produccion: 'produccion', contabilidad: 'contabilidad' }
  if (ROLE_BY_USERNAME[user.username] && user.role !== ROLE_BY_USERNAME[user.username]) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(ROLE_BY_USERNAME[user.username], user.id)
    user.role = ROLE_BY_USERNAME[user.username]
    console.log(`[AUTH-FIX] Usuario ${user.username} corregido a rol '${user.role}'`)
  }

  db.prepare('UPDATE users SET failed_attempts = 0, last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id)
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.full_name }, JWT_SECRET, { expiresIn: '8h' })
  res.json({
    token,
    user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role }
  })
  addHistory({ user: { id: user.id, fullName: user.full_name } }, { action: 'login', module: 'Auth', description: `Inicio de sesión: ${user.username}` })
})

router.get('/auth/me', auth, (req, res) => {
  const u = db.prepare('SELECT id, username, full_name, email, role, active, created_at, last_login FROM users WHERE id = ?').get(req.user.id)
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  res.json({ id: u.id, username: u.username, fullName: u.full_name, email: u.email, role: u.role, active: !!u.active, createdAt: u.created_at, lastLogin: u.last_login })
})

// ---------- USERS ----------
router.get('/users', auth, (_req, res) => {
  const rows = db.prepare('SELECT id, username, full_name, email, role, active, created_at, last_login FROM users ORDER BY full_name').all()
  res.json(rows.map(u => ({
    id: u.id, username: u.username, fullName: u.full_name, email: u.email, role: u.role,
    active: !!u.active, createdAt: u.created_at, lastLogin: u.last_login
  })))
})

router.post('/users', auth, requireRole('admin'), (req, res) => {
  const { username, password, fullName, email, role } = req.body
  if (!username || !password || !fullName) return res.status(400).json({ error: 'Datos incompletos' })
  // Only allow 3 roles
  const validRoles = ['admin', 'produccion', 'contabilidad']
  const finalRole = validRoles.includes(role) ? role : 'produccion'
  try {
    const id = uid('u-')
    db.prepare('INSERT INTO users (id, username, password_hash, full_name, email, role, active, created_at) VALUES (?,?,?,?,?,?,1,?)')
      .run(id, username, bcrypt.hashSync(password, 10), fullName, email || '', finalRole, new Date().toISOString())
    addHistory(req, { action: 'crear', module: 'Usuarios', entityId: id, description: `Creado usuario ${username} (${finalRole})` })
    res.json({ id, username, fullName, email, role: finalRole })
  } catch (e) {
    res.status(400).json({ error: 'Usuario ya existe' })
  }
})

router.put('/users/:id', auth, requireRole('admin'), (req, res) => {
  const { id } = req.params
  const { fullName, email, role, active, password } = req.body
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  db.prepare('UPDATE users SET full_name = ?, email = ?, role = ?, active = ? WHERE id = ?')
    .run(fullName || u.full_name, email ?? u.email, role || u.role, active === false ? 0 : 1, id)
  if (password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id)
  addHistory(req, { action: 'modificar', module: 'Usuarios', entityId: id, description: `Modificado usuario ${u.username}`, before: u })
  res.json({ ok: true })
})

router.delete('/users/:id', auth, requireRole('admin'), (req, res) => {
  const { id } = req.params
  if (id === req.user.id) return res.status(400).json({ error: 'No puede eliminarse a sí mismo' })
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  addHistory(req, { action: 'borrar', module: 'Usuarios', entityId: id, description: `Eliminado usuario ${u.username}`, before: u })
  res.json({ ok: true })
})

// ---------- SUPPLIERS ----------
router.get('/suppliers', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all().map(s => ({
    id: s.id, name: s.name, cif: s.cif, email: s.email, phone: s.phone, contact: s.contact, address: s.address, city: s.city, country: s.country
  })))
})
router.post('/suppliers', auth, requireRole('admin', 'contabilidad'), (req, res) => {
  const b = req.body
  const id = uid('s-')
  db.prepare('INSERT INTO suppliers (id, name, cif, email, phone, contact, address, city, country) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, b.name, b.cif || '', b.email || '', b.phone || '', b.contact || '', b.address || '', b.city || '', b.country || 'España')
  addHistory(req, { action: 'crear', module: 'Proveedores', entityId: id, description: `Creado proveedor ${b.name}` })
  res.json({ id })
})
router.put('/suppliers/:id', auth, requireRole('admin', 'contabilidad'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE suppliers SET name=?, cif=?, email=?, phone=?, contact=?, address=?, city=?, country=? WHERE id=?')
    .run(b.name, b.cif, b.email, b.phone, b.contact, b.address, b.city, b.country, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Proveedores', entityId: req.params.id, description: `Modificado proveedor ${b.name}` })
  res.json({ ok: true })
})
router.delete('/suppliers/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id)
  addHistory(req, { action: 'borrar', module: 'Proveedores', entityId: req.params.id, description: 'Proveedor eliminado' })
  res.json({ ok: true })
})

// ---------- RAW MATERIALS ----------
const mapRaw = (r) => ({
  id: r.id, code: r.code, name: r.name, category: r.category, unit: r.unit,
  stock: r.stock, minStock: r.min_stock, maxStock: r.max_stock, price: r.price,
  supplierId: r.supplier_id, location: r.location, expiryDate: r.expiry_date, lot: r.lot, lastUpdated: r.last_updated
})

router.get('/raw-materials', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM raw_materials ORDER BY name').all().map(mapRaw))
})
router.post('/raw-materials', auth, requireRole('admin', 'produccion', 'contabilidad'), (req, res) => {
  const b = req.body
  const id = uid('rm-')
  db.prepare(`INSERT INTO raw_materials (id, code, name, category, unit, stock, min_stock, max_stock, price, supplier_id, location, expiry_date, lot, last_updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, b.code, b.name, b.category, b.unit, b.stock || 0, b.minStock || 0, b.maxStock || 0, b.price || 0, b.supplierId || null, b.location || '', b.expiryDate || null, b.lot || null, new Date().toISOString())
  addHistory(req, { action: 'crear', module: 'Materias Primas', entityId: id, description: `Creada materia prima ${b.name}` })
  res.json({ id })
})
router.put('/raw-materials/:id', auth, requireRole('admin', 'produccion', 'contabilidad'), (req, res) => {
  const b = req.body
  const before = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(req.params.id)
  if (!before) return res.status(404).json({ error: 'No encontrado' })
  db.prepare(`UPDATE raw_materials SET code=?, name=?, category=?, unit=?, min_stock=?, max_stock=?, price=?, supplier_id=?, location=?, expiry_date=?, lot=?, last_updated=? WHERE id=?`)
    .run(b.code, b.name, b.category, b.unit, b.minStock, b.maxStock, b.price, b.supplierId || null, b.location, b.expiryDate || null, b.lot || null, new Date().toISOString(), req.params.id)
  addHistory(req, { action: 'modificar', module: 'Materias Primas', entityId: req.params.id, description: `Modificada materia prima ${b.name}`, before: mapRaw(before), after: b })
  res.json({ ok: true })
})
router.delete('/raw-materials/:id', auth, requireRole('admin'), (req, res) => {
  const before = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(req.params.id)
  db.prepare('DELETE FROM raw_materials WHERE id = ?').run(req.params.id)
  addHistory(req, { action: 'borrar', module: 'Materias Primas', entityId: req.params.id, description: `Eliminada materia prima ${before?.name || ''}`, before: before ? mapRaw(before) : null })
  res.json({ ok: true })
})

// Stock entry (compra / entrada almacén)
router.post('/raw-materials/:id/entry', auth, requireRole('admin', 'contabilidad'), (req, res) => {
  const { quantity, lot, expiryDate, price, invoice } = req.body
  const m = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(req.params.id)
  if (!m) return res.status(404).json({ error: 'No encontrado' })
  const newStock = m.stock + Number(quantity)
  db.prepare('UPDATE raw_materials SET stock = ?, last_updated = ?, lot = COALESCE(?, lot), expiry_date = COALESCE(?, expiry_date), price = COALESCE(?, price) WHERE id = ?')
    .run(newStock, new Date().toISOString(), lot, expiryDate, price, req.params.id)
  addHistory(req, { action: 'compra', module: 'Almacén', entityId: req.params.id, description: `Entrada de ${quantity} ${m.unit} de ${m.name}${invoice ? ' — Factura ' + invoice : ''}` })
  maybeAddStockNotifications()
  res.json({ ok: true, newStock })
})

// ---------- PACKAGING ----------
const mapPkg = (p) => ({
  id: p.id, code: p.code, name: p.name, type: p.type, size: p.size,
  stock: p.stock, minStock: p.min_stock, maxStock: p.max_stock, price: p.price,
  supplierId: p.supplier_id, location: p.location, lastUpdated: p.last_updated
})

router.get('/packaging', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM packaging ORDER BY name').all().map(mapPkg))
})
router.post('/packaging', auth, requireRole('admin', 'produccion', 'contabilidad'), (req, res) => {
  const b = req.body
  const id = uid('pk-')
  db.prepare('INSERT INTO packaging (id, code, name, type, size, stock, min_stock, max_stock, price, supplier_id, location, last_updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, b.code, b.name, b.type, b.size || null, b.stock || 0, b.minStock || 0, b.maxStock || 0, b.price || 0, b.supplierId || null, b.location || '', new Date().toISOString())
  addHistory(req, { action: 'crear', module: 'Embalaje', entityId: id, description: `Creado material ${b.name}` })
  res.json({ id })
})
router.put('/packaging/:id', auth, requireRole('admin', 'produccion', 'contabilidad'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE packaging SET code=?, name=?, type=?, size=?, min_stock=?, max_stock=?, price=?, supplier_id=?, location=?, last_updated=? WHERE id=?')
    .run(b.code, b.name, b.type, b.size || null, b.minStock, b.maxStock, b.price, b.supplierId || null, b.location, new Date().toISOString(), req.params.id)
  addHistory(req, { action: 'modificar', module: 'Embalaje', entityId: req.params.id, description: `Modificado material ${b.name}` })
  res.json({ ok: true })
})
router.delete('/packaging/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM packaging WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})
router.post('/packaging/:id/entry', auth, requireRole('admin', 'contabilidad'), (req, res) => {
  const { quantity, price, invoice } = req.body
  const m = db.prepare('SELECT * FROM packaging WHERE id = ?').get(req.params.id)
  if (!m) return res.status(404).json({ error: 'No encontrado' })
  db.prepare('UPDATE packaging SET stock = stock + ?, last_updated = ?, price = COALESCE(?, price) WHERE id = ?')
    .run(Number(quantity), new Date().toISOString(), price, req.params.id)
  addHistory(req, { action: 'compra', module: 'Almacén', entityId: req.params.id, description: `Entrada de ${quantity} ud de ${m.name}${invoice ? ' — Factura ' + invoice : ''}` })
  maybeAddStockNotifications()
  res.json({ ok: true })
})

// ---------- PRODUCTS ----------
const mapProd = (p) => ({
  id: p.id, code: p.code, name: p.name, description: p.description, category: p.category,
  bottleSize: p.bottle_size, stock: p.stock, minStock: p.min_stock, maxStock: p.max_stock,
  price: p.price, cost: p.cost, recipeId: p.recipe_id, active: !!p.active
})

router.get('/products', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY name').all().map(mapProd))
})
router.post('/products', auth, requireRole('admin'), (req, res) => {
  const b = req.body
  const id = uid('pr-')
  db.prepare('INSERT INTO products (id, code, name, description, category, bottle_size, stock, min_stock, max_stock, price, cost, recipe_id, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)')
    .run(id, b.code, b.name, b.description || '', b.category || 'General', b.bottleSize, b.stock || 0, b.minStock || 0, b.maxStock || 0, b.price || 0, b.cost || 0, b.recipeId || null)
  addHistory(req, { action: 'crear', module: 'Productos', entityId: id, description: `Creado producto ${b.name}` })
  res.json({ id })
})
router.put('/products/:id', auth, requireRole('admin'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE products SET code=?, name=?, description=?, category=?, bottle_size=?, min_stock=?, max_stock=?, price=?, cost=?, recipe_id=?, active=? WHERE id=?')
    .run(b.code, b.name, b.description, b.category, b.bottleSize, b.minStock, b.maxStock, b.price, b.cost, b.recipeId || null, b.active === false ? 0 : 1, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Productos', entityId: req.params.id, description: `Modificado producto ${b.name}` })
  res.json({ ok: true })
})
router.delete('/products/:id', auth, requireRole('admin'), (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
    // Comprobar si tiene recetas o lotes asociados
    const recipes = db.prepare('SELECT COUNT(*) c FROM recipes WHERE product_id = ?').get(req.params.id).c
    const lots = db.prepare('SELECT COUNT(*) c FROM lots WHERE product_id = ?').get(req.params.id).c
    if (recipes > 0 || lots > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar: tiene ${recipes} receta(s) y ${lots} lote(s) asociado(s). Elimina primero esos registros.` 
      })
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id)
    addHistory(req, { action: 'eliminar', module: 'Productos', entityId: req.params.id, description: `Eliminado producto ${product.name}` })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar: ' + e.message })
  }
})

// ---------- RECIPES ----------
const mapRec = (r) => ({
  id: r.id, productId: r.product_id, bottleSize: r.bottle_size,
  bottlesPerBox: r.bottles_per_box, boxesPerPallet: r.boxes_per_pallet,
  yieldPerLiter: r.yield_per_liter,
  batchSize: r.batch_size ?? 1000,
  items: JSON.parse(r.items_json || '[]'),
  updatedAt: r.updated_at
})

router.get('/recipes', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM recipes ORDER BY product_id').all().map(mapRec))
})
router.get('/recipes/:id', auth, (req, res) => {
  const r = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'No encontrado' })
  res.json(mapRec(r))
})
router.post('/recipes', auth, requireRole('admin', 'produccion'), (req, res) => {
  const b = req.body
  const id = uid('rc-')
  const batchSize = Number(b.batchSize) || 1000
  db.prepare('INSERT INTO recipes (id, product_id, bottle_size, bottles_per_box, boxes_per_pallet, yield_per_liter, batch_size, items_json, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, b.productId, b.bottleSize || 0, b.bottlesPerBox || 0, b.boxesPerPallet || 0, b.yieldPerLiter || 0, batchSize, JSON.stringify(b.items || []), new Date().toISOString())
  addHistory(req, { action: 'crear', module: 'Recetas', entityId: id, description: `Creada receta (lote de ${batchSize}L) para producto ${b.productId}` })
  res.json({ id })
})
router.put('/recipes/:id', auth, requireRole('admin', 'produccion'), (req, res) => {
  const b = req.body
  const batchSize = Number(b.batchSize) || 1000
  db.prepare('UPDATE recipes SET bottle_size=?, bottles_per_box=?, boxes_per_pallet=?, yield_per_liter=?, batch_size=?, items_json=?, updated_at=? WHERE id=?')
    .run(b.bottleSize || 0, b.bottlesPerBox || 0, b.boxesPerPallet || 0, b.yieldPerLiter || 0, batchSize, JSON.stringify(b.items || []), new Date().toISOString(), req.params.id)
  addHistory(req, { action: 'modificar', module: 'Recetas', entityId: req.params.id, description: `Modificada receta (lote de ${batchSize}L)` })
  res.json({ ok: true })
})
router.delete('/recipes/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })

// DELETE /api/lots/:id — eliminar fabricación (SOLO ADMIN)
router.delete('/lots/:id', auth, requireRole('admin'), (req, res) => {
  const lot = db.prepare('SELECT * FROM lots WHERE id = ?').get(req.params.id)
  if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
  const tx = db.transaction(() => {
    // Devolver el stock de las materias primas consumidas
    const items = JSON.parse(lot.raw_materials_json || '[]')
    for (const it of items) {
      if (it.materialType === 'raw') {
        db.prepare('UPDATE raw_materials SET stock = stock + ?, last_updated = ? WHERE id = ?').run(it.quantity || 0, new Date().toISOString(), it.materialId)
      } else if (it.materialType === 'packaging') {
        db.prepare('UPDATE packaging SET stock = stock + ?, last_updated = ? WHERE id = ?').run(it.quantity || 0, new Date().toISOString(), it.materialId)
      }
    }
    // Restar del stock del producto (si se sumó al fabricar)
    if (lot.status === 'completado') {
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(lot.quantity || 0, lot.product_id)
    }
    // Borrar notificaciones relacionadas
    db.prepare("DELETE FROM notifications WHERE related_id = ?").run('lot:' + req.params.id)
    // Borrar el lote
    db.prepare('DELETE FROM lots WHERE id = ?').run(req.params.id)
  })
  tx()
  addHistory(req, { 
    action: 'eliminar', 
    module: 'Producción', 
    entityId: req.params.id, 
    description: `Eliminado lote ${lot.lot_number} (producto ${lot.product_id}, cantidad ${lot.quantity}L)` 
  })
  res.json({ ok: true, id: req.params.id, message: 'Lote eliminado y stock devuelto' })
})

})

// ---------- CUSTOMERS ----------
const mapCust = (c) => ({
  id: c.id, code: c.code, name: c.name, company: c.company, cif: c.cif,
  address: c.address, city: c.city, country: c.country, phone: c.phone,
  email: c.email, contact: c.contact, notes: c.notes,
  totalPurchases: c.total_purchases, createdAt: c.created_at
})

router.get('/customers', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM customers ORDER BY name').all().map(mapCust))
})
router.post('/customers', auth, requireRole('admin', 'comercial'), (req, res) => {
  const b = req.body
  const id = uid('c-')
  const code = b.code || `C-${String(db.prepare('SELECT COUNT(*) c FROM customers').get().c + 1).padStart(3, '0')}`
  db.prepare('INSERT INTO customers (id, code, name, company, cif, address, city, country, phone, email, contact, notes, total_purchases, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)')
    .run(id, code, b.name, b.company || '', b.cif || '', b.address || '', b.city || '', b.country || 'España', b.phone || '', b.email || '', b.contact || '', b.notes || '', new Date().toISOString())
  addHistory(req, { action: 'crear', module: 'Clientes', entityId: id, description: `Creado cliente ${b.name}` })
  res.json({ id })
})
router.put('/customers/:id', auth, requireRole('admin', 'comercial'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE customers SET code=?, name=?, company=?, cif=?, address=?, city=?, country=?, phone=?, email=?, contact=?, notes=? WHERE id=?')
    .run(b.code, b.name, b.company, b.cif, b.address, b.city, b.country, b.phone, b.email, b.contact, b.notes, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Clientes', entityId: req.params.id, description: `Modificado cliente ${b.name}` })
  res.json({ ok: true })
})
router.delete('/customers/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- ORDERS ----------
const mapOrder = (o) => ({
  id: o.id, number: o.number, customerId: o.customer_id, items: JSON.parse(o.items_json || '[]'),
  subtotal: o.subtotal, tax: o.tax, discount: o.discount, total: o.total,
  status: o.status, createdAt: o.created_at, deliveryDate: o.delivery_date, notes: o.notes, createdBy: o.created_by
})

router.get('/orders', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(mapOrder))
})
router.post('/orders', auth, requireRole('admin', 'comercial'), (req, res) => {
  const b = req.body
  const id = uid('o-')
  const count = db.prepare("SELECT COUNT(*) c FROM orders WHERE number LIKE 'PED-%'").get().c
  const number = b.number || `PED-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
  db.prepare('INSERT INTO orders (id, number, customer_id, items_json, subtotal, tax, discount, total, status, created_at, delivery_date, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, number, b.customerId, JSON.stringify(b.items || []), b.subtotal || 0, b.tax || 0, b.discount || 0, b.total || 0, b.status || 'pendiente', new Date().toISOString(), b.deliveryDate || null, b.notes || null, req.user.id)
  addHistory(req, { action: 'crear', module: 'Pedidos', entityId: id, description: `Creado pedido ${number}` })
  // add notification
  db.prepare('INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,0,?,?)')
    .run(uid('n-'), 'pedido', 'Nuevo pedido', `Pedido ${number} creado por ${req.user.fullName}`, 'info', new Date().toISOString(), 'order:'+id)
  res.json({ id, number })
})
router.put('/orders/:id', auth, requireRole('admin', 'comercial', 'produccion'), (req, res) => {
  const b = req.body
  const before = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!before) return res.status(404).json({ error: 'No encontrado' })
  // if changing to 'confirmado' from pendiente and was not confirmed before, deduct stock
  const newStatus = b.status || before.status
  let touched = false
  const deductStock = (order) => {
    const items = JSON.parse(order.items_json)
    for (const it of items) {
      // Mirar stock actual del producto
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(it.productId)
      const requested = it.quantity
      const available = prod ? prod.stock : 0
      if (available >= requested) {
        // Hay suficiente: descontar directamente
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(requested, it.productId)
      } else {
        // No hay suficiente: descontar lo que haya (sin negativos) y crear production_order por la diferencia
        if (available > 0) {
          db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(it.productId)
        }
        const falta = requested - available
        // Crear production_order pendiente para cubrir lo que falta
        const poId = uid('po-')
        const poCount = db.prepare("SELECT COUNT(*) c FROM production_orders WHERE number LIKE 'OP-%'").get().c
        const poNumber = `OP-${new Date().getFullYear()}-${String(poCount + 1).padStart(4, '0')}`
        const recipe = db.prepare('SELECT * FROM recipes WHERE product_id = ?').get(it.productId)
        db.prepare(`INSERT INTO production_orders (id, number, product_id, recipe_id, quantity, status, pedido_id, notes, created_by, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .run(poId, poNumber, it.productId, recipe ? recipe.id : null, falta, 'pendiente', order.id, `Auto-creada por pedido: ${order.number}`, req.user.id, new Date().toISOString())
        addHistory(req, { action: 'crear', module: 'Producción', entityId: poId, description: `Auto-creada OP ${poNumber} (${falta} L) por pedido ${order.number} - stock insuficiente` })
        // Notificación
        db.prepare('INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,0,?,?)')
          .run(uid('n-'), 'produccion', 'Producción pendiente', `Faltan ${falta} L de ${prod?.name || it.productId} - OP ${poNumber}`, 'warning', new Date().toISOString(), 'po:'+poId)
      }
      touched = true
    }
    db.prepare('UPDATE customers SET total_purchases = total_purchases + ? WHERE id = ?').run(order.total, order.customer_id)
  }
  if (newStatus === 'confirmado' && before.status !== 'confirmado' && before.status !== 'entregado' && before.status !== 'cancelado') {
    deductStock(before)
  }
  db.prepare('UPDATE orders SET customer_id=?, items_json=?, subtotal=?, tax=?, discount=?, total=?, status=?, delivery_date=?, notes=? WHERE id=?')
    .run(b.customerId || before.customer_id, JSON.stringify(b.items || JSON.parse(before.items_json)), b.subtotal ?? before.subtotal, b.tax ?? before.tax, b.discount ?? before.discount, b.total ?? before.total, newStatus, b.deliveryDate ?? before.delivery_date, b.notes ?? before.notes, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Pedidos', entityId: req.params.id, description: `Pedido ${before.number} → ${newStatus}${touched ? ' (stock descontado)' : ''}`, before: mapOrder(before) })
  if (touched) maybeAddStockNotifications()
  res.json({ ok: true })
})
router.delete('/orders/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- PRODUCTION ORDERS ----------
const mapProductionOrder = (o) => o ? ({
  id: o.id,
  number: o.number,
  productId: o.product_id,
  recipeId: o.recipe_id,
  quantity: o.quantity,
  status: o.status,
  pedidoId: o.pedido_id,
  notes: o.notes,
  createdBy: o.created_by,
  createdAt: o.created_at,
  startedAt: o.started_at,
  finishedAt: o.finished_at,
}) : null

// Listar todas las ordenes de fabricacion
router.get('/production-orders', auth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM production_orders ORDER BY created_at DESC').all()
  res.json(rows.map(mapProductionOrder))
})

// Crear una orden de fabricacion manual
router.post('/production-orders', auth, requireRole('admin', 'produccion'), (req, res) => {
  const b = req.body
  if (!b.productId) return res.status(400).json({ error: 'Falta productId' })
  if (!b.quantity || b.quantity <= 0) return res.status(400).json({ error: 'Cantidad inválida' })
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(b.productId)
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
  // Auto-buscar receta para este producto
  const recipe = db.prepare('SELECT * FROM recipes WHERE product_id = ?').get(b.productId)
  const id = uid('po-')
  const count = db.prepare("SELECT COUNT(*) c FROM production_orders WHERE number LIKE 'OP-%'").get().c
  const number = b.number || `OP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
  db.prepare(`INSERT INTO production_orders (id, number, product_id, recipe_id, quantity, status, pedido_id, notes, created_by, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, number, b.productId, recipe ? recipe.id : null, b.quantity, b.status || 'pendiente', b.pedidoId || null, b.notes || null, req.user.id, new Date().toISOString())
  addHistory(req, { action: 'crear', module: 'Producción', entityId: id, description: `Creada orden de fabricación ${number} (${b.quantity} L de ${product.name})` })
  const created = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(id)
  res.json(mapProductionOrder(created))
})

// Confirmar fabricacion: pendiente -> en_proceso
router.patch('/production-orders/:id/start', auth, requireRole('admin', 'produccion'), (req, res) => {
  const o = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'No encontrado' })
  if (o.status !== 'pendiente') return res.status(400).json({ error: `No se puede iniciar una orden en estado '${o.status}'` })
  db.prepare(`UPDATE production_orders SET status = 'en_proceso', started_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), req.params.id)
  addHistory(req, { action: 'modificar', module: 'Producción', entityId: o.id, description: `Orden ${o.number} → en_proceso` })
  const updated = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id)
  res.json(mapProductionOrder(updated))
})

// Marcar como acabada: en_proceso -> acabada, descuenta MPs y suma stock producto
router.patch('/production-orders/:id/complete', auth, requireRole('admin', 'produccion'), (req, res) => {
  const o = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'No encontrado' })
  if (o.status !== 'en_proceso') return res.status(400).json({ error: `Solo se pueden completar ordenes en_proceso (actual: '${o.status}')` })
  const recipe = o.recipe_id ? db.prepare('SELECT * FROM recipes WHERE id = ?').get(o.recipe_id) : null
  if (!recipe) return res.status(400).json({ error: 'La orden no tiene receta asociada' })
  const items = JSON.parse(recipe.items_json || '[]')
  const recipeBatch = recipe.batch_size || 1000
  const ratio = o.quantity / recipeBatch
  // Descontar materias primas / envases
  for (const it of items) {
    const total = it.quantity * ratio
    if (it.materialType === 'raw') {
      db.prepare('UPDATE raw_materials SET stock = stock - ? WHERE id = ?').run(total, it.materialId)
    } else if (it.materialType === 'packaging') {
      db.prepare('UPDATE packaging SET stock = stock - ? WHERE id = ?').run(total, it.materialId)
    }
  }
  // Sumar al stock del producto terminado
  db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(o.quantity, o.product_id)
  // Marcar como acabada
  db.prepare(`UPDATE production_orders SET status = 'acabada', finished_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), o.id)
  addHistory(req, { action: 'modificar', module: 'Producción', entityId: o.id, description: `Orden ${o.number} → acabada (${o.quantity} L fabricados)` })
  const updated = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(o.id)
  res.json(mapProductionOrder(updated))
})

// Borrar orden de fabricacion
router.delete('/production-orders/:id', auth, requireRole('admin'), (req, res) => {
  const o = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id)
  if (!o) return res.status(404).json({ error: 'No encontrado' })
  if (o.status === 'en_proceso') return res.status(400).json({ error: 'No se puede borrar una orden en_proceso' })
  db.prepare('DELETE FROM production_orders WHERE id = ?').run(req.params.id)
  addHistory(req, { action: 'borrar', module: 'Producción', entityId: o.id, description: `Borrada orden ${o.number}` })
  res.json({ ok: true })
})

// ---------- PURCHASES ----------
const mapPurch = (p) => ({
  id: p.id, number: p.number, supplierId: p.supplier_id, invoice: p.invoice, items: JSON.parse(p.items_json || '[]'),
  subtotal: p.subtotal, tax: p.tax, total: p.total, status: p.status, date: p.date, notes: p.notes
})

router.get('/purchases', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM purchases ORDER BY date DESC').all().map(mapPurch))
})
router.post('/purchases', auth, requireRole('admin', 'contabilidad', 'almacen'), (req, res) => {
  const b = req.body
  const id = uid('pu-')
  const count = db.prepare('SELECT COUNT(*) c FROM purchases').get().c
  const number = b.number || `C-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
  db.prepare('INSERT INTO purchases (id, number, supplier_id, invoice, items_json, subtotal, tax, total, status, date, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, number, b.supplierId, b.invoice || '', JSON.stringify(b.items || []), b.subtotal || 0, b.tax || 0, b.total || 0, b.status || 'recibida', b.date || new Date().toISOString(), b.notes || null)
  // auto-update stock if status recibida
  if ((b.status || 'recibida') === 'recibida') {
    for (const it of b.items || []) {
      if (it.materialType === 'raw') db.prepare('UPDATE raw_materials SET stock = stock + ?, last_updated = ? WHERE id = ?').run(it.quantity, new Date().toISOString(), it.materialId)
      else db.prepare('UPDATE packaging SET stock = stock + ?, last_updated = ? WHERE id = ?').run(it.quantity, new Date().toISOString(), it.materialId)
    }
    maybeAddStockNotifications()
  }
  addHistory(req, { action: 'compra', module: 'Compras', entityId: id, description: `Compra ${number} — Factura ${b.invoice || 's/f'}` })
  res.json({ id, number })
})
router.put('/purchases/:id', auth, requireRole('admin', 'contabilidad', 'almacen'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE purchases SET supplier_id=?, invoice=?, items_json=?, subtotal=?, tax=?, total=?, status=?, date=?, notes=? WHERE id=?')
    .run(b.supplierId, b.invoice, JSON.stringify(b.items || []), b.subtotal, b.tax, b.total, b.status, b.date, b.notes, req.params.id)
  res.json({ ok: true })
})
router.delete('/purchases/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- EXPENSES ----------
const mapExp = (e) => ({ id: e.id, date: e.date, category: e.category, amount: e.amount, description: e.description, attachment: e.attachment, createdBy: e.created_by })

router.get('/expenses', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC').all().map(mapExp))
})
router.post('/expenses', auth, requireRole('admin', 'contabilidad'), (req, res) => {
  const b = req.body
  const id = uid('e-')
  db.prepare('INSERT INTO expenses (id, date, category, amount, description, attachment, created_by) VALUES (?,?,?,?,?,?,?)')
    .run(id, b.date || new Date().toISOString(), b.category, b.amount, b.description || '', b.attachment || null, req.user.id)
  addHistory(req, { action: 'crear', module: 'Gastos', entityId: id, description: `Gasto de ${b.category}: ${b.amount}€` })
  res.json({ id })
})
router.put('/expenses/:id', auth, requireRole('admin', 'contabilidad'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE expenses SET date=?, category=?, amount=?, description=?, attachment=? WHERE id=?')
    .run(b.date, b.category, b.amount, b.description, b.attachment, req.params.id)
  res.json({ ok: true })
})
router.delete('/expenses/:id', auth, requireRole('admin', 'contabilidad'), (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- LOTS ----------
const mapLot = (l) => ({
  id: l.id,
  lotNumber: l.lot_number,
  productionOrderNumber: l.production_order_number || '',
  productId: l.product_id,
  recipeId: l.recipe_id || '',
  quantity: l.quantity || 0,
  rawMaterialsUsed: JSON.parse(l.raw_materials_json || '[]'),
  producedBy: l.produced_by,
  machineId: l.machine_id || undefined,
  producedAt: l.produced_at,
  expiryDate: l.expiry_date || undefined,
  status: l.status,
  notes: l.notes
})

function mapUser(u) {
  let permissions = null
  try { permissions = u.permissions ? JSON.parse(u.permissions) : null } catch {}
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    email: u.email || '',
    role: u.role,
    active: !!u.active,
    failedAttempts: u.failed_attempts || 0,
    createdAt: u.created_at,
    lastLogin: u.last_login,
    permissions
  }
}

function hasPermission(user, module, action) {
  if (user && user.role === 'admin') return true
  if (!user || !user.permissions) return false
  const perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
  if (!perms || !perms[module]) return false
  return perms[module][action] === true
}

function requirePermission(module, action) {
  return (req, res, next) => {
    if (!hasPermission(req.user, module, action)) {
      return res.status(403).json({ error: `No tiene permiso para ${action} en ${module}` })
    }
    next()
  }
}

router.get('/lots', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM lots ORDER BY produced_at DESC').all().map(mapLot))
})
// GET /api/lots/preview-number — previsualizar el próximo número de lote (sin crear)
router.get('/lots/preview-number', auth, (_req, res) => {
  const { lotNumber, productionOrderNumber } = nextProductionNumbers()
  res.json({ lotNumber, productionOrderNumber })
})

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

// ---------- USER MANAGEMENT (admin) ----------
router.post('/users', auth, requirePermission('users', 'create'), (req, res) => {
  const { username, password, fullName, email, role, permissions } = req.body || {}
  if (!username || !password || !fullName) return res.status(400).json({ error: 'Faltan campos requeridos (username, password, fullName)' })
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return res.status(409).json({ error: 'El nombre de usuario ya existe' })
  const id = uid('u-')
  const hash = bcrypt.hashSync(password, 10)
  const permsJson = permissions ? JSON.stringify(permissions) : null
  db.prepare('INSERT INTO users (id, username, password_hash, full_name, email, role, active, created_at, last_login, permissions) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?)')
    .run(id, username, hash, fullName, email || '', role || 'operario', new Date().toISOString(), permsJson)
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  addHistory(req, { action: 'crear', module: 'Usuarios', entityId: id, description: `Usuario creado: ${username} (${role || 'operario'})` })
  res.json(mapUser(u))
})

router.put('/users/:id', auth, requirePermission('users', 'edit'), (req, res) => {
  const { fullName, email, role, username } = req.body || {}
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (u.id === req.user.id && role && role !== 'admin') {
    return res.status(400).json({ error: 'No puedes cambiarte tu propio rol de admin' })
  }
  db.prepare('UPDATE users SET full_name = ?, email = ?, role = ?, username = COALESCE(?, username) WHERE id = ?')
    .run(fullName || u.full_name, email !== undefined ? email : u.email, role || u.role, username || null, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Usuarios', entityId: u.id, description: `Usuario modificado: ${u.username}` })
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  res.json(mapUser(updated))
})

router.put('/users/:id/status', auth, requirePermission('users', 'edit'), (req, res) => {
  const { active } = req.body || {}
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (u.id === req.user.id && !active) {
    return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' })
  }
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id)
  addHistory(req, { action: active ? 'activar' : 'desactivar', module: 'Usuarios', entityId: u.id, description: `Usuario ${active ? 'activado' : 'desactivado'}: ${u.username}` })
  res.json({ ok: true, active: !!active })
})

router.put('/users/:id/password', auth, (req, res) => {
  const { newPassword, currentPassword } = req.body || {}
  if (!newPassword) return res.status(400).json({ error: 'Falta newPassword' })
  if (newPassword.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' })
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (req.user.role !== 'admin' && req.user.id !== u.id) {
    return res.status(403).json({ error: 'No tiene permisos para cambiar esta contraseña' })
  }
  if (req.user.id === u.id && req.user.role !== 'admin') {
    if (!currentPassword) return res.status(400).json({ error: 'Falta currentPassword' })
    if (!bcrypt.compareSync(currentPassword, u.password_hash)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    }
  }
  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ?, failed_attempts = 0 WHERE id = ?').run(hash, req.params.id)
  addHistory(req, { action: 'cambiar_password', module: 'Usuarios', entityId: u.id, description: `Contraseña cambiada para: ${u.username}` })
  res.json({ ok: true })
})

router.put('/users/:id/permissions', auth, requirePermission('users', 'edit'), (req, res) => {
  const { permissions } = req.body || {}
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' })
  const permsJson = permissions ? JSON.stringify(permissions) : null
  db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(permsJson, req.params.id)
  addHistory(req, { action: 'modificar_permisos', module: 'Usuarios', entityId: u.id, description: `Permisos modificados para: ${u.username}` })
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  res.json(mapUser(updated))
})

router.delete('/users/:id', auth, requirePermission('users', 'delete'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (u.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' })
  if (u.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get().c
    if (adminCount <= 1) return res.status(400).json({ error: 'No se puede eliminar al último admin activo' })
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  addHistory(req, { action: 'eliminar', module: 'Usuarios', entityId: u.id, description: `Usuario eliminado: ${u.username}` })
  res.json({ ok: true })
})

router.get('/permissions/defaults', auth, requirePermission('users', 'view'), (_req, res) => {
  res.json({
    modules: [
      { key: 'home', label: 'Inicio' },
      { key: 'raw_materials', label: 'Materias primas' },
      { key: 'recipes', label: 'Recetas' },
      { key: 'production', label: 'Producción' },
      { key: 'lots', label: 'Lotes' },
      { key: 'customers', label: 'Clientes' },
      { key: 'sales', label: 'Ventas/Pedidos' },
      { key: 'inventory', label: 'Inventario' },
      { key: 'accounting', label: 'Contabilidad' },
      { key: 'reports', label: 'Informes' },
      { key: 'users', label: 'Usuarios' },
      { key: 'settings', label: 'Configuración' },
      { key: 'recalls', label: 'Retiradas' },
      { key: 'packaging', label: 'Embalaje' },
    ],
    actions: [
      { key: 'view', label: 'Ver' },
      { key: 'create', label: 'Crear' },
      { key: 'edit', label: 'Editar' },
      { key: 'delete', label: 'Eliminar' },
    ]
  })
})

// ---------- RECALLS (retiradas) ----------
router.get('/recalls', auth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM recalls ORDER BY date DESC, id DESC').all();
  res.json(rows);
});

router.post('/recalls', auth, (req, res) => {
  const b = req.body || {};
  const { productId, lotNumber, reason, quantity, status, reportedBy, date, notes } = b;
  if (!productId) return res.status(400).json({ error: 'Falta productId' });
  if (!reason) return res.status(400).json({ error: 'Falta reason' });
  const id = uid('rc-');
  db.prepare(`INSERT INTO recalls (id, product_id, lot_number, reason, quantity, status, reported_by, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, productId, lotNumber || null, reason, quantity || 0, status || 'investigating', reportedBy || null, date || new Date().toISOString().split('T')[0], notes || null);
  addHistory({ user: req.user }, { action: 'crear', module: 'Retiradas', entityId: id, description: `Retirada creada: ${reason}` });
  res.json({ id, ok: true });
});

router.put('/recalls/:id', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM recalls WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'No encontrado' });
  const b = req.body || {};
  db.prepare(`UPDATE recalls SET status = COALESCE(?, status), notes = COALESCE(?, notes), reason = COALESCE(?, reason) WHERE id = ?`)
    .run(b.status || null, b.notes || null, b.reason || null, req.params.id);
  res.json({ ok: true });
});

router.delete('/recalls/:id', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM recalls WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'No encontrado' });
  db.prepare('DELETE FROM recalls WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

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
// Force re-deploy: 1786565523.3838074

// Force re-deploy: 1786565670.8531992

// Final: 1786565957.2081718

// Force: 1786567748.5123284

// Recalls deployed: 1786753297.943492
