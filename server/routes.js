
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
  let userPerms = null
  try { userPerms = user.permissions ? JSON.parse(user.permissions) : null } catch {}
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.full_name, permissions: userPerms }, JWT_SECRET, { expiresIn: '8h' })
  res.json({
    token,
    user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role, permissions: userPerms }
  })
  addHistory({ user: { id: user.id, fullName: user.full_name } }, { action: 'login', module: 'Auth', description: `Inicio de sesión: ${user.username}` })
})

router.get('/auth/me', auth, (req, res) => {
  const u = db.prepare('SELECT id, username, full_name, email, role, active, created_at, last_login, permissions FROM users WHERE id = ?').get(req.user.id)
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  let perms = null
  try { perms = u.permissions ? JSON.parse(u.permissions) : null } catch {}
  res.json({ id: u.id, username: u.username, fullName: u.full_name, email: u.email, role: u.role, active: !!u.active, createdAt: u.created_at, lastLogin: u.last_login, permissions: perms })
})

// ---------- USERS ----------
router.get('/users', auth, requirePermission('users', 'view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY full_name').all()
  res.json(rows.map(mapUser))
})

router.post('/users', auth, requirePermission('users', 'create'), (req, res) => {
  const { username, password, fullName, email, role, permissions } = req.body
  if (!username || !password || !fullName) return res.status(400).json({ error: 'Datos incompletos' })
  // Only allow 3 roles
  const validRoles = ['admin', 'produccion', 'contabilidad']
  const finalRole = validRoles.includes(role) ? role : 'produccion'
  try {
    const id = uid('u-')
    // Permisos: si se pasan, se usan; si no, se asignan los del rol
    const finalPerms = permissions || getDefaultPermsForRole(finalRole)
    const permsJson = finalPerms ? JSON.stringify(finalPerms) : null
    db.prepare('INSERT INTO users (id, username, password_hash, full_name, email, role, active, created_at, permissions) VALUES (?,?,?,?,?,?,1,?,?)')
      .run(id, username, bcrypt.hashSync(password, 10), fullName, email || '', finalRole, new Date().toISOString(), permsJson)
    addHistory(req, { action: 'crear', module: 'Usuarios', entityId: id, description: `Creado usuario ${username} (${finalRole})` })
    res.json({ id, username, fullName, email, role: finalRole, permissions: finalPerms })
  } catch (e) {
    res.status(400).json({ error: 'Usuario ya existe' })
  }
})

router.put('/users/:id', auth, requirePermission('users', 'edit'), (req, res) => {
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

router.delete('/users/:id', auth, requirePermission('users', 'delete'), (req, res) => {
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
router.post('/suppliers', auth, requirePermission('suppliers', 'create'), (req, res) => {
  const b = req.body
  const id = uid('s-')
  db.prepare('INSERT INTO suppliers (id, name, cif, email, phone, contact, address, city, country) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, b.name, b.cif || '', b.email || '', b.phone || '', b.contact || '', b.address || '', b.city || '', b.country || 'España')
  addHistory(req, { action: 'crear', module: 'Proveedores', entityId: id, description: `Creado proveedor ${b.name}` })
  res.json({ id })
})
router.put('/suppliers/:id', auth, requirePermission('suppliers', 'edit'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE suppliers SET name=?, cif=?, email=?, phone=?, contact=?, address=?, city=?, country=? WHERE id=?')
    .run(b.name, b.cif, b.email, b.phone, b.contact, b.address, b.city, b.country, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Proveedores', entityId: req.params.id, description: `Modificado proveedor ${b.name}` })
  res.json({ ok: true })
})
router.delete('/suppliers/:id', auth, requirePermission('suppliers', 'delete'), (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id)
  addHistory(req, { action: 'borrar', module: 'Proveedores', entityId: req.params.id, description: 'Proveedor eliminado' })
  res.json({ ok: true })
})

// ---------- RAW MATERIALS ----------
const mapRaw = (r) => ({
  id: r.id, code: r.code, name: r.name, category: r.category, unit: r.unit,
  stock: r.stock, minStock: r.min_stock, maxStock: r.max_stock, price: r.price,
  supplierId: r.supplier_id, location: r.location, expiryDate: r.expiry_date, lot: r.lot, lastUpdated: r.last_updated,
  entryNumber: r.entry_number || null
})

router.get('/raw-materials', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM raw_materials ORDER BY name').all().map(mapRaw))
})
router.post('/raw-materials', auth, requirePermission('raw_materials', 'create'), (req, res) => {
  const b = req.body
  const id = uid('rm-')
  const count = db.prepare('SELECT COUNT(*) c FROM raw_materials').get().c
  const entryNumber = count + 1
  const code = b.code || `MP ${entryNumber}`
  db.prepare(`INSERT INTO raw_materials (id, code, name, category, unit, stock, min_stock, max_stock, price, supplier_id, location, expiry_date, lot, last_updated, entry_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, code, b.name, b.category || 'General', b.unit, b.stock || 0, b.minStock || 0, b.maxStock || 0, b.price || 0, b.supplierId || null, b.location || '', b.expiryDate || null, b.lot || null, new Date().toISOString(), entryNumber)
  addHistory(req, { action: 'crear', module: 'Materias Primas', entityId: id, description: `Creada materia prima ${b.name} (${code})` })
  res.json({ id, code, entryNumber })
})
router.put('/raw-materials/:id', auth, requirePermission('raw_materials', 'edit'), (req, res) => {
  const b = req.body
  const before = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(req.params.id)
  if (!before) return res.status(404).json({ error: 'No encontrado' })
  db.prepare(`UPDATE raw_materials SET code=?, name=?, category=?, unit=?, min_stock=?, max_stock=?, price=?, supplier_id=?, location=?, expiry_date=?, lot=?, last_updated=? WHERE id=?`)
    .run(b.code, b.name, b.category, b.unit, b.minStock, b.maxStock, b.price, b.supplierId || null, b.location, b.expiryDate || null, b.lot || null, new Date().toISOString(), req.params.id)
  addHistory(req, { action: 'modificar', module: 'Materias Primas', entityId: req.params.id, description: `Modificada materia prima ${b.name}`, before: mapRaw(before), after: b })
  res.json({ ok: true })
})
router.delete('/raw-materials/:id', auth, requirePermission('raw_materials', 'delete'), (req, res) => {
  const before = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(req.params.id)
  db.prepare('DELETE FROM raw_materials WHERE id = ?').run(req.params.id)
  addHistory(req, { action: 'borrar', module: 'Materias Primas', entityId: req.params.id, description: `Eliminada materia prima ${before?.name || ''}`, before: before ? mapRaw(before) : null })
  res.json({ ok: true })
})

// Stock entry (compra / entrada almacén)
router.post('/raw-materials/:id/entry', auth, requirePermission('purchases', 'create'), (req, res) => {
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
  supplierId: p.supplier_id, location: p.location, lastUpdated: p.last_updated,
  entryNumber: p.entry_number || null
})

router.get('/packaging', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM packaging ORDER BY entry_number ASC, id ASC').all().map(mapPkg))
})
router.post('/packaging', auth, requirePermission('packaging', 'create'), (req, res) => {
  const b = req.body
  const id = uid('pk-')
  const count = db.prepare('SELECT COUNT(*) c FROM packaging').get().c
  const entryNumber = count + 1
  const code = b.code || `PK${entryNumber}`
  let name = b.name
  if (!name && b.size) {
    const typeLabel = (b.type || 'Botella')
    name = `${typeLabel} ${b.size}`
  } else if (!name) {
    name = `PK${entryNumber}`
  }
  // Auto-clasificar: envase vs embalaje
  let category = b.category
  if (!category) {
    const nameLower = name.toLowerCase()
    const typeLower = (b.type || '').toLowerCase()
    category = /caja|pal[ée]s?|pallet|film|separador|cinta|burbuja|bolsa|cart[oó]n|wrap|stretch/.test(nameLower) ||
               /caja|pal[ée]s?|pallet/.test(typeLower) ? 'embalaje' : 'envase'
  }
  db.prepare(`INSERT INTO packaging (id, code, name, type, size, stock, min_stock, max_stock, price, supplier_id, location, last_updated, entry_number, category) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, code, name, b.type || 'Botella', b.size || null, b.stock || 0, b.minStock || 0, b.maxStock || 0, b.price || 0, b.supplierId || null, b.location || '', new Date().toISOString(), entryNumber, category)
  addHistory(req, { action: 'crear', module: category === 'embalaje' ? 'Embalaje' : 'Envase', entityId: id, description: `Creado ${category} ${name} (${code})` })
  res.json({ id, code, name, entryNumber, category })
})
router.put('/packaging/:id', auth, requirePermission('packaging', 'edit'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE packaging SET code=?, name=?, type=?, size=?, min_stock=?, max_stock=?, price=?, supplier_id=?, location=?, last_updated=? WHERE id=?')
    .run(b.code, b.name, b.type, b.size || null, b.minStock, b.maxStock, b.price, b.supplierId || null, b.location, new Date().toISOString(), req.params.id)
  addHistory(req, { action: 'modificar', module: 'Embalaje', entityId: req.params.id, description: `Modificado material ${b.name}` })
  res.json({ ok: true })
})
router.delete('/packaging/:id', auth, requirePermission('packaging', 'delete'), (req, res) => {
  db.prepare('DELETE FROM packaging WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})
router.post('/packaging/:id/entry', auth, requirePermission('purchases', 'create'), (req, res) => {
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
router.post('/products', auth, requirePermission('production', 'create'), (req, res) => {
  try {
    const b = req.body || {}
    if (!b.name) return res.status(400).json({ error: 'Falta el nombre del producto' })
    const id = uid('pr-')
    const count = db.prepare('SELECT COUNT(*) c FROM products').get().c
    const entryNumber = count + 1
    const code = b.code || `PROD${entryNumber}`
    db.prepare('INSERT INTO products (id, code, name, description, category, bottle_size, stock, min_stock, max_stock, price, cost, recipe_id, active, entry_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, code, b.name, b.description || '', b.category || 'General', Number(b.bottleSize) || 0, Number(b.stock) || 0, Number(b.minStock) || 0, Number(b.maxStock) || 0, Number(b.price) || 0, Number(b.cost) || 0, b.recipeId || null, 1, entryNumber)
    addHistory(req, { action: 'crear', module: 'Productos', entityId: id, description: `Creado producto ${b.name} (${code})` })
    res.json({ id, code, entryNumber })
  } catch (e) {
    console.error('Error POST /products:', e.message)
    res.status(500).json({ error: e.message })
  }
})
router.put('/products/:id', auth, requirePermission('production', 'edit'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE products SET code=?, name=?, description=?, category=?, bottle_size=?, min_stock=?, max_stock=?, price=?, cost=?, recipe_id=?, active=? WHERE id=?')
    .run(b.code, b.name, b.description, b.category, b.bottleSize, b.minStock, b.maxStock, b.price, b.cost, b.recipeId || null, b.active === false ? 0 : 1, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Productos', entityId: req.params.id, description: `Modificado producto ${b.name}` })
  res.json({ ok: true })
})
router.delete('/products/:id', auth, requirePermission('production', 'delete'), (req, res) => {
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
router.post('/recipes', auth, requirePermission('recipes', 'create'), (req, res) => {
  const b = req.body
  const id = uid('rc-')
  const batchSize = Number(b.batchSize) || 1000
  db.prepare('INSERT INTO recipes (id, product_id, bottle_size, bottles_per_box, boxes_per_pallet, yield_per_liter, batch_size, items_json, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, b.productId, b.bottleSize || 0, b.bottlesPerBox || 0, b.boxesPerPallet || 0, b.yieldPerLiter || 0, batchSize, JSON.stringify(b.items || []), new Date().toISOString())
  addHistory(req, { action: 'crear', module: 'Recetas', entityId: id, description: `Creada receta (lote de ${batchSize}L) para producto ${b.productId}` })
  res.json({ id })
})
router.put('/recipes/:id', auth, requirePermission('recipes', 'edit'), (req, res) => {
  const b = req.body
  const batchSize = Number(b.batchSize) || 1000
  db.prepare('UPDATE recipes SET bottle_size=?, bottles_per_box=?, boxes_per_pallet=?, yield_per_liter=?, batch_size=?, items_json=?, updated_at=? WHERE id=?')
    .run(b.bottleSize || 0, b.bottlesPerBox || 0, b.boxesPerPallet || 0, b.yieldPerLiter || 0, batchSize, JSON.stringify(b.items || []), new Date().toISOString(), req.params.id)
  addHistory(req, { action: 'modificar', module: 'Recetas', entityId: req.params.id, description: `Modificada receta (lote de ${batchSize}L)` })
  res.json({ ok: true })
})
router.delete('/recipes/:id', auth, requirePermission('recipes', 'delete'), (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })

// DELETE /api/lots/:id — eliminar fabricación (SOLO ADMIN)
router.delete('/lots/:id', auth, requirePermission('lots', 'delete'), (req, res) => {
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
    description: `Eliminado lote ${lot.code || lot.lot_number} (producto ${lot.product_id}, cantidad ${lot.quantity}L)` 
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
// GET /api/customers/by-code/:code - Buscar cliente por código CL-XXXXX
router.get('/customers/by-code/:code', auth, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE code = ?').get(req.params.code)
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado con ese código' })
  res.json(mapCust(c))
})
router.post('/customers', auth, requirePermission('customers', 'create'), (req, res) => {
  try {
    const b = req.body || {}
    if (!b.name) return res.status(400).json({ error: 'Falta el nombre del cliente' })
    const id = uid('c-')
    // Auto-generar código CL-XXXXX si no se proporciona
    let code = b.code
    if (!code) {
      const maxCode = db.prepare("SELECT MAX(CAST(SUBSTR(code, 4) AS INTEGER)) AS max_no FROM customers WHERE code LIKE 'CL-%'").get()
      const nextNo = (maxCode?.max_no || 0) + 1
      code = `CL-${String(nextNo).padStart(5, '0')}`
    }
    db.prepare('INSERT INTO customers (id, code, name, company, cif, address, city, country, phone, email, contact, notes, total_purchases, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)')
      .run(id, code, b.name, b.company || '', b.cif || '', b.address || '', b.city || '', b.country || '', b.phone || '', b.email || '', b.contact || '', b.notes || '', new Date().toISOString())
    addHistory(req, { action: 'crear', module: 'Clientes', entityId: id, description: `Creado cliente ${b.name} (${code})` })
    res.json({ id, code })
  } catch (e) {
    console.error('Error POST /customers:', e.message)
    res.status(500).json({ error: e.message })
  }
})
router.put('/customers/:id', auth, requirePermission('customers', 'edit'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE customers SET code=?, name=?, company=?, cif=?, address=?, city=?, country=?, phone=?, email=?, contact=?, notes=? WHERE id=?')
    .run(b.code, b.name, b.company, b.cif, b.address, b.city, b.country, b.phone, b.email, b.contact, b.notes, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Clientes', entityId: req.params.id, description: `Modificado cliente ${b.name}` })
  res.json({ ok: true })
})
router.delete('/customers/:id', auth, requirePermission('customers', 'delete'), (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- DELIVERY / ENTREGA DE PEDIDOS ----------
// GET /api/delivery/lookup/:code - Buscar cliente por código y devolver sus pedidos pendientes
router.get('/delivery/lookup/:code', auth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE code = ?').get(req.params.code)
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' })
  // Pedidos NO entregados del cliente
  const allOrders = db.prepare(`SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC`).all(customer.id)
  const ordersList = allOrders.map(o => {
    let items = []
    try { items = JSON.parse(o.items_json || '[]') } catch {}
    return {
      ...o,
      items,
      items_json: undefined,
      delivered: !!o.delivered_at
    }
  })
  res.json({
    customer: mapCust(customer),
    orders: ordersList,
    pendingOrders: ordersList.filter(o => !o.delivered_at),
    deliveredOrders: ordersList.filter(o => o.delivered_at)
  })
})

// POST /api/delivery/:orderId - Marcar pedido como entregado
router.post('/delivery/:orderId', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
    if (order.delivered_at) {
      return res.status(400).json({
        error: 'Este pedido ya fue entregado',
        deliveredAt: order.delivered_at,
        deliveredBy: order.delivered_by
      })
    }
    const now = new Date().toISOString()
    const userId = req.user?.id || null
    const userName = req.user?.username || req.user?.fullName || 'Sistema'
    db.prepare('UPDATE orders SET delivered_at = ?, delivered_by = ?, status = ? WHERE id = ?')
      .run(now, userName, 'entregado', req.params.orderId)
    addHistory(req, {
      action: 'entregar', module: 'Pedidos', entityId: req.params.orderId,
      description: `Pedido ${order.number} marcado como entregado por ${userName}`
    })
    res.json({
      ok: true,
      orderId: req.params.orderId,
      deliveredAt: now,
      deliveredBy: userName
    })
  } catch (e) {
    console.error('Error POST /delivery:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/delivery/:orderId - Revertir entrega (solo admin)
router.delete('/delivery/:orderId', auth, requirePermission('sales', 'delete'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
  if (!order.delivered_at) return res.status(400).json({ error: 'Este pedido no estaba entregado' })
  db.prepare('UPDATE orders SET delivered_at = NULL, delivered_by = NULL, status = ? WHERE id = ?')
    .run(order.status === 'entregado' ? 'confirmado' : order.status, req.params.orderId)
  addHistory(req, { action: 'revertir_entrega', module: 'Pedidos', entityId: req.params.orderId, description: `Entrega del pedido ${order.number} revertida` })
  res.json({ ok: true })
})

// ---------- ORDERS ----------
const mapOrder = (o) => ({
  id: o.id, number: o.number, customerId: o.customer_id, items: JSON.parse(o.items_json || '[]'),
  subtotal: o.subtotal, tax: o.tax, discount: o.discount, total: o.total,
  status: o.status, createdAt: o.created_at, deliveryDate: o.delivery_date, notes: o.notes, createdBy: o.created_by,
  deliveredAt: o.delivered_at || null, deliveredBy: o.delivered_by || null
})

router.get('/orders', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(mapOrder))
})
router.post('/orders', auth, requirePermission('sales', 'create'), (req, res) => {
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
router.put('/orders/:id', auth, requirePermission('sales', 'edit'), (req, res) => {
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
    // CREAR RESERVAS en lugar de descontar directamente
    const items = JSON.parse(before.items_json)
    for (const it of items) {
      db.prepare(`INSERT INTO stock_reservations (id, product_id, order_id, quantity, status, created_at) VALUES (?,?,?,?,?,?)`)
        .run(uid('res-'), it.productId, before.id, it.quantity, 'active', new Date().toISOString())
    }
    deductStock(before)
  }
  // Si se cancela un pedido confirmado o entregado, liberar reservas
  if (newStatus === 'cancelado' && (before.status === 'confirmado' || before.status === 'pendiente' || before.status === 'preparando')) {
    db.prepare(`UPDATE stock_reservations SET status = 'released', released_at = ? WHERE order_id = ? AND status = 'active'`)
      .run(new Date().toISOString(), before.id)
  }
  // Si se marca como preparando, las reservas se mantienen activas
  // Si se entrega, las reservas se mantienen (ya se desconto stock)
  db.prepare('UPDATE orders SET customer_id=?, items_json=?, subtotal=?, tax=?, discount=?, total=?, status=?, delivery_date=?, notes=? WHERE id=?')
    .run(b.customerId || before.customer_id, JSON.stringify(b.items || JSON.parse(before.items_json)), b.subtotal ?? before.subtotal, b.tax ?? before.tax, b.discount ?? before.discount, b.total ?? before.total, newStatus, b.deliveryDate ?? before.delivery_date, b.notes ?? before.notes, req.params.id)
  addHistory(req, { action: 'modificar', module: 'Pedidos', entityId: req.params.id, description: `Pedido ${before.number} → ${newStatus}${touched ? ' (stock descontado)' : ''}`, before: mapOrder(before) })
  if (touched) maybeAddStockNotifications()
  res.json({ ok: true })
})
router.delete('/orders/:id', auth, requirePermission('sales', 'delete'), (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- INVOICE / FACTURA (HTML standalone) ----------
// Genera una factura profesional en HTML, lista para imprimir o descargar como PDF
// Uso: GET /api/invoice/:orderId (requiere auth en header)
//      GET /api/invoice/:orderId?token=xxx (token en query string)
router.get('/invoice/:orderId', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
  if (!order) return res.status(404).send('<h1>Pedido no encontrado</h1>')
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id)
  let items = []
  try { items = JSON.parse(order.items_json || '[]') } catch {}

  // Obtener info de empresa del config
  const companyInfo = getConfig('company', { name: 'SAHEL', cif: '', address: '', phone: '', email: '' })
  const taxRate = getConfig('defaults', { tax: 21 }).tax || 21

  // Calcular totales
  const subtotal = order.subtotal || 0
  const tax = order.tax || 0
  const discount = order.discount || 0
  const total = order.total || 0

  // Número de factura
  const invoiceNumber = `FAC-${order.number}`

  const orderDate = order.created_at ? order.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
  const deliveryDate = order.delivery_date || ''

  // HTML profesional
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f0f0f0;
      color: #1a1a1a;
      line-height: 1.4;
    }
    .no-print {
      background: #1e293b;
      color: white;
      padding: 16px;
      display: flex;
      gap: 12px;
      justify-content: center;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,.2);
    }
    .no-print button {
      padding: 10px 20px;
      font-size: 14px;
      background: #329bff;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }
    .no-print button:hover { background: #1666e0; }
    .no-print button.close { background: #475569; }
    .no-print button.pdf { background: #10b981; }
    .no-print button.pdf:hover { background: #059669; }

    .invoice {
      max-width: 800px;
      margin: 24px auto;
      background: white;
      padding: 40px 48px;
      box-shadow: 0 4px 16px rgba(0,0,0,.1);
      border-radius: 4px;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1666e0;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .company-info { flex: 1; }
    .company-name {
      font-size: 26pt;
      font-weight: 900;
      color: #1666e0;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .company-tagline {
      font-size: 9pt;
      color: #666;
      margin-bottom: 12px;
    }
    .company-details {
      font-size: 9pt;
      line-height: 1.6;
      color: #555;
    }
    .invoice-meta {
      text-align: right;
      background: #f0f9ff;
      padding: 16px 20px;
      border-radius: 6px;
      border-left: 4px solid #1666e0;
    }
    .invoice-title {
      font-size: 22pt;
      font-weight: 800;
      color: #1666e0;
      margin-bottom: 8px;
    }
    .invoice-number {
      font-size: 11pt;
      color: #333;
      font-family: monospace;
    }
    .invoice-date {
      font-size: 9pt;
      color: #666;
      margin-top: 4px;
    }

    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    .party-box {
      padding: 16px;
      background: #f8fafc;
      border-radius: 6px;
      border-left: 3px solid #329bff;
    }
    .party-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .party-name {
      font-size: 11pt;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    .party-details {
      font-size: 9pt;
      line-height: 1.5;
      color: #555;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      background: #1666e0;
      color: white;
      padding: 12px;
      text-align: left;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    .items-table th.right { text-align: right; }
    .items-table th.center { text-align: center; }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 9.5pt;
    }
    .items-table td.right { text-align: right; }
    .items-table td.center { text-align: center; }
    .items-table tr:last-child td { border-bottom: none; }
    .items-table tr:nth-child(even) { background: #f8fafc; }
    .item-name { font-weight: 600; }
    .item-code { font-size: 8pt; color: #666; font-family: monospace; }

    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .totals-box {
      width: 320px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      font-size: 10pt;
    }
    .total-row.subtotal { color: #555; }
    .total-row.discount { color: #10b981; }
    .total-row.tax { color: #555; }
    .total-row.grand {
      background: #1666e0;
      color: white;
      font-weight: 800;
      font-size: 13pt;
      margin-top: 4px;
      border-radius: 4px;
    }

    .footer-info {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      font-size: 8pt;
      color: #666;
      line-height: 1.6;
    }
    .payment-info {
      margin-top: 16px;
      padding: 12px 16px;
      background: #fef3c7;
      border-radius: 6px;
      font-size: 9pt;
      color: #78350f;
    }

    @media print {
      body { background: white; }
      .no-print { display: none; }
      .invoice {
        box-shadow: none;
        margin: 0;
        padding: 24px;
        max-width: 100%;
      }
      .invoice-header { border-bottom-color: #000; }
      .company-name, .invoice-title, .total-row.grand { color: #000; }
      .total-row.grand { background: #f0f0f0; color: #000; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
  <script>
// Script de traducción embebido - SOLO para documentos
// Se inyecta directamente en el HTML del documento

const DICT = {"es":{"Imprimir / Guardar PDF":"Imprimir / Guardar PDF","Enviar por email":"Enviar por email","Cerrar":"Cerrar","HOJA DE PEDIDO":"HOJA DE PEDIDO","PEDIDO N°":"PEDIDO N°","Fecha":"Fecha","Pedido N°":"Pedido N°","N°":"N°","Descripción":"Descripción","Presentación":"Presentación","Cantidad":"Cantidad","Precio Unitario":"Precio Unitario","Total":"Total","Subtotal":"Subtotal","Descuento":"Descuento","Transporte":"Transporte","TOTAL GENERAL":"TOTAL GENERAL","I.V.A.":"I.V.A.","IVA":"IVA","Base imponible":"Base imponible","Datos del Cliente":"Datos del Cliente","Detalles del Pedido":"Detalles del Pedido","Nombre:":"Nombre:","Dirección:":"Dirección:","Teléfono:":"Teléfono:","Email:":"Email:","NIF / VAT:":"NIF / VAT:","Fecha del pedido:":"Fecha del pedido:","Fecha de entrega:":"Fecha de entrega:","Condiciones de pago:":"Condiciones de pago:","Vendedor:":"Vendedor:","Referencia:":"Referencia:","Notas:":"Notas:","Condiciones Generales":"Condiciones Generales","Firma y sello del cliente":"Firma y sello del cliente","¡GRACIAS POR SU CONFIANZA!":"¡GRACIAS POR SU CONFIANZA!","FACTURA":"FACTURA","Factura N°":"Factura N°","Forma de pago":"Forma de pago","Vencimiento":"Vencimiento","Importe":"Importe","Tarjeta de Cliente":"Tarjeta de Cliente","Cliente":"Cliente","Entrega de Pedidos":"Entrega de Pedidos","Buscar cliente":"Buscar cliente","Escanear QR o escribir código":"Escanear QR o escribir código","Buscar":"Buscar","Pedidos pendientes":"Pedidos pendientes","Pedidos entregados":"Pedidos entregados","Sin pedidos pendientes":"Sin pedidos pendientes","Entregar":"Entregar","Ya entregados":"Ya entregados","Volver":"Volver","Cargando...":"Cargando...","Cliente no encontrado":"Cliente no encontrado","Verificar el código":"Verificar el código","Error de conexion":"Error de conexión","No se puede conectar con el servidor":"No se puede conectar con el servidor","Pedido ya entregado":"Pedido ya entregado","Entrega registrada":"Entrega registrada","Pedido no encontrado":"Pedido no encontrado","Iniciar sesion":"Iniciar sesión","Iniciar sesión":"Iniciar sesión","Accede a tu panel de control":"Accede a tu panel de control","Usuario":"Usuario","Contrasena":"Contraseña","Contraseña":"Contraseña","Entrar":"Entrar","Entrando...":"Entrando...","Cuentas de prueba":"Cuentas de prueba","Administrador":"Administrador","Produccion":"Producción","Producción":"Producción","Almacen":"Almacén","Almacén":"Almacén","Comercial":"Comercial","Contabilidad":"Contabilidad"},"fr":{"Imprimir / Guardar PDF":"Imprimer / Sauvegarder PDF","Enviar por email":"Envoyer par email","Cerrar":"Fermer","HOJA DE PEDIDO":"BON DE COMMANDE","PEDIDO N°":"COMMANDE N°","Fecha":"Date","Pedido N°":"Commande N°","N°":"N°","Descripción":"Description","Presentación":"Présentation","Cantidad":"Quantité","Precio Unitario":"Prix Unitaire","Total":"Total","Subtotal":"Sous-total","Descuento":"Remise","Transporte":"Transport","TOTAL GENERAL":"TOTAL GÉNÉRAL","I.V.A.":"T.V.A.","IVA":"TVA","Base imponible":"Base imposable","Datos del Cliente":"Données du Client","Detalles del Pedido":"Détails de la Commande","Nombre:":"Nom :","Dirección:":"Adresse :","Teléfono:":"Téléphone :","Email:":"Email :","NIF / VAT:":"NIF / TVA :","Fecha del pedido:":"Date de commande :","Fecha de entrega:":"Date de livraison :","Condiciones de pago:":"Conditions de paiement :","Vendedor:":"Vendeur :","Referencia:":"Référence :","Notas:":"Notes :","Condiciones Generales":"Conditions Générales","Firma y sello del cliente":"Signature et cachet du client","¡GRACIAS POR SU CONFIANZA!":"MERCI DE VOTRE CONFIANCE !","FACTURA":"FACTURE","Factura N°":"Facture N°","Forma de pago":"Mode de paiement","Vencimiento":"Échéance","Importe":"Montant","Tarjeta de Cliente":"Carte Client","Cliente":"Client","Entrega de Pedidos":"Livraison de Commandes","Buscar cliente":"Rechercher client","Escanear QR o escribir código":"Scanner QR ou saisir le code","Buscar":"Rechercher","Pedidos pendientes":"Commandes en attente","Pedidos entregados":"Commandes livrées","Sin pedidos pendientes":"Aucune commande en attente","Entregar":"Livrer","Ya entregados":"Déjà livrées","Volver":"Retour","Cargando...":"Chargement...","Cliente no encontrado":"Client non trouvé","Verificar el código":"Vérifier le code","Error de conexion":"Erreur de connexion","No se puede conectar con el servidor":"Impossible de se connecter au serveur","Pedido ya entregado":"Commande déjà livrée","Entrega registrada":"Livraison enregistrée","Pedido no encontrado":"Commande non trouvée","Iniciar sesion":"Se connecter","Iniciar sesión":"Se connecter","Accede a tu panel de control":"Accédez à votre tableau de bord","Usuario":"Utilisateur","Contrasena":"Mot de passe","Contraseña":"Mot de passe","Entrar":"Entrer","Entrando...":"Connexion...","Cuentas de prueba":"Comptes de test","Administrador":"Administrateur","Produccion":"Production","Producción":"Production","Almacen":"Entrepôt","Almacén":"Entrepôt","Comercial":"Commercial","Contabilidad":"Comptabilité"},"en":{"Imprimir / Guardar PDF":"Print / Save PDF","Enviar por email":"Send by email","Cerrar":"Close","HOJA DE PEDIDO":"ORDER FORM","PEDIDO N°":"ORDER N°","Fecha":"Date","Pedido N°":"Order N°","N°":"N°","Descripción":"Description","Presentación":"Presentation","Cantidad":"Quantity","Precio Unitario":"Unit Price","Total":"Total","Subtotal":"Subtotal","Descuento":"Discount","Transporte":"Shipping","TOTAL GENERAL":"GRAND TOTAL","I.V.A.":"V.A.T.","IVA":"VAT","Base imponible":"Taxable base","Datos del Cliente":"Customer Details","Detalles del Pedido":"Order Details","Nombre:":"Name:","Dirección:":"Address:","Teléfono:":"Phone:","Email:":"Email:","NIF / VAT:":"Tax ID:","Fecha del pedido:":"Order date:","Fecha de entrega:":"Delivery date:","Condiciones de pago:":"Payment terms:","Vendedor:":"Seller:","Referencia:":"Reference:","Notas:":"Notes:","Condiciones Generales":"General Conditions","Firma y sello del cliente":"Customer signature and stamp","¡GRACIAS POR SU CONFIANZA!":"THANK YOU FOR YOUR TRUST!","FACTURA":"INVOICE","Factura N°":"Invoice N°","Forma de pago":"Payment method","Vencimiento":"Due date","Importe":"Amount","Tarjeta de Cliente":"Customer Card","Cliente":"Customer","Entrega de Pedidos":"Order Delivery","Buscar cliente":"Search customer","Escanear QR o escribir código":"Scan QR or type code","Buscar":"Search","Pedidos pendientes":"Pending orders","Pedidos entregados":"Delivered orders","Sin pedidos pendientes":"No pending orders","Entregar":"Deliver","Ya entregados":"Already delivered","Volver":"Back","Cargando...":"Loading...","Cliente no encontrado":"Customer not found","Verificar el código":"Verify the code","Error de conexion":"Connection error","No se puede conectar con el servidor":"Cannot connect to server","Pedido ya entregado":"Order already delivered","Entrega registrada":"Delivery registered","Pedido no encontrado":"Order not found","Iniciar sesion":"Sign in","Iniciar sesión":"Sign in","Accede a tu panel de control":"Access your control panel","Usuario":"User","Contrasena":"Password","Contraseña":"Password","Entrar":"Sign in","Entrando...":"Signing in...","Cuentas de prueba":"Test accounts","Administrador":"Administrator","Produccion":"Production","Producción":"Production","Almacen":"Warehouse","Almacén":"Warehouse","Comercial":"Sales","Contabilidad":"Accounting"},"pt":{"Imprimir / Guardar PDF":"Imprimir / Salvar PDF","Enviar por email":"Enviar por email","Cerrar":"Fechar","HOJA DE PEDIDO":"FOLHA DE PEDIDO","PEDIDO N°":"PEDIDO N°","Fecha":"Data","Pedido N°":"Pedido N°","N°":"N°","Descripción":"Descrição","Presentación":"Apresentação","Cantidad":"Quantidade","Precio Unitario":"Preço Unitário","Total":"Total","Subtotal":"Subtotal","Descuento":"Desconto","Transporte":"Transporte","TOTAL GENERAL":"TOTAL GERAL","I.V.A.":"I.V.A.","IVA":"IVA","Base imponible":"Base tributável","Datos del Cliente":"Dados do Cliente","Detalles del Pedido":"Detalhes do Pedido","Nombre:":"Nome:","Dirección:":"Endereço:","Teléfono:":"Telefone:","Email:":"Email:","NIF / VAT:":"CNPJ/CPF:","Fecha del pedido:":"Data do pedido:","Fecha de entrega:":"Data de entrega:","Condiciones de pago:":"Condições de pagamento:","Vendedor:":"Vendedor:","Referencia:":"Referência:","Notas:":"Notas:","Condiciones Generales":"Condições Gerais","Firma y sello del cliente":"Assinatura e carimbo do cliente","¡GRACIAS POR SU CONFIANZA!":"OBRIGADO PELA SUA CONFIANÇA!","FACTURA":"FATURA","Factura N°":"Fatura N°","Forma de pago":"Forma de pagamento","Vencimiento":"Vencimento","Importe":"Valor","Tarjeta de Cliente":"Cartão de Cliente","Cliente":"Cliente","Entrega de Pedidos":"Entrega de Pedidos","Buscar cliente":"Buscar cliente","Escanear QR o escribir código":"Escanear QR ou digitar código","Buscar":"Pesquisar","Pedidos pendientes":"Pedidos pendentes","Pedidos entregados":"Pedidos entregues","Sin pedidos pendientes":"Sem pedidos pendentes","Entregar":"Entregar","Ya entregados":"Já entregues","Volver":"Voltar","Cargando...":"Carregando...","Cliente no encontrado":"Cliente não encontrado","Verificar el código":"Verifique o código","Error de conexion":"Erro de conexão","No se puede conectar con el servidor":"Não é possível conectar ao servidor","Pedido ya entregado":"Pedido já entregue","Entrega registrada":"Entrega registrada","Pedido no encontrado":"Pedido não encontrado","Iniciar sesion":"Entrar","Iniciar sesión":"Entrar","Accede a tu panel de control":"Aceda ao seu painel de controlo","Usuario":"Utilizador","Contrasena":"Palavra-passe","Contraseña":"Palavra-passe","Entrar":"Entrar","Entrando...":"Entrando...","Cuentas de prueba":"Contas de teste","Administrador":"Administrador","Produccion":"Produção","Producción":"Produção","Almacen":"Armazém","Almacén":"Armazém","Comercial":"Comercial","Contabilidad":"Contabilidade"}};

function applyDocI18n() {
  if (window.__docI18nApplied) return;
  window.__docI18nApplied = true;

  const urlParams = new URLSearchParams(window.location.search);
  const lang = (urlParams.get('lang') || localStorage.getItem('cleanerp-lang') || 'es').toLowerCase();
  if (!DICT[lang]) lang = 'es';

  // Mapa ES normalizado -> clave
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const esToKey = {};
  for (const k in DICT.es) {
    esToKey[k] = k;
    esToKey[norm(k)] = k;
  }

  function tr(key) {
    return (DICT[lang] && DICT[lang][key]) || DICT.es[key] || key;
  }

  // Traducir text nodes
  function translateNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue || '';
      if (!raw.trim()) return;
      const txt = raw.trim();
      if (txt.length < 2 || txt.length > 100) return;
      const key = esToKey[txt] || esToKey[norm(txt)];
      if (key) {
        const newText = tr(key);
        if (newText !== txt) {
          node.nodeValue = raw.replace(txt, newText);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG') return;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (node.placeholder) {
          const k = esToKey[node.placeholder] || esToKey[norm(node.placeholder)];
          if (k) node.placeholder = tr(k);
        }
        return;
      }
      for (const child of node.childNodes) translateNode(child);
    }
  }

  // Aplicar a todo el body
  translateNode(document.body);
  document.documentElement.lang = lang;
  document.title = (lang === 'es' ? 'Hoja de Pedido' : (lang === 'fr' ? 'Bon de Commande' : (lang === 'en' ? 'Order Form' : 'Folha de Pedido')));
}

// Ejecutar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyDocI18n);
} else {
  applyDocI18n();
}

// Re-aplicar para contenido dinámico
const obs = new MutationObserver(() => {
  clearTimeout(window.__docI18nTimeout);
  window.__docI18nTimeout = setTimeout(applyDocI18n, 50);
});
obs.observe(document.body, { childList: true, subtree: true });

// Cambios de idioma
window.addEventListener('storage', e => {
  if (e.key === 'cleanerp-lang') {
    window.location.reload();
  }
});

console.log('[doc-i18n] Idioma:', new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('cleanerp-lang') || 'es');

  </script>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Imprimir factura</button>
    <button class="pdf" onclick="window.print()">📄 Descargar como PDF</button>
    <button class="close" onclick="window.close()">Cerrar</button>
  </div>

  <div class="invoice">
    <div class="invoice-header">
      <div class="company-info">
        <div class="company-name">${companyInfo.name || 'SAHEL'}</div>
        <div class="company-tagline">Produits d'Hygiène</div>
        <div class="company-details">
          ${companyInfo.cif ? `<div><strong>CIF/NIF:</strong> ${companyInfo.cif}</div>` : ''}
          ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
          ${companyInfo.phone ? `<div><strong>Tel:</strong> ${companyInfo.phone}</div>` : ''}
          ${companyInfo.email ? `<div><strong>Email:</strong> ${companyInfo.email}</div>` : ''}
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">FACTURA</div>
        <div class="invoice-number">${invoiceNumber}</div>
        <div class="invoice-date">Fecha: ${orderDate}</div>
        ${deliveryDate ? `<div class="invoice-date">Entrega: ${deliveryDate}</div>` : ''}
      </div>
    </div>

    <div class="parties">
      <div class="party-box">
        <div class="party-label">Facturar a</div>
        <div class="party-name">${customer?.name || 'Cliente'}</div>
        <div class="party-details">
          ${customer?.company && customer.company !== customer.name ? `<div>${customer.company}</div>` : ''}
          ${customer?.cif ? `<div><strong>CIF:</strong> ${customer.cif}</div>` : ''}
          ${customer?.address ? `<div>${customer.address}</div>` : ''}
          ${customer?.city ? `<div>${customer.city}${customer.country ? ', ' + customer.country : ''}</div>` : ''}
          ${customer?.phone ? `<div><strong>Tel:</strong> ${customer.phone}</div>` : ''}
          ${customer?.email ? `<div><strong>Email:</strong> ${customer.email}</div>` : ''}
          ${customer?.contact ? `<div><strong>Contacto:</strong> ${customer.contact}</div>` : ''}
        </div>
      </div>
      <div class="party-box">
        <div class="party-label">Detalles del pedido</div>
        <div class="party-details">
          <div><strong>Número de pedido:</strong> ${order.number}</div>
          <div><strong>Estado:</strong> ${order.status}</div>
          <div><strong>Fecha pedido:</strong> ${orderDate}</div>
          ${order.notes ? `<div style="margin-top: 8px;"><strong>Notas:</strong> ${order.notes}</div>` : ''}
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50px;" class="center">#</th>
          <th>Descripción</th>
          <th class="center" style="width: 80px;">Cantidad</th>
          <th class="right" style="width: 100px;">P. Unitario</th>
          <th class="right" style="width: 100px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => {
          const qty = Number(it.quantity) || 0
          const price = Number(it.unitPrice) || 0
          const total = qty * price
          return `<tr>
            <td class="center">${idx + 1}</td>
            <td>
              <div class="item-name">${it.name || it.productName || 'Producto'}</div>
              ${it.code ? `<div class="item-code">${it.code}</div>` : ''}
            </td>
            <td class="center">${qty} ${it.unit || 'ud'}</td>
            <td class="right">${price.toFixed(2)} €</td>
            <td class="right">${total.toFixed(2)} €</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="total-row subtotal">
          <span>Subtotal:</span>
          <span>${subtotal.toFixed(2)} €</span>
        </div>
        ${discount > 0 ? `<div class="total-row discount">
          <span>Descuento:</span>
          <span>-${discount.toFixed(2)} €</span>
        </div>` : ''}
        <div class="total-row tax">
          <span>${taxRate}% IVA:</span>
          <span>${tax.toFixed(2)} €</span>
        </div>
        <div class="total-row grand">
          <span>TOTAL:</span>
          <span>${total.toFixed(2)} €</span>
        </div>
      </div>
    </div>

    <div class="payment-info">
      <strong>Forma de pago:</strong> ${getConfig('payment_terms', 'A convenir.Gracias por su confianza.') || 'A convenir.'}
    </div>

    <div class="footer-info">
      <div>${companyInfo.name || 'SAHEL'} · Produits d'Hygiène</div>
      ${companyInfo.cif ? `<div>CIF: ${companyInfo.cif}</div>` : ''}
      <div style="margin-top: 6px; font-style: italic;">Gracias por su confianza. Para cualquier duda, contacte con nosotros.</div>
    </div>
  </div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// Invoice con auth por query string (para abrir en nueva ventana)
router.get('/invoice-view/:orderId', (req, res) => {
  const token = req.query.token
  if (token) {
    try {
      const jwt = require('jsonwebtoken')
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'cleanerp-dev-secret-change-in-production-9f8e7d6c5b4a3210')
    } catch (e) {}
  }
  return router.handle({ ...req, url: `/invoice/${req.params.orderId}`, method: 'GET' }, res, () => {})
})

// ---------- ORDER SHEET (Hoja de pedido A4 profesional) ----------
// Genera una hoja de pedido A4 con el logo SAHEL, datos del cliente, productos, totales y zona de firma
// Uso: GET /api/order-sheet/:orderId
//      GET /api/order-sheet-view/:orderId?token=xxx (con token en query)
router.get('/order-sheet/:orderId', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
  if (!order) return res.status(404).send('<h1>Pedido no encontrado</h1>')
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id)
  let items = []
  try { items = JSON.parse(order.items_json || '[]') } catch {}

  // Datos de empresa
  const companyInfo = getConfig('company', { name: 'SAHEL', cif: '', address: '', phone: '', email: '', city: 'Bamako', country: 'Mali' })
  const taxRate = getConfig('defaults', { tax: 21 }).tax || 21

  const subtotal = order.subtotal || 0
  const tax = order.tax || 0
  const discount = order.discount || 0
  const total = order.total || 0
  const shipping = order.shipping || 0
  const currency = order.currency || 'FCFA'

  const orderDate = order.created_at ? order.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
  const deliveryDate = order.delivery_date || ''
  const seller = order.seller || order.created_by_name || 'Administración'
  const paymentTerms = order.payment_terms || 'Contado'
  const customerRef = order.customer_ref || ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hoja de Pedido ${order.number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f3f4f6;
      color: #111827;
      line-height: 1.45;
      padding: 20px;
      font-size: 10pt;
    }
    .no-print {
      background: #1f2937;
      color: white;
      padding: 12px;
      display: flex;
      gap: 8px;
      justify-content: center;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      margin: -20px -20px 16px -20px;
    }
    .no-print button {
      padding: 9px 16px;
      font-size: 12px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      font-family: inherit;
    }
    .no-print button:hover { background: #1d4ed8; }
    .no-print button.close { background: #6b7280; }

    .sheet {
      width: 210mm;
      min-height: auto;
      margin: 0 auto;
      background: white;
      padding: 14mm 16mm;
      box-shadow: 0 2px 8px rgba(0,0,0,.1);
    }

    .header {
      display: grid;
      grid-template-columns: 55mm 1fr 70mm;
      gap: 6mm;
      align-items: center;
      padding-bottom: 6mm;
      border-bottom: 1.5pt solid #1e3a8a;
      margin-bottom: 6mm;
    }
    .logo-box {
      text-align: center;
      padding: 2mm;
      border: 0.5pt solid #d1d5db;
    }
    .logo-box img { width: 100%; max-width: 50mm; height: auto; }
    .company-name {
      font-size: 16pt;
      font-weight: bold;
      color: #1e3a8a;
      letter-spacing: 0.5px;
      margin-bottom: 1mm;
    }
    .company-tagline {
      font-size: 8pt;
      color: #6b7280;
      margin-bottom: 3mm;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .company-info {
      font-size: 8.5pt;
      line-height: 1.6;
      color: #4b5563;
    }
    .company-info div { margin: 0.3mm 0; }

    .order-meta {
      text-align: right;
      padding: 4mm 5mm;
      border: 1pt solid #1e3a8a;
    }
    .order-meta .label {
      font-size: 7pt;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }
    .order-meta .order-num {
      font-size: 14pt;
      font-weight: bold;
      color: #1e3a8a;
      letter-spacing: 0.5px;
      margin: 1mm 0;
    }
    .order-meta .order-date {
      font-size: 8.5pt;
      color: #4b5563;
      margin-top: 1.5mm;
    }

    .doc-title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      color: #1e3a8a;
      letter-spacing: 3px;
      margin: 4mm 0 6mm;
    }

    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm;
      margin-bottom: 5mm;
    }
    .info-box {
      padding: 4mm 5mm;
      border: 0.5pt solid #9ca3af;
    }
    .info-box h3 {
      font-size: 9pt;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: bold;
      margin-bottom: 3mm;
      padding-bottom: 1.5mm;
      border-bottom: 0.5pt solid #1e3a8a;
    }
    .info-row {
      display: grid;
      grid-template-columns: 32mm 1fr;
      gap: 2mm;
      margin: 1mm 0;
      font-size: 9pt;
    }
    .info-row .lbl {
      font-weight: 600;
      color: #4b5563;
    }
    .info-row .val { color: #111827; }

    table.items {
      width: 100%;
      border-collapse: collapse;
      margin: 4mm 0;
    }
    table.items thead th {
      background: #1e3a8a;
      color: white;
      padding: 2.5mm 3mm;
      text-align: left;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    table.items thead th.right { text-align: right; }
    table.items thead th.center { text-align: center; }
    table.items tbody td {
      padding: 2.5mm 3mm;
      border-bottom: 0.5pt solid #d1d5db;
      font-size: 9pt;
      vertical-align: top;
    }
    table.items tbody td.right { text-align: right; }
    table.items tbody td.center { text-align: center; }
    .item-name { font-weight: 600; color: #111827; }
    .item-sub { font-size: 7.5pt; color: #6b7280; margin-top: 0.5mm; }

    .totals {
      display: flex;
      justify-content: flex-end;
      margin: 3mm 0 5mm;
    }
    .totals-box {
      width: 80mm;
      border: 0.5pt solid #9ca3af;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 2mm 4mm;
      font-size: 9pt;
      border-bottom: 0.3pt solid #e5e7eb;
    }
    .total-row:last-child { border-bottom: none; }
    .total-row.sub { color: #4b5563; }
    .total-row.disc { color: #047857; }
    .total-row.grand {
      background: #1e3a8a;
      color: white;
      font-weight: bold;
      font-size: 11pt;
    }

    .bottom {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 5mm;
      margin-top: 6mm;
    }
    .conditions {
      padding: 4mm 5mm;
      border: 0.5pt solid #9ca3af;
      background: #f9fafb;
    }
    .conditions h4 {
      font-size: 8.5pt;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: bold;
      margin-bottom: 2.5mm;
    }
    .conditions ul {
      list-style: none;
      padding: 0;
    }
    .conditions li {
      font-size: 8pt;
      color: #4b5563;
      margin: 1.2mm 0;
      padding-left: 4mm;
      position: relative;
      line-height: 1.5;
    }
    .conditions li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: #1e3a8a;
      font-weight: bold;
    }
    .signature {
      border: 0.5pt solid #9ca3af;
      padding: 3mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      min-height: 35mm;
    }
    .sig-label {
      font-size: 7.5pt;
      color: #6b7280;
      text-align: center;
      width: 100%;
      border-top: 0.5pt solid #9ca3af;
      padding-top: 1.5mm;
    }

    .thanks {
      text-align: center;
      margin: 5mm 0 3mm;
      font-size: 9pt;
      font-weight: bold;
      color: #1e3a8a;
      letter-spacing: 2px;
    }
    .footer-info {
      text-align: center;
      font-size: 7pt;
      color: #9ca3af;
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 0.5pt solid #e5e7eb;
    }

    @media print {
      body { background: white; padding: 0; }
      .no-print { display: none; }
      .sheet {
        box-shadow: none;
        margin: 0;
        padding: 10mm 12mm;
        width: 100%;
        min-height: auto;
      }
      @page {
        size: A4;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
    <button class="close" onclick="window.close()">Cerrar</button>
  </div>

  <div class="sheet">
    <div class="header">
      <div class="logo-box">
        <img src="https://mndiayediawara-hue.github.io/cleansahel/logo.svg" alt="SAHEL" onerror="this.outerHTML='<div style=&quot;font-weight:bold;font-size:18pt;color:#1e3a8a;&quot;>SAHEL</div>'" />
      </div>
      <div>
        <div class="company-name">${(companyInfo.name || 'SAHEL').toUpperCase()}</div>
        <div class="company-tagline">${companyInfo.tagline || 'Produits d\'Hygiène'}</div>
        <div class="company-info">
          ${companyInfo.address ? `<div>${companyInfo.address}${companyInfo.city ? ', ' + companyInfo.city : ''}${companyInfo.country ? ', ' + companyInfo.country : ''}</div>` : ''}
          ${companyInfo.phone ? `<div>Tel: ${companyInfo.phone}</div>` : ''}
          ${companyInfo.email ? `<div>Email: ${companyInfo.email}</div>` : ''}
          ${companyInfo.website ? `<div>Web: ${companyInfo.website}</div>` : ''}
        </div>
      </div>
      <div class="order-meta">
        <div class="label">Pedido N°</div>
        <div class="order-num">${order.number}</div>
        <div class="order-date">Fecha: ${orderDate.split('-').reverse().join('/')}</div>
      </div>
    </div>

    <div class="doc-title">HOJA DE PEDIDO</div>

    <div class="info-section">
      <div class="info-box">
        <h3>Datos del Cliente</h3>
        <div class="info-row">
          <span class="lbl">Nombre:</span>
          <span class="val">${customer?.name || '—'}</span>
        </div>
        ${customer?.address ? `<div class="info-row"><span class="lbl">Dirección:</span><span class="val">${customer.address}${customer.city ? ', ' + customer.city : ''}</span></div>` : ''}
        ${customer?.phone ? `<div class="info-row"><span class="lbl">Teléfono:</span><span class="val">${customer.phone}</span></div>` : ''}
        ${customer?.email ? `<div class="info-row"><span class="lbl">Email:</span><span class="val">${customer.email}</span></div>` : ''}
        ${customer?.cif ? `<div class="info-row"><span class="lbl">NIF / VAT:</span><span class="val">${customer.cif}</span></div>` : ''}
      </div>
      <div class="info-box">
        <h3>Detalles del Pedido</h3>
        <div class="info-row">
          <span class="lbl">Fecha del pedido:</span>
          <span class="val">${orderDate.split('-').reverse().join('/')}</span>
        </div>
        ${deliveryDate ? `<div class="info-row"><span class="lbl">Fecha de entrega:</span><span class="val">${deliveryDate.split('-').reverse().join('/')}</span></div>` : ''}
        <div class="info-row">
          <span class="lbl">Condiciones de pago:</span>
          <span class="val">${paymentTerms}</span>
        </div>
        <div class="info-row">
          <span class="lbl">Vendedor:</span>
          <span class="val">${seller}</span>
        </div>
        ${customerRef ? `<div class="info-row"><span class="lbl">Ref. cliente:</span><span class="val">${customerRef}</span></div>` : ''}
        ${order.notes ? `<div class="info-row"><span class="lbl">Notas:</span><span class="val">${order.notes}</span></div>` : ''}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width: 12mm;" class="center">N°</th>
          <th>Descripción</th>
          <th style="width: 38mm;">Presentación</th>
          <th style="width: 22mm;" class="center">Cantidad</th>
          <th style="width: 32mm;" class="right">Precio Unitario</th>
          <th style="width: 35mm;" class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => {
          const qty = Number(it.quantity) || 0
          const price = Number(it.unitPrice) || 0
          const total = qty * price
          const presentation = it.presentation || it.size || it.unit || ''
          return `<tr>
            <td class="center">${idx + 1}</td>
            <td>
              <div class="item-name">${it.name || it.productName || 'Producto'}</div>
              ${it.code ? `<div class="item-sub">Ref: ${it.code}</div>` : ''}
            </td>
            <td>${presentation}</td>
            <td class="center">${qty.toLocaleString('es-ES')}</td>
            <td class="right">${price.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}</td>
            <td class="right">${total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="total-row sub">
          <span>Subtotal</span>
          <span>${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${currency}</span>
        </div>
        ${discount > 0 ? `<div class="total-row disc">
          <span>Descuento</span>
          <span>-${discount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${currency}</span>
        </div>` : ''}
        ${shipping > 0 ? `<div class="total-row sub">
          <span>Transporte</span>
          <span>${shipping.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${currency}</span>
        </div>` : ''}
        ${tax > 0 ? `<div class="total-row sub">
          <span>${taxRate}% I.V.A.</span>
          <span>${tax.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${currency}</span>
        </div>` : ''}
        <div class="total-row grand">
          <span>TOTAL GENERAL</span>
          <span>${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${currency}</span>
        </div>
      </div>
    </div>

    <div class="bottom">
      <div class="conditions">
        <h4>Condiciones Generales</h4>
        <ul>
          <li>Los productos viajan por cuenta y riesgo del comprador.</li>
          <li>Cualquier reclamación debe hacerse dentro de las 48h después de la recepción.</li>
          <li>Pagos: transferencia bancaria o efectivo según condiciones acordadas.</li>
        </ul>
      </div>
      <div class="signature">
        <div class="sig-label">Firma y sello del cliente</div>
      </div>
    </div>

    <div class="thanks">¡GRACIAS POR SU CONFIANZA!</div>

    <div class="footer-info">
      ${(companyInfo.name || 'SAHEL').toUpperCase()} · ${companyInfo.tagline || 'Produits d\'Hygiène'}
    </div>
  </div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// Order sheet con auth por query string
router.get('/order-sheet-view/:orderId', (req, res) => {
  const token = req.query.token
  if (token) {
    try {
      const jwt = require('jsonwebtoken')
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'cleanerp-dev-secret-change-in-production-9f8e7d6c5b4a3210')
    } catch (e) {}
  }
  return router.handle({ ...req, url: `/order-sheet/${req.params.orderId}`, method: 'GET' }, res, () => {})
})

// ---------- ORDER SHEET (Hoja de pedido A4 profesional) ----------
// Documento imprimible con el diseño de la imagen de referencia
function buildOrderSheetHTML(order, customer, items) {
  const companyInfo = getConfig('company', { name: 'SAHEL', tagline: 'Produits d\'Hygiène', cif: '', address: 'Bamako, Mali', phone: '+223 70 00 00 00', email: 'contact@sahel.ml', web: 'www.sahel.ml' })
  const subtotal = order.subtotal || 0
  const tax = order.tax || 0
  const discount = order.discount || 0
  const total = order.total || 0
  const shipping = order.shipping || 0
  const currency = order.currency || 'FCFA'
  const orderDate = order.created_at ? order.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
  const deliveryDate = order.delivery_date || ''
  const seller = order.seller || order.created_by_name || 'Administración'
  const paymentTerms = order.payment_terms || 'Contado'
  const customerRef = order.customer_ref || ''

  const fmt = (n) => new Intl.NumberFormat('es-ES').format(Math.round(n || 0)) + ' ' + currency
  const safe = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const itemRows = (items || []).map((it, i) => {
    const name = it.name || it.productName || ''
    const code = it.code || ''
    const pres = it.presentation || ''
    const qty = it.quantity || 0
    const price = it.unitPrice || 0
    const lineTotal = (qty * price) * (1 - (it.discount || 0) / 100)
    return `<tr>
      <td style="text-align:center;width:10mm;">${i + 1}</td>
      <td><strong>${safe(name)}</strong>${code ? '<br><span style="color:#6b7280;font-size:8.5pt;">' + safe(code) + '</span>' : ''}</td>
      <td style="text-align:center;width:32mm;">${safe(pres)}</td>
      <td style="text-align:center;width:18mm;">${new Intl.NumberFormat('es-ES').format(qty)}</td>
      <td style="text-align:right;width:30mm;">${fmt(price)}</td>
      <td style="text-align:right;width:30mm;font-weight:600;">${fmt(lineTotal)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Hoja de Pedido ${safe(order.number)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background: #f3f4f6; color: #1f2937; padding: 12px; font-size: 9pt; }
  .no-print { background: #1f2937; color: white; padding: 12px; display: flex; gap: 8px; justify-content: center; align-items: center; position: sticky; top: 0; z-index: 100; margin: -12px -12px 12px -12px; }
  .no-print button { padding: 10px 18px; font-size: 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-family: inherit; }
  .no-print button:hover { background: #1d4ed8; }
  .no-print button.close { background: #6b7280; }
  .sheet { width: 210mm; min-height: auto; margin: 0 auto; background: white; padding: 8mm 10mm; box-shadow: 0 2px 12px rgba(0,0,0,.12); }

  .header { display: grid; grid-template-columns: 45mm 1fr 60mm; gap: 3mm; align-items: start; padding-bottom: 3mm; border-bottom: 1.2pt solid #1e3a8a; margin-bottom: 3mm; }
  .logo-box { border: 0.6pt solid #cbd5e1; padding: 2mm; text-align: center; }
  .logo-fallback { color: #1e3a8a; font-weight: 900; font-size: 20pt; letter-spacing: 1px; padding: 6mm 4mm; }
  .logo-fallback .tag { font-size: 7pt; font-weight: 600; letter-spacing: 2.5px; color: #475569; display: block; margin-top: 2mm; }
  .doc-title { text-align: center; padding: 2mm 0; }
  .doc-title h1 { font-size: 18pt; color: #1e3a8a; letter-spacing: 2px; font-weight: 900; margin: 0 0 1mm 0; }
  .doc-title .divider { width: 30mm; height: 0.8pt; background: #1e3a8a; margin: 2mm auto 0; }
  .company-info { font-size: 8.5pt; line-height: 1.55; color: #475569; margin-top: 4mm; }
  .company-info .name { font-size: 9.5pt; font-weight: 700; color: #1e3a8a; letter-spacing: 0.5px; margin-bottom: 1.5mm; }
  .company-info .row { display: flex; align-items: center; gap: 2mm; margin: 0.6mm 0; }
  .company-info .ic { width: 8pt; color: #2563eb; flex-shrink: 0; }
  .order-box { border: 0.8pt solid #1e3a8a; padding: 4mm 5mm; text-align: center; }
  .order-box .lbl { font-size: 7.5pt; color: #1e3a8a; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }
  .order-box .num { font-size: 14pt; color: #1e3a8a; font-weight: 800; letter-spacing: 0.5px; margin: 1mm 0; }
  .order-box .lbl2 { font-size: 7.5pt; color: #1e3a8a; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-top: 2mm; }
  .order-box .date { font-size: 10pt; color: #1e3a8a; font-weight: 700; margin-top: 1mm; }

  .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 3mm; }
  .info-box { border: 0.6pt solid #cbd5e1; }
  .info-box h3 { background: #1e3a8a; color: white; padding: 2mm 4mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; }
  .info-box .body { padding: 3mm 4mm; }
  .info-row { display: flex; gap: 2mm; margin: 1.2mm 0; font-size: 8.8pt; align-items: flex-start; }
  .info-row .ic { color: #2563eb; flex-shrink: 0; margin-top: 0.5mm; width: 9pt; }
  .info-row .lbl { font-weight: 700; color: #1e3a8a; width: 28mm; flex-shrink: 0; }
  .info-row .val { color: #1f2937; flex: 1; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
  table.items thead th { background: #1e3a8a; color: white; padding: 1.5mm 2mm; text-align: center; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
  table.items tbody td { padding: 1.5mm 2mm; border-bottom: 0.4pt solid #e5e7eb; font-size: 8.5pt; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #f9fafb; }

  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 3mm; }
  .totals { width: 70mm; }
  .totals .row { display: flex; justify-content: space-between; padding: 1mm 3mm; font-size: 9pt; }
  .totals .row.grand { background: #1e3a8a; color: white; font-weight: 800; font-size: 10.5pt; padding: 2mm 3mm; }

  .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 2mm; }
  .conditions { border: 0.6pt solid #cbd5e1; padding: 2mm 3mm; }
  .conditions h4 { color: #1e3a8a; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 1mm; display: flex; align-items: center; gap: 2mm; }
  .conditions ul { list-style: disc; padding-left: 4mm; font-size: 7.5pt; color: #475569; line-height: 1.4; }
  .signature { border: 0.6pt solid #cbd5e1; padding: 2mm 3mm; display: flex; flex-direction: column; justify-content: flex-end; min-height: 25mm; }
  .signature .sig-line { border-top: 0.5pt solid #6b7280; margin-top: 10mm; padding-top: 1.5mm; text-align: center; font-size: 8pt; color: #475569; }

  .thanks { text-align: center; color: #1e3a8a; font-size: 11pt; font-weight: 800; letter-spacing: 2.5px; margin: 3mm 0 2mm; }

  .footer { display: none; }

  @media print {
    body { background: white; padding: 0; margin: 0; }
    .no-print { display: none; }
    .sheet { box-shadow: none; padding: 6mm 8mm; width: 100%; max-width: 210mm; margin: 0; }
    @page { size: A4; margin: 0; }
    @page :first { margin-bottom: 0; }
  }
</style>
  <script>
// Script de traducción embebido - SOLO para documentos
// Se inyecta directamente en el HTML del documento

const DICT = {"es":{"Imprimir / Guardar PDF":"Imprimir / Guardar PDF","Enviar por email":"Enviar por email","Cerrar":"Cerrar","HOJA DE PEDIDO":"HOJA DE PEDIDO","PEDIDO N°":"PEDIDO N°","Fecha":"Fecha","Pedido N°":"Pedido N°","N°":"N°","Descripción":"Descripción","Presentación":"Presentación","Cantidad":"Cantidad","Precio Unitario":"Precio Unitario","Total":"Total","Subtotal":"Subtotal","Descuento":"Descuento","Transporte":"Transporte","TOTAL GENERAL":"TOTAL GENERAL","I.V.A.":"I.V.A.","IVA":"IVA","Base imponible":"Base imponible","Datos del Cliente":"Datos del Cliente","Detalles del Pedido":"Detalles del Pedido","Nombre:":"Nombre:","Dirección:":"Dirección:","Teléfono:":"Teléfono:","Email:":"Email:","NIF / VAT:":"NIF / VAT:","Fecha del pedido:":"Fecha del pedido:","Fecha de entrega:":"Fecha de entrega:","Condiciones de pago:":"Condiciones de pago:","Vendedor:":"Vendedor:","Referencia:":"Referencia:","Notas:":"Notas:","Condiciones Generales":"Condiciones Generales","Firma y sello del cliente":"Firma y sello del cliente","¡GRACIAS POR SU CONFIANZA!":"¡GRACIAS POR SU CONFIANZA!","FACTURA":"FACTURA","Factura N°":"Factura N°","Forma de pago":"Forma de pago","Vencimiento":"Vencimiento","Importe":"Importe","Tarjeta de Cliente":"Tarjeta de Cliente","Cliente":"Cliente","Entrega de Pedidos":"Entrega de Pedidos","Buscar cliente":"Buscar cliente","Escanear QR o escribir código":"Escanear QR o escribir código","Buscar":"Buscar","Pedidos pendientes":"Pedidos pendientes","Pedidos entregados":"Pedidos entregados","Sin pedidos pendientes":"Sin pedidos pendientes","Entregar":"Entregar","Ya entregados":"Ya entregados","Volver":"Volver","Cargando...":"Cargando...","Cliente no encontrado":"Cliente no encontrado","Verificar el código":"Verificar el código","Error de conexion":"Error de conexión","No se puede conectar con el servidor":"No se puede conectar con el servidor","Pedido ya entregado":"Pedido ya entregado","Entrega registrada":"Entrega registrada","Pedido no encontrado":"Pedido no encontrado","Iniciar sesion":"Iniciar sesión","Iniciar sesión":"Iniciar sesión","Accede a tu panel de control":"Accede a tu panel de control","Usuario":"Usuario","Contrasena":"Contraseña","Contraseña":"Contraseña","Entrar":"Entrar","Entrando...":"Entrando...","Cuentas de prueba":"Cuentas de prueba","Administrador":"Administrador","Produccion":"Producción","Producción":"Producción","Almacen":"Almacén","Almacén":"Almacén","Comercial":"Comercial","Contabilidad":"Contabilidad"},"fr":{"Imprimir / Guardar PDF":"Imprimer / Sauvegarder PDF","Enviar por email":"Envoyer par email","Cerrar":"Fermer","HOJA DE PEDIDO":"BON DE COMMANDE","PEDIDO N°":"COMMANDE N°","Fecha":"Date","Pedido N°":"Commande N°","N°":"N°","Descripción":"Description","Presentación":"Présentation","Cantidad":"Quantité","Precio Unitario":"Prix Unitaire","Total":"Total","Subtotal":"Sous-total","Descuento":"Remise","Transporte":"Transport","TOTAL GENERAL":"TOTAL GÉNÉRAL","I.V.A.":"T.V.A.","IVA":"TVA","Base imponible":"Base imposable","Datos del Cliente":"Données du Client","Detalles del Pedido":"Détails de la Commande","Nombre:":"Nom :","Dirección:":"Adresse :","Teléfono:":"Téléphone :","Email:":"Email :","NIF / VAT:":"NIF / TVA :","Fecha del pedido:":"Date de commande :","Fecha de entrega:":"Date de livraison :","Condiciones de pago:":"Conditions de paiement :","Vendedor:":"Vendeur :","Referencia:":"Référence :","Notas:":"Notes :","Condiciones Generales":"Conditions Générales","Firma y sello del cliente":"Signature et cachet du client","¡GRACIAS POR SU CONFIANZA!":"MERCI DE VOTRE CONFIANCE !","FACTURA":"FACTURE","Factura N°":"Facture N°","Forma de pago":"Mode de paiement","Vencimiento":"Échéance","Importe":"Montant","Tarjeta de Cliente":"Carte Client","Cliente":"Client","Entrega de Pedidos":"Livraison de Commandes","Buscar cliente":"Rechercher client","Escanear QR o escribir código":"Scanner QR ou saisir le code","Buscar":"Rechercher","Pedidos pendientes":"Commandes en attente","Pedidos entregados":"Commandes livrées","Sin pedidos pendientes":"Aucune commande en attente","Entregar":"Livrer","Ya entregados":"Déjà livrées","Volver":"Retour","Cargando...":"Chargement...","Cliente no encontrado":"Client non trouvé","Verificar el código":"Vérifier le code","Error de conexion":"Erreur de connexion","No se puede conectar con el servidor":"Impossible de se connecter au serveur","Pedido ya entregado":"Commande déjà livrée","Entrega registrada":"Livraison enregistrée","Pedido no encontrado":"Commande non trouvée","Iniciar sesion":"Se connecter","Iniciar sesión":"Se connecter","Accede a tu panel de control":"Accédez à votre tableau de bord","Usuario":"Utilisateur","Contrasena":"Mot de passe","Contraseña":"Mot de passe","Entrar":"Entrer","Entrando...":"Connexion...","Cuentas de prueba":"Comptes de test","Administrador":"Administrateur","Produccion":"Production","Producción":"Production","Almacen":"Entrepôt","Almacén":"Entrepôt","Comercial":"Commercial","Contabilidad":"Comptabilité"},"en":{"Imprimir / Guardar PDF":"Print / Save PDF","Enviar por email":"Send by email","Cerrar":"Close","HOJA DE PEDIDO":"ORDER FORM","PEDIDO N°":"ORDER N°","Fecha":"Date","Pedido N°":"Order N°","N°":"N°","Descripción":"Description","Presentación":"Presentation","Cantidad":"Quantity","Precio Unitario":"Unit Price","Total":"Total","Subtotal":"Subtotal","Descuento":"Discount","Transporte":"Shipping","TOTAL GENERAL":"GRAND TOTAL","I.V.A.":"V.A.T.","IVA":"VAT","Base imponible":"Taxable base","Datos del Cliente":"Customer Details","Detalles del Pedido":"Order Details","Nombre:":"Name:","Dirección:":"Address:","Teléfono:":"Phone:","Email:":"Email:","NIF / VAT:":"Tax ID:","Fecha del pedido:":"Order date:","Fecha de entrega:":"Delivery date:","Condiciones de pago:":"Payment terms:","Vendedor:":"Seller:","Referencia:":"Reference:","Notas:":"Notes:","Condiciones Generales":"General Conditions","Firma y sello del cliente":"Customer signature and stamp","¡GRACIAS POR SU CONFIANZA!":"THANK YOU FOR YOUR TRUST!","FACTURA":"INVOICE","Factura N°":"Invoice N°","Forma de pago":"Payment method","Vencimiento":"Due date","Importe":"Amount","Tarjeta de Cliente":"Customer Card","Cliente":"Customer","Entrega de Pedidos":"Order Delivery","Buscar cliente":"Search customer","Escanear QR o escribir código":"Scan QR or type code","Buscar":"Search","Pedidos pendientes":"Pending orders","Pedidos entregados":"Delivered orders","Sin pedidos pendientes":"No pending orders","Entregar":"Deliver","Ya entregados":"Already delivered","Volver":"Back","Cargando...":"Loading...","Cliente no encontrado":"Customer not found","Verificar el código":"Verify the code","Error de conexion":"Connection error","No se puede conectar con el servidor":"Cannot connect to server","Pedido ya entregado":"Order already delivered","Entrega registrada":"Delivery registered","Pedido no encontrado":"Order not found","Iniciar sesion":"Sign in","Iniciar sesión":"Sign in","Accede a tu panel de control":"Access your control panel","Usuario":"User","Contrasena":"Password","Contraseña":"Password","Entrar":"Sign in","Entrando...":"Signing in...","Cuentas de prueba":"Test accounts","Administrador":"Administrator","Produccion":"Production","Producción":"Production","Almacen":"Warehouse","Almacén":"Warehouse","Comercial":"Sales","Contabilidad":"Accounting"},"pt":{"Imprimir / Guardar PDF":"Imprimir / Salvar PDF","Enviar por email":"Enviar por email","Cerrar":"Fechar","HOJA DE PEDIDO":"FOLHA DE PEDIDO","PEDIDO N°":"PEDIDO N°","Fecha":"Data","Pedido N°":"Pedido N°","N°":"N°","Descripción":"Descrição","Presentación":"Apresentação","Cantidad":"Quantidade","Precio Unitario":"Preço Unitário","Total":"Total","Subtotal":"Subtotal","Descuento":"Desconto","Transporte":"Transporte","TOTAL GENERAL":"TOTAL GERAL","I.V.A.":"I.V.A.","IVA":"IVA","Base imponible":"Base tributável","Datos del Cliente":"Dados do Cliente","Detalles del Pedido":"Detalhes do Pedido","Nombre:":"Nome:","Dirección:":"Endereço:","Teléfono:":"Telefone:","Email:":"Email:","NIF / VAT:":"CNPJ/CPF:","Fecha del pedido:":"Data do pedido:","Fecha de entrega:":"Data de entrega:","Condiciones de pago:":"Condições de pagamento:","Vendedor:":"Vendedor:","Referencia:":"Referência:","Notas:":"Notas:","Condiciones Generales":"Condições Gerais","Firma y sello del cliente":"Assinatura e carimbo do cliente","¡GRACIAS POR SU CONFIANZA!":"OBRIGADO PELA SUA CONFIANÇA!","FACTURA":"FATURA","Factura N°":"Fatura N°","Forma de pago":"Forma de pagamento","Vencimiento":"Vencimento","Importe":"Valor","Tarjeta de Cliente":"Cartão de Cliente","Cliente":"Cliente","Entrega de Pedidos":"Entrega de Pedidos","Buscar cliente":"Buscar cliente","Escanear QR o escribir código":"Escanear QR ou digitar código","Buscar":"Pesquisar","Pedidos pendientes":"Pedidos pendentes","Pedidos entregados":"Pedidos entregues","Sin pedidos pendientes":"Sem pedidos pendentes","Entregar":"Entregar","Ya entregados":"Já entregues","Volver":"Voltar","Cargando...":"Carregando...","Cliente no encontrado":"Cliente não encontrado","Verificar el código":"Verifique o código","Error de conexion":"Erro de conexão","No se puede conectar con el servidor":"Não é possível conectar ao servidor","Pedido ya entregado":"Pedido já entregue","Entrega registrada":"Entrega registrada","Pedido no encontrado":"Pedido não encontrado","Iniciar sesion":"Entrar","Iniciar sesión":"Entrar","Accede a tu panel de control":"Aceda ao seu painel de controlo","Usuario":"Utilizador","Contrasena":"Palavra-passe","Contraseña":"Palavra-passe","Entrar":"Entrar","Entrando...":"Entrando...","Cuentas de prueba":"Contas de teste","Administrador":"Administrador","Produccion":"Produção","Producción":"Produção","Almacen":"Armazém","Almacén":"Armazém","Comercial":"Comercial","Contabilidad":"Contabilidade"}};

function applyDocI18n() {
  if (window.__docI18nApplied) return;
  window.__docI18nApplied = true;

  const urlParams = new URLSearchParams(window.location.search);
  const lang = (urlParams.get('lang') || localStorage.getItem('cleanerp-lang') || 'es').toLowerCase();
  if (!DICT[lang]) lang = 'es';

  // Mapa ES normalizado -> clave
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const esToKey = {};
  for (const k in DICT.es) {
    esToKey[k] = k;
    esToKey[norm(k)] = k;
  }

  function tr(key) {
    return (DICT[lang] && DICT[lang][key]) || DICT.es[key] || key;
  }

  // Traducir text nodes
  function translateNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue || '';
      if (!raw.trim()) return;
      const txt = raw.trim();
      if (txt.length < 2 || txt.length > 100) return;
      const key = esToKey[txt] || esToKey[norm(txt)];
      if (key) {
        const newText = tr(key);
        if (newText !== txt) {
          node.nodeValue = raw.replace(txt, newText);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG') return;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (node.placeholder) {
          const k = esToKey[node.placeholder] || esToKey[norm(node.placeholder)];
          if (k) node.placeholder = tr(k);
        }
        return;
      }
      for (const child of node.childNodes) translateNode(child);
    }
  }

  // Aplicar a todo el body
  translateNode(document.body);
  document.documentElement.lang = lang;
  document.title = (lang === 'es' ? 'Hoja de Pedido' : (lang === 'fr' ? 'Bon de Commande' : (lang === 'en' ? 'Order Form' : 'Folha de Pedido')));
}

// Ejecutar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyDocI18n);
} else {
  applyDocI18n();
}

// Re-aplicar para contenido dinámico
const obs = new MutationObserver(() => {
  clearTimeout(window.__docI18nTimeout);
  window.__docI18nTimeout = setTimeout(applyDocI18n, 50);
});
obs.observe(document.body, { childList: true, subtree: true });

// Cambios de idioma
window.addEventListener('storage', e => {
  if (e.key === 'cleanerp-lang') {
    window.location.reload();
  }
});

console.log('[doc-i18n] Idioma:', new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('cleanerp-lang') || 'es');

  </script>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">Imprimir / Guardar PDF</button>
  <button onclick="sendEmail()">Enviar por email</button>
  <button class="close" onclick="window.close()">Cerrar</button>
</div>
<div class="sheet">
  <div class="header">
    <div class="logo-box">
      <div class="logo-fallback">SAHEL<span class="tag">PRODUITS D'HYGIENE</span></div>
    </div>
    <div>
      <div class="doc-title"><h1>HOJA DE PEDIDO</h1><div class="divider"></div></div>
      <div class="company-info">
        <div class="name">${safe((companyInfo.name || 'SAHEL').toUpperCase() + ' ' + (companyInfo.tagline || 'PRODUITS D\'HYGIENE'))}</div>
        <div class="row"><span class="ic">📍</span> ${safe(companyInfo.address || 'Bamako, Mali')}</div>
        <div class="row"><span class="ic">📞</span> ${safe(companyInfo.phone || '+223 70 00 00 00')}</div>
        <div class="row"><span class="ic">✉</span> ${safe(companyInfo.email || 'contact@sahel.ml')}</div>
        <div class="row"><span class="ic">🌐</span> ${safe(companyInfo.web || 'www.sahel.ml')}</div>
      </div>
    </div>
    <div class="order-box">
      <div class="lbl">Pedido N°</div>
      <div class="num">${safe(order.number)}</div>
      <div class="lbl2">Fecha</div>
      <div class="date">${safe(orderDate)}</div>
    </div>
  </div>

  <div class="info-section">
    <div class="info-box">
      <h3>Datos del Cliente</h3>
      <div class="body">
        <div class="info-row"><span class="ic">👤</span><span class="lbl">Nombre:</span><span class="val">${safe(customer?.name || '-')}</span></div>
        <div class="info-row"><span class="ic">📍</span><span class="lbl">Dirección:</span><span class="val">${safe(customer?.address || '-')}${customer?.city ? '<br>' + safe(customer.city) + (customer?.country ? ', ' + safe(customer.country) : '') : ''}</span></div>
        <div class="info-row"><span class="ic">📞</span><span class="lbl">Teléfono:</span><span class="val">${safe(customer?.phone || '-')}</span></div>
        <div class="info-row"><span class="ic">✉</span><span class="lbl">Email:</span><span class="val">${safe(customer?.email || '-')}</span></div>
        <div class="info-row"><span class="ic">🏢</span><span class="lbl">NIF / VAT:</span><span class="val">${safe(customer?.cif || '-')}</span></div>
      </div>
    </div>
    <div class="info-box">
      <h3>Detalles del Pedido</h3>
      <div class="body">
        <div class="info-row"><span class="ic">📅</span><span class="lbl">Fecha del pedido:</span><span class="val">${safe(orderDate)}</span></div>
        <div class="info-row"><span class="ic">🚚</span><span class="lbl">Fecha de entrega:</span><span class="val">${safe(deliveryDate || '-')}</span></div>
        <div class="info-row"><span class="ic">💳</span><span class="lbl">Condiciones de pago:</span><span class="val">${safe(paymentTerms)}</span></div>
        <div class="info-row"><span class="ic">👤</span><span class="lbl">Vendedor:</span><span class="val">${safe(seller)}</span></div>
        <div class="info-row"><span class="ic">🔖</span><span class="lbl">Referencia del cliente:</span><span class="val">${safe(customerRef || '-')}</span></div>
        <div class="info-row"><span class="ic">📝</span><span class="lbl">Notas:</span><span class="val">${safe(order.notes || '-')}</span></div>
      </div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:10mm;">N°</th>
        <th>Descripción</th>
        <th style="width:32mm;">Presentación</th>
        <th style="width:18mm;">Cantidad</th>
        <th style="width:30mm;">Precio Unitario</th>
        <th style="width:30mm;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="6" style="text-align:center;padding:8mm;">Sin productos</td></tr>'}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      <div class="row"><span>Descuento</span><span>${fmt(discount)}</span></div>
      <div class="row"><span>Transporte</span><span>${fmt(shipping)}</span></div>
      <div class="row grand"><span>TOTAL GENERAL</span><span>${fmt(total)}</span></div>
    </div>
  </div>

  <div class="bottom">
    <div class="conditions">
      <h4>📋 Condiciones Generales</h4>
      <ul>
        <li>Los productos viajan por cuenta y riesgo del comprador.</li>
        <li>Cualquier reclamación debe hacerse dentro de las 48h después de la recepción.</li>
        <li>Pagos: transferencia bancaria o efectivo según condiciones acordadas.</li>
      </ul>
    </div>
    <div class="signature">
      <div class="sig-line">Firma y sello del cliente</div>
    </div>
  </div>

  <div class="thanks">¡GRACIAS POR SU CONFIANZA!</div>
</div>
<script>
function sendEmail() {
  const email = '${safe(customer?.email || '')}';
  const name = '${safe(customer?.name || 'Cliente')}';
  const num = '${safe(order.number)}';
  if (!email) { alert('El cliente no tiene email configurado.\n\nUse el boton de imprimir para guardar el PDF y adjuntarlo manualmente.'); return; }
  const subject = encodeURIComponent('Hoja de Pedido ' + num + ' - SAHEL');
  const body = encodeURIComponent('Estimado/a ' + name + ',\n\nAdjunto encontrara la hoja de pedido ' + num + '.\n\nQuedamos a su disposicion para cualquier consulta.\n\nAtentamente,\nSAHEL - Produits d\'Hygiene');
  window.location.href = 'mailto:' + email + '?subject=' + subject + '&body=' + body;
}
</script>
</body>
</html>`
}

router.get('/order-sheet/:orderId', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
  if (!order) return res.status(404).send('<h1>Pedido no encontrado</h1>')
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id)
  let items = []
  try { items = JSON.parse(order.items_json || '[]') } catch {}
  const html = buildOrderSheetHTML(order, customer, items)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// Order sheet con auth por query string (para abrir desde email)
router.get('/order-sheet-view/:orderId', (req, res) => {
  const token = req.query.token
  if (token) {
    try {
      const jwt = require('jsonwebtoken')
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'cleanerp-dev-secret-change-in-production-9f8e7d6c5b4a3210')
    } catch (e) {}
  }
  return router.handle({ ...req, url: `/order-sheet/${req.params.orderId}`, method: 'GET' }, res, () => {})
})

// Enviar por email al cliente (mailto link)
// POST /api/orders/:orderId/send-email
router.post('/orders/:orderId/send-email', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id)
  if (!customer || !customer.email) return res.status(400).json({ error: 'El cliente no tiene email configurado' })
  const subject = `Hoja de Pedido ${order.number} - SAHEL`
  const body = `Estimado/a ${customer.name},\n\nAdjuntamos los detalles de su pedido ${order.number}.\n\nPuede consultar el documento completo en: ${req.protocol}://${req.get('host')}/api/order-sheet/${order.id}\n\nQuedamos a su disposicion.\n\nAtentamente,\nSAHEL - Produits d'Hygiene`
  const mailto = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  addHistory(req, { action: 'enviar_email', module: 'Pedidos', entityId: order.id, description: `Hoja de pedido ${order.number} enviada por email a ${customer.email}` })
  res.json({ ok: true, method: 'mailto', to: customer.email, mailto, subject })
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
router.post('/production-orders', auth, requirePermission('production', 'create'), (req, res) => {
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
router.patch('/production-orders/:id/start', auth, requirePermission('production', 'edit'), (req, res) => {
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
router.patch('/production-orders/:id/complete', auth, requirePermission('production', 'edit'), (req, res) => {
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
router.delete('/production-orders/:id', auth, requirePermission('production', 'delete'), (req, res) => {
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
router.post('/purchases', auth, requirePermission('purchases', 'create'), (req, res) => {
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
router.put('/purchases/:id', auth, requirePermission('purchases', 'edit'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE purchases SET supplier_id=?, invoice=?, items_json=?, subtotal=?, tax=?, total=?, status=?, date=?, notes=? WHERE id=?')
    .run(b.supplierId, b.invoice, JSON.stringify(b.items || []), b.subtotal, b.tax, b.total, b.status, b.date, b.notes, req.params.id)
  res.json({ ok: true })
})
router.delete('/purchases/:id', auth, requirePermission('purchases', 'delete'), (req, res) => {
  db.prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- EXPENSES ----------
const mapExp = (e) => ({ id: e.id, date: e.date, category: e.category, amount: e.amount, description: e.description, attachment: e.attachment, createdBy: e.created_by })

router.get('/expenses', auth, (_req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC').all().map(mapExp))
})
router.post('/expenses', auth, requirePermission('expenses', 'create'), (req, res) => {
  const b = req.body
  const id = uid('e-')
  db.prepare('INSERT INTO expenses (id, date, category, amount, description, attachment, created_by) VALUES (?,?,?,?,?,?,?)')
    .run(id, b.date || new Date().toISOString(), b.category, b.amount, b.description || '', b.attachment || null, req.user.id)
  addHistory(req, { action: 'crear', module: 'Gastos', entityId: id, description: `Gasto de ${b.category}: ${b.amount}€` })
  res.json({ id })
})
router.put('/expenses/:id', auth, requirePermission('expenses', 'edit'), (req, res) => {
  const b = req.body
  db.prepare('UPDATE expenses SET date=?, category=?, amount=?, description=?, attachment=? WHERE id=?')
    .run(b.date, b.category, b.amount, b.description, b.attachment, req.params.id)
  res.json({ ok: true })
})
router.delete('/expenses/:id', auth, requirePermission('expenses', 'delete'), (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---------- LOTS ----------
// Helper: calcular si un lote pendiente/en_curso se puede producir con el stock actual
function canProduceLot(lotId) {
  const lot = db.prepare('SELECT * FROM lots WHERE id = ?').get(lotId)
  if (!lot) return { canProduce: false, shortages: [] }
  const recipe = db.prepare('SELECT * FROM recipes WHERE product_id = ?').get(lot.product_id)
  if (!recipe) return { canProduce: true, shortages: [] } // sin receta, asumimos OK
  let items = []
  try { items = JSON.parse(recipe.items_json || '[]') } catch {}
  const recipeBatch = recipe.batch_size || 1
  const liters = Number(lot.quantity) || 0
  const ratio = liters / recipeBatch
  const shortages = []
  for (const it of items) {
    const totalQty = it.quantity * ratio
    let available = 0
    if (it.materialType === 'raw') {
      const m = db.prepare('SELECT stock FROM raw_materials WHERE id = ?').get(it.materialId)
      available = m ? m.stock : 0
    } else {
      const m = db.prepare('SELECT stock FROM packaging WHERE id = ?').get(it.materialId)
      available = m ? m.stock : 0
    }
    if (available < totalQty) {
      shortages.push({
        materialId: it.materialId,
        materialType: it.materialType,
        required: totalQty,
        available: available,
        missing: totalQty - available
      })
    }
  }
  return { canProduce: shortages.length === 0, shortages }
}

const mapLot = (l) => {
  const result = (l.status === 'pendiente' || l.status === 'en_curso') ? canProduceLot(l.id) : { canProduce: true, shortages: [] }
  return {
    id: l.id,
    lotNumber: l.code || l.lot_number || '',
    productionOrderNumber: l.production_order_number || '',
    productId: l.product_id,
    recipeId: l.recipe_id || '',
    quantity: l.quantity || 0,
    rawMaterialsUsed: JSON.parse(l.raw_materials_json || '[]'),
    producedBy: l.produced_by,
    machineId: l.machine_id || undefined,
    producedAt: l.received_at || l.produced_at,
    expiryDate: l.expiry_date || undefined,
    status: l.status,
    notes: l.notes,
    canProduce: result.canProduce,
    shortages: result.shortages,
    startedAt: l.started_at || undefined,
    finishedAt: l.finished_at || undefined
  }
}

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
// Cuando se marca como 'completado' por primera vez:
//   - Descuenta MPs y envases del stock
//   - Suma los litros al stock del producto
//   - Crea el detalle de materiales consumidos
//   - Marca started_at/finished_at
router.patch('/lots/:id/status', auth, requirePermission('production', 'edit'), (req, res) => {
  const { status } = req.body
  const validStatuses = ['pendiente', 'en_curso', 'completado', 'cancelado']
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido. Debe ser: pendiente, en_curso, completado, cancelado' })
  }
  const lot = db.prepare('SELECT * FROM lots WHERE id = ?').get(req.params.id)
  if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
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

  const now = new Date().toISOString()
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(lot.product_id)

  // Al pasar a en_curso por primera vez: marca started_at
  if (status === 'en_curso' && !lot.started_at) {
    db.prepare('UPDATE lots SET status = ?, started_at = ? WHERE id = ?').run(status, now, req.params.id)
  }
  // Al pasar a completado: descuenta stock, suma al producto, marca finished_at
  else if (status === 'completado' && lot.status !== 'completado') {
    if (!product) return res.status(400).json({ error: 'Producto no encontrado' })
    const recipe = db.prepare('SELECT * FROM recipes WHERE product_id = ?').get(lot.product_id)
    if (!recipe) return res.status(400).json({ error: 'El producto no tiene receta definida' })

    let items
    try { items = JSON.parse(recipe.items_json) } catch { items = [] }
    if (!items.length) return res.status(400).json({ error: 'La receta no tiene items definidos' })

    const recipeBatch = recipe.batch_size || 1
    const liters = Number(lot.quantity)
    if (!Number.isFinite(liters) || liters <= 0) {
      return res.status(400).json({ error: 'Cantidad del lote inválida' })
    }
    const ratio = liters / recipeBatch

    // Calcular materiales necesarios
    const needed = items.map(it => {
      const totalQty = it.quantity * ratio
      if (it.materialType === 'raw') {
        const m = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(it.materialId)
        return { ...it, totalQty, available: m ? m.stock : 0, name: m?.name || it.materialId, unit: m?.unit || it.unit }
      } else {
        const m = db.prepare('SELECT * FROM packaging WHERE id = ?').get(it.materialId)
        return { ...it, totalQty, available: m ? m.stock : 0, name: m?.name || it.materialId, unit: 'ud' }
      }
    })

    // Verificar stock
    const shortages = needed.filter(n => n.available < n.totalQty)
    if (shortages.length > 0) {
      return res.status(400).json({
        error: 'Stock insuficiente para completar la fabricación',
        shortages: shortages.map(s => ({ name: s.name, needed: s.totalQty, available: s.available, unit: s.unit }))
      })
    }

    // Descontar stock y sumar al producto
    const tx = db.transaction(() => {
      for (const n of needed) {
        if (n.materialType === 'raw') {
          db.prepare('UPDATE raw_materials SET stock = stock - ?, last_updated = ? WHERE id = ?').run(n.totalQty, now, n.materialId)
        } else {
          db.prepare('UPDATE packaging SET stock = stock - ?, last_updated = ? WHERE id = ?').run(n.totalQty, now, n.materialId)
        }
      }
      // Sumar litros al stock del producto
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(liters, lot.product_id)
      // Actualizar lote
      db.prepare('UPDATE lots SET status = ?, finished_at = ?, raw_materials_json = ? WHERE id = ?')
        .run(status, now, JSON.stringify(needed.map(n => ({ materialId: n.materialId, materialType: n.materialType, quantity: n.totalQty, unit: n.unit, name: n.name }))), req.params.id)
      // Notificación
      db.prepare('INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,0,?,?)')
        .run(uid('n-'), 'produccion', 'Producción completada', `Fabricados ${liters} L de ${product.name} — Lote ${lot.lot_number}`, 'success', now, 'lot:' + req.params.id)
    })
    tx()
    addHistory(req, { action: 'produccion', module: 'Producción', entityId: req.params.id, description: `Lote ${lot.lot_number} completado: ${liters} L de ${product.name}` })
    maybeAddStockNotifications()
    return res.json({ ok: true, id: req.params.id, status, deducted: needed.length })
  }
  // Otros casos
  else {
    db.prepare('UPDATE lots SET status = ? WHERE id = ?').run(status, req.params.id)
  }
  addHistory(req, {
    action: 'cambiar_estado', module: 'Producción', entityId: req.params.id,
    description: `Lote ${lot.code || lot.lot_number} → ${status}`
  })
  res.json({ ok: true, id: req.params.id, status })
})


// POST /api/lots — crear una nueva fabricación con estado 'pendiente' (sin descontar stock todavía)
router.post('/lots', auth, requirePermission('production', 'create'), (req, res) => {
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
router.post('/produce-with-lots', auth, requirePermission('production', 'create'), (req, res) => {
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
router.post('/produce', auth, requirePermission('production', 'create'), (req, res) => {
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
router.put('/config', auth, requirePermission('settings', 'edit'), (req, res) => {
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
  const recentLots = db.prepare(`SELECT l.*, p.name as product_name FROM lots l LEFT JOIN products p ON p.id = l.product_id ORDER BY l.received_at DESC LIMIT 5`).all()
    .map(l => ({ id: l.id, lotNumber: l.code || l.lot_number, product: l.product_name, quantity: l.quantity || l.quantity_received, status: l.status, producedAt: l.received_at || l.produced_at }))
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
router.get('/backup', auth, requirePermission('settings', 'view'), (_req, res) => {
  const tables = ['users','suppliers','raw_materials','packaging','products','recipes','customers','orders','purchases','expenses','lots','notifications','history','config']
  const dump = {}
  for (const t of tables) {
    if (t === 'config') dump[t] = db.prepare('SELECT * FROM config').all()
    else dump[t] = db.prepare(`SELECT * FROM ${t}`).all()
  }
  res.setHeader('Content-Disposition', `attachment; filename="cleanerp-backup-${new Date().toISOString().slice(0,10)}.json"`)
  res.json(dump)
})

router.post('/restore', auth, requirePermission('settings', 'edit'), (req, res) => {
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

// ---------- PERMISSION DEFAULTS ----------
const PERMISSION_MODULES = [
  { key: 'home',          label: 'Inicio',         icon: 'home' },
  { key: 'raw_materials', label: 'Materias Primas', icon: 'beaker' },
  { key: 'packaging',     label: 'Embalaje',       icon: 'package' },
  { key: 'recipes',       label: 'Recetas',        icon: 'book' },
  { key: 'production',    label: 'Producción',     icon: 'factory' },
  { key: 'lots',          label: 'Lotes',          icon: 'box' },
  { key: 'customers',     label: 'Clientes',       icon: 'users' },
  { key: 'sales',         label: 'Pedidos',        icon: 'shopping-cart' },
  { key: 'suppliers',     label: 'Proveedores',    icon: 'truck' },
  { key: 'purchases',     label: 'Compras',        icon: 'inbox' },
  { key: 'expenses',      label: 'Gastos',         icon: 'receipt' },
  { key: 'inventory',     label: 'Inventario',     icon: 'archive' },
  { key: 'reports',       label: 'Informes',       icon: 'bar-chart' },
  { key: 'recalls',       label: 'Retiradas',      icon: 'alert' },
  { key: 'users',         label: 'Usuarios',       icon: 'user-cog' },
  { key: 'settings',      label: 'Configuración',  icon: 'settings' },
]

const PERMISSION_ACTIONS = [
  { key: 'view',   label: 'Ver' },
  { key: 'create', label: 'Crear' },
  { key: 'edit',   label: 'Editar' },
  { key: 'delete', label: 'Eliminar' },
]

const DEFAULT_PERMS_BY_ROLE = {
  admin: () => {
    const p = {}
    for (const m of PERMISSION_MODULES) p[m.key] = { view: true, create: true, edit: true, delete: true }
    return p
  },
  produccion: () => {
    const allowed = ['home', 'raw_materials', 'packaging', 'recipes', 'production', 'lots', 'inventory', 'recalls']
    const p = {}
    for (const m of PERMISSION_MODULES) {
      if (allowed.includes(m.key)) p[m.key] = { view: true, create: true, edit: true, delete: false }
    }
    return p
  },
  contabilidad: () => {
    const allowed = ['home', 'customers', 'sales', 'suppliers', 'purchases', 'expenses', 'inventory', 'reports']
    const p = {}
    for (const m of PERMISSION_MODULES) {
      if (allowed.includes(m.key)) p[m.key] = { view: true, create: true, edit: true, delete: false }
    }
    return p
  },
}

function getDefaultPermsForRole(role) {
  if (DEFAULT_PERMS_BY_ROLE[role]) return DEFAULT_PERMS_BY_ROLE[role]()
  return null
}

router.get('/permissions/defaults', auth, requirePermission('users', 'view'), (_req, res) => {
  res.json({
    modules: PERMISSION_MODULES,
    actions: PERMISSION_ACTIONS,
    byRole: {
      admin: getDefaultPermsForRole('admin'),
      produccion: getDefaultPermsForRole('produccion'),
      contabilidad: getDefaultPermsForRole('contabilidad'),
    }
  })
})

// ---------- RECALLS (retiradas) ----------
router.get('/recalls', auth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM recalls ORDER BY date DESC, id DESC').all();
  res.json(rows);
});

// Cualquier usuario logueado puede ver sus propios permisos (sin necesidad de ser admin)
router.get('/permissions/mine', auth, (req, res) => {
  const u = db.prepare('SELECT role, permissions FROM users WHERE id = ?').get(req.user.id)
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  let perms = null
  try { perms = u.permissions ? JSON.parse(u.permissions) : null } catch {}
  res.json({ role: u.role, permissions: perms })
})

// ---------- RECALLS (retiradas) ----------
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

// ---------- MACHINES (placeholder) ----------
router.get('/machines', auth, (_req, res) => {
  res.json([]);
});
router.post('/machines', auth, requirePermission('production', 'create'), (req, res) => {
  res.json({ ok: true, id: uid('m-') });
});
router.put('/machines/:id', auth, requirePermission('production', 'edit'), (req, res) => {
  res.json({ ok: true });
});
router.delete('/machines/:id', auth, requirePermission('production', 'delete'), (req, res) => {
  res.json({ ok: true });
});

// ---------- RAW MATERIAL LOTS (entradas individuales) ----------
// Cada entrada (compra/albarán) al almacén queda registrada.
// Al crear, suma al stock del material.
// Al borrar, resta del stock del material (devuelve las unidades).
router.get('/raw-material-lots', auth, (_req, res) => {
  const rows = db.prepare(`
    SELECT rml.*, rm.name as material_name, rm.code as material_code, rm.unit as material_unit
    FROM raw_material_lots rml
    LEFT JOIN raw_materials rm ON rm.id = rml.raw_material_id
    ORDER BY rml.received_at DESC, rml.id DESC
  `).all()
  res.json(rows.map(r => ({
    id: r.id,
    rawMaterialId: r.raw_material_id,
    materialName: r.material_name,
    materialCode: r.material_code,
    unit: r.unit || r.material_unit,
    code: r.code,
    quantity: r.quantity,
    remaining: r.remaining,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    invoice: r.invoice,
    receivedAt: r.received_at,
    expiryDate: r.expiry_date,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  })))
})

router.post('/raw-material-lots', auth, requirePermission('purchases', 'create'), (req, res) => {
  const b = req.body || {}
  const { rawMaterialId, quantity, quantityReceived, quantityRemaining, supplierId, supplierName, invoice, receivedAt, expiryDate, notes, internalLotNumber, supplierLotNumber, manufactureDate, certificates } = b
  if (!rawMaterialId) return res.status(400).json({ error: 'Falta rawMaterialId' })
  const material = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(rawMaterialId)
  if (!material) return res.status(404).json({ error: 'Materia prima no encontrada' })
  // Aceptar quantity, quantityReceived, o quantityRemaining como cantidad
  const qty = Number(quantity ?? quantityReceived ?? quantityRemaining)
  if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Cantidad inválida' })

  const now = new Date().toISOString()

  // ─────────────────────────────────────────────
  // UNIFICADO: generar código MP- y grabar en lots + raw_material_lots
  // ─────────────────────────────────────────────
  let code = b.code
  if (!code) {
    // Siguiente código MP-
    const row = db.prepare(`SELECT code FROM lots WHERE code LIKE 'MP-%' ORDER BY length(code) DESC, code DESC LIMIT 1`).get()
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    code = `MP-${String(nextNum).padStart(5, '0')}`
  }

  const id = uid('rml-')
  const lotId = uid('lot-')

  // 1. Insertar en raw_material_lots (tabla de detalle de materia prima)
  db.prepare(`INSERT INTO raw_material_lots (id, raw_material_id, code, quantity, remaining, unit, supplier_id, supplier_name, invoice, received_at, expiry_date, status, notes, created_at, internal_lot_number, supplier_lot_number, manufacture_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, rawMaterialId, code, qty, qty, material.unit, supplierId || null, supplierName || null, invoice || null,
         receivedAt || now, expiryDate || null, 'active', notes || null, now,
         internalLotNumber || code, supplierLotNumber || null, manufactureDate || null)

  // 2. Insertar en lots (TABLA ÚNICA de lotes para toda la app)
  db.prepare(`INSERT OR IGNORE INTO lots (id, code, type, reference_id, raw_material_id, packaging_id, product_id, production_order_id, quantity, quantity_received, quantity_remaining, unit, supplier_id, supplier_name, invoice, received_at, expiry_date, status, notes, created_at, internal_lot_number, supplier_lot_number, manufacture_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(lotId, code, 'raw', id, rawMaterialId, null, null, null, qty, qty, qty, material.unit,
         supplierId || null, supplierName || null, invoice || null,
         receivedAt || now, expiryDate || null, 'active', notes || null, now,
         internalLotNumber || code, supplierLotNumber || null, manufactureDate || null)

  // 3. Sumar al stock del material
  db.prepare('UPDATE raw_materials SET stock = stock + ?, last_updated = ? WHERE id = ?').run(qty, now, rawMaterialId)

  addHistory(req, {
    action: 'compra', module: 'Materias Primas', entityId: id,
    description: `Entrada de ${qty} ${material.unit} de ${material.name} (Lote ${code}${invoice ? ' — Factura ' + invoice : ''})`
  })
  res.json({ ok: true, id, code, lotId })
})

router.put('/raw-material-lots/:id', auth, requirePermission('purchases', 'edit'), (req, res) => {
  const b = req.body || {}
  const lot = db.prepare('SELECT * FROM raw_material_lots WHERE id = ?').get(req.params.id)
  if (!lot) return res.status(404).json({ error: 'No encontrado' })
  db.prepare(`UPDATE raw_material_lots SET supplier_id = COALESCE(?, supplier_id), supplier_name = COALESCE(?, supplier_name), invoice = COALESCE(?, invoice), expiry_date = COALESCE(?, expiry_date), notes = COALESCE(?, notes), status = COALESCE(?, status) WHERE id = ?`)
    .run(b.supplierId || null, b.supplierName || null, b.invoice || null, b.expiryDate || null, b.notes || null, b.status || null, req.params.id)
  res.json({ ok: true })
})

router.delete('/raw-material-lots/:id', auth, requirePermission('purchases', 'delete'), (req, res) => {
  const lot = db.prepare('SELECT * FROM raw_material_lots WHERE id = ?').get(req.params.id)
  if (!lot) return res.status(404).json({ error: 'No encontrado' })
  // Restar del stock del material
  db.prepare('UPDATE raw_materials SET stock = stock - ?, last_updated = ? WHERE id = ?').run(lot.remaining || lot.quantity, new Date().toISOString(), lot.raw_material_id)
  // Borrar el lote
  db.prepare('DELETE FROM raw_material_lots WHERE id = ?').run(req.params.id)
  addHistory(req, {
    action: 'borrar', module: 'Materias Primas', entityId: req.params.id,
    description: `Eliminada entrada de ${lot.quantity} ${lot.unit} (${lot.code}). Stock devuelto al material.`
  })
  res.json({ ok: true })
})

router.patch('/raw-material-lots/:id/block', auth, requirePermission('purchases', 'edit'), (req, res) => {
  const lot = db.prepare('SELECT * FROM raw_material_lots WHERE id = ?').get(req.params.id)
  if (!lot) return res.status(404).json({ error: 'No encontrado' })
  // Bloquear lote: poner status='blocked' y restar del stock disponible
  if (lot.status !== 'blocked') {
    const blocked = lot.remaining || 0
    db.prepare('UPDATE raw_materials SET stock = stock - ?, last_updated = ? WHERE id = ?').run(blocked, new Date().toISOString(), lot.raw_material_id)
    db.prepare("UPDATE raw_material_lots SET status = 'blocked', remaining = 0 WHERE id = ?").run(req.params.id)
  } else {
    // Desbloquear
    db.prepare("UPDATE raw_material_lots SET status = 'active', remaining = ? WHERE id = ?").run(lot.quantity, req.params.id)
    db.prepare('UPDATE raw_materials SET stock = stock + ?, last_updated = ? WHERE id = ?').run(lot.quantity, new Date().toISOString(), lot.raw_material_id)
  }
  res.json({ ok: true })
})

// ---------- PACKAGING LOTS (entradas individuales de envases) ----------
router.get('/packaging-lots', auth, (_req, res) => {
  res.json([])
})
router.post('/packaging-lots', auth, requirePermission('purchases', 'create'), (req, res) => {
  const b = req.body || {}
  const { packagingId, quantity, quantityReceived, quantityRemaining, supplierId, supplierName, invoice, receivedAt, expiryDate, notes, internalLotNumber, supplierLotNumber, manufactureDate, certificates } = b
  if (!packagingId) return res.status(400).json({ error: 'Falta packagingId' })
  const packaging = db.prepare('SELECT * FROM packaging WHERE id = ?').get(packagingId)
  if (!packaging) return res.status(404).json({ error: 'Envase/Embalaje no encontrado' })
  // Aceptar quantity, quantityReceived, o quantityRemaining como cantidad
  const qty = Number(quantity ?? quantityReceived ?? quantityRemaining)
  if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Cantidad inválida' })

  const now = new Date().toISOString()
  const category = packaging.category || 'envase'
  const lotType = category === 'embalaje' ? 'embalaje' : 'envase'
  const prefix = category === 'embalaje' ? 'EMB-' : 'ENV-'

  // ─────────────────────────────────────────────
  // UNIFICADO: generar código y grabar en lots + packaging_lots
  // ─────────────────────────────────────────────
  let code = b.code
  if (!code) {
    const row = db.prepare(`SELECT code FROM lots WHERE code LIKE ? ORDER BY length(code) DESC, code DESC LIMIT 1`).get(`${prefix}%`)
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    code = `${prefix}${String(nextNum).padStart(5, '0')}`
  }

  const id = uid('pkl-')
  const lotId = uid('lot-')

  // 1. Insertar en packaging_lots
  db.prepare(`INSERT INTO packaging_lots (id, packaging_id, code, quantity, remaining, supplier_id, supplier_name, invoice, received_at, expiry_date, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, packagingId, code, qty, qty, supplierId || null, supplierName || null, invoice || null,
         receivedAt || now, expiryDate || null, 'active', notes || null, now)

  // 2. Insertar en lots (TABLA ÚNICA)
  db.prepare(`INSERT OR IGNORE INTO lots (id, code, type, reference_id, raw_material_id, packaging_id, product_id, production_order_id, quantity, quantity_received, quantity_remaining, unit, supplier_id, supplier_name, invoice, received_at, expiry_date, status, notes, created_at, internal_lot_number, supplier_lot_number, manufacture_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(lotId, code, lotType, id, null, packagingId, null, null, qty, qty, qty, 'ud',
         supplierId || null, supplierName || null, invoice || null,
         receivedAt || now, expiryDate || null, 'active', notes || null, now,
         internalLotNumber || code, supplierLotNumber || null, manufactureDate || null)

  db.prepare('UPDATE packaging SET stock = stock + ?, last_updated = ? WHERE id = ?').run(qty, now, packagingId)
  addHistory(req, {
    action: 'compra', module: 'Almacén', entityId: id,
    description: `Entrada de ${qty} ud de ${packaging.name} (Lote ${code}${invoice ? ' — Factura ' + invoice : ''})`
  })
  res.json({ ok: true, id, code, lotId })
})

router.delete('/packaging-lots/:id', auth, requirePermission('purchases', 'delete'), (req, res) => {
  const lot = db.prepare('SELECT * FROM packaging_lots WHERE id = ?').get(req.params.id)
  if (!lot) return res.status(404).json({ error: 'No encontrado' })
  db.prepare('UPDATE packaging SET stock = stock - ?, last_updated = ? WHERE id = ?').run(lot.remaining || lot.quantity, new Date().toISOString(), lot.packaging_id)
  db.prepare('DELETE FROM packaging_lots WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router

// ---------- RESET DB (dev only) ----------
router.post('/reset', auth, requirePermission('settings', 'edit'), async (_req, res) => {
  const { seed } = await import('./seed.js')
  seed({ force: true })
  res.json({ ok: true })
})
// Force re-deploy: 1786565523.3838074

// Force re-deploy: 1786565670.8531992

// Final: 1786565957.2081718

// Force: 1786567748.5123284

// Recalls deployed: 1786753297.943492

// ---------- PRINT LABEL (HTML standalone) ----------
// Genera una página HTML standalone SOLO con la etiqueta, lista para imprimir
// Uso: GET /api/print-label/:lotId?token=xxx (token opcional si viene en query)
// Uso: GET /api/print-label/rml/:rmlId?token=xxx (etiqueta de materia prima)
router.get('/print-label/rml/:rmlId', auth, (req, res) => {
  const rml = db.prepare(`
    SELECT rml.*, rm.name as material_name, rm.code as material_code, rm.unit as material_unit
    FROM raw_material_lots rml
    LEFT JOIN raw_materials rm ON rm.id = rml.raw_material_id
    WHERE rml.id = ?
  `).get(req.params.rmlId)
  if (!rml) return res.status(404).send('<h1>Lote de materia prima no encontrado</h1>')

  const receivedAt = rml.received_at ? rml.received_at.split('T')[0] : new Date().toISOString().split('T')[0]
  const expiryDate = rml.expiry_date || ''
  const supplierName = rml.supplier_name || '—'
  const supplierLot = rml.code || ''
  const internalLot = `MP-${rml.id.slice(-6).toUpperCase()}`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Etiqueta ${internalLot}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .printable-label {
      width: 80mm;
      min-height: 60mm;
      padding: 3mm;
      background: white;
      border: 1px dashed #999;
      display: flex;
      flex-direction: column;
      gap: 2mm;
      font-size: 9pt;
      color: #000;
      line-height: 1.25;
    }
    .label-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 2mm;
    }
    .brand {
      font-weight: 900;
      font-size: 12pt;
      letter-spacing: 1px;
    }
    .material-name {
      font-weight: 700;
      font-size: 10pt;
      text-transform: uppercase;
    }
    .material-code {
      font-family: monospace;
      font-size: 8pt;
      color: #555;
    }
    .section {
      border-top: 1px solid #ccc;
      padding-top: 1.5mm;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 0.8mm 0;
      font-size: 8.5pt;
    }
    .label { color: #555; }
    .value { font-weight: 700; }
    .internal {
      font-family: monospace;
      font-size: 11pt;
      font-weight: 800;
      background: #f0f0f0;
      padding: 2mm;
      text-align: center;
      letter-spacing: 1px;
    }
    .footer {
      border-top: 1px solid #000;
      padding-top: 2mm;
      margin-top: auto;
      font-size: 7pt;
      text-align: center;
      color: #555;
    }
    .no-print { text-align: center; margin: 20px 0; }
    .no-print button {
      padding: 12px 24px;
      font-size: 14px;
      background: #329bff;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      margin: 0 8px;
    }
    .no-print button:hover { background: #1666e0; }
    .no-print button.close { background: #666; }
    @media print {
      body { background: white; padding: 0; }
      .no-print { display: none; }
      .printable-label {
        border: none;
        box-shadow: none;
      }
      @page {
        size: 80mm 60mm;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Imprimir etiqueta</button>
    <button class="close" onclick="window.close()">Cerrar</button>
    <p style="margin-top: 16px; color: #666; font-size: 12px;">
      Etiqueta materia prima · 80mm × 60mm
    </p>
  </div>
  <div class="printable-label">
    <div class="label-header">
      <div>
        <div class="brand">SAHEL</div>
        <div style="font-size: 7pt; color: #666;">Materia Prima</div>
      </div>
      <div style="text-align: right; font-size: 7pt;">
        <div class="label">Lote interno</div>
        <div style="font-weight: 700; font-size: 10pt;">${internalLot}</div>
      </div>
    </div>

    <div>
      <div class="material-name">${rml.material_name || ''}</div>
      <div class="material-code">${rml.material_code || ''} · ${rml.material_unit || ''}</div>
    </div>

    <div class="internal">${supplierLot}</div>

    <div>
      <div class="info-row">
        <span class="label">Proveedor:</span>
        <span class="value">${supplierName}</span>
      </div>
      <div class="info-row">
        <span class="label">Recepción:</span>
        <span class="value">${receivedAt}</span>
      </div>
      ${expiryDate ? `<div class="info-row"><span class="label">Caducidad:</span><span class="value" style="color: #c00;">${expiryDate}</span></div>` : ''}
      <div class="info-row">
        <span class="label">Cantidad:</span>
        <span class="value" style="font-size: 11pt;">${rml.quantity} ${rml.material_unit || 'ud'}</span>
      </div>
    </div>

    <div class="footer">
      SAHEL · control de calidad
    </div>
  </div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// Genera etiqueta de MP con auth por query string
router.get('/print-rml/:rmlId', (req, res) => {
  // Auth opcional por query string
  const token = req.query.token
  if (token) {
    try {
      const jwt = require('jsonwebtoken')
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'cleanerp-dev-secret-change-in-production-9f8e7d6c5b4a3210')
    } catch (e) {
      // Token inválido, continuar sin auth
    }
  }
  return router.handle({ ...req, url: `/print-label/rml/${req.params.rmlId}`, method: 'GET' }, res, () => {})
})

router.get('/print-label/:lotId', auth, (req, res) => {
  const lot = db.prepare('SELECT * FROM lots WHERE id = ?').get(req.params.lotId)
  if (!lot) return res.status(404).send('<h1>Lote no encontrado</h1>')
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(lot.product_id)
  if (!product) return res.status(404).send('<h1>Producto no encontrado</h1>')

  const producedAt = lot.received_at || lot.produced_at ? (lot.received_at || lot.produced_at).split('T')[0] : new Date().toISOString().split('T')[0]
  const expiryDate = lot.expiry_date || ''
  const lotNumber = lot.code || lot.lot_number || ''

  // HTML standalone con CSS print correcto
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Etiqueta ${lotNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .printable-label {
      width: 60mm;
      min-height: 40mm;
      padding: 3mm;
      background: white;
      border: 1px dashed #ccc;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 9pt;
      color: #000;
      line-height: 1.2;
    }
    .label-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #000;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    .brand {
      font-weight: 900;
      font-size: 11pt;
      letter-spacing: 1px;
    }
    .product-name {
      font-weight: 700;
      font-size: 10pt;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    .product-code {
      font-family: monospace;
      font-size: 8pt;
      color: #333;
      margin-bottom: 2mm;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 1mm 0;
      font-size: 8pt;
    }
    .label { color: #666; }
    .value { font-weight: 700; }
    .qr-placeholder {
      width: 18mm;
      height: 18mm;
      border: 1px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: monospace;
      font-size: 6pt;
      text-align: center;
    }
    .footer {
      border-top: 1px solid #000;
      padding-top: 2mm;
      margin-top: 2mm;
      font-size: 7pt;
      text-align: center;
    }
    .no-print { text-align: center; margin: 20px 0; }
    .no-print button {
      padding: 12px 24px;
      font-size: 14px;
      background: #329bff;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      margin: 0 8px;
    }
    .no-print button:hover { background: #1666e0; }
    .no-print button.close { background: #666; }
    @media print {
      body { background: white; padding: 0; }
      .no-print { display: none; }
      .printable-label {
        border: none;
        box-shadow: none;
      }
      @page {
        size: 60mm 40mm;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Imprimir etiqueta</button>
    <button class="close" onclick="window.close()">Cerrar</button>
    <p style="margin-top: 16px; color: #666; font-size: 12px;">
      Tamaño recomendado: 60mm × 40mm · 1 etiqueta por impresión
    </p>
  </div>
  <div class="printable-label">
    <div class="label-header">
      <div>
        <div class="brand">SAHEL</div>
        <div style="font-size: 7pt; color: #666;">Produits d'Hygiène</div>
      </div>
      <div class="qr-placeholder">QR<br>${lotNumber.slice(-6) || '0000'}</div>
    </div>
    <div>
      <div class="product-name">${product.name}</div>
      <div class="product-code">${product.code || ''}</div>
      <div class="info-row">
        <span class="label">Lote:</span>
        <span class="value">${lotNumber}</span>
      </div>
      <div class="info-row">
        <span class="label">Fabricado:</span>
        <span class="value">${producedAt}</span>
      </div>
      ${expiryDate ? `<div class="info-row"><span class="label">Caducidad:</span><span class="value">${expiryDate}</span></div>` : ''}
      <div class="info-row">
        <span class="label">Cantidad:</span>
        <span class="value">${lot.quantity} L</span>
      </div>
    </div>
    <div class="footer">
      SAHEL · control de calidad
    </div>
  </div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// ---------- CUSTOMER CARD (Tarjeta de cliente con QR) ----------
// GET /api/customer-card/:code
// Sin auth: la tarjeta es pública (se entrega al cliente físicamente)
// El QR de la tarjeta apunta a /api/delivery-mobile que sí puede requerir auth,
// pero la página mobile maneja su propia auth internamente.
router.get('/customer-card/:code', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE code = ?').get(req.params.code)
  if (!customer) return res.status(404).send('<h1>Cliente no encontrado</h1>')

  const companyInfo = getConfig('company', { name: 'SAHEL', tagline: 'Produits d\'Hygiène' })
  const deliveryUrl = `${req.protocol}://${req.get('host')}/api/delivery-mobile?code=${encodeURIComponent(customer.code)}`
  // QR generado en cliente con qrcode.js (CDN) - funciona offline y nunca falla
  const companyName = (companyInfo.name || 'SAHEL').toUpperCase()
  const tagline = (companyInfo.tagline || 'Produits d\'Hygiène').replace(/'/g, "\\'")

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tarjeta ${customer.code} - ${customer.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background: #e5e7eb; padding: 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .no-print { background: #1f2937; color: white; padding: 12px; display: flex; gap: 8px; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; right: 0; z-index: 100; }
    .no-print button { padding: 9px 16px; font-size: 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit; }
    .no-print button:hover { background: #1d4ed8; }
    .no-print button.close { background: #6b7280; }
    .card-container { display: flex; flex-direction: column; gap: 16px; margin-top: 50px; align-items: center; }
    .card { width: 85.6mm; height: 53.98mm; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #1e3a8a; border-radius: 6px; padding: 5mm; display: grid; grid-template-columns: 1fr 26mm; gap: 4mm; box-shadow: 0 4px 12px rgba(0,0,0,.15); position: relative; overflow: hidden; }
    .card-info { display: flex; flex-direction: column; justify-content: space-between; padding-top: 3mm; }
    .card-brand { font-size: 9pt; font-weight: bold; color: #1e3a8a; letter-spacing: 0.5px; margin-top: 2mm; }
    .card-tagline { font-size: 6pt; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 0.5mm; }
    .card-customer { flex: 1; display: flex; flex-direction: column; justify-content: center; margin: 2mm 0; }
    .card-name { font-size: 10pt; font-weight: bold; color: #111827; margin-bottom: 2mm; line-height: 1.1; max-height: 22pt; overflow: hidden; }
    .card-code { display: inline-block; background: #1e3a8a; color: white; padding: 1.5mm 3mm; font-family: 'Courier New', monospace; font-size: 11pt; font-weight: bold; letter-spacing: 1.5px; align-self: flex-start; }
    .card-qr { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 3mm; }
    .card-qr-canvas { width: 24mm; height: 24mm; display: block; }
    .card-qr canvas, .card-qr img { width: 24mm !important; height: 24mm !important; display: block; }
    .card-qr-label { font-size: 5.5pt; color: #6b7280; margin-top: 0.5mm; text-align: center; }
    .instructions { max-width: 600px; background: white; padding: 16px 20px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,.08); font-size: 10pt; color: #4b5563; line-height: 1.5; }
    .instructions h3 { color: #1e3a8a; font-size: 11pt; margin-bottom: 8px; }
    .instructions ul { padding-left: 18px; }
    .instructions li { margin: 4px 0; }
    @media print { body { background: white; padding: 0; } .no-print { display: none; } .card-container { margin: 0; } .card { box-shadow: none; page-break-inside: avoid; margin: 8mm auto; } .instructions { display: none; } @page { size: A4; margin: 8mm; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
    <button class="close" onclick="window.close()">Cerrar</button>
  </div>
  <div class="card-container">
    <div class="card">
      <div class="card-info">
        <div>
          <div class="card-brand">${companyName}</div>
          <div class="card-tagline">${tagline}</div>
        </div>
        <div class="card-customer">
          <div class="card-name">${customer.name}</div>
          <div class="card-code">${customer.code}</div>
        </div>
      </div>
      <div class="card-qr">
        <div id="qrcode" class="card-qr-canvas"></div>
        <div class="card-qr-label">Escanear para entrega</div>
      </div>
    </div>
    <div class="instructions no-print">
      <h3>Instrucciones</h3>
      <ul>
        <li>Tarjeta de <strong>${customer.name}</strong></li>
        <li>C&oacute;digo: <strong>${customer.code}</strong></li>
        <li>Imprimir en papel grueso (85.6mm &times; 54mm) y plastificar.</li>
        <li>El cliente conserva siempre la misma tarjeta; el QR es permanente.</li>
        <li>El operador escanea el QR desde Pedidos &rarr; Escanear cliente.</li>
      </ul>
    </div>
  </div>
  <script>
    (function() {
      var deliveryUrl = ${JSON.stringify(deliveryUrl)};
      function renderQR() {
        try {
          if (typeof QRCode !== 'undefined') {
            new QRCode(document.getElementById('qrcode'), {
              text: deliveryUrl,
              width: 240,
              height: 240,
              colorDark: '#1e3a8a',
              colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.M
            });
            return true;
          }
        } catch (e) { console.error('QR error:', e); }
        return false;
      }
      // Intentar cargar qrcode desde varios CDNs
      function loadQR() {
        var scripts = [
          'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
          'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
        ];
        function tryNext(i) {
          if (i >= scripts.length) {
            // Fallback: mostrar el código como texto
            var el = document.getElementById('qrcode');
            if (el) {
              el.innerHTML = '<div style="width:24mm;height:24mm;background:#1e3a8a;color:white;display:flex;align-items:center;justify-content:center;font-size:8pt;text-align:center;padding:1mm;font-family:monospace">' + deliveryUrl + '</div>';
            }
            return;
          }
          var s = document.createElement('script');
          s.src = scripts[i];
          s.onload = function() { if (!renderQR()) tryNext(i+1); };
          s.onerror = function() { tryNext(i+1); };
          document.head.appendChild(s);
        }
        tryNext(0);
      }
      if (typeof QRCode === 'undefined') {
        loadQR();
      } else {
        renderQR();
      }
    })();
  </script>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// Tarjeta con auth por query string
router.get('/customer-card-view/:code', (req, res) => {
  const token = req.query.token
  if (token) {
    try {
      const jwt = require('jsonwebtoken')
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'cleanerp-dev-secret-change-in-production-9f8e7d6c5b4a3210')
    } catch (e) {}
  }
  return router.handle({ ...req, url: `/customer-card/${req.params.code}`, method: 'GET' }, res, () => {})
})

// ---------- DELIVERY MOBILE (Escáner QR + Input manual) ----------
router.get('/delivery-mobile', (req, res) => {
  const prefillCode = req.query.code || ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#1e3a8a">
  <title>SAHEL - Entregas</title>
  <script src="https://unpkg.com/html5-qrcode" type="text/javascript"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; color: #111827; min-height: 100vh; }
    .header { background: #1e3a8a; color: white; padding: 14px 16px; display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 10; }
    .header img { width: 32px; height: 32px; }
    .header h1 { font-size: 15px; font-weight: 600; }
    .header .sub { font-size: 10px; opacity: .85; }
    .container { max-width: 600px; margin: 0 auto; padding: 12px; }
    .card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 10px; }
    .card h2 { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600; }
    .scanner { width: 100%; aspect-ratio: 1; max-height: 280px; background: #000; border-radius: 8px; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; }
    .scanner-placeholder { color: #9ca3af; text-align: center; padding: 20px; }
    .scanner button { background: #1e3a8a; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; margin-top: 10px; font-family: inherit; }
    .manual-input { display: flex; gap: 6px; margin-top: 10px; }
    .manual-input input { flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 15px; font-family: monospace; text-transform: uppercase; letter-spacing: 1px; }
    .manual-input input:focus { outline: none; border-color: #1e3a8a; box-shadow: 0 0 0 3px rgba(30,58,138,.15); }
    .manual-input button { background: #1e3a8a; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .customer-info { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 10px; }
    .customer-info h3 { font-size: 17px; color: #111827; margin-bottom: 4px; }
    .customer-info .code { display: inline-block; background: #1e3a8a; color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; }
    .customer-info .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .order { background: white; border-radius: 8px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 8px; border-left: 4px solid #1e3a8a; }
    .order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .order-number { font-family: monospace; font-weight: 600; color: #1e3a8a; font-size: 14px; }
    .order-date { font-size: 11px; color: #6b7280; }
    .order-total { font-size: 17px; font-weight: 700; color: #111827; margin: 6px 0; }
    .order-items { font-size: 12px; color: #4b5563; padding: 6px 0; border-top: 1px solid #e5e7eb; }
    .order-btn { width: 100%; background: #10b981; color: white; border: none; padding: 11px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; font-family: inherit; }
    .order-btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .order-btn:active { background: #059669; }
    .order-delivered { background: #f0fdf4; border-left-color: #10b981; }
    .order-delivered-info { font-size: 12px; color: #047857; margin-top: 6px; font-style: italic; }
    .empty { text-align: center; padding: 24px 12px; color: #6b7280; }
    .login-box { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.1); text-align: center; max-width: 360px; margin: 40px auto; }
    .login-box input { width: 100%; padding: 10px; margin: 6px 0; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
    .login-box button { width: 100%; background: #1e3a8a; color: white; border: none; padding: 11px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 10px; font-family: inherit; }
    .login-error { color: #dc2626; font-size: 13px; margin-top: 8px; }
    .hidden { display: none; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-ok { background: #d1fae5; color: #065f46; }
    .toast { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background: #1f2937; color: white; padding: 10px 16px; border-radius: 6px; font-size: 13px; z-index: 100; opacity: 0; transition: opacity 0.2s; }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <img src="https://mndiayediawara-hue.github.io/cleansahel/logo.svg" onerror="this.outerHTML='<div style=width:32px;height:32px;background:white;color:#1e3a8a;font-weight:bold;display:flex;align-items:center;justify-content:center;border-radius:4px;font-size:12px>SH</div>'" />
    <div>
      <h1>SAHEL · Entregas</h1>
      <div class="sub">Escanear QR o introducir código</div>
    </div>
  </div>
  <div class="container">
    <div id="loginSection" class="login-box hidden">
      <p style="color: #6b7280; margin-bottom: 12px;">Inicia sesión para continuar</p>
      <input type="text" id="loginUser" placeholder="Usuario" autocomplete="username" />
      <input type="password" id="loginPass" placeholder="Contraseña" autocomplete="current-password" />
      <button onclick="doLogin()">Iniciar sesión</button>
      <div id="loginError" class="login-error hidden"></div>
    </div>
    <div id="mainSection" class="hidden">
      <div class="card">
        <h2>1. Escanear QR del cliente</h2>
        <div id="qr-reader" class="scanner"></div>
        <button id="startScanBtn" onclick="startScanner()">Iniciar cámara</button>
        <div style="margin-top: 10px; text-align: center; color: #6b7280; font-size: 11px;">o introduce el código manualmente</div>
        <div class="manual-input">
          <input type="text" id="codeInput" placeholder="CL-00001" value="${prefillCode}" autocomplete="off" />
          <button onclick="lookupCustomer()">Buscar</button>
        </div>
      </div>
      <div id="resultSection"></div>
    </div>
  </div>
  <div id="toast" class="toast"></div>
  <script>
    const API = 'https://cleansahel-production.up.railway.app/api'
    let token = localStorage.getItem('cleanerp-token') || new URLSearchParams(window.location.search).get('token')
    if (token) { localStorage.setItem('cleanerp-token', token); showMain() } else { document.getElementById('loginSection').classList.remove('hidden') }
    function showToast(msg, color) { const t = document.getElementById('toast'); t.textContent = msg; t.style.background = color || '#1f2937'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500) }
    async function doLogin() {
      const username = document.getElementById('loginUser').value.trim()
      const password = document.getElementById('loginPass').value
      if (!username || !password) { document.getElementById('loginError').textContent = 'Introduce usuario y contraseña'; document.getElementById('loginError').classList.remove('hidden'); return }
      try {
        const res = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
        if (!res.ok) throw new Error('Credenciales incorrectas')
        const data = await res.json()
        token = data.token
        localStorage.setItem('cleanerp-token', token)
        document.getElementById('loginSection').classList.add('hidden')
        document.getElementById('loginError').classList.add('hidden')
        showMain()
      } catch (e) { document.getElementById('loginError').textContent = e.message; document.getElementById('loginError').classList.remove('hidden') }
    }
    function showMain() { document.getElementById('mainSection').classList.remove('hidden'); const prefill = document.getElementById('codeInput').value.trim(); if (prefill) lookupCustomer() }
    function startScanner() {
      const readerEl = document.getElementById('qr-reader'); readerEl.innerHTML = ''
      const html5QrCode = new Html5Qrcode('qr-reader')
      const startBtn = document.getElementById('startScanBtn')
      startBtn.disabled = true; startBtn.textContent = 'Escaneando...'
      html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 },
        (decodedText) => {
          html5QrCode.stop().then(() => {
            startBtn.disabled = false; startBtn.textContent = 'Reiniciar cámara'
            const codeMatch = decodedText.match(/CL-\\d{4,6}/)
            const code = codeMatch ? codeMatch[0] : decodedText.trim()
            document.getElementById('codeInput').value = code
            lookupCustomer()
          }).catch(() => {})
        }, (error) => {}
      ).catch(err => { startBtn.disabled = false; startBtn.textContent = 'Iniciar cámara'; showToast('Error al acceder a la cámara: ' + err.message, '#dc2626') })
    }
    async function lookupCustomer() {
      const code = document.getElementById('codeInput').value.trim().toUpperCase()
      if (!code) { showToast('Introduce un código', '#dc2626'); return }
      document.getElementById('codeInput').value = code
      try {
        const res = await fetch(API + '/delivery/lookup/' + encodeURIComponent(code), { headers: { 'Authorization': 'Bearer ' + token } })
        if (res.status === 404) { showToast('Cliente no encontrado: ' + code, '#dc2626'); document.getElementById('resultSection').innerHTML = ''; return }
        if (!res.ok) throw new Error('Error al buscar cliente')
        const data = await res.json()
        renderCustomer(data)
      } catch (e) { showToast('Error: ' + e.message, '#dc2626') }
    }
    function renderCustomer(data) {
      const c = data.customer; const orders = data.pendingOrders; const delivered = data.deliveredOrders
      let html = '<div class="customer-info">'
      html += '<h3>' + escapeHtml(c.name) + '</h3>'
      html += '<span class="code">' + escapeHtml(c.code) + '</span>'
      if (c.company) html += '<div class="meta">' + escapeHtml(c.company) + '</div>'
      if (c.phone) html += '<div class="meta">Tel: ' + escapeHtml(c.phone) + '</div>'
      if (c.address) html += '<div class="meta">' + escapeHtml(c.address) + (c.city ? ', ' + escapeHtml(c.city) : '') + '</div>'
      html += '</div>'
      if (orders.length === 0) { html += '<div class="empty">No hay pedidos pendientes para este cliente.</div>' }
      else {
        html += '<div class="card"><h2>2. Pedidos pendientes (' + orders.length + ')</h2></div>'
        for (const o of orders) {
          const itemsHtml = (o.items || []).map(i => escapeHtml(i.name || i.productName) + ' × ' + i.quantity).join('<br>')
          html += '<div class="order" id="order-' + o.id + '">'
          html += '<div class="order-header"><span class="order-number">' + escapeHtml(o.number) + '</span><span class="order-date">' + formatDate(o.createdAt) + '</span></div>'
          html += '<div class="order-total">' + (o.total || 0).toFixed(2) + ' €</div>'
          html += '<div class="order-items">' + itemsHtml + '</div>'
          html += '<button class="order-btn" onclick="deliverOrder(\\'' + o.id + '\\', this)">Entregar</button>'
          html += '</div>'
        }
      }
      if (delivered.length > 0) {
        html += '<div class="card"><h2>Ya entregados (' + delivered.length + ')</h2></div>'
        for (const o of delivered) {
          html += '<div class="order order-delivered">'
          html += '<div class="order-header"><span class="order-number">' + escapeHtml(o.number) + '</span><span class="badge badge-ok">Entregado</span></div>'
          html += '<div class="order-total">' + (o.total || 0).toFixed(2) + ' €</div>'
          html += '<div class="order-delivered-info">Entregado el ' + formatDate(o.deliveredAt) + ' por ' + escapeHtml(o.deliveredBy || 'Sistema') + '</div>'
          html += '</div>'
        }
      }
      document.getElementById('resultSection').innerHTML = html
      document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    async function deliverOrder(orderId, btn) {
      if (!confirm('¿Confirmar la entrega de este pedido?')) return
      btn.disabled = true; btn.textContent = 'Procesando...'
      try {
        const res = await fetch(API + '/delivery/' + orderId, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
        const data = await res.json()
        if (!res.ok) {
          if (data.deliveredAt) { showToast('Pedido ya entregado el ' + formatDate(data.deliveredAt) + ' por ' + data.deliveredBy, '#f59e0b') }
          else { showToast('Error: ' + (data.error || 'desconocido'), '#dc2626') }
          btn.disabled = false; btn.textContent = 'Entregar'; return
        }
        showToast('Entrega registrada correctamente', '#10b981')
        setTimeout(() => lookupCustomer(), 800)
      } catch (e) { showToast('Error: ' + e.message, '#dc2626'); btn.disabled = false; btn.textContent = 'Entregar' }
    }
    function formatDate(d) { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
    document.getElementById('codeInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') lookupCustomer() })
    document.getElementById('loginPass').addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin() })
  </script>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// ============================================================
// MODULOS CRITICOS - Fase 1
// ============================================================

// ---------- 1. STOCK RESERVADO ----------
function getReservedStock(productId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS reserved
    FROM stock_reservations
    WHERE product_id = ? AND status = 'active'
  `).get(productId)
  return row.reserved || 0
}

// GET /api/products/:id/availability - stock disponible
router.get('/products/:id/availability', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' })
  const reserved = getReservedStock(req.params.id)
  const available = Math.max(0, p.stock - reserved)
  res.json({
    productId: p.id, productName: p.name,
    stock: p.stock, reserved, available, canSell: available > 0
  })
})

// GET /api/inventory/availability
router.get('/inventory/availability', auth, (_req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all()
  const result = products.map(p => {
    const reserved = getReservedStock(p.id)
    const available = Math.max(0, p.stock - reserved)
    return {
      id: p.id, code: p.code, name: p.name,
      bottleSize: p.bottle_size, price: p.price,
      stock: p.stock, reserved, available,
      status: available <= 0 ? 'agotado' : (available < p.min_stock ? 'bajo' : 'ok')
    }
  })
  res.json(result)
})

// ---------- 2. TRAZABILIDAD INVERSA ----------
// GET /api/traceability/by-material/:id
router.get('/traceability/by-material/:id', auth, (req, res) => {
  const materialId = req.params.id
  let matInfo = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(materialId)
  if (!matInfo) matInfo = db.prepare('SELECT * FROM packaging WHERE id = ?').get(materialId)
  if (!matInfo) return res.status(404).json({ error: 'Material no encontrado' })

  const lots = db.prepare(`
    SELECT l.*, p.name AS product_name, p.code AS product_code
    FROM lots l
    LEFT JOIN products p ON p.id = l.product_id
    WHERE EXISTS (
      SELECT 1 FROM json_each(l.raw_materials_json) AS item
      WHERE json_extract(item.value, '$.materialId') = ?
    )
    ORDER BY l.produced_at DESC
  `).all(materialId)

  const enrichedLots = lots.map(l => {
    let items = []
    try { items = JSON.parse(l.raw_materials_json || '[]') } catch {}
    const usedHere = items.find(i => i.materialId === materialId)
    return {
      id: l.id, lotNumber: l.code || l.lot_number,
      productName: l.product_name, productCode: l.product_code,
      quantity: l.quantity, producedAt: l.received_at || l.produced_at, status: l.status,
      usedQuantity: usedHere?.quantity || 0, usedUnit: usedHere?.unit || ''
    }
  })

  res.json({
    material: { id: matInfo.id, code: matInfo.code, name: matInfo.name, unit: matInfo.unit || 'ud', currentStock: matInfo.stock },
    lots: enrichedLots,
    totalLots: enrichedLots.length,
    totalUsed: enrichedLots.reduce((sum, l) => sum + (l.usedQuantity || 0), 0)
  })
})

// GET /api/traceability/by-customer/:id
router.get('/traceability/by-customer/:id', auth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id)
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' })

  const orders = db.prepare(`
    SELECT o.*, u.full_name AS created_by_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `).all(req.params.id)

  const result = orders.map(o => {
    let items = []
    try { items = JSON.parse(o.items_json || '[]') } catch {}
    return {
      id: o.id, number: o.number, status: o.status, total: o.total,
      createdAt: o.created_at, createdBy: o.created_by_name,
      deliveredAt: o.delivered_at, deliveredBy: o.delivered_by, items
    }
  })

  res.json({
    customer: { id: customer.id, code: customer.code, name: customer.name, totalPurchases: customer.total_purchases },
    orders: result,
    summary: {
      totalOrders: result.length,
      pendingOrders: result.filter(o => !['entregado', 'cancelado'].includes(o.status)).length,
      deliveredOrders: result.filter(o => o.status === 'entregado').length,
      totalSpent: result.filter(o => o.status === 'entregado').reduce((s, o) => s + (o.total || 0), 0)
    }
  })
})

// GET /api/traceability/full
router.get('/traceability/full', auth, (_req, res) => {
  const lots = db.prepare(`
    SELECT l.*, p.name AS product_name, p.code AS product_code, u.full_name AS produced_by_name
    FROM lots l
    LEFT JOIN products p ON p.id = l.product_id
    LEFT JOIN users u ON u.id = l.produced_by
    WHERE l.status = 'completado'
    ORDER BY l.produced_at DESC
    LIMIT 100
  `).all()

  const result = lots.map(l => {
    let items = []
    try { items = JSON.parse(l.raw_materials_json || '[]') } catch {}
    const enriched = items.map(it => {
      const raw = db.prepare('SELECT name, code, unit FROM raw_materials WHERE id = ?').get(it.materialId)
      const pkg = db.prepare('SELECT name, code FROM packaging WHERE id = ?').get(it.materialId)
      return { ...it, materialName: raw?.name || pkg?.name || it.materialId, materialCode: raw?.code || pkg?.code || '', materialUnit: raw?.unit || 'ud' }
    })
    return {
      id: l.id, lotNumber: l.lot_number, productionOrderNumber: l.production_order_number,
      productName: l.product_name, productCode: l.product_code,
      quantity: l.quantity, producedAt: l.produced_at, producedBy: l.produced_by_name,
      materialsUsed: enriched
    }
  })
  res.json(result)
})

// ---------- 3. ALERTAS DE CADUCIDAD ----------
router.get('/alerts/expiry', auth, (_req, res) => {
  const alerts = []
  const rmls = db.prepare(`
    SELECT rml.*, rm.name AS material_name, rm.code AS material_code, rm.unit
    FROM raw_material_lots rml
    LEFT JOIN raw_materials rm ON rm.id = rml.raw_material_id
    WHERE rml.expiry_date IS NOT NULL AND rml.expiry_date != ''
      AND rml.status = 'active' AND rml.remaining > 0
    ORDER BY rml.expiry_date ASC
  `).all()
  for (const r of rmls) {
    const exp = new Date(r.expiry_date)
    const days = Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24))
    let severity = 'info'
    if (days < 0) severity = 'critical'
    else if (days <= 7) severity = 'critical'
    else if (days <= 15) severity = 'warning'
    else if (days <= 30) severity = 'info'
    if (days <= 30) {
      alerts.push({
        type: 'rml_expiry', severity,
        materialId: r.raw_material_id, materialName: r.material_name, materialCode: r.material_code,
        lotCode: r.code, expiryDate: r.expiry_date, daysToExpiry: days,
        stock: r.remaining, unit: r.unit
      })
    }
  }
  res.json({ alerts, count: alerts.length, critical: alerts.filter(a => a.severity === 'critical').length, warning: alerts.filter(a => a.severity === 'warning').length })
})

router.post('/alerts/expiry/scan', auth, (_req, res) => {
  let created = 0
  db.prepare("DELETE FROM notifications WHERE type LIKE 'expiry%'").run()
  const rmls = db.prepare(`
    SELECT rml.*, rm.name AS material_name, rm.code AS material_code
    FROM raw_material_lots rml
    LEFT JOIN raw_materials rm ON rm.id = rml.raw_material_id
    WHERE rml.expiry_date IS NOT NULL AND rml.expiry_date != ''
      AND rml.status = 'active' AND rml.remaining > 0
  `).all()
  for (const r of rmls) {
    const exp = new Date(r.expiry_date)
    const days = Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24))
    if (days <= 30) {
      const severity = days <= 7 ? 'critical' : (days <= 15 ? 'warning' : 'info')
      const message = days < 0 ? `CADUCADO hace ${Math.abs(days)} dias: ${r.material_name} (${r.code}) - Lote ${r.code}` : `Caduca en ${days} dias: ${r.material_name} (${r.code}) - Lote ${r.code}`
      const exists = db.prepare("SELECT id FROM notifications WHERE type='expiry' AND related_id=?").get('rml:'+r.id)
      if (!exists) {
        db.prepare(`INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,0,?,?)`)
          .run(uid('n-'), 'expiry', 'Caducidad proxima', message, severity, new Date().toISOString(), 'rml:'+r.id)
        created++
      }
    }
  }
  res.json({ ok: true, created, scanned: rmls.length })
})

// ---------- 4. AJUSTES DE INVENTARIO ----------
router.get('/inventory/adjustments', auth, (_req, res) => {
  const rows = db.prepare(`
    SELECT sa.*, u.full_name AS user_name
    FROM stock_adjustments sa
    LEFT JOIN users u ON u.id = sa.created_by
    ORDER BY sa.created_at DESC
    LIMIT 200
  `).all()
  res.json(rows)
})

router.post('/inventory/adjustments', auth, requirePermission('inventory', 'edit'), (req, res) => {
  try {
    const { materialType, materialId, newStock, reason, lotId } = req.body
    if (!materialType || !materialId || newStock === undefined) return res.status(400).json({ error: 'Faltan datos' })
    if (!reason || reason.trim() === '') return res.status(400).json({ error: 'Debe especificar el motivo' })
    let table
    let lotTable
    let lotCol
    if (materialType === 'raw') { table = 'raw_materials'; lotTable = 'raw_material_lots'; lotCol = 'raw_material_id' }
    else if (materialType === 'packaging') { table = 'packaging'; lotTable = 'packaging_lots'; lotCol = 'packaging_id' }
    else if (materialType === 'product') table = 'products'
    else return res.status(400).json({ error: 'materialType invalido' })
    const before = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(materialId)
    if (!before) return res.status(404).json({ error: 'Material no encontrado' })
    const newStockNum = Number(newStock)
    if (newStockNum < 0) return res.status(400).json({ error: 'Stock no puede ser negativo' })
    const diff = newStockNum - before.stock
    
    // Si se especifica lotId, ajustar el lote tambien (para trazabilidad)
    let lotUpdate = null
    if (lotId && lotTable) {
      const lot = db.prepare(`SELECT * FROM ${lotTable} WHERE id = ?`).get(lotId)
      if (lot) {
        // newStockNum es el nuevo valor del stock del material
        // La diferencia (diff) se resta del remaining del lote proporcionalmente
        // Si diff = -100 y remaining=500, nuevo remaining = 400
        const newRemaining = Math.max(0, lot.remaining + diff)
        const lotDiff = newRemaining - lot.remaining
        db.prepare(`UPDATE ${lotTable} SET remaining = ? WHERE id = ?`).run(newRemaining, lotId)
        db.prepare(`UPDATE ${lotTable} SET status = CASE WHEN remaining <= 0 THEN 'consumed' ELSE status END WHERE id = ?`).run(lotId)
        lotUpdate = { lotId, before: lot.remaining, after: newRemaining, diff: lotDiff }
      }
    }
    
    const tx = db.transaction(() => {
      db.prepare(`UPDATE ${table} SET stock = ? WHERE id = ?`).run(newStockNum, materialId)
      const adjId = uid('adj-')
      db.prepare(`INSERT INTO stock_adjustments (id, material_type, material_id, material_name, lot_id, quantity_before, quantity_after, difference, reason, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(adjId, materialType, materialId, before.name || '', lotId || null, before.stock, newStockNum, diff, reason.trim(), req.user.id, new Date().toISOString())
      db.prepare(`INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,0,?,?)`)
        .run(uid('n-'), 'stock-adjustment', 'Ajuste de inventario', `${before.name}: ${before.stock} → ${newStockNum} (${diff > 0 ? '+' : ''}${diff}) - ${reason}${lotUpdate ? ` [Lote: ${lotUpdate.before} → ${lotUpdate.after}]` : ''}`, diff < 0 ? 'warning' : 'info', new Date().toISOString(), 'adj:' + materialId)
    })
    tx()
    addHistory(req, { action: 'ajuste', module: 'Inventario', entityId: materialId, description: `Ajuste ${before.name}: ${before.stock} → ${newStockNum} (${reason})${lotUpdate ? ` (Lote ${lotUpdate.lotId}: ${lotUpdate.before} → ${lotUpdate.after})` : ''}` })
    res.json({ ok: true, before: before.stock, after: newStockNum, difference: diff, lot: lotUpdate })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ---------- 5. FIFO/FEFO en produccion ----------
function getMaterialByFEFO(materialId, materialType, neededQty) {
  const table = materialType === 'raw' ? 'raw_material_lots' : 'packaging_lots'
  const matCol = materialType === 'raw' ? 'raw_material_id' : 'packaging_id'
  const lots = db.prepare(`
    SELECT * FROM ${table}
    WHERE ${matCol} = ? AND status = 'active' AND remaining > 0
    ORDER BY CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END, expiry_date ASC, received_at ASC
  `).all(materialId)
  const result = []
  let remaining = neededQty
  for (const lot of lots) {
    if (remaining <= 0) break
    const take = Math.min(remaining, lot.remaining)
    result.push({ lotId: lot.id, lotCode: lot.code, quantity: take, expiryDate: lot.expiry_date, receivedAt: lot.received_at })
    remaining -= take
  }
  return { allocations: result, shortage: remaining > 0 ? remaining : 0 }
}

function consumeFIFO(materialId, materialType, quantity) {
  const table = materialType === 'raw' ? 'raw_material_lots' : 'packaging_lots'
  const matCol = materialType === 'raw' ? 'raw_material_id' : 'packaging_id'
  const { allocations, shortage } = getMaterialByFEFO(materialId, materialType, quantity)
  if (shortage > 0) return { error: 'Stock insuficiente', shortage }
  for (const alloc of allocations) {
    db.prepare(`UPDATE ${table} SET remaining = remaining - ? WHERE id = ?`).run(alloc.quantity, alloc.lotId)
    db.prepare(`UPDATE ${table} SET status = CASE WHEN remaining <= 0 THEN 'consumed' ELSE status END WHERE id = ?`).run(alloc.lotId)
  }
  return { allocations, shortage: 0 }
}

router.get('/inventory/fefo/:type/:id', auth, (req, res) => {
  const { type, id } = req.params
  const qty = Number(req.query.quantity) || 1
  const { allocations, shortage } = getMaterialByFEFO(id, type, qty)
  res.json({ allocations, shortage, requested: qty })
})

// ============================================================
// FIN MODULOS CRITICOS
// ============================================================


// ============================================================
// ETIQUETAS DE RECEPCION 4x6 (10.2x15.2cm) - 203 DPI
// ============================================================

// Función helper: genera el código QR como data URL
async function generateQRDataURL(text) {
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 1,
      width: 300,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
  } catch (e) {
    console.error('QR error:', e.message)
    return null
  }
}

// GET /api/reception-label/:type/:id - Genera la etiqueta 4x6 lista para imprimir
router.get('/reception-label/:type/:id', async (req, res) => {
  const { type, id } = req.params
  if (!['raw', 'pkg'].includes(type)) {
    return res.status(400).send('<h1>Tipo inválido (raw o pkg)</h1>')
  }
  
  let lot = null
  let material = null
  let supplier = null
  
  if (type === 'raw') {
    lot = db.prepare('SELECT * FROM raw_material_lots WHERE id = ?').get(id)
    if (!lot) return res.status(404).send('<h1>Lote no encontrado</h1>')
    material = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(lot.raw_material_id)
    if (lot.supplier_id) supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(lot.supplier_id)
  } else {
    lot = db.prepare('SELECT * FROM packaging_lots WHERE id = ?').get(id)
    if (!lot) return res.status(404).send('<h1>Lote no encontrado</h1>')
    material = db.prepare('SELECT * FROM packaging WHERE id = ?').get(lot.packaging_id)
    if (lot.supplier_id) supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(lot.supplier_id)
  }
  
  if (!material) return res.status(404).send('<h1>Material no encontrado</h1>')
  
  const companyInfo = getConfig('company', { name: 'SAHEL', tagline: 'PRODUITS D\'HYGIÈNE' })
  const baseUrl = `${req.protocol}://${req.get('host')}`
  const qrData = `${baseUrl}/api/reception-info/${type}/${id}`
  const qrUrl = await generateQRDataURL(qrData)
  
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'
  const safe = (s) => String(s || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  // Calcular % consumido
  const used = Number(lot.quantity) - Number(lot.remaining)
  const percentUsed = lot.quantity > 0 ? Math.round((used / lot.quantity) * 100) : 0
  
  // Color según estado
  let statusColor = '#10b981' // green - activo
  let statusText = 'ACTIVO'
  if (lot.status === 'blocked' || lot.status === 'consumed') {
    statusColor = '#ef4444' // red
    statusText = lot.status === 'blocked' ? 'BLOQUEADO' : 'AGOTADO'
  }
  if (Number(lot.remaining) <= 0) {
    statusColor = '#6b7280' // gray
    statusText = 'AGOTADO'
  }
  
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Etiqueta ${safe(lot.code)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 4in 6in; margin: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    width: 4in;
    height: 6in;
    padding: 0.15in;
    background: white;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .no-print {
    background: #1f2937;
    color: white;
    padding: 10px;
    text-align: center;
    margin: -0.15in -0.15in 10px -0.15in;
  }
  .no-print button {
    padding: 8px 16px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin: 0 4px;
    font-size: 13px;
    font-weight: 500;
  }
  .no-print button.close { background: #6b7280; }
  .label {
    border: 2px solid #000;
    height: calc(6in - 0.3in);
    display: flex;
    flex-direction: column;
    padding: 0.1in;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5pt solid #000;
    padding-bottom: 4px;
    margin-bottom: 4px;
  }
  .logo {
    font-weight: 900;
    font-size: 16pt;
    letter-spacing: 1px;
  }
  .logo .tag {
    font-size: 7pt;
    font-weight: 600;
    letter-spacing: 2px;
    color: #555;
  }
  .qr {
    width: 0.85in;
    height: 0.85in;
  }
  .qr img { width: 100%; height: 100%; }
  .title {
    text-align: center;
    font-size: 8pt;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    margin: 4px 0 2px;
  }
  .product {
    text-align: center;
    font-size: 14pt;
    font-weight: 800;
    margin: 4px 0;
    line-height: 1.1;
  }
  .code {
    text-align: center;
    font-size: 9pt;
    color: #555;
    font-family: monospace;
    margin-bottom: 4px;
  }
  .qty-box {
    text-align: center;
    background: #1e3a8a;
    color: white;
    padding: 6px;
    margin: 6px 0;
    border-radius: 4px;
  }
  .qty-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .qty-value {
    font-size: 24pt;
    font-weight: 900;
    line-height: 1;
  }
  .qty-unit {
    font-size: 11pt;
    font-weight: 600;
  }
  .info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 8px;
    font-size: 8pt;
    margin-top: 4px;
  }
  .info-row { display: flex; flex-direction: column; }
  .info-label {
    font-size: 7pt;
    text-transform: uppercase;
    color: #666;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .info-value {
    font-size: 9pt;
    font-weight: 600;
  }
  .barcode {
    text-align: center;
    font-family: monospace;
    font-size: 10pt;
    letter-spacing: 2px;
    margin-top: 4px;
    padding: 4px;
    background: #f3f4f6;
    border-radius: 3px;
  }
  .status {
    position: absolute;
    top: 0.2in;
    right: 0.2in;
    background: ${statusColor};
    color: white;
    padding: 3px 8px;
    font-size: 7pt;
    font-weight: 800;
    border-radius: 3px;
    letter-spacing: 1px;
  }
  .footer {
    margin-top: auto;
    text-align: center;
    font-size: 7pt;
    color: #666;
    border-top: 1pt solid #ccc;
    padding-top: 3px;
  }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
    .label { border: 2px solid #000; height: 6in; }
  }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">🖨️ Imprimir etiqueta</button>
  <button class="close" onclick="window.close()">Cerrar</button>
</div>
<div class="label">
  <div class="status">${statusText}</div>
  <div class="header">
    <div class="logo">
      ${safe(companyInfo.name)}
      <div class="tag">${safe(companyInfo.tagline || 'PRODUITS D\'HYGIÈNE')}</div>
    </div>
    ${qrUrl ? `<div class="qr"><img src="${qrUrl}" alt="QR"></div>` : ''}
  </div>
  <div class="title">ETIQUETA DE RECEPCIÓN</div>
  <div class="product">${safe(material.name)}</div>
  <div class="code">Cód: ${safe(material.code)}</div>
  <div class="qty-box">
    <div class="qty-label">CANTIDAD RECIBIDA</div>
    <div class="qty-value">${Number(lot.quantity).toLocaleString('es-ES')}</div>
    <div class="qty-unit">${safe(lot.unit || material.unit)}</div>
  </div>
  <div class="info">
    <div class="info-row">
      <div class="info-label">Lote</div>
      <div class="info-value">${safe(lot.code)}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Proveedor</div>
      <div class="info-value">${supplier ? safe(supplier.name) : (lot.supplier_name || '-')}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Recepción</div>
      <div class="info-value">${formatDate(lot.received_at)}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Caducidad</div>
      <div class="info-value">${formatDate(lot.expiry_date)}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Disponible</div>
      <div class="info-value">${Number(lot.remaining).toLocaleString('es-ES')} / ${Number(lot.quantity).toLocaleString('es-ES')}</div>
    </div>
    <div class="info-row">
      <div class="info-label">${type === 'raw' ? 'Categoría' : 'Tipo'}</div>
      <div class="info-value">${safe(type === 'raw' ? (material.category || '-') : (material.type || '-'))}</div>
    </div>
  </div>
  <div class="barcode">*${safe(lot.code)}*</div>
  <div class="footer">
    ${type === 'raw' ? 'MATERIA PRIMA' : 'ENVASE'} · ${percentUsed}% usado · Escanea el QR para info en tiempo real
  </div>
</div>
<script>
  // Auto-imprimir si se pasa ?print=1
  if (window.location.search.includes('print=1')) {
    setTimeout(() => window.print(), 500);
  }
</script>
</body>
</html>`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// GET /api/reception-info/:type/:id - Página que se abre al escanear el QR
// Muestra toda la información del lote EN TIEMPO REAL
router.get('/reception-info/:type/:id', async (req, res) => {
  const { type, id } = req.params
  if (!['raw', 'pkg'].includes(type)) {
    return res.status(400).send('<h1>Tipo inválido</h1>')
  }
  
  let lot = null
  let material = null
  let supplier = null
  
  if (type === 'raw') {
    lot = db.prepare('SELECT * FROM raw_material_lots WHERE id = ?').get(id)
    if (!lot) return res.status(404).send('<h1>Lote no encontrado</h1>')
    material = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(lot.raw_material_id)
    if (lot.supplier_id) supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(lot.supplier_id)
  } else {
    lot = db.prepare('SELECT * FROM packaging_lots WHERE id = ?').get(id)
    if (!lot) return res.status(404).send('<h1>Lote no encontrado</h1>')
    material = db.prepare('SELECT * FROM packaging WHERE id = ?').get(lot.packaging_id)
    if (lot.supplier_id) supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(lot.supplier_id)
  }
  
  if (!material) return res.status(404).send('<h1>Material no encontrado</h1>')
  
  const used = Number(lot.quantity) - Number(lot.remaining)
  const percentUsed = lot.quantity > 0 ? Math.round((used / lot.quantity) * 100) : 0
  const percentLeft = 100 - percentUsed
  
  const companyInfo = getConfig('company', { name: 'SAHEL', tagline: 'PRODUITS D\'HYGIÈNE' })
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'
  const safe = (s) => String(s || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safe(lot.code)} - ${safe(material.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    min-height: 100vh;
    padding: 20px;
    color: #1f2937;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    overflow: hidden;
  }
  .header {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
    color: white;
    padding: 24px;
    text-align: center;
  }
  .header h1 {
    font-size: 14pt;
    margin: 0 0 4px;
    letter-spacing: 1px;
  }
  .header p {
    font-size: 11pt;
    margin: 0;
    opacity: 0.95;
    font-weight: 500;
  }
  .badge {
    display: inline-block;
    background: rgba(255,255,255,0.2);
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 9pt;
    margin-top: 8px;
  }
  .progress {
    padding: 24px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  .progress-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 10pt;
  }
  .progress-label strong { color: #1e3a8a; }
  .progress-bar {
    background: #e5e7eb;
    height: 20px;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    height: 100%;
    border-radius: 10px;
    transition: width 0.3s;
  }
  .progress-text {
    text-align: center;
    margin-top: 6px;
    font-size: 9pt;
    color: #6b7280;
  }
  .info-grid {
    padding: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .info-item {
    background: #f9fafb;
    padding: 12px;
    border-radius: 8px;
    border-left: 3px solid #2563eb;
  }
  .info-item.full { grid-column: span 2; }
  .info-label {
    font-size: 8pt;
    text-transform: uppercase;
    color: #6b7280;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .info-value {
    font-size: 12pt;
    font-weight: 700;
    color: #1f2937;
    margin-top: 2px;
  }
  .actions {
    padding: 20px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .btn {
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 10pt;
    font-weight: 600;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-primary {
    background: #1e3a8a;
    color: white;
  }
  .btn-secondary {
    background: white;
    color: #1e3a8a;
    border: 1px solid #1e3a8a;
  }
  .footer {
    padding: 16px;
    text-align: center;
    color: #6b7280;
    font-size: 9pt;
    background: #f9fafb;
  }
  .refresh-info {
    background: #fef3c7;
    border-left: 3px solid #f59e0b;
    padding: 8px 12px;
    margin: 16px 20px;
    border-radius: 6px;
    font-size: 9pt;
    color: #92400e;
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${safe(companyInfo.name || 'SAHEL')}</h1>
    <p>${safe(material.name)}</p>
    <div class="badge">${type === 'raw' ? 'MATERIA PRIMA' : 'ENVASE'} · Lote ${safe(lot.code)}</div>
  </div>
  
  <div class="progress">
    <div class="progress-label">
      <span>Disponible: <strong>${Number(lot.remaining).toLocaleString('es-ES')} ${safe(lot.unit || material.unit)}</strong></span>
      <span>Recibido: <strong>${Number(lot.quantity).toLocaleString('es-ES')} ${safe(lot.unit || material.unit)}</strong></span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${percentLeft}%"></div>
    </div>
    <div class="progress-text">
      ${percentUsed}% consumido · ${percentLeft}% disponible
    </div>
  </div>
  
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Código material</div>
      <div class="info-value">${safe(material.code)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Lote interno</div>
      <div class="info-value">${safe(lot.code)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Proveedor</div>
      <div class="info-value">${supplier ? safe(supplier.name) : (lot.supplier_name || '-')}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Factura</div>
      <div class="info-value">${safe(lot.invoice || '-')}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Recepción</div>
      <div class="info-value">${formatDate(lot.received_at)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Caducidad</div>
      <div class="info-value">${formatDate(lot.expiry_date)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">${type === 'raw' ? 'Categoría' : 'Tipo'}</div>
      <div class="info-value">${safe(type === 'raw' ? (material.category || '-') : (material.type || '-'))}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Estado</div>
      <div class="info-value">${safe(lot.status || 'active')}</div>
    </div>
    <div class="info-item full">
      <div class="info-label">Notas</div>
      <div class="info-value">${safe(lot.notes || 'Sin notas')}</div>
    </div>
  </div>
  
  <div class="refresh-info">
    ℹ️ Esta información se actualiza en tiempo real. La cantidad disponible cambia automáticamente al usar el material.
  </div>
  
  <div class="actions">
    <a href="${req.protocol}://${req.get('host')}/api/reception-label/${type}/${id}?print=1" class="btn btn-primary" target="_blank">🖨️ Imprimir etiqueta</a>
    <a href="${req.protocol}://${req.get('host')}" class="btn btn-secondary">← Volver a la app</a>
  </div>
  
  <div class="footer">
    Última actualización: ${formatDateTime(new Date().toISOString())} · SAHEL ERP
  </div>
</div>
<script>
  // Auto-refresh cada 30 segundos para ver cambios en tiempo real
  setTimeout(() => location.reload(), 30000);
</script>
</body>
</html>`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// GET /api/reception-info-json/:type/:id - JSON con la info del lote (para el QR scan)
router.get('/reception-info-json/:type/:id', auth, (req, res) => {
  const { type, id } = req.params
  if (!['raw', 'pkg'].includes(type)) {
    return res.status(400).json({ error: 'Tipo inválido' })
  }
  
  let lot = null
  let material = null
  let supplier = null
  
  if (type === 'raw') {
    lot = db.prepare('SELECT * FROM raw_material_lots WHERE id = ?').get(id)
    if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
    material = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(lot.raw_material_id)
    if (lot.supplier_id) supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(lot.supplier_id)
  } else {
    lot = db.prepare('SELECT * FROM packaging_lots WHERE id = ?').get(id)
    if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
    material = db.prepare('SELECT * FROM packaging WHERE id = ?').get(lot.packaging_id)
    if (lot.supplier_id) supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(lot.supplier_id)
  }
  
  if (!material) return res.status(404).json({ error: 'Material no encontrado' })
  
  res.json({
    type,
    lot: {
      id: lot.id,
      code: lot.code,
      quantity: lot.quantity,
      remaining: lot.remaining,
      unit: lot.unit || material.unit,
      receivedAt: lot.received_at,
      expiryDate: lot.expiry_date,
      status: lot.status,
      notes: lot.notes
    },
    material: {
      id: material.id,
      code: material.code,
      name: material.name,
      category: material.category,
      type: material.type,
      location: material.location
    },
    supplier: supplier ? { name: supplier.name, phone: supplier.phone, email: supplier.email } : (lot.supplier_name ? { name: lot.supplier_name } : null),
    percentUsed: lot.quantity > 0 ? Math.round(((lot.quantity - lot.remaining) / lot.quantity) * 100) : 0
  })
})

// GET /api/reception-labels - Lista todas las recepciones recientes
router.get('/reception-labels', auth, (_req, res) => {
  try {
    const raw = db.prepare(`SELECT id, code, raw_material_id as material_id, quantity, remaining, unit, received_at, expiry_date, status FROM raw_material_lots ORDER BY received_at DESC LIMIT 50`).all()
    const pkg = db.prepare(`SELECT id, code, packaging_id as material_id, quantity, remaining, received_at, expiry_date, status FROM packaging_lots ORDER BY received_at DESC LIMIT 50`).all()
    const combined = [
      ...raw.map(l => ({ ...l, type: 'raw' })),
      ...pkg.map(l => ({ ...l, type: 'pkg' }))
    ].sort((a, b) => (b.received_at || '').localeCompare(a.received_at || '')).slice(0, 50)
    res.json(combined)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ============================================================
// LOTES CENTRALIZADO - Generación auto, trazabilidad, flujo
// ============================================================

// GET /api/lots/next-code/:type - Genera el siguiente número de lote
// type = 'raw' (MP) | 'envase' | 'embalaje' | 'product' (PT) | 'production' (OP)
router.get('/lots/next-code/:type', auth, (req, res) => {
  const { type } = req.params
  const year = new Date().getFullYear()
  let code = ''
  
  if (type === 'raw') {
    // MP-00025 - sin año
    const prefix = 'MP-'
    const row = db.prepare(`SELECT code FROM raw_material_lots WHERE code LIKE ? ORDER BY length(code) DESC, code DESC LIMIT 1`).get(`${prefix}%`)
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    code = `${prefix}${String(nextNum).padStart(5, '0')}`
  } else if (type === 'envase') {
    // ENV-00012 - sin año
    const prefix = 'ENV-'
    const row = db.prepare(`SELECT code FROM packaging_lots WHERE code LIKE ? ORDER BY length(code) DESC, code DESC LIMIT 1`).get(`${prefix}%`)
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    code = `${prefix}${String(nextNum).padStart(5, '0')}`
  } else if (type === 'embalaje') {
    // EMB-00008 - sin año
    const prefix = 'EMB-'
    const row = db.prepare(`SELECT code FROM packaging_lots WHERE code LIKE ? ORDER BY length(code) DESC, code DESC LIMIT 1`).get(`${prefix}%`)
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    code = `${prefix}${String(nextNum).padStart(5, '0')}`
  } else if (type === 'pkg' || type === 'packaging') {
    // Legacy: envase por defecto
    const prefix = 'ENV-'
    const row = db.prepare(`SELECT code FROM packaging_lots WHERE code LIKE ? ORDER BY length(code) DESC, code DESC LIMIT 1`).get(`${prefix}%`)
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    code = `${prefix}${String(nextNum).padStart(5, '0')}`
  } else if (type === 'product') {
    // PT-2026-0001 - con año
    const prefix = 'PT-'
    const row = db.prepare(`SELECT lot_number as code FROM lots WHERE lot_number LIKE ? ORDER BY lot_number DESC LIMIT 1`).get(`${prefix}${year}-%`)
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    code = `${prefix}${year}-${String(nextNum).padStart(4, '0')}`
  } else if (type === 'production') {
    // OP-2026-0001 - con año
    const prefix = 'OP-'
    const row = db.prepare(`SELECT number as code FROM production_orders WHERE number LIKE ? ORDER BY number DESC LIMIT 1`).get(`${prefix}${year}-%`)
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    code = `${prefix}${year}-${String(nextNum).padStart(4, '0')}`
  } else {
    return res.status(400).json({ error: 'Tipo inválido. Use: raw, envase, embalaje, product, production' })
  }
  
  res.json({ code, type, year, prefix: code.split('-')[0] + '-' })
})

// GET /api/lots-central - Búsqueda unificada de todos los tipos de lote
// Soporta filtros: type, query, status, supplierId, productId, orderId, startDate, endDate
router.get('/lots-central', auth, (req, res) => {
  try {
    const { type, query, status, supplierId, productId, orderId, startDate, endDate, limit = 100 } = req.query
    const results = []
    
    // Lotes de MP
    if (!type || type === 'raw' || type === 'all') {
      let sql = `SELECT 
        rml.id, rml.code, rml.internal_lot_number, rml.supplier_lot_number,
        rml.quantity as quantity_received, rml.remaining as quantity_remaining,
        rml.unit, rml.invoice, rml.received_at, rml.expiry_date, rml.status, rml.notes,
        rml.supplier_id, rml.supplier_name, rml.raw_material_id,
        rm.name as material_name, rm.code as material_code, rm.category as material_category
      FROM raw_material_lots rml
      LEFT JOIN raw_materials rm ON rml.raw_material_id = rm.id
      WHERE 1=1`
      const params = []
      if (query) {
        sql += ` AND (rml.code LIKE ? OR rml.internal_lot_number LIKE ? OR rml.supplier_lot_number LIKE ? OR rm.name LIKE ? OR rml.invoice LIKE ?)`
        const q = `%${query}%`
        params.push(q, q, q, q, q)
      }
      if (status) { sql += ` AND rml.status = ?`; params.push(status) }
      if (supplierId) { sql += ` AND rml.supplier_id = ?`; params.push(supplierId) }
      if (startDate) { sql += ` AND rml.received_at >= ?`; params.push(startDate) }
      if (endDate) { sql += ` AND rml.received_at <= ?`; params.push(endDate) }
      sql += ` ORDER BY rml.received_at DESC LIMIT ?`
      params.push(Number(limit))
      const rows = db.prepare(sql).all(...params)
      for (const r of rows) {
        results.push({
          type: 'raw',
          id: r.id,
          code: r.code,
          internalLotNumber: r.internal_lot_number,
          supplierLotNumber: r.supplier_lot_number,
          quantityReceived: r.quantity_received,
          quantityRemaining: r.quantity_remaining,
          unit: r.unit,
          invoice: r.invoice,
          receivedAt: r.received_at,
          expiryDate: r.expiry_date,
          status: r.status,
          notes: r.notes,
          supplierId: r.supplier_id,
          supplierName: r.supplier_name,
          materialId: r.raw_material_id,
          materialName: r.material_name,
          materialCode: r.material_code,
          materialCategory: r.material_category,
          percentUsed: r.quantity_received > 0 ? Math.round(((r.quantity_received - r.quantity_remaining) / r.quantity_received) * 100) : 0
        })
      }
    }
    
    // Lotes de envases y embalajes
    if (!type || type === 'envase' || type === 'embalaje' || type === 'pkg' || type === 'all') {
      let sql = `SELECT 
        pl.id, pl.code, pl.quantity as quantity_received, pl.remaining as quantity_remaining,
        pl.unit, pl.invoice, pl.received_at, pl.expiry_date, pl.status, pl.notes,
        pl.supplier_id, pl.supplier_name, pl.packaging_id, pl.internal_lot_number, pl.supplier_lot_number,
        COALESCE(p.category, 'envase') as category,
        p.name as material_name, p.code as material_code, p.type as material_type
      FROM packaging_lots pl
      LEFT JOIN packaging p ON pl.packaging_id = p.id
      WHERE 1=1`
      const params = []
      if (query) {
        sql += ` AND (pl.code LIKE ? OR p.name LIKE ? OR pl.invoice LIKE ?)`
        const q = `%${query}%`
        params.push(q, q, q)
      }
      if (status) { sql += ` AND pl.status = ?`; params.push(status) }
      if (supplierId) { sql += ` AND pl.supplier_id = ?`; params.push(supplierId) }
      if (startDate) { sql += ` AND pl.received_at >= ?`; params.push(startDate) }
      if (endDate) { sql += ` AND pl.received_at <= ?`; params.push(endDate) }
      // Filtrar por categoría específica
      if (type === 'envase') sql += ` AND (p.category = 'envase' OR p.category IS NULL)`
      if (type === 'embalaje') sql += ` AND p.category = 'embalaje'`
      sql += ` ORDER BY pl.received_at DESC LIMIT ?`
      params.push(Number(limit))
      const rows = db.prepare(sql).all(...params)
      for (const r of rows) {
        const t = (r.category === 'embalaje') ? 'embalaje' : 'envase'
        if (type && type !== 'all' && type !== t && type !== 'pkg') continue
        results.push({
          type: t,
          category: t,
          id: r.id,
          code: r.code,
          internalLotNumber: r.internal_lot_number,
          supplierLotNumber: r.supplier_lot_number,
          quantityReceived: r.quantity_received,
          quantityRemaining: r.quantity_remaining,
          unit: r.unit || 'ud',
          invoice: r.invoice,
          receivedAt: r.received_at,
          expiryDate: r.expiry_date,
          status: r.status,
          notes: r.notes,
          supplierId: r.supplier_id,
          supplierName: r.supplier_name,
          materialId: r.packaging_id,
          materialName: r.material_name,
          materialCode: r.material_code,
          materialType: r.material_type,
          percentUsed: r.quantity_received > 0 ? Math.round(((r.quantity_received - r.quantity_remaining) / r.quantity_received) * 100) : 0
        })
      }
    }
    
    // Lotes de producto terminado (desde tabla unificada lots)
    if (!type || type === 'product' || type === 'all') {
      let sql = `SELECT 
        l.id, l.code, l.quantity as quantity_received, l.quantity_remaining, l.unit, l.status,
        l.received_at as produced_at, l.expiry_date,
        l.produced_by, l.notes, l.product_id, l.recipe_id, l.production_order_id,
        l.production_order_number,
        p.name as product_name, p.code as product_code,
        po.number as production_order_number2, po.pedido_id as order_id,
        u.full_name as produced_by_name,
        o.number as order_number, c.name as customer_name
      FROM lots l
      LEFT JOIN products p ON l.product_id = p.id
      LEFT JOIN production_orders po ON l.production_order_id = po.id
      LEFT JOIN users u ON l.produced_by = u.id
      LEFT JOIN orders o ON po.pedido_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE l.type = 'product'`
      const params = []
      if (query) {
        sql += ` AND (l.code LIKE ? OR p.name LIKE ? OR p.code LIKE ?)`
        const q = `%${query}%`
        params.push(q, q, q)
      }
      if (status) { sql += ` AND l.status = ?`; params.push(status) }
      if (productId) { sql += ` AND l.product_id = ?`; params.push(productId) }
      if (orderId) { sql += ` AND po.pedido_id = ?`; params.push(orderId) }
      if (startDate) { sql += ` AND l.received_at >= ?`; params.push(startDate) }
      if (endDate) { sql += ` AND l.received_at <= ?`; params.push(endDate) }
      sql += ` ORDER BY l.received_at DESC LIMIT ?`
      params.push(Number(limit))
      const rows = db.prepare(sql).all(...params)
      for (const r of rows) {
        results.push({
          type: 'product',
          id: r.id,
          code: r.code,
          quantityReceived: r.quantity_received,
          quantityRemaining: r.quantity_remaining,
          quantity: r.quantity_received,
          unit: r.unit || 'ud',
          producedAt: r.produced_at,
          expiryDate: r.expiry_date,
          status: r.status,
          notes: r.notes,
          productId: r.product_id,
          productName: r.product_name,
          productCode: r.product_code,
          productionOrderId: r.production_order_id,
          productionOrderNumber: r.production_order_number || r.production_order_number2,
          orderId: r.order_id,
          orderNumber: r.order_number,
          customerName: r.customer_name,
          producedBy: r.produced_by,
          producedByName: r.produced_by_name
        })
      }
    }
    
    // Ordenar por fecha
    results.sort((a, b) => {
      const da = a.receivedAt || a.producedAt || ''
      const db_ = b.receivedAt || b.producedAt || ''
      return db_.localeCompare(da)
    })
    
    res.json({ results: results.slice(0, Number(limit)), total: results.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/lots/:id/traceability - Trazabilidad completa de un lote de producto terminado
router.get('/lots/:id/traceability', auth, (req, res) => {
  try {
    const lot = db.prepare(`
      SELECT l.*, p.name as product_name, p.code as product_code, p.bottle_size as product_unit
      FROM lots l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.id = ?
    `).get(req.params.id)
    if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
    
    // Consumos de MP/envases
    const consumptions = db.prepare(`
      SELECT * FROM lot_consumptions WHERE production_lot_id = ? ORDER BY consumed_at ASC
    `).all(req.params.id)
    
    // Enriquecer con info de los lotes de origen
    const enrichedConsumptions = consumptions.map(c => {
      let sourceLot = null
      if (c.source_type === 'raw') {
        sourceLot = db.prepare(`
          SELECT rml.*, rm.name as material_name, rm.code as material_code
          FROM raw_material_lots rml
          LEFT JOIN raw_materials rm ON rml.raw_material_id = rm.id
          WHERE rml.id = ?
        `).get(c.source_lot_id)
      } else {
        sourceLot = db.prepare(`
          SELECT pl.*, p.name as material_name, p.code as material_code
          FROM packaging_lots pl
          LEFT JOIN packaging p ON pl.packaging_id = p.id
          WHERE pl.id = ?
        `).get(c.source_lot_id)
      }
      return {
        ...c,
        source_lot: sourceLot ? {
          code: sourceLot.code,
          material_name: sourceLot.material_name,
          material_code: sourceLot.material_code,
          received_at: sourceLot.received_at,
          expiry_date: sourceLot.expiry_date,
          supplier_name: sourceLot.supplier_name,
          invoice: sourceLot.invoice
        } : null
      }
    })
    
    // Orden de producción vinculada
    let productionOrder = null
    if (lot.production_order_id) {
      productionOrder = db.prepare(`
        SELECT po.*, u.full_name as created_by_name
        FROM production_orders po
        LEFT JOIN users u ON po.created_by = u.id
        WHERE po.id = ?
      `).get(lot.production_order_id)
    }
    
    // Pedido vinculado
    let order = null
    if (productionOrder?.pedido_id) {
      order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(productionOrder.pedido_id)
      if (order) {
        try { order.items = JSON.parse(order.items_json || '[]') } catch {}
      }
    }
    
    res.json({
      lot: {
        id: lot.id,
        code: lot.code || lot.lot_number,
        productId: lot.product_id,
        productName: lot.product_name,
        productCode: lot.product_code,
        productUnit: lot.product_unit,
        quantity: lot.quantity_received || lot.quantity,
        quantityRemaining: lot.quantity_remaining,
        status: lot.status,
        producedAt: lot.received_at || lot.produced_at,
        expiryDate: lot.expiry_date,
        notes: lot.notes
      },
      productionOrder,
      order,
      consumptions: enrichedConsumptions
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/production-orders/from-order/:orderId
// Crea una orden de producción desde un pedido
router.post('/production-orders/from-order/:orderId', auth, requirePermission('production', 'create'), (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
    let items
    try { items = JSON.parse(order.items_json || '[]') } catch { items = [] }
    if (items.length === 0) return res.status(400).json({ error: 'El pedido no tiene items' })
    
    // Por simplicidad, crear una orden por producto diferente
    const created = []
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId)
      if (!product) continue
      
      // Buscar receta
      const recipe = db.prepare(`SELECT * FROM recipes WHERE product_id = ? ORDER BY updated_at DESC LIMIT 1`).get(product.id)
      if (!recipe) {
        created.push({ productId: product.id, productName: product.name, error: 'Sin receta' })
        continue
      }
      
      // Generar número de orden
      const year = new Date().getFullYear()
      const count = db.prepare("SELECT COUNT(*) c FROM production_orders WHERE number LIKE ?").get(`OP-${year}-%`).c
      const number = `OP-${year}-${String(count + 1).padStart(4, '0')}`
      
      const id = uid('po-')
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO production_orders (id, number, product_id, recipe_id, quantity, status, pedido_id, notes, created_by, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(id, number, product.id, recipe.id, item.quantity || 1, 'pendiente', order.id, 
             `Creada desde pedido ${order.number}`, req.user.id, now)
      
      // Calcular materiales necesarios según receta
      let materials = []
      try { materials = JSON.parse(recipe.items_json || '[]') } catch {}
      const neededMaterials = materials.map(m => {
        const ratio = (item.quantity || 1) / (recipe.batch_size || 1)
        return {
          materialId: m.materialId,
          materialType: m.materialType || 'raw',
          name: m.name,
          quantityNeeded: m.quantity * ratio,
          unit: m.unit
        }
      })
      
      // Calcular disponibilidad con FIFO/FEFO
      const availability = []
      for (const m of neededMaterials) {
        const { allocations, shortage } = getMaterialByFEFO(m.materialId, m.materialType, m.quantityNeeded)
        availability.push({
          ...m,
          allocations,
          shortage,
          available: shortage === 0
        })
      }
      
      created.push({
        productionOrderId: id,
        number,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        quantity: item.quantity,
        status: 'pendiente',
        neededMaterials: availability
      })
    }
    
    addHistory(req, {
      action: 'crear', module: 'Producción', entityId: order.id,
      description: `Órdenes de producción creadas desde pedido ${order.number} (${created.length})`
    })
    
    res.json({ ok: true, orderId: order.id, productionOrders: created })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/production-orders/:id/complete
// Completa una orden de producción: descuenta MPs/envases, genera lote de PT
router.post('/production-orders/:id/complete', auth, requirePermission('production', 'edit'), (req, res) => {
  try {
    const po = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(req.params.id)
    if (!po) return res.status(404).json({ error: 'Orden de producción no encontrada' })
    if (po.status === 'acabada') return res.status(400).json({ error: 'La orden ya está completada' })
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(po.product_id)
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
    
    const recipe = po.recipe_id ? db.prepare('SELECT * FROM recipes WHERE id = ?').get(po.recipe_id) : null
    let materials = []
    if (recipe) {
      try { materials = JSON.parse(recipe.items_json || '[]') } catch {}
      // Enriquecer con nombre del material
      for (const m of materials) {
        if (!m.name) {
          if (m.materialType === 'packaging' || m.materialType === 'pkg') {
            const p = db.prepare('SELECT name FROM packaging WHERE id = ?').get(m.materialId)
            m.name = p?.name || 'Material'
          } else {
            const rm = db.prepare('SELECT name FROM raw_materials WHERE id = ?').get(m.materialId)
            m.name = rm?.name || 'Material'
          }
        }
      }
    }
    
    // Generar código de lote PT
    const year = new Date().getFullYear()
    const row = db.prepare(`SELECT code FROM lots WHERE code LIKE ? ORDER BY length(code) DESC, code DESC LIMIT 1`).get(`PT-${year}-%`)
    let nextNum = 1
    if (row?.code) {
      const m = row.code.match(/(\d+)$/)
      if (m) nextNum = parseInt(m[1], 10) + 1
    }
    const lotCode = `PT-${year}-${String(nextNum).padStart(4, '0')}`
    
    const lotId = uid('lot-')
    const now = new Date().toISOString()
    
    // Calcular expiry por defecto: 1 año para la mayoría
    const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    
    // Insertar el lote de PT en la tabla unificada lots
    db.prepare(`
      INSERT INTO lots (id, code, type, reference_id, product_id, production_order_id, quantity, quantity_received, quantity_remaining, unit, status, notes, created_at, recipe_id, produced_by, expiry_date, raw_materials_json, production_order_number)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(lotId, lotCode, 'product', lotId, po.product_id, po.id, po.quantity, po.quantity, po.quantity, product.unit || 'ud',
           'completado', `Producido desde ${po.number}`, now, po.recipe_id, req.user.id, expiryDate, JSON.stringify(materials), po.number)
    
    // Consumir materiales (FIFO/FEFO) y registrar trazabilidad
    const consumptions = []
    for (const m of materials) {
      const ratio = po.quantity / (recipe.batch_size || 1)
      const needed = m.quantity * ratio
      const { allocations, shortage } = getMaterialByFEFO(m.materialId, m.materialType || 'raw', needed)
      
      if (shortage > 0) {
        return res.status(400).json({ 
          error: `Stock insuficiente de ${m.name}: faltan ${shortage} ${m.unit}`,
          shortage: { materialId: m.materialId, materialName: m.name, missing: shortage }
        })
      }
      
      for (const alloc of allocations) {
        const table = m.materialType === 'pkg' ? 'packaging_lots' : 'raw_material_lots'
        db.prepare(`UPDATE ${table} SET remaining = remaining - ? WHERE id = ?`).run(alloc.quantity, alloc.lotId)
        db.prepare(`UPDATE ${table} SET status = CASE WHEN remaining <= 0 THEN 'consumed' ELSE status END WHERE id = ?`).run(alloc.lotId)
        
        // Registrar consumo para trazabilidad
        const consId = uid('cons-')
        db.prepare(`
          INSERT INTO lot_consumptions (id, production_lot_id, production_order_id, source_type, source_lot_id, source_lot_code, material_id, material_name, quantity_consumed, unit, consumed_at, consumed_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(consId, lotId, po.id, m.materialType === 'pkg' ? 'pkg' : 'raw', alloc.lotId, alloc.lotCode, m.materialId, m.name, alloc.quantity, m.unit, now, req.user.id)
        
        consumptions.push({ sourceLot: alloc.lotCode, material: m.name, quantity: alloc.quantity, unit: m.unit })
      }
    }
    
    // Sumar al stock de producto terminado
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(po.quantity, po.product_id)
    
    // Marcar la orden de producción como completada
    db.prepare(`UPDATE production_orders SET status = 'acabada', finished_at = ? WHERE id = ?`).run(now, po.id)
    
    addHistory(req, {
      action: 'completar', module: 'Producción', entityId: po.id,
      description: `Producción ${po.number} completada → Lote ${lotCode} (${po.quantity} ud) de ${product.name}`
    })
    
    res.json({
      ok: true,
      lot: {
        id: lotId,
        code: lotCode,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        quantity: po.quantity,
        producedAt: now,
        expiryDate
      },
      consumptions,
      productionOrder: { id: po.id, number: po.number, status: 'acabada' }
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/lots/by-code/:code - Búsqueda directa de un lote por su código
// Detecta automáticamente el tipo según el prefijo (MP-, ENV-, EMB-, PT-, OP-)
router.get('/lots/by-code/:code', auth, (req, res) => {
  try {
    const { code } = req.params
    const codeUpper = code.toUpperCase()
    
    if (codeUpper.startsWith('MP-')) {
      const lot = db.prepare(`
        SELECT rml.*, rm.name as material_name, rm.code as material_code
        FROM raw_material_lots rml
        LEFT JOIN raw_materials rm ON rml.raw_material_id = rm.id
        WHERE rml.code = ? OR rml.internal_lot_number = ?
        LIMIT 1
      `).get(codeUpper, code)
      if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
      return res.json({ type: 'raw', lot })
    } else if (codeUpper.startsWith('ENV-') || codeUpper.startsWith('EMB-')) {
      const lot = db.prepare(`
        SELECT pl.*, p.name as material_name, p.code as material_code, p.category
        FROM packaging_lots pl
        LEFT JOIN packaging p ON pl.packaging_id = p.id
        WHERE pl.code = ? OR pl.internal_lot_number = ?
        LIMIT 1
      `).get(codeUpper, code)
      if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
      return res.json({ type: lot.category || 'envase', lot })
    } else if (codeUpper.startsWith('PT-')) {
      const lot = db.prepare(`
        SELECT l.*, p.name as product_name, p.code as product_code
        FROM lots l
        LEFT JOIN products p ON l.product_id = p.id
        WHERE l.code = ?
        LIMIT 1
      `).get(codeUpper)
      if (!lot) return res.status(404).json({ error: 'Lote no encontrado' })
      return res.json({ type: 'product', lot })
    } else if (codeUpper.startsWith('OP-')) {
      const po = db.prepare(`
        SELECT po.*, p.name as product_name, p.code as product_code
        FROM production_orders po
        LEFT JOIN products p ON po.product_id = p.id
        WHERE po.number = ?
        LIMIT 1
      `).get(codeUpper)
      if (!po) return res.status(404).json({ error: 'Orden no encontrada' })
      return res.json({ type: 'production', lot: po })
    } else {
      return res.status(400).json({ error: 'Prefijo no reconocido. Use MP-, ENV-, EMB-, PT- u OP-' })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/lots/:id/reverse-traceability - Trazabilidad inversa
// Dado un lote de MP/envase/embalaje, devuelve en qué lotes de PT se ha utilizado
router.get('/lots/:id/reverse-traceability', auth, (req, res) => {
  try {
    const { id } = req.params
    const consumptions = db.prepare(`
      SELECT lc.*, l.code as production_lot_code, l.received_at as produced_at, l.status as lot_status,
             p.name as product_name, p.code as product_code
      FROM lot_consumptions lc
      LEFT JOIN lots l ON lc.production_lot_id = l.id
      LEFT JOIN products p ON l.product_id = p.id
      WHERE lc.source_lot_id = ?
      ORDER BY lc.consumed_at DESC
    `).all(id)
    
    if (consumptions.length === 0) {
      return res.json({ usedIn: [], message: 'Este lote aún no se ha utilizado en ninguna producción' })
    }
    
    res.json({
      usedIn: consumptions.map(c => ({
        productionLotId: c.production_lot_id,
        productionLotCode: c.production_lot_code,
        producedAt: c.produced_at,
        lotStatus: c.lot_status,
        productName: c.product_name,
        productCode: c.product_code,
        quantityConsumed: c.quantity_consumed,
        unit: c.unit,
        consumedAt: c.consumed_at
      }))
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/lots-catalog - Catálogo de tipos para el sidebar
// Lee de la tabla UNIFICADA lots para todos los tipos
router.get('/lots-catalog', auth, (_req, res) => {
  try {
    const counts = {
      raw: db.prepare(`SELECT COUNT(*) c FROM lots WHERE type = 'raw'`).get().c,
      envase: db.prepare(`SELECT COUNT(*) c FROM lots WHERE type = 'envase'`).get().c,
      embalaje: db.prepare(`SELECT COUNT(*) c FROM lots WHERE type = 'embalaje'`).get().c,
      product: db.prepare(`SELECT COUNT(*) c FROM lots WHERE type = 'product'`).get().c,
      production: db.prepare(`SELECT COUNT(*) c FROM production_orders WHERE status != 'acabada'`).get().c
    }
    res.json({
      counts,
      lastCodes: {
        raw: (db.prepare(`SELECT code FROM lots WHERE type = 'raw' ORDER BY length(code) DESC, code DESC LIMIT 1`).get() || {}).code || null,
        envase: (db.prepare(`SELECT code FROM lots WHERE type = 'envase' ORDER BY length(code) DESC, code DESC LIMIT 1`).get() || {}).code || null,
        embalaje: (db.prepare(`SELECT code FROM lots WHERE type = 'embalaje' ORDER BY length(code) DESC, code DESC LIMIT 1`).get() || {}).code || null,
        product: (db.prepare(`SELECT code FROM lots WHERE type = 'product' ORDER BY length(code) DESC, code DESC LIMIT 1`).get() || {}).code || null,
        production: (db.prepare(`SELECT number as code FROM production_orders ORDER BY number DESC LIMIT 1`).get() || {}).code || null
      }
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
