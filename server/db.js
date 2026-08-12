
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
} catch (e) { console.warn('migration lots:', e.message) }

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
  const colsLots3 = db.prepare("PRAGMA table_info(lots)").all()
  if (!colsLots3.find(c => c.name === 'status') && !colsLots3.find(c => c.name === 'status_safe_check')) {
    // No hacemos nada, status ya existe en el schema
  }
} catch (e) { console.warn('migration status check:', e.message) }
db.pragma('foreign_keys = ON')
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