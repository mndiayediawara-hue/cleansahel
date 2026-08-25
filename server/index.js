
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import apiRoutes from './routes.js'
import { seed } from './seed.js'
import { db } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Initialize DB - SIEMPRE ejecuta el seed (es idempotente, solo añade lo que falta)
console.log('🌱 Verificando integridad de la BD...')
try {
  seed()
  console.log('✓ Seed verificado - datos esenciales presentes')
} catch (e) {
  console.error('❌ Error en seed:', e.message)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// Request logger (only in dev)
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  }
  next()
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), version: '1.0.0' })
})

// ENDPOINT TEMPORAL: Reset DB (usar para forzar re-seed)
app.post('/api/reset-db', (req, res) => {
  const token = req.headers['x-reset-token']
  if (token !== (process.env.RESET_TOKEN || 'CHANGE_ME_RESET_TOKEN')) return res.status(403).json({ error: 'Token inválido' })
  try {
    seed({ force: true })
    res.json({ ok: true, message: 'DB reseteada' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ENDPOINT PÚBLICO: Reseed (asegurar datos esenciales - idempotente, no borra nada)
app.post('/api/reseed', (_req, res) => {
  try {
    const result = seed()
    res.json({ ok: true, message: 'Datos esenciales verificados/creados', result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ENDPOINT PÚBLICO: Status (ver qué hay en la BD)
app.get('/api/status', (_req, res) => {
  try {
    const counts = {
      users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      raw_materials: db.prepare('SELECT COUNT(*) as c FROM raw_materials').get().c,
      packaging: db.prepare('SELECT COUNT(*) as c FROM packaging').get().c,
      products: db.prepare('SELECT COUNT(*) as c FROM products').get().c,
      recipes: db.prepare('SELECT COUNT(*) as c FROM recipes').get().c,
      customers: db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
      suppliers: db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c,
      orders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
      lots: db.prepare('SELECT COUNT(*) as c FROM lots').get().c,
      production_orders: db.prepare('SELECT COUNT(*) as c FROM production_orders').get().c,
    }
    res.json({ ok: true, counts, time: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Mount all API routes
app.use('/api', apiRoutes)

// Servir archivos estáticos: assets/ del proyecto (patches + bundles)
const rootAssetsPath = path.join(__dirname, '..', 'assets')
// dist/ para el build de React
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  // Primero assets/ del proyecto (patches), luego dist/ para el build
  if (fs.existsSync(rootAssetsPath)) {
    app.use('/assets', express.static(rootAssetsPath))
  }
  app.use(express.static(distPath))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

const PORT = process.env.PORT || 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ CleanERP API ready (recalls enabled) on http://0.0.0.0:${PORT}`)
  console.log(`  Database: ${path.join(__dirname, '..', 'data', 'cleanerp.db')}`)
  console.log(`  Static dist: ${fs.existsSync(distPath) ? 'found' : 'NOT FOUND — run npm run build'}`)
})
// Last update: Sat Aug  8 22:53:22 UTC 2026
// Force re-deploy Sun Aug  9 09:25:19 UTC 2026
// Re-deploy trigger: 1786564454.4422479

// Force re-deploy: 1786565342.696721

// Force: 1786569304.930822

// Force: 1786753191.0797138

// Production system deploy: 1787150314.95243



