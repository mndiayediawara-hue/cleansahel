// SEED LIMPIO - Solo crea los 3 usuarios esenciales
import bcrypt from 'bcryptjs'
import db, { uid, setConfig } from './db.js'

const now = new Date()
const monthsAgo = (n) => { const d = new Date(now); d.setMonth(d.getMonth() - n); return d.toISOString() }

function alreadySeeded() {
  const row = db.prepare('SELECT COUNT(*) as c FROM users').get()
  return row.c > 0
}

export function seed({ force = false } = {}) {
  if (alreadySeeded() && !force) return { seeded: false }
  
  console.log('🌱 Sembrando solo usuarios esenciales...')
  
  // Config básica
  setConfig('company', {
    name: 'CleanSahel',
    cif: '',
    address: '',
    phone: '',
    email: '',
  })
  setConfig('defaults', {
    bottlesPerBox: 12, boxesPerPallet: 60, tax: 21, currency: 'EUR', language: 'es',
    minStockDefault: 100, maxStockDefault: 5000, bottleSizes: [250, 500, 750, 1000, 2000],
  })
  setConfig('security', { sessionTimeoutMin: 30, maxFailedAttempts: 5, autoBackupHours: 24 })

  // Solo los 3 USERS esenciales
  const hash = (p) => bcrypt.hashSync(p, 10)
  const allPerms = {"home": {"view": true, "create": true, "edit": true, "delete": true}, "raw_materials": {"view": true, "create": true, "edit": true, "delete": true}, "recipes": {"view": true, "create": true, "edit": true, "delete": true}, "production": {"view": true, "create": true, "edit": true, "delete": true}, "lots": {"view": true, "create": true, "edit": true, "delete": true}, "customers": {"view": true, "create": true, "edit": true, "delete": true}, "sales": {"view": true, "create": true, "edit": true, "delete": true}, "inventory": {"view": true, "create": true, "edit": true, "delete": true}, "accounting": {"view": true, "create": true, "edit": true, "delete": true}, "reports": {"view": true, "create": true, "edit": true, "delete": true}, "users": {"view": true, "create": true, "edit": true, "delete": true}, "settings": {"view": true, "create": true, "edit": true, "delete": true}, "recalls": {"view": true, "create": true, "edit": true, "delete": true}, "packaging": {"view": true, "create": true, "edit": true, "delete": true}}
  const produccionPerms = {"home": {"view": true, "create": false, "edit": false, "delete": false}, "raw_materials": {"view": true, "create": true, "edit": true, "delete": false}, "recipes": {"view": true, "create": true, "edit": true, "delete": false}, "production": {"view": true, "create": true, "edit": true, "delete": false}, "lots": {"view": true, "create": true, "edit": true, "delete": false}, "packaging": {"view": true, "create": true, "edit": true, "delete": false}, "recalls": {"view": true, "create": true, "edit": true, "delete": false}}
  const contabilidadPerms = {"home": {"view": true, "create": false, "edit": false, "delete": false}, "customers": {"view": true, "create": true, "edit": true, "delete": false}, "sales": {"view": true, "create": true, "edit": true, "delete": false}, "purchases": {"view": true, "create": true, "edit": true, "delete": false}, "expenses": {"view": true, "create": true, "edit": true, "delete": false}, "reports": {"view": true, "create": false, "edit": false, "delete": false}, "inventory": {"view": true, "create": false, "edit": false, "delete": false}, "suppliers": {"view": true, "create": true, "edit": true, "delete": false}}
  const users = [
    { id: 'u1', username: 'admin', password: process.env.ADMIN_PASSWORD || 'CHANGE_ME_ADMIN_PASSWORD', fullName: 'Administrador', email: 'admin@cleansahel.com', role: 'admin', permissions: allPerms },
    { id: 'u2', username: 'produccion', password: process.env.PRODUCCION_PASSWORD || 'CHANGE_ME_PRODUCCION_PASSWORD', fullName: 'Operario Producción', email: 'produccion@cleansahel.com', role: 'produccion', permissions: produccionPerms },
    { id: 'u3', username: 'contabilidad', password: process.env.CONTABILIDAD_PASSWORD || 'CHANGE_ME_CONTABILIDAD_PASSWORD', fullName: 'Operario Contabilidad', email: 'contabilidad@cleansahel.com', role: 'contabilidad', permissions: contabilidadPerms },
  ]
  const insUser = db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, full_name, email, role, active, created_at, last_login, permissions) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
  for (const u of users) {
    insUser.run(u.id, u.username, hash(u.password), u.fullName, u.email, u.role, monthsAgo(12), null, JSON.stringify(u.permissions || null))
  }
  
  console.log('✓ 3 usuarios creados/actualizados')
  // Resetear failed_attempts y asegurar active=1
  db.prepare('UPDATE users SET failed_attempts = 0, active = 1').run()
  console.log('✓ Cuentas desbloqueadas')
  
  // Si no hay productos, crear datos de muestra
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c
  if (productCount === 0) {
    console.log('📦 Creando datos de muestra...')
    
    const raws = [
      { id: 'rm-' + Date.now().toString(36) + 'a', code: 'MP-AGUA', name: 'Agua Desionizada', category: 'Base', unit: 'L', stock: 5000, min_stock: 500, max_stock: 10000, price: 0.1 },
      { id: 'rm-' + Date.now().toString(36) + 'b', code: 'MP-CONC', name: 'Concentrado Limpiador', category: 'Activo', unit: 'L', stock: 500, min_stock: 50, max_stock: 2000, price: 8.5 },
      { id: 'rm-' + Date.now().toString(36) + 'c', code: 'MP-ALCO', name: 'Alcohol Isopropílico', category: 'Activo', unit: 'L', stock: 200, min_stock: 20, max_stock: 500, price: 4.2 },
      { id: 'rm-' + Date.now().toString(36) + 'd', code: 'MP-FRAG', name: 'Fragancia Limón', category: 'Aroma', unit: 'L', stock: 50, min_stock: 5, max_stock: 100, price: 25.0 },
      { id: 'rm-' + Date.now().toString(36) + 'e', code: 'MP-COL', name: 'Colorante Azul', category: 'Color', unit: 'L', stock: 20, min_stock: 2, max_stock: 50, price: 35.0 },
    ]
    const insRaw = db.prepare(`INSERT INTO raw_materials (id, code, name, category, unit, stock, min_stock, max_stock, price, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const r of raws) {
      insRaw.run(r.id, r.code, r.name, r.category, r.unit, r.stock, r.min_stock, r.max_stock, r.price, new Date().toISOString())
    }
    
    const pkgs = [
      { code: 'ENV-750', name: 'Botella 750ml con atomizador', type: 'Botella', size: '750ml', stock: 500, min_stock: 50, max_stock: 2000, price: 0.85 },
      { code: 'ENV-1000', name: 'Botella 1L con tapón', type: 'Botella', size: '1L', stock: 400, min_stock: 40, max_stock: 1500, price: 1.10 },
      { code: 'ENV-500', name: 'Botella 500ml con spray', type: 'Botella', size: '500ml', stock: 300, min_stock: 30, max_stock: 1000, price: 0.70 },
    ]
    const insPkg = db.prepare(`INSERT INTO packaging (id, code, name, type, size, stock, min_stock, max_stock, price, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const p of pkgs) {
      insPkg.run('pk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), p.code, p.name, p.type, p.size, p.stock, p.min_stock, p.max_stock, p.price, new Date().toISOString())
    }
    
    const products = [
      { code: 'LIM-MULT-1L', name: 'Limpiador Multiusos 1L', category: 'Multiusos', bottle_size: 1000, stock: 0, min_stock: 20, max_stock: 200, price: 4.50, cost: 2.10 },
      { code: 'LIM-BAN-750', name: 'Limpiador Baños 750ml', category: 'Baños', bottle_size: 750, stock: 0, min_stock: 15, max_stock: 150, price: 4.20, cost: 1.95 },
      { code: 'LIM-CRIS-500', name: 'Limpiacristales 500ml', category: 'Cristales', bottle_size: 500, stock: 0, min_stock: 10, max_stock: 100, price: 3.50, cost: 1.60 },
    ]
    const insProd = db.prepare(`INSERT INTO products (id, code, name, category, bottle_size, stock, min_stock, max_stock, price, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const p of products) {
      insProd.run('pr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), p.code, p.name, p.category, p.bottle_size, p.stock, p.min_stock, p.max_stock, p.price, p.cost)
    }
    
    console.log('✓ Datos de muestra creados: 5 MPs, 3 envases, 3 productos')
  } else {
    console.log('ℹ Productos ya existen (skip demo data)')
  }
  return { seeded: true, users: 3 }
}
