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
  const users = [
    { id: 'u1', username: 'admin', password: process.env.ADMIN_PASSWORD || 'CHANGE_ME_ADMIN_PASSWORD', fullName: 'Administrador', email: 'admin@cleansahel.com', role: 'admin' },
    { id: 'u2', username: 'produccion', password: process.env.PRODUCCION_PASSWORD || 'CHANGE_ME_PRODUCCION_PASSWORD', fullName: 'Operario Producción', email: 'produccion@cleansahel.com', role: 'produccion' },
    { id: 'u3', username: 'contabilidad', password: process.env.CONTABILIDAD_PASSWORD || 'CHANGE_ME_CONTABILIDAD_PASSWORD', fullName: 'Operario Contabilidad', email: 'contabilidad@cleansahel.com', role: 'contabilidad' },
  ]
  const insUser = db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, full_name, email, role, active, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
  for (const u of users) {
    insUser.run(u.id, u.username, hash(u.password), u.fullName, u.email, u.role, monthsAgo(12), null)
  }
  
  console.log('✓ 3 usuarios creados/actualizados')
  // Resetear failed_attempts y asegurar active=1
  db.prepare('UPDATE users SET failed_attempts = 0, active = 1').run()
  console.log('✓ Cuentas desbloqueadas')
  return { seeded: true, users: 3 }
}
