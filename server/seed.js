// SEED ROBUSTO - Idempotente, siempre rellena lo que falte
import bcrypt from 'bcryptjs'
import db, { uid, setConfig } from './db.js'

const now = new Date()
const monthsAgo = (n) => { const d = new Date(now); d.setMonth(d.getMonth() - n); return d.toISOString() }

function getOrCreateId(prefix, codeColumn, code, table) {
  // Si ya existe un registro con ese code, devuelve su id. Si no, crea uno nuevo.
  const existing = db.prepare(`SELECT id FROM ${table} WHERE ${codeColumn} = ?`).get(code)
  if (existing) return existing.id
  return uid(prefix)
}

// Hash de password con fallback a defaults si no hay env vars
function hashPassword(envVar, defaultPwd) {
  const pwd = process.env[envVar] || defaultPwd
  return bcrypt.hashSync(pwd, 10)
}

export function seed({ force = false } = {}) {
  console.log('🌱 Ejecutando seed robusto...')
  
  // ========== CONFIG (siempre) ==========
  setConfig('company', {
    name: 'SAHEL',
    cif: 'ML12345678',
    address: 'Av. de la Liberté 123, Bamako, Mali',
    phone: '+223 70 12 34 56',
    email: 'contacto@sahel.ml',
    web: 'www.sahel.ml'
  })
  setConfig('defaults', {
    bottlesPerBox: 12, boxesPerPallet: 60, tax: 21, currency: 'EUR', language: 'es',
    minStockDefault: 100, maxStockDefault: 5000, bottleSizes: [250, 500, 750, 1000, 2000],
  })
  setConfig('security', { sessionTimeoutMin: 30, maxFailedAttempts: 5, autoBackupHours: 24 })
  console.log('✓ Configuración guardada')
  
  // ========== USUARIOS (siempre re-asegurar) ==========
  const allPerms = {"home":{"view":true,"create":true,"edit":true,"delete":true},"raw_materials":{"view":true,"create":true,"edit":true,"delete":true},"recipes":{"view":true,"create":true,"edit":true,"delete":true},"production":{"view":true,"create":true,"edit":true,"delete":true},"lots":{"view":true,"create":true,"edit":true,"delete":true},"customers":{"view":true,"create":true,"edit":true,"delete":true},"sales":{"view":true,"create":true,"edit":true,"delete":true},"inventory":{"view":true,"create":true,"edit":true,"delete":true},"accounting":{"view":true,"create":true,"edit":true,"delete":true},"reports":{"view":true,"create":true,"edit":true,"delete":true},"users":{"view":true,"create":true,"edit":true,"delete":true},"settings":{"view":true,"create":true,"edit":true,"delete":true},"recalls":{"view":true,"create":true,"edit":true,"delete":true},"packaging":{"view":true,"create":true,"edit":true,"delete":true},"suppliers":{"view":true,"create":true,"edit":true,"delete":true},"purchases":{"view":true,"create":true,"edit":true,"delete":true},"expenses":{"view":true,"create":true,"edit":true,"delete":true},"orders":{"view":true,"create":true,"edit":true,"delete":true},"alerts":{"view":true,"create":true,"edit":true,"delete":true}}
  const produccionPerms = {"home":{"view":true,"create":false,"edit":false,"delete":false},"raw_materials":{"view":true,"create":true,"edit":true,"delete":false},"recipes":{"view":true,"create":true,"edit":true,"delete":false},"production":{"view":true,"create":true,"edit":true,"delete":false},"lots":{"view":true,"create":true,"edit":true,"delete":false},"packaging":{"view":true,"create":true,"edit":true,"delete":false},"recalls":{"view":true,"create":true,"edit":true,"delete":false}}
  const contabilidadPerms = {"home":{"view":true,"create":false,"edit":false,"delete":false},"customers":{"view":true,"create":true,"edit":true,"delete":false},"sales":{"view":true,"create":true,"edit":true,"delete":false},"purchases":{"view":true,"create":true,"edit":true,"delete":false},"expenses":{"view":true,"create":true,"edit":true,"delete":false},"reports":{"view":true,"create":false,"edit":false,"delete":false},"inventory":{"view":true,"create":false,"edit":false,"delete":false},"suppliers":{"view":true,"create":true,"edit":true,"delete":false}}

  const repartidorPerms = {"home":{"view":true,"create":false,"edit":false,"delete":false},"entregas":{"view":true,"create":true,"edit":false,"delete":false,"history":true,"stats":true},"orders":{"view":true,"create":true,"edit":true,"delete":false},"customers":{"view":true,"create":false,"edit":false,"delete":false},"sales":{"view":false,"create":false,"edit":false,"delete":false}}

  const users = [
    { id: 'u-admin', username: 'admin', password: hashPassword('ADMIN_PASSWORD', '41668585Z'), fullName: 'Administrador', email: 'admin@cleansahel.com', role: 'admin', permissions: allPerms },
    { id: 'u-prod', username: 'produccion', password: hashPassword('PRODUCCION_PASSWORD', 'produccion2024'), fullName: 'Operario Producción', email: 'produccion@cleansahel.com', role: 'produccion', permissions: produccionPerms },
    { id: 'u-cont', username: 'contabilidad', password: hashPassword('CONTABILIDAD_PASSWORD', 'contabilidad2024'), fullName: 'Operario Contabilidad', email: 'contabilidad@cleansahel.com', role: 'contabilidad', permissions: contabilidadPerms },
    { id: 'u-rep1', username: 'moussa', password: hashPassword('REP1_PASSWORD', 'moussa123'), fullName: 'Moussa Diallo', email: 'moussa@cleansahel.com', role: 'repartidor', permissions: repartidorPerms },
    { id: 'u-rep2', username: 'fanta', password: hashPassword('REP2_PASSWORD', 'fanta123'), fullName: 'Fanta Samaké', email: 'fanta@cleansahel.com', role: 'repartidor', permissions: repartidorPerms },
  ]
  
  const insUser = db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, full_name, email, role, active, created_at, last_login, permissions, failed_attempts) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0)`)
  for (const u of users) {
    insUser.run(u.id, u.username, u.password, u.fullName, u.email, u.role, monthsAgo(12), null, JSON.stringify(u.permissions || null))
  }
  console.log(`✓ ${users.length} usuarios esenciales (admin/produccion/contabilidad/repartidores) asegurados`)

  // ========== MATERIAS PRIMAS (idempotente) ==========
  const raws = [
    { code: 'MP-AGUA', name: 'Agua Desionizada', category: 'Base', unit: 'L', stock: 5000, min_stock: 500, max_stock: 10000, price: 0.1 },
    { code: 'MP-CONC', name: 'Concentrado Limpiador', category: 'Activo', unit: 'L', stock: 500, min_stock: 50, max_stock: 2000, price: 8.5 },
    { code: 'MP-ALCO', name: 'Alcohol Isopropílico', category: 'Activo', unit: 'L', stock: 200, min_stock: 20, max_stock: 500, price: 4.2 },
    { code: 'MP-FRAG', name: 'Fragancia Limón', category: 'Aroma', unit: 'L', stock: 50, min_stock: 5, max_stock: 100, price: 25.0 },
    { code: 'MP-COL', name: 'Colorante Azul', category: 'Color', unit: 'L', stock: 20, min_stock: 2, max_stock: 50, price: 35.0 },
  ]
  const existingRawCodes = new Set(db.prepare('SELECT code FROM raw_materials').all().map(r => r.code))
  const insRaw = db.prepare(`INSERT INTO raw_materials (id, code, name, category, unit, stock, min_stock, max_stock, price, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  let rawsAdded = 0
  for (const r of raws) {
    if (!existingRawCodes.has(r.code)) {
      insRaw.run(uid('rm-'), r.code, r.name, r.category, r.unit, r.stock, r.min_stock, r.max_stock, r.price, new Date().toISOString())
      rawsAdded++
    }
  }
  if (rawsAdded > 0) console.log(`✓ ${rawsAdded} materias primas añadidas`)

  // ========== ENVASES (idempotente) ==========
  const pkgs = [
    { code: 'ENV-1000', name: 'Botella 1L con tapón', type: 'Botella', size: '1L', stock: 400, min_stock: 40, max_stock: 1500, price: 1.10 },
    { code: 'ENV-750', name: 'Botella 750ml con atomizador', type: 'Botella', size: '750ml', stock: 500, min_stock: 50, max_stock: 2000, price: 0.85 },
    { code: 'ENV-500', name: 'Botella 500ml con spray', type: 'Botella', size: '500ml', stock: 300, min_stock: 30, max_stock: 1000, price: 0.70 },
  ]
  const existingPkgCodes = new Set(db.prepare('SELECT code FROM packaging').all().map(p => p.code))
  const insPkg = db.prepare(`INSERT INTO packaging (id, code, name, type, size, stock, min_stock, max_stock, price, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  let pkgsAdded = 0
  for (const p of pkgs) {
    if (!existingPkgCodes.has(p.code)) {
      insPkg.run(uid('pk-'), p.code, p.name, p.type, p.size, p.stock, p.min_stock, p.max_stock, p.price, new Date().toISOString())
      pkgsAdded++
    }
  }
  if (pkgsAdded > 0) console.log(`✓ ${pkgsAdded} envases añadidos`)

  // ========== PRODUCTOS (idempotente) ==========
  const products = [
    { code: 'LIM-MULT-1L', name: 'Limpiador Multiusos 1L', category: 'Multiusos', bottle_size: 1000, stock: 0, min_stock: 20, max_stock: 200, price: 4.50, cost: 2.10 },
    { code: 'LIM-BAN-750', name: 'Limpiador Baños 750ml', category: 'Baños', bottle_size: 750, stock: 0, min_stock: 15, max_stock: 150, price: 4.20, cost: 1.95 },
    { code: 'LIM-CRIS-500', name: 'Limpiacristales 500ml', category: 'Cristales', bottle_size: 500, stock: 0, min_stock: 10, max_stock: 100, price: 3.50, cost: 1.60 },
  ]
  const existingProdCodes = new Set(db.prepare('SELECT code FROM products').all().map(p => p.code))
  const insProd = db.prepare(`INSERT INTO products (id, code, name, category, bottle_size, stock, min_stock, max_stock, price, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  let prodsAdded = 0
  for (const p of products) {
    if (!existingProdCodes.has(p.code)) {
      insProd.run(uid('pr-'), p.code, p.name, p.category, p.bottle_size, p.stock, p.min_stock, p.max_stock, p.price, p.cost)
      prodsAdded++
    }
  }
  if (prodsAdded > 0) console.log(`✓ ${prodsAdded} productos añadidos`)

  // ========== RECETAS (idempotente - NUEVO) ==========
  const rawsDb = db.prepare('SELECT id, code FROM raw_materials').all()
  const pkgsDb = db.prepare('SELECT id, code FROM packaging').all()
  const prodsDb = db.prepare('SELECT id, code, bottle_size FROM products').all()
  
  // Receta para LIM-MULT-1L
  const prodMult = prodsDb.find(p => p.code === 'LIM-MULT-1L')
  if (prodMult) {
    const existingRecipe = db.prepare('SELECT id FROM recipes WHERE product_id = ?').get(prodMult.id)
    if (!existingRecipe) {
      const items = []
      const agua = rawsDb.find(r => r.code === 'MP-AGUA')
      const conc = rawsDb.find(r => r.code === 'MP-CONC')
      const alco = rawsDb.find(r => r.code === 'MP-ALCO')
      const frag = rawsDb.find(r => r.code === 'MP-FRAG')
      const col = rawsDb.find(r => r.code === 'MP-COL')
      const bot1L = pkgsDb.find(p => p.code === 'ENV-1000')
      if (agua) items.push({ materialId: agua.id, materialType: 'raw', quantity: 800, unit: 'L' })
      if (conc) items.push({ materialId: conc.id, materialType: 'raw', quantity: 100, unit: 'L' })
      if (alco) items.push({ materialId: alco.id, materialType: 'raw', quantity: 50, unit: 'L' })
      if (frag) items.push({ materialId: frag.id, materialType: 'raw', quantity: 30, unit: 'L' })
      if (col)  items.push({ materialId: col.id,  materialType: 'raw', quantity: 20, unit: 'L' })
      if (bot1L) items.push({ materialId: bot1L.id, materialType: 'packaging', quantity: 1000, unit: 'ud' })
      db.prepare(`INSERT INTO recipes (id, product_id, bottle_size, bottles_per_box, boxes_per_pallet, yield_per_liter, batch_size, items_json, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(uid('rc-'), prodMult.id, 1000, 12, 60, 1, 1000, JSON.stringify(items), new Date().toISOString())
      console.log('✓ Receta creada para LIM-MULT-1L')
    }
  }
  
  // Receta para LIM-BAN-750
  const prodBan = prodsDb.find(p => p.code === 'LIM-BAN-750')
  if (prodBan) {
    const existingRecipe = db.prepare('SELECT id FROM recipes WHERE product_id = ?').get(prodBan.id)
    if (!existingRecipe) {
      const items = []
      const agua = rawsDb.find(r => r.code === 'MP-AGUA')
      const conc = rawsDb.find(r => r.code === 'MP-CONC')
      const frag = rawsDb.find(r => r.code === 'MP-FRAG')
      const bot750 = pkgsDb.find(p => p.code === 'ENV-750')
      if (agua) items.push({ materialId: agua.id, materialType: 'raw', quantity: 850, unit: 'L' })
      if (conc) items.push({ materialId: conc.id, materialType: 'raw', quantity: 120, unit: 'L' })
      if (frag) items.push({ materialId: frag.id, materialType: 'raw', quantity: 30, unit: 'L' })
      if (bot750) items.push({ materialId: bot750.id, materialType: 'packaging', quantity: 1000, unit: 'ud' })
      db.prepare(`INSERT INTO recipes (id, product_id, bottle_size, bottles_per_box, boxes_per_pallet, yield_per_liter, batch_size, items_json, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(uid('rc-'), prodBan.id, 750, 12, 60, 1, 1000, JSON.stringify(items), new Date().toISOString())
      console.log('✓ Receta creada para LIM-BAN-750')
    }
  }

  // Receta para LIM-CRIS-500
  const prodCris = prodsDb.find(p => p.code === 'LIM-CRIS-500')
  if (prodCris) {
    const existingRecipe = db.prepare('SELECT id FROM recipes WHERE product_id = ?').get(prodCris.id)
    if (!existingRecipe) {
      const items = []
      const agua = rawsDb.find(r => r.code === 'MP-AGUA')
      const alco = rawsDb.find(r => r.code === 'MP-ALCO')
      const col = rawsDb.find(r => r.code === 'MP-COL')
      const bot500 = pkgsDb.find(p => p.code === 'ENV-500')
      if (agua) items.push({ materialId: agua.id, materialType: 'raw', quantity: 800, unit: 'L' })
      if (alco) items.push({ materialId: alco.id, materialType: 'raw', quantity: 180, unit: 'L' })
      if (col)  items.push({ materialId: col.id,  materialType: 'raw', quantity: 20, unit: 'L' })
      if (bot500) items.push({ materialId: bot500.id, materialType: 'packaging', quantity: 1000, unit: 'ud' })
      db.prepare(`INSERT INTO recipes (id, product_id, bottle_size, bottles_per_box, boxes_per_pallet, yield_per_liter, batch_size, items_json, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(uid('rc-'), prodCris.id, 500, 12, 60, 1, 1000, JSON.stringify(items), new Date().toISOString())
      console.log('✓ Receta creada para LIM-CRIS-500')
    }
  }
  
  // ========== PROVEEDOR (idempotente) ==========
  const existingSuppliers = db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c
  if (existingSuppliers === 0) {
    db.prepare(`INSERT INTO suppliers (id, name, cif, email, phone, contact, address, city, country) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uid('sup-'), 'Químicas Bamako SARL', 'ML87654321', 'ventas@quimbamako.ml', '+223 20 22 11 33', 'Ibrahima Diallo', 'Zone Industrielle', 'Bamako', 'Mali')
    console.log('✓ Proveedor de ejemplo creado')
  }
  
  // ========== CLIENTES DE PRUEBA PARA ENTREGAS (idempotente) ==========
  const testCustomers = [
    { code: 'CL-00001', name: 'Supermarché Djoliba', address: 'Av. de la Liberté 45', phone: '+223 70 11 22 33', city: 'Bamako' },
    { code: 'CL-00002', name: 'Hotel Liberté', address: 'Rue de la Liberté 12', phone: '+223 70 44 55 66', city: 'Bamako' },
    { code: 'CL-00003', name: 'Pharmacie Centrale', address: 'Bd de l\'Indépendance 8', phone: '+223 70 77 88 99', city: 'Bamako' },
    { code: 'CL-00004', name: 'Restaurant Le Sahel', address: 'Av. de l\'ONU 22', phone: '+223 70 33 44 55', city: 'Bamako' },
  ]
  for (const c of testCustomers) {
    const existing = db.prepare('SELECT id FROM customers WHERE code = ?').get(c.code)
    if (!existing) {
      db.prepare(`INSERT INTO customers (id, code, name, address, phone, city, country, total_purchases, created_at) VALUES (?,?,?,?,?,?,'Mali',0,?)`)
        .run(uid('c-'), c.code, c.name, c.address, c.phone, c.city, monthsAgo(1))
    }
  }
  console.log(`✓ ${testCustomers.length} clientes de prueba asegurados`)

  // ========== PEDIDOS ENTREGADOS PARA HISTORIAL (idempotente) ==========
  const prods = db.prepare('SELECT id, name, price FROM products').all()
  const customers = db.prepare('SELECT id, name, code FROM customers').all()
  const reps = db.prepare("SELECT id, username, full_name FROM users WHERE role = 'repartidor'").all()
  if (prods.length && customers.length && reps.length) {
    // Crear 15 pedidos entregados en las últimas 2 semanas
    const existingDelivered = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'").get().c
    if (existingDelivered === 0) {
      const rep = reps[0]
      for (let i = 1; i <= 15; i++) {
        const customer = customers[i % customers.length]
        const daysAgo = i
        const qty = Math.floor(Math.random() * 5) + 1
        const items = prods.slice(0, Math.min(3, prods.length)).map(p => ({
          productId: p.id, productName: p.name, quantity: qty, unitPrice: p.price
        }))
        const subtotal = items.reduce((s, item) => s + item.unitPrice * item.quantity, 0)
        const tax = subtotal * 0.18
        const total = subtotal + tax
        const d = new Date(); d.setDate(d.getDate() - daysAgo)
        const deliveryInfo = JSON.stringify({ userId: rep.id, userName: rep.username, userFullName: rep.full_name, items, totalItems: qty * items.length })
        db.prepare(`INSERT OR IGNORE INTO orders (id, number, customer_id, items_json, subtotal, tax, discount, total, status, created_at, delivered_at, delivered_by, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(uid('ord-'), 'D' + String(i).padStart(4, '0'), customer.id, JSON.stringify(items), subtotal, tax, 0, total, 'delivered', d.toISOString(), d.toISOString(), rep.username, deliveryInfo)
      }
      console.log(`✓ 15 pedidos entregados de ejemplo creados (historial)`)
    }
  }

  console.log('✅ Seed completo - BD lista para usar')
  return { seeded: true, users: 3 }
}
