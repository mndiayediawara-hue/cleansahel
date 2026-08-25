
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'cleanerp.db')

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// Ejecutar SCHEMA primero para que las tablas existan
// (Se ejecuta al final también, pero necesitamos las tablas YA para las migraciones)
// (Esto es un duplicado intencional - CREATE TABLE IF NOT EXISTS es idempotente)



// ---------- SCHEMA ----------
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  failed_attempts INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cif TEXT,
  email TEXT,
  phone TEXT,
  contact TEXT,
  address TEXT,
  city TEXT,
  country TEXT
);

CREATE TABLE IF NOT EXISTS raw_materials (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  max_stock REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  supplier_id TEXT,
  location TEXT,
  expiry_date TEXT,
  lot TEXT,
  last_updated TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS packaging (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size TEXT,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  max_stock REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  supplier_id TEXT,
  location TEXT,
  last_updated TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  bottle_size REAL NOT NULL,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  max_stock REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  recipe_id TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  bottle_size REAL NOT NULL DEFAULT 0,
  bottles_per_box INTEGER NOT NULL DEFAULT 0,
  boxes_per_pallet INTEGER NOT NULL DEFAULT 0,
  yield_per_liter REAL NOT NULL DEFAULT 0,
  batch_size REAL NOT NULL DEFAULT 1000,
  items_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  cif TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  contact TEXT,
  notes TEXT,
  total_purchases REAL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  items_json TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivery_date TEXT,
  notes TEXT,
  created_by TEXT,
  delivered_at TEXT,
  delivered_by TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  supplier_id TEXT NOT NULL,
  invoice TEXT,
  items_json TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  attachment TEXT,
  created_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lots (
  id TEXT PRIMARY KEY,
  lot_number TEXT UNIQUE NOT NULL,
  product_id TEXT NOT NULL,
  recipe_id TEXT,
  quantity REAL NOT NULL,
  raw_materials_json TEXT NOT NULL,
  produced_by TEXT,
  produced_at TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (produced_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  related_id TEXT
);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- raw_material_lots: entradas individuales de cada materia prima
-- (Cada compra o entrada al almacén queda registrada con su cantidad,
-- fecha de caducidad, proveedor, etc. El stock total del material se
-- calcula sumando todos los lotes activos.)
CREATE TABLE IF NOT EXISTS raw_material_lots (
  id TEXT PRIMARY KEY,
  raw_material_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  remaining REAL NOT NULL DEFAULT 0,
  unit TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  invoice TEXT,
  received_at TEXT NOT NULL,
  expiry_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- packaging_lots: entradas individuales de cada envase
CREATE TABLE IF NOT EXISTS packaging_lots (
  id TEXT PRIMARY KEY,
  packaging_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  remaining REAL NOT NULL DEFAULT 0,
  supplier_id TEXT,
  supplier_name TEXT,
  invoice TEXT,
  received_at TEXT NOT NULL,
  expiry_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (packaging_id) REFERENCES packaging(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- production_orders: ordenes de fabricacion con 3 estados (pendiente/en_proceso/acabada)
CREATE TABLE IF NOT EXISTS production_orders (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  product_id TEXT NOT NULL,
  recipe_id TEXT,
  quantity REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  pedido_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
  FOREIGN KEY (pedido_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);


-- lot_consumptions: trazabilidad de que lotes de MP/envase se usaron en cada lote de producto terminado
CREATE TABLE IF NOT EXISTS lot_consumptions (
  id TEXT PRIMARY KEY,
  production_lot_id TEXT NOT NULL,
  production_order_id TEXT,
  source_type TEXT NOT NULL,  -- 'raw' | 'pkg'
  source_lot_id TEXT NOT NULL,
  source_lot_code TEXT,
  material_id TEXT NOT NULL,
  material_name TEXT,
  quantity_consumed REAL NOT NULL,
  unit TEXT,
  consumed_at TEXT NOT NULL,
  consumed_by TEXT,
  FOREIGN KEY (production_lot_id) REFERENCES lots(id) ON DELETE CASCADE,
  FOREIGN KEY (consumed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- recalls: retiradas de producto
CREATE TABLE IF NOT EXISTS recalls (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  lot_number TEXT,
  reason TEXT NOT NULL,
  quantity REAL DEFAULT 0,
  status TEXT DEFAULT 'investigating',
  reported_by TEXT,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL
);
`

// Ejecutar SCHEMA primero
db.exec(SCHEMA)

// Ahora ejecutar migraciones (las tablas ya existen)
// ---------- MIGRATIONS ----------
// Add batch_size column to recipes if it doesn't exist (safe)
try {
  const cols = db.prepare("PRAGMA table_info(recipes)").all()
  if (!cols.find(c => c.name === 'batch_size')) {
    db.exec("ALTER TABLE recipes ADD COLUMN batch_size REAL NOT NULL DEFAULT 1000")
    console.log('✓ Migrated: added batch_size column to recipes')
  }
} catch (e) { console.warn('migration recipes:', e.message) }

// Add machine_id column to lots if it doesn't exist (safe)
try {
  const colsLots = db.prepare("PRAGMA table_info(lots)").all()
  if (!colsLots.find(c => c.name === 'machine_id')) {
    db.exec("ALTER TABLE lots ADD COLUMN machine_id TEXT")
    console.log('✓ Migrated: added machine_id column to lots')
  }
  if (!colsLots.find(c => c.name === 'started_at')) {
    db.exec("ALTER TABLE lots ADD COLUMN started_at TEXT")
    console.log('✓ Migrated: added started_at column to lots')
  }
  if (!colsLots.find(c => c.name === 'finished_at')) {
    db.exec("ALTER TABLE lots ADD COLUMN finished_at TEXT")
    console.log('✓ Migrated: added finished_at column to lots')
  }
} catch (e) { console.warn('migration lots timestamps:', e.message) }

// Add production_order_number column to lots if it doesn't exist (safe)
try {
  const colsLots2 = db.prepare("PRAGMA table_info(lots)").all()
  if (!colsLots2.find(c => c.name === 'production_order_number')) {
    db.exec("ALTER TABLE lots ADD COLUMN production_order_number TEXT")
    console.log('✓ Migrated: added production_order_number column to lots')
  }
} catch (e) { console.warn('migration lots order:', e.message) }

// Add status_safe_check column to lots (no usamos esto, pero por si hay restricciones)
try {
  // Add permissions column to users if it doesn't exist
  try {
    const colsUsers = db.prepare("PRAGMA table_info(users)").all()
    if (!colsUsers.find(c => c.name === 'permissions')) {
      db.exec("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT NULL")
      console.log('✓ Migrated: added permissions column to users')
    }
  } catch (e) { console.warn('migration users permissions:', e.message) }
  // Add active column to users if it doesn't exist (in case schema doesn't have it)
  try {
    const colsUsersA = db.prepare("PRAGMA table_info(users)").all()
    if (!colsUsersA.find(c => c.name === 'active')) {
      db.exec("ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1")
      console.log('✓ Migrated: added active column to users')
    }
  } catch (e) { console.warn('migration users active:', e.message) }

  // Add entry_number column to packaging and raw_materials (auto-incrementing identifier)
  try {
    const colsPkg = db.prepare("PRAGMA table_info(packaging)").all()
    if (!colsPkg.find(c => c.name === 'entry_number')) {
      db.exec("ALTER TABLE packaging ADD COLUMN entry_number INTEGER")
      const allPkg = db.prepare("SELECT id FROM packaging ORDER BY created_at, id").all()
      let n = 1
      for (const r of allPkg) {
        db.prepare("UPDATE packaging SET entry_number = ? WHERE id = ?").run(n++, r.id)
      }
      console.log('✓ Migrated: added entry_number column to packaging')
    }
  } catch (e) { console.warn('migration packaging entry_number:', e.message) }

  try {
    const colsRaw = db.prepare("PRAGMA table_info(raw_materials)").all()
    if (!colsRaw.find(c => c.name === 'entry_number')) {
      db.exec("ALTER TABLE raw_materials ADD COLUMN entry_number INTEGER")
      const allRaw = db.prepare("SELECT id FROM raw_materials ORDER BY created_at, id").all()
      let n = 1
      for (const r of allRaw) {
        db.prepare("UPDATE raw_materials SET entry_number = ? WHERE id = ?").run(n++, r.id)
      }
      console.log('✓ Migrated: added entry_number column to raw_materials')
    }
  } catch (e) { console.warn('migration raw_materials entry_number:', e.message) }

  try {
    const colsProd = db.prepare("PRAGMA table_info(products)").all()
    if (!colsProd.find(c => c.name === 'entry_number')) {
      db.exec("ALTER TABLE products ADD COLUMN entry_number INTEGER")
      const allProd = db.prepare("SELECT id FROM products ORDER BY created_at, id").all()
      let n = 1
      for (const r of allProd) {
        db.prepare("UPDATE products SET entry_number = ? WHERE id = ?").run(n++, r.id)
      }
      console.log('✓ Migrated: added entry_number column to products')
    }
  } catch (e) { console.warn('migration products entry_number:', e.message) }

// Add delivery columns to orders (delivered_at, delivered_by)
try {
  const colsOrders = db.prepare("PRAGMA table_info(orders)").all()
  if (!colsOrders.find(c => c.name === 'delivered_at')) {
    db.exec("ALTER TABLE orders ADD COLUMN delivered_at TEXT")
    console.log('✓ Migrated: added delivered_at column to orders')
  }
  if (!colsOrders.find(c => c.name === 'delivered_by')) {
    db.exec("ALTER TABLE orders ADD COLUMN delivered_by TEXT")
    console.log('✓ Migrated: added delivered_by column to orders')
  }
} catch (e) { console.warn('migration orders delivery:', e.message) }
  const colsLots3 = db.prepare("PRAGMA table_info(lots)").all()
  if (!colsLots3.find(c => c.name === 'status') && !colsLots3.find(c => c.name === 'status_safe_check')) {
    // No hacemos nada, status ya existe en el schema
  }
} catch (e) { console.warn('migration status check:', e.message) }
db.pragma('foreign_keys = ON')

// ============================================================
// MIGRACIONES - Modulos criticos Fase 1
// ============================================================

// 1. Stock reservado
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_reservations (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      released_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `)
  console.log('✓ Migrated: stock_reservations table ready')
} catch (e) { console.warn('migration stock_reservations:', e.message) }



// Migración: lot_consumptions table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lot_consumptions (
      id TEXT PRIMARY KEY,
      production_lot_id TEXT NOT NULL,
      production_order_id TEXT,
      source_type TEXT NOT NULL,
      source_lot_id TEXT NOT NULL,
      source_lot_code TEXT,
      material_id TEXT NOT NULL,
      material_name TEXT,
      quantity_consumed REAL NOT NULL,
      unit TEXT,
      consumed_at TEXT NOT NULL,
      consumed_by TEXT,
      FOREIGN KEY (production_lot_id) REFERENCES lots(id) ON DELETE CASCADE,
      FOREIGN KEY (consumed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)
  console.log('✓ Migrated: lot_consumptions table ready')
} catch (e) { console.warn('migration lot_consumptions:', e.message) }

// Migración: añadir campos a raw_material_lots
try {
  const rmlCols = db.prepare("PRAGMA table_info(raw_material_lots)").all()
  if (!rmlCols.find(c => c.name === 'internal_lot_number')) {
    db.exec("ALTER TABLE raw_material_lots ADD COLUMN internal_lot_number TEXT")
    console.log('✓ Migrated: added internal_lot_number to raw_material_lots')
  }
  if (!rmlCols.find(c => c.name === 'supplier_lot_number')) {
    db.exec("ALTER TABLE raw_material_lots ADD COLUMN supplier_lot_number TEXT")
    console.log('✓ Migrated: added supplier_lot_number to raw_material_lots')
  }
  if (!rmlCols.find(c => c.name === 'manufacture_date')) {
    db.exec("ALTER TABLE raw_material_lots ADD COLUMN manufacture_date TEXT")
    console.log('✓ Migrated: added manufacture_date to raw_material_lots')
  }
} catch (e) { console.warn('migration raw_material_lots fields:', e.message) }

// Migración: añadir campos a packaging_lots
try {
  const pkgCols = db.prepare("PRAGMA table_info(packaging_lots)").all()
  if (!pkgCols.find(c => c.name === 'internal_lot_number')) {
    db.exec("ALTER TABLE packaging_lots ADD COLUMN internal_lot_number TEXT")
    console.log('✓ Migrated: added internal_lot_number to packaging_lots')
  }
  if (!pkgCols.find(c => c.name === 'supplier_lot_number')) {
    db.exec("ALTER TABLE packaging_lots ADD COLUMN supplier_lot_number TEXT")
    console.log('✓ Migrated: added supplier_lot_number to packaging_lots')
  }
  if (!pkgCols.find(c => c.name === 'manufacture_date')) {
    db.exec("ALTER TABLE packaging_lots ADD COLUMN manufacture_date TEXT")
    console.log('✓ Migrated: added manufacture_date to packaging_lots')
  }
  if (!pkgCols.find(c => c.name === 'unit')) {
    db.exec("ALTER TABLE packaging_lots ADD COLUMN unit TEXT")
    console.log('✓ Migrated: added unit to packaging_lots')
  }
} catch (e) { console.warn('migration packaging_lots fields:', e.message) }

// 4. Ajustes de inventario
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id TEXT PRIMARY KEY,
      material_type TEXT NOT NULL,
      material_id TEXT NOT NULL,
      material_name TEXT,
      quantity_before REAL NOT NULL,
      quantity_after REAL NOT NULL,
      difference REAL NOT NULL,
      reason TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)
  // Añadir columna lot_id a stock_adjustments si no existe
try {
  const adjCols = db.prepare("PRAGMA table_info(stock_adjustments)").all()
  if (!adjCols.find(c => c.name === 'lot_id')) {
    db.exec("ALTER TABLE stock_adjustments ADD COLUMN lot_id TEXT")
    console.log('✓ Migrated: added lot_id column to stock_adjustments')
  }
} catch (e) { console.warn('migration stock_adjustments lot_id:', e.message) }

console.log("✓ Migrated: stock_adjustments table ready (with lot_id support)")
} catch (e) { console.warn('migration stock_adjustments:', e.message) }

export { SCHEMA }

export function getConfig(key, fallback = null) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key)
  if (!row) return fallback
  try { return JSON.parse(row.value) } catch { return fallback }
}

export function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
}

export function uid(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export default db