// Seed script — populates the DB with realistic demo data on first run.
import bcrypt from 'bcryptjs'
import db, { uid, getConfig, setConfig } from './db.js'

const now = new Date()
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString()
const daysAhead = (n) => new Date(now.getTime() + n * 86400000).toISOString()
const monthsAgo = (n) => { const d = new Date(now); d.setMonth(d.getMonth() - n); return d.toISOString() }

function alreadySeeded() {
  const row = db.prepare('SELECT COUNT(*) as c FROM users').get()
  return row.c > 0
}

function clear() {
  const tables = ['history','notifications','lots','expenses','purchases','orders','customers','recipes','products','packaging','raw_materials','suppliers','users','config']
  for (const t of tables) {
    try { db.prepare(`DELETE FROM ${t}`).run() } catch {}
  }
}

export function seed({ force = false } = {}) {
  if (alreadySeeded() && !force) return { seeded: false }
  if (force) clear()

  // ---- CONFIG ----
  setConfig('company', {
    name: 'CleanPro Industries S.L.',
    cif: 'B-12345678',
    address: 'Polígono Industrial Las Marismas, Nave 14, 41020 Sevilla',
    phone: '+34 954 123 456',
    email: 'info@cleanpro.es',
  })
  setConfig('defaults', {
    bottlesPerBox: 12, boxesPerPallet: 60, tax: 21, currency: 'EUR', language: 'es',
    minStockDefault: 100, maxStockDefault: 5000, bottleSizes: [250, 500, 750, 1000, 2000],
  })
  setConfig('security', { sessionTimeoutMin: 30, maxFailedAttempts: 5, autoBackupHours: 24 })

  // ---- USERS ----
  const hash = (p) => bcrypt.hashSync(p, 10)
  const users = [
    { id: 'u1', username: 'admin', password: 'admin123', fullName: 'Carlos Rodríguez', email: 'carlos@cleanpro.es', role: 'admin' },
    { id: 'u2', username: 'produccion', password: 'produccion123', fullName: 'María García', email: 'maria@cleanpro.es', role: 'produccion' },
    { id: 'u3', username: 'contabilidad', password: 'contabilidad123', fullName: 'Antonio Sánchez', email: 'antonio@cleanpro.es', role: 'contabilidad' },
  ]
  const insUser = db.prepare(`INSERT INTO users (id, username, password_hash, full_name, email, role, active, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
  for (const u of users) {
    insUser.run(u.id, u.username, hash(u.password), u.fullName, u.email, u.role, monthsAgo(12), daysAgo(0))
  }

  // ---- SUPPLIERS ----
  const suppliers = [
    { id: 's1', name: 'Química Industrial del Sur', cif: 'A-41111222', email: 'ventas@quimicasur.es', phone: '+34 955 111 222', contact: 'Pedro Ramírez', address: 'Av. de la Industria 45', city: 'Sevilla', country: 'España' },
    { id: 's2', name: 'Envases Mediterráneo', cif: 'B-43222333', email: 'pedidos@envasesmed.com', phone: '+34 961 222 333', contact: 'Sofía Martín', address: 'C/ del Plástico 12', city: 'Valencia', country: 'España' },
    { id: 's3', name: 'Aromas & Fragancias S.A.', cif: 'A-08333444', email: 'info@aromass.com', phone: '+34 932 333 444', contact: 'Joan Puig', address: 'Polígono Zona Franca 8', city: 'Barcelona', country: 'España' },
    { id: 's4', name: 'Colorantes Técnicos', cif: 'B-25444555', email: 'comercial@coltec.es', phone: '+34 983 444 555', contact: 'Ana Belén', address: 'C/ Mayor 67', city: 'Valladolid', country: 'España' },
  ]
  const insSup = db.prepare(`INSERT INTO suppliers (id, name, cif, email, phone, contact, address, city, country) VALUES (?,?,?,?,?,?,?,?,?)`)
  for (const s of suppliers) insSup.run(s.id, s.name, s.cif, s.email, s.phone, s.contact, s.address, s.city, s.country)

  // ---- RAW MATERIALS ----
  const raw = [
    { id: 'rm1', code: 'RM-001', name: 'Concentrado Japonés Premium', category: 'concentrado', unit: 'L', stock: 1850, minStock: 500, maxStock: 5000, price: 4.50, supplierId: 's1', location: 'A-01-03', expiry: daysAhead(180), lot: 'CJ-2025-0842' },
    { id: 'rm2', code: 'RM-002', name: 'Agua Desionizada', category: 'agua', unit: 'L', stock: 12400, minStock: 2000, maxStock: 20000, price: 0.05, supplierId: 's1', location: 'A-01-04' },
    { id: 'rm3', code: 'RM-003', name: 'Colorante Azul Brillante', category: 'colorante', unit: 'ml', stock: 18500, minStock: 5000, maxStock: 50000, price: 0.08, supplierId: 's4', location: 'A-02-01', expiry: daysAhead(420), lot: 'AZ-24-1138' },
    { id: 'rm4', code: 'RM-004', name: 'Aroma Limón Natural', category: 'aroma', unit: 'ml', stock: 9200, minStock: 3000, maxStock: 30000, price: 0.12, supplierId: 's3', location: 'A-02-02', expiry: daysAhead(28), lot: 'LM-25-0244' },
    { id: 'rm5', code: 'RM-005', name: 'Aroma Pino Fresco', category: 'aroma', unit: 'ml', stock: 450, minStock: 1000, maxStock: 20000, price: 0.14, supplierId: 's3', location: 'A-02-03', expiry: daysAhead(90), lot: 'PN-25-0091' },
    { id: 'rm6', code: 'RM-006', name: 'Conservante Kathon CG', category: 'conservante', unit: 'ml', stock: 6800, minStock: 2000, maxStock: 15000, price: 0.22, supplierId: 's1', location: 'A-03-01', expiry: daysAhead(540), lot: 'KT-24-0512' },
    { id: 'rm7', code: 'RM-007', name: 'Espesante Xantana', category: 'espesante', unit: 'kg', stock: 320, minStock: 100, maxStock: 2000, price: 8.20, supplierId: 's1', location: 'A-03-02', expiry: daysAhead(720), lot: 'XT-24-0088' },
    { id: 'rm8', code: 'RM-008', name: 'Sal Industrial', category: 'sal', unit: 'kg', stock: 1500, minStock: 200, maxStock: 5000, price: 0.30, supplierId: 's1', location: 'A-04-01' },
    { id: 'rm9', code: 'RM-009', name: 'Hipoclorito Sódico 12%', category: 'otro', unit: 'L', stock: 3200, minStock: 1000, maxStock: 8000, price: 1.20, supplierId: 's1', location: 'B-01-01', expiry: daysAhead(45), lot: 'HC-25-0301' },
    { id: 'rm10', code: 'RM-010', name: 'Tensoactivo No Iónico', category: 'concentrado', unit: 'L', stock: 2400, minStock: 800, maxStock: 6000, price: 3.80, supplierId: 's1', location: 'A-01-05', expiry: daysAhead(300), lot: 'TN-24-0712' },
  ]
  const insRaw = db.prepare(`INSERT INTO raw_materials (id, code, name, category, unit, stock, min_stock, max_stock, price, supplier_id, location, expiry_date, lot, last_updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const m of raw) insRaw.run(m.id, m.code, m.name, m.category, m.unit, m.stock, m.minStock, m.maxStock, m.price, m.supplierId, m.location, m.expiry || null, m.lot || null, daysAgo(2))

  // ---- PACKAGING ----
  const pkg = [
    { id: 'pk1', code: 'PK-250', name: 'Botella PET 250 ml', type: 'botella', size: '250ml', stock: 8400, minStock: 2000, maxStock: 30000, price: 0.18, supplierId: 's2', location: 'C-01-01' },
    { id: 'pk2', code: 'PK-500', name: 'Botella PET 500 ml', type: 'botella', size: '500ml', stock: 6200, minStock: 2000, maxStock: 30000, price: 0.26, supplierId: 's2', location: 'C-01-02' },
    { id: 'pk3', code: 'PK-750', name: 'Botella PET 750 ml', type: 'botella', size: '750ml', stock: 1180, minStock: 2000, maxStock: 25000, price: 0.34, supplierId: 's2', location: 'C-01-03' },
    { id: 'pk4', code: 'PK-1000', name: 'Botella PET 1 L', type: 'botella', size: '1000ml', stock: 4100, minStock: 1500, maxStock: 20000, price: 0.42, supplierId: 's2', location: 'C-01-04' },
    { id: 'pk5', code: 'PK-TAP', name: 'Tapón Rosca 28/400', type: 'tapon', stock: 22500, minStock: 5000, maxStock: 80000, price: 0.04, supplierId: 's2', location: 'C-02-01' },
    { id: 'pk6', code: 'PK-PUL', name: 'Pulverizador Trigger', type: 'pulverizador', stock: 3400, minStock: 1000, maxStock: 15000, price: 0.85, supplierId: 's2', location: 'C-02-02' },
    { id: 'pk7', code: 'PK-ETQ', name: 'Etiqueta Adhesiva', type: 'etiqueta', stock: 18000, minStock: 5000, maxStock: 100000, price: 0.03, supplierId: 's2', location: 'C-03-01' },
    { id: 'pk8', code: 'PK-CJA', name: 'Caja Cartón 12 ud', type: 'caja', stock: 1450, minStock: 500, maxStock: 10000, price: 0.55, supplierId: 's2', location: 'D-01-01' },
    { id: 'pk9', code: 'PK-PAL', name: 'Palet EUR 1200x800', type: 'palet', stock: 85, minStock: 20, maxStock: 200, price: 12.00, supplierId: 's2', location: 'D-02-01' },
    { id: 'pk10', code: 'PK-FLM', name: 'Film Estirable 23µ', type: 'film', stock: 32, minStock: 10, maxStock: 100, price: 18.50, supplierId: 's2', location: 'D-02-02' },
    { id: 'pk11', code: 'PK-PRI', name: 'Precinto Seguridad', type: 'precinto', stock: 1200, minStock: 500, maxStock: 10000, price: 0.06, supplierId: 's2', location: 'D-02-03' },
  ]
  const insPkg = db.prepare(`INSERT INTO packaging (id, code, name, type, size, stock, min_stock, max_stock, price, supplier_id, location, last_updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const p of pkg) insPkg.run(p.id, p.code, p.name, p.type, p.size || null, p.stock, p.minStock, p.maxStock, p.price, p.supplierId, p.location, daysAgo(2))

  // ---- PRODUCTS ----
  const products = [
    { id: 'pr1', code: 'P-LIM-750', name: 'Limpiador Multiusos 750 ml', description: 'Limpiador multiusos aroma limón', category: 'Multiusos', bottleSize: 750, stock: 480, minStock: 500, maxStock: 5000, price: 3.95, cost: 1.80, recipeId: 'rc1' },
    { id: 'pr2', code: 'P-LIM-1L', name: 'Limpiador Multiusos 1 L', description: 'Limpiador multiusos aroma limón', category: 'Multiusos', bottleSize: 1000, stock: 1240, minStock: 400, maxStock: 4000, price: 4.50, cost: 2.10, recipeId: 'rc2' },
    { id: 'pr3', code: 'P-DES-1L', name: 'Desinfectante Pino 1 L', description: 'Desinfectante aroma pino fresco', category: 'Desinfectantes', bottleSize: 1000, stock: 320, minStock: 300, maxStock: 3000, price: 5.20, cost: 2.30, recipeId: 'rc3' },
    { id: 'pr4', code: 'P-FREG-2L', name: 'Fregasuelos Concentrado 2 L', description: 'Fregasuelos alta concentración', category: 'Suelos', bottleSize: 2000, stock: 180, minStock: 200, maxStock: 2000, price: 7.80, cost: 3.40, recipeId: 'rc4' },
    { id: 'pr5', code: 'P-VIT-500', name: 'Limpiacristales 500 ml', description: 'Limpiacristales con pulverizador', category: 'Cristales', bottleSize: 500, stock: 890, minStock: 300, maxStock: 3000, price: 3.20, cost: 1.45, recipeId: 'rc5' },
    { id: 'pr6', code: 'P-BAN-750', name: 'Limpiador Baños 750 ml', description: 'Limpiador específico para baños', category: 'Baño', bottleSize: 750, stock: 560, minStock: 300, maxStock: 3000, price: 4.20, cost: 1.95, recipeId: 'rc6' },
  ]
  const insProd = db.prepare(`INSERT INTO products (id, code, name, description, category, bottle_size, stock, min_stock, max_stock, price, cost, recipe_id, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`)
  for (const p of products) insProd.run(p.id, p.code, p.name, p.description, p.category, p.bottleSize, p.stock, p.minStock, p.maxStock, p.price, p.cost, p.recipeId)

  // ---- RECIPES ----
  const recipes = [
    { id: 'rc1', productId: 'pr1', bottleSize: 750, bottlesPerBox: 12, boxesPerPallet: 60, yieldPerLiter: 1.3, items: [
      { materialId: 'rm1', materialType: 'raw', quantity: 0.15, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.80, unit: 'L' },
      { materialId: 'rm3', materialType: 'raw', quantity: 0.5, unit: 'ml' },
      { materialId: 'rm4', materialType: 'raw', quantity: 2.5, unit: 'ml' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.3, unit: 'ml' },
      { materialId: 'pk3', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1/12, unit: 'ud' },
    ]},
    { id: 'rc2', productId: 'pr2', bottleSize: 1000, bottlesPerBox: 12, boxesPerPallet: 60, yieldPerLiter: 1.0, items: [
      { materialId: 'rm1', materialType: 'raw', quantity: 0.18, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.78, unit: 'L' },
      { materialId: 'rm3', materialType: 'raw', quantity: 0.6, unit: 'ml' },
      { materialId: 'rm4', materialType: 'raw', quantity: 3.0, unit: 'ml' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.4, unit: 'ml' },
      { materialId: 'pk4', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1/12, unit: 'ud' },
    ]},
    { id: 'rc3', productId: 'pr3', bottleSize: 1000, bottlesPerBox: 12, boxesPerPallet: 60, yieldPerLiter: 1.0, items: [
      { materialId: 'rm9', materialType: 'raw', quantity: 0.20, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.75, unit: 'L' },
      { materialId: 'rm5', materialType: 'raw', quantity: 3.0, unit: 'ml' },
      { materialId: 'rm10', materialType: 'raw', quantity: 0.05, unit: 'L' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.3, unit: 'ml' },
      { materialId: 'pk4', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1/12, unit: 'ud' },
    ]},
    { id: 'rc4', productId: 'pr4', bottleSize: 2000, bottlesPerBox: 6, boxesPerPallet: 48, yieldPerLiter: 0.5, items: [
      { materialId: 'rm1', materialType: 'raw', quantity: 0.30, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.65, unit: 'L' },
      { materialId: 'rm7', materialType: 'raw', quantity: 5, unit: 'g' },
      { materialId: 'rm4', materialType: 'raw', quantity: 4, unit: 'ml' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.5, unit: 'ml' },
      { materialId: 'pk4', materialType: 'packaging', quantity: 2, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 2, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 2, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1/6, unit: 'ud' },
    ]},
    { id: 'rc5', productId: 'pr5', bottleSize: 500, bottlesPerBox: 12, boxesPerPallet: 80, yieldPerLiter: 2.0, items: [
      { materialId: 'rm1', materialType: 'raw', quantity: 0.05, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.42, unit: 'L' },
      { materialId: 'rm3', materialType: 'raw', quantity: 0.3, unit: 'ml' },
      { materialId: 'rm10', materialType: 'raw', quantity: 0.03, unit: 'L' },
      { materialId: 'pk2', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk6', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1/12, unit: 'ud' },
    ]},
    { id: 'rc6', productId: 'pr6', bottleSize: 750, bottlesPerBox: 12, boxesPerPallet: 60, yieldPerLiter: 1.3, items: [
      { materialId: 'rm9', materialType: 'raw', quantity: 0.10, unit: 'L' },
      { materialId: 'rm1', materialType: 'raw', quantity: 0.10, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.75, unit: 'L' },
      { materialId: 'rm7', materialType: 'raw', quantity: 2, unit: 'g' },
      { materialId: 'rm3', materialType: 'raw', quantity: 0.4, unit: 'ml' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.3, unit: 'ml' },
      { materialId: 'pk3', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1/12, unit: 'ud' },
    ]},
  ]
  const insRec = db.prepare(`INSERT INTO recipes (id, product_id, bottle_size, bottles_per_box, boxes_per_pallet, yield_per_liter, items_json, updated_at) VALUES (?,?,?,?,?,?,?,?)`)
  for (const r of recipes) insRec.run(r.id, r.productId, r.bottleSize, r.bottlesPerBox, r.boxesPerPallet, r.yieldPerLiter, JSON.stringify(r.items), daysAgo(10))

  // ---- CUSTOMERS ----
  const customers = [
    { id: 'c1', code: 'C-001', name: 'Distribuciones del Sur', company: 'Distribuciones del Sur S.L.', cif: 'B-41111222', address: 'C/ Asunción 23', city: 'Sevilla', country: 'España', phone: '+34 954 555 111', email: 'pedidos@dissur.es', contact: 'Manuel Sánchez', notes: 'Cliente VIP. Pago a 30 días.', totalPurchases: 48250 },
    { id: 'c2', code: 'C-002', name: 'Hiperlimpieza Madrid', company: 'Hiperlimpieza S.A.', cif: 'A-28111222', address: 'Av. Andalucía 89', city: 'Madrid', country: 'España', phone: '+34 911 222 333', email: 'compras@hiperlimpieza.com', contact: 'Cristina Vega', notes: 'Volumen alto', totalPurchases: 92400 },
    { id: 'c3', code: 'C-003', name: 'Limpiezas BCN', company: 'Limpiezas BCN S.L.', cif: 'B-08222333', address: 'C/ Mallorca 234', city: 'Barcelona', country: 'España', phone: '+34 932 444 555', email: 'info@limpiezasbcn.es', contact: 'Jordi Roca', notes: '', totalPurchases: 31800 },
    { id: 'c4', code: 'C-004', name: 'Hostelería del Levante', company: 'Hostelería Levante S.L.', cif: 'B-46222333', address: 'Av. del Mar 45', city: 'Valencia', country: 'España', phone: '+34 963 555 666', email: 'admin@hosteleva.es', contact: 'Patricia Mora', notes: 'Pedidos semanales', totalPurchases: 24650 },
    { id: 'c5', code: 'C-005', name: 'EcoClean Portugal', company: 'EcoClean Lda.', cif: 'PT-501234567', address: 'Rua das Indústrias 12', city: 'Lisboa', country: 'Portugal', phone: '+351 21 555 777', email: 'geral@ecoclean.pt', contact: 'Rui Santos', notes: 'Export UE', totalPurchases: 15800 },
    { id: 'c6', code: 'C-006', name: 'Limpiezas Málaga', company: 'Limpiezas Costa del Sol', cif: 'B-29222333', address: 'C/ Larios 78', city: 'Málaga', country: 'España', phone: '+34 952 666 777', email: 'contacto@limmalaga.es', contact: 'Sara Díaz', notes: '', totalPurchases: 9200 },
  ]
  const insCust = db.prepare(`INSERT INTO customers (id, code, name, company, cif, address, city, country, phone, email, contact, notes, total_purchases, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const c of customers) insCust.run(c.id, c.code, c.name, c.company, c.cif, c.address, c.city, c.country, c.phone, c.email, c.contact, c.notes, c.totalPurchases, monthsAgo(12))

  // ---- ORDERS ----
  const orders = [
    { id: 'o1', number: 'PED-2025-0142', customerId: 'c1', items: [{ productId: 'pr1', quantity: 200, unitPrice: 3.95, discount: 5 }], subtotal: 790, tax: 165.90, discount: 39.50, total: 916.40, status: 'entregado', createdAt: daysAgo(2), deliveryDate: daysAgo(1), createdBy: 'u4' },
    { id: 'o2', number: 'PED-2025-0143', customerId: 'c2', items: [{ productId: 'pr2', quantity: 500, unitPrice: 4.50, discount: 8 }, { productId: 'pr5', quantity: 300, unitPrice: 3.20, discount: 5 }], subtotal: 3210, tax: 674.10, discount: 304.80, total: 3579.30, status: 'preparando', createdAt: daysAgo(1), createdBy: 'u4' },
    { id: 'o3', number: 'PED-2025-0144', customerId: 'c3', items: [{ productId: 'pr3', quantity: 150, unitPrice: 5.20, discount: 0 }], subtotal: 780, tax: 163.80, discount: 0, total: 943.80, status: 'confirmado', createdAt: daysAgo(0), createdBy: 'u4' },
    { id: 'o4', number: 'PED-2025-0145', customerId: 'c4', items: [{ productId: 'pr4', quantity: 80, unitPrice: 7.80, discount: 10 }, { productId: 'pr6', quantity: 120, unitPrice: 4.20, discount: 5 }], subtotal: 1128, tax: 236.88, discount: 138, total: 1226.88, status: 'pendiente', createdAt: daysAgo(0), createdBy: 'u4' },
    { id: 'o5', number: 'PED-2025-0146', customerId: 'c5', items: [{ productId: 'pr1', quantity: 300, unitPrice: 3.95, discount: 12 }], subtotal: 1185, tax: 248.85, discount: 142.20, total: 1291.65, status: 'pendiente', createdAt: daysAgo(0), createdBy: 'u4' },
  ]
  const insOrder = db.prepare(`INSERT INTO orders (id, number, customer_id, items_json, subtotal, tax, discount, total, status, created_at, delivery_date, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const o of orders) insOrder.run(o.id, o.number, o.customerId, JSON.stringify(o.items), o.subtotal, o.tax, o.discount, o.total, o.status, o.createdAt, o.deliveryDate || null, o.notes || null, o.createdBy)

  // ---- PURCHASES ----
  const purchases = [
    { id: 'pu1', number: 'C-2025-0089', supplierId: 's1', invoice: 'F-2025/1234', items: [{ materialId: 'rm1', materialType: 'raw', quantity: 1000, unitPrice: 4.50 }], subtotal: 4500, tax: 945, total: 5445, status: 'recibida', date: daysAgo(2) },
    { id: 'pu2', number: 'C-2025-0090', supplierId: 's2', invoice: 'F-2025/5678', items: [{ materialId: 'pk3', materialType: 'packaging', quantity: 5000, unitPrice: 0.34 }], subtotal: 1700, tax: 357, total: 2057, status: 'recibida', date: daysAgo(5) },
    { id: 'pu3', number: 'C-2025-0091', supplierId: 's3', invoice: 'F-2025/9012', items: [{ materialId: 'rm4', materialType: 'raw', quantity: 5000, unitPrice: 0.12 }], subtotal: 600, tax: 126, total: 726, status: 'recibida', date: daysAgo(3) },
  ]
  const insPurch = db.prepare(`INSERT INTO purchases (id, number, supplier_id, invoice, items_json, subtotal, tax, total, status, date, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
  for (const p of purchases) insPurch.run(p.id, p.number, p.supplierId, p.invoice, JSON.stringify(p.items), p.subtotal, p.tax, p.total, p.status, p.date, p.notes || null)

  // ---- EXPENSES ----
  const expenses = [
    { date: daysAgo(1), category: 'electricidad', amount: 1245.50, description: 'Factura luz nave producción' },
    { date: daysAgo(2), category: 'agua', amount: 320.00, description: 'Consumo agua industrial' },
    { date: daysAgo(3), category: 'gas', amount: 480.30, description: 'Gas natural calefacción' },
    { date: daysAgo(5), category: 'internet', amount: 89.90, description: 'Fibra óptica oficina' },
    { date: daysAgo(7), category: 'combustible', amount: 215.40, description: 'Gasolina furgoneta reparto' },
    { date: daysAgo(10), category: 'alquiler', amount: 3200.00, description: 'Alquiler nave industrial' },
    { date: daysAgo(15), category: 'sueldos', amount: 18500.00, description: 'Nóminas mes' },
    { date: daysAgo(20), category: 'publicidad', amount: 450.00, description: 'Campaña Google Ads' },
    { date: daysAgo(25), category: 'mantenimiento', amount: 380.00, description: 'Revisión maquinaria' },
    { date: daysAgo(28), category: 'impuestos', amount: 2150.00, description: 'IVA trimestral' },
  ]
  const insExp = db.prepare(`INSERT INTO expenses (id, date, category, amount, description, attachment, created_by) VALUES (?,?,?,?,?,?,?)`)
  for (const e of expenses) insExp.run(uid('e-'), e.date, e.category, e.amount, e.description, null, 'u5')

  // ---- LOTS ----
  const lots = [
    { id: 'l1', lotNumber: 'LOT-2025-0842', productId: 'pr1', recipeId: 'rc1', quantity: 500, producedBy: 'u2', producedAt: daysAgo(2), status: 'completado' },
    { id: 'l2', lotNumber: 'LOT-2025-0843', productId: 'pr2', recipeId: 'rc2', quantity: 800, producedBy: 'u2', producedAt: daysAgo(1), status: 'completado' },
    { id: 'l3', lotNumber: 'LOT-2025-0844', productId: 'pr5', recipeId: 'rc5', quantity: 300, producedBy: 'u2', producedAt: daysAgo(0), status: 'completado' },
    { id: 'l4', lotNumber: 'LOT-2025-0845', productId: 'pr6', recipeId: 'rc6', quantity: 400, producedBy: 'u2', producedAt: daysAgo(0), status: 'en-proceso' },
  ]
  const insLot = db.prepare(`INSERT INTO lots (id, lot_number, product_id, recipe_id, quantity, raw_materials_json, produced_by, produced_at, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
  for (const l of lots) insLot.run(l.id, l.lotNumber, l.productId, l.recipeId, l.quantity, '[]', l.producedBy, l.producedAt, l.status, null)

  // ---- NOTIFICATIONS ----
  const notifs = [
    { type: 'stock-bajo', title: 'Stock bajo', message: 'Botellas PET 750 ml por debajo del mínimo (1.180 / 2.000)', severity: 'critical' },
    { type: 'stock-bajo', title: 'Stock bajo', message: 'Aroma Pino Fresco por debajo del mínimo (450 ml / 1.000 ml)', severity: 'warning' },
    { type: 'caducidad', title: 'Próxima caducidad', message: 'Aroma Limón Natural caduca en 28 días', severity: 'warning' },
    { type: 'stock-bajo', title: 'Stock bajo', message: 'Limpiador Multiusos 750 ml por debajo del mínimo (480 / 500)', severity: 'warning' },
    { type: 'produccion', title: 'Orden de fabricación', message: 'Orden automática generada: fabricar 800 ud de Limpiador Multiusos 750 ml', severity: 'info' },
    { type: 'pedido', title: 'Nuevo pedido', message: 'PED-2025-0144 de Limpiezas BCN por 943,80 €', severity: 'info' },
    { type: 'stock-bajo', title: 'Stock bajo', message: 'Fregasuelos Concentrado 2 L por debajo del mínimo (180 / 200)', severity: 'warning' },
  ]
  const insNotif = db.prepare(`INSERT INTO notifications (id, type, title, message, severity, read, created_at, related_id) VALUES (?,?,?,?,?,?,?,?)`)
  for (let i = 0; i < notifs.length; i++) {
    const n = notifs[i]
    insNotif.run(uid('n-'), n.type, n.title, n.message, n.severity, i > 4 ? 0 : 0, daysAgo(i === 4 ? 0 : 0), null)
  }

  // ---- HISTORY ----
  const hist = [
    { user: 'María García', action: 'produccion', module: 'Producción', desc: 'Fabricadas 500 ud de Limpiador Multiusos 750 ml — Lote LOT-2025-0842', ts: daysAgo(2) },
    { user: 'Laura Martínez', action: 'crear', module: 'Pedidos', desc: 'Creado pedido PED-2025-0146 para EcoClean Portugal', ts: daysAgo(0) },
    { user: 'Javier López', action: 'modificar', module: 'Almacén', desc: 'Entrada de 1.000 ud de Botella PET 750 ml — Factura F-2025/5678', ts: daysAgo(5) },
    { user: 'Carlos Rodríguez', action: 'modificar', module: 'Configuración', desc: 'Modificado IVA por defecto a 21%', ts: daysAgo(7) },
    { user: 'María García', action: 'produccion', module: 'Producción', desc: 'Fabricadas 800 ud de Limpiador Multiusos 1 L — Lote LOT-2025-0843', ts: daysAgo(1) },
    { user: 'Antonio Sánchez', action: 'crear', module: 'Gastos', desc: 'Registrado gasto de electricidad: 1.245,50 €', ts: daysAgo(1) },
  ]
  const insHist = db.prepare(`INSERT INTO history (id, user_id, user_name, action, module, entity_id, description, before_json, after_json, timestamp) VALUES (?,?,?,?,?,?,?,?,?,?)`)
  for (const h of hist) insHist.run(uid('h-'), 'u2', h.user, h.action, h.module, null, h.desc, null, null, h.ts)

  return { seeded: true }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const force = process.argv.includes('--force')
  const result = seed({ force })
  console.log('Seed:', result)
}
