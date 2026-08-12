
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

// Initialize DB - SIEMPRE forzar re-seed para corregir datos corruptos
console.log('🗑️  Forzando re-seed de la DB...')
seed({ force: true })
console.log('✓ DB re-seedeada con datos correctos')

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

// Mount all API routes
app.use('/api', apiRoutes)

// Serve React build
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

const PORT = process.env.PORT || 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ CleanERP API running on http://0.0.0.0:${PORT}`)
  console.log(`  Database: ${path.join(__dirname, '..', 'data', 'cleanerp.db')}`)
  console.log(`  Static dist: ${fs.existsSync(distPath) ? 'found' : 'NOT FOUND — run npm run build'}`)
})
// Last update: Sat Aug  8 22:53:22 UTC 2026
// Force re-deploy Sun Aug  9 09:25:19 UTC 2026
// Re-deploy trigger: 1786564454.4422479

// Force re-deploy: 1786565342.696721

// Force: 1786569304.930822
