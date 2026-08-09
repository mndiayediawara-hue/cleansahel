// Smart API client — tries the real Express backend first,
// falls back to in-browser localStorage demo when unreachable.
// This lets the same bundle work in production (with backend)
// and on the static deploy (demo mode).
import { demoApi } from './demoApi'

// One-time: on production deployment, clear stale demo data
if (typeof window !== 'undefined') {
  const h = window.location.hostname
  if (h.includes('onrender.com') || h.includes('render.com')) {
    try {
      localStorage.removeItem('cleanerp-demo-data-v1')
    } catch {}
  }
}

let realAvailable: boolean | null = null
let demoMode = false

const BASE = 'https://cleansahel.onrender.com/api'

// Heuristic: if we're served from a static CDN (no API at /api/*),
// skip the probe and go straight to demo mode.
function isStaticDeploy(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  // Known static-deploy hostnames (no backend available)
  if (h.includes('space.minimax.io')) return true
  if (h.includes('.vercel.app')) return true
  if (h.includes('.netlify.app')) return true
  if (h.includes('.github.io')) return true
  if (h.includes('localhost') && window.location.port === '5173') return true
  // Allow override via localStorage flag
  if (localStorage.getItem('cleanerp-force-real') === '1') return false
  if (localStorage.getItem('cleanerp-force-demo') === '1') return true
  return false
}

// Detect production deployment with real backend
function isProductionWithBackend(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  // GitHub Pages no soporta backend - siempre demo
  if (h.includes('github.io')) return false
  if (h.includes('onrender.com')) return true
  if (h.includes('surge.sh')) return true
  if (h.includes('netlify.app')) return true
  if (h.includes('vercel.app')) return true
  if (h.includes('render.com')) return true
  return false
}

function getToken() {
  return localStorage.getItem('cleanerp-token') || ''
}

function setToken(t: string) {
  localStorage.setItem('cleanerp-token', t)
}

export function isDemoMode() { return demoMode }

async function realFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as any || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (res.status === 401) {
    if (!path.startsWith('/auth/')) {
      localStorage.removeItem('cleanerp-token')
      localStorage.removeItem('cleanerp-user')
      window.location.href = '/login'
    }
    throw new Error('No autorizado')
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

async function probeRealBackend(): Promise<boolean> {
  try {
    if (typeof fetch === 'undefined') return false
    // Try health endpoint with a tight timeout.
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null
    const t = ctrl ? setTimeout(() => { try { ctrl.abort() } catch {} }, 1500) : null
    let res: Response
    try {
      res = await fetch(`${BASE}/health`, { method: 'GET', signal: ctrl?.signal })
    } finally {
      if (t) clearTimeout(t)
    }
    if (!res.ok) return false
    // Verify it's actually our backend (JSON), not the SPA's index.html
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return false
    const j = await res.json()
    return !!(j && j.ok === true)
  } catch { return false }
}

async function ensureMode() {
  if (realAvailable !== null) return
  if (isStaticDeploy()) {
    // On a static CDN, never even probe — go straight to demo
    realAvailable = false
    demoMode = true
    console.info('CleanERP: hosting estático detectado, activando modo demo (datos en este navegador)')
    return
  }
  // On production (Render etc), always use real backend
  if (isProductionWithBackend()) {
    realAvailable = true
    demoMode = false
    console.info('CleanERP: producción detectada, usando backend real (datos compartidos)')
    return
  }
  realAvailable = await probeRealBackend()
  demoMode = !realAvailable
  if (demoMode) console.info('CleanERP: backend no disponible, activando modo demo (datos en este navegador)')
}

// Activate demo mode permanently for this session.
function activateDemo() {
  realAvailable = false
  demoMode = true
  if (!localStorage.getItem('cleanerp-demo-notice-shown')) {
    console.info('CleanERP: entrando en modo demo (datos en este navegador)')
    localStorage.setItem('cleanerp-demo-notice-shown', '1')
  }
}

// ---------- DEMO ROUTER ----------
async function demoFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase()
  const body = init.body ? JSON.parse(init.body as string) : {}
  const p = path.split('?')[0]
  const segs = p.split('/').filter(Boolean)

  if (p === '/auth/login' && method === 'POST') return demoApi.login(body.username, body.password) as any
  if (p === '/auth/me' && method === 'GET') return demoApi.me() as any
  if (p === '/dashboard' && method === 'GET') return demoApi.dashboard() as any

  if (p === '/notifications' && method === 'GET') return demoApi.notifications() as any
  if (p === '/notifications/read-all' && method === 'POST') return demoApi.markAllNotificationsRead() as any
  const notifMatch = p.match(/^\/notifications\/(.+)$/)
  if (notifMatch && method === 'POST') return demoApi.markNotificationRead(notifMatch[1]) as any

  if (p.startsWith('/history') && method === 'GET') return demoApi.history(300) as any

  if (p === '/config' && method === 'GET') return demoApi.config() as any
  if (p === '/config' && method === 'PUT') return demoApi.updateConfig(body) as any

  if (p.startsWith('/search') && method === 'GET') return demoApi.search(new URLSearchParams(path.split('?')[1] || '').get('q') || '') as any
  const bcMatch = p.match(/^\/barcode\/(.+)$/)
  if (bcMatch && method === 'GET') return demoApi.barcode(decodeURIComponent(bcMatch[1])) as any

  // LOTES DE MATERIAS PRIMAS
  if (p === '/raw-material-lots' && method === 'GET') return demoApi.rawMaterialLotsList() as any
  if (p === '/raw-material-lots' && method === 'POST') return demoApi.createRawMaterialLot(body) as any
  const rmlMatch = p.match(/^\/raw-material-lots\/(.+)$/)
  if (rmlMatch && method === 'PUT') return demoApi.updateRawMaterialLot(rmlMatch[1], body) as any
  const rmlBlockMatch = p.match(/^\/raw-material-lots\/(.+)\/block$/)
  if (rmlBlockMatch && method === 'POST') return demoApi.blockRawMaterialLot(rmlBlockMatch[1], body.reason) as any

  // PRODUCCIÓN CON LOTES
  if (p === '/produce-with-lots' && method === 'POST') return demoApi.produceWithLots(body) as any

  // TRAZABILIDAD
  const traceMatch = p.match(/^\/traceability\/(.+)\/(.+)$/)
  if (traceMatch && method === 'GET') return demoApi.traceability({ type: traceMatch[1] as any, id: decodeURIComponent(traceMatch[2]) }) as any

  // BÚSQUEDA DE LOTES
  if (p.startsWith('/lot-search') && method === 'GET') return demoApi.lotSearch(new URLSearchParams(path.split('?')[1] || '').get('q') || '') as any

  // RECALLS
  if (p === '/recalls' && method === 'GET') return demoApi.recallsList() as any
  if (p === '/recalls' && method === 'POST') return demoApi.initiateRecall(body) as any
  const recallMatch = p.match(/^\/recalls\/(.+)\/complete$/)
  if (recallMatch && method === 'POST') return demoApi.completeRecall(recallMatch[1], body.notes) as any

  // MÁQUINAS
  if (p === '/machines' && method === 'GET') return demoApi.machinesList() as any
  if (p === '/machines' && method === 'POST') return demoApi.createMachine(body) as any
  const machineMatch = p.match(/^\/machines\/(.+)$/)
  if (machineMatch && method === 'PUT') return demoApi.updateMachine(machineMatch[1], body) as any
  if (machineMatch && method === 'DELETE') return demoApi.deleteMachine(machineMatch[1]) as any

  // ETIQUETAS
  const labelMatch = p.match(/^\/label\/(.+)$/)
  if (labelMatch && method === 'GET') return demoApi.generateLabel(labelMatch[1]) as any

  // GENERADOR DE LOTES
  if (p === '/lots/preview-number' && method === 'GET') return { lotNumber: demoApi.previewLotNumber(new URLSearchParams(path.split('?')[1] || '').get('date') || undefined) } as any
  if (p === '/lots/generate' && method === 'POST') return demoApi.generateLot(body) as any
  const lotStatusMatch = p.match(/^\/lots\/(.+)\/status$/)
  if (lotStatusMatch && method === 'POST') return demoApi.updateLotStatus(lotStatusMatch[1], body.status, body.notes) as any

  const repMatch = p.match(/^\/reports\/(.+)$/)
  if (repMatch && method === 'GET') return demoApi.reports(repMatch[1]) as any

  if (p === '/backup' && method === 'GET') return load() as any
  if (p === '/reset' && method === 'POST') return demoApi.reset()

  const entity = segs[0] as any
  if (entity) {
    if (segs.length === 1 && method === 'GET') return demoApi.list(entity) as any
    if (segs.length === 1 && method === 'POST') return demoApi.create(entity, body) as any
    if (segs.length === 2 && method === 'GET') return (demoApi.list(entity) as any[]).find((x: any) => x.id === segs[1]) as any
    if (segs.length === 2 && method === 'PUT') return demoApi.update(entity, segs[1], body) as any
    if (segs.length === 2 && method === 'DELETE') return demoApi.remove(entity, segs[1]) as any
    if (segs.length === 3) {
      const action = segs[2]
      if (entity === 'raw-materials' && action === 'entry' && method === 'POST') return demoApi.rawMaterialEntry(segs[1], body) as any
      if (entity === 'packaging' && action === 'entry' && method === 'POST') return demoApi.packagingEntry(segs[1], body) as any
    }
  }

  if (p === '/produce' && method === 'POST') return demoApi.produce(body) as any
  if (p === '/restore' && method === 'POST') return { ok: true }

  if (entity === 'orders' && segs.length === 2 && method === 'PUT') {
    if (Object.keys(body).length === 1 && body.status) return demoApi.changeOrderStatus(segs[1], body.status) as any
    return demoApi.updateOrder(segs[1], body) as any
  }
  if (entity === 'orders' && segs.length === 1 && method === 'POST') return demoApi.createOrder(body) as any

  if (entity === 'purchases' && segs.length === 1 && method === 'POST') return demoApi.createPurchase(body) as any
  if (entity === 'expenses' && segs.length === 1 && method === 'POST') return demoApi.createExpense(body) as any

  throw new Error(`Endpoint demo no implementado: ${method} ${path}`)
}

function load(): any {
  const data = localStorage.getItem('cleanerp-demo-data-v1')
  return data ? JSON.parse(data) : {}
}

export const api = {
  async get<T = any>(path: string) {
    await ensureMode()
    if (demoMode && !isProductionWithBackend()) return demoFetch<T>(path, { method: 'GET' })
    try { return await realFetch<T>(path, { method: 'GET' }) }
    catch (e: any) {
      if (isProductionWithBackend()) { throw new Error("Error de conexión con el servidor: " + e.message + ". Recarga la página.") }
      if (isProductionWithBackend()) throw new Error("Error de conexión con el servidor: " + e.message + ". Recarga la página."); activateDemo()
      return demoFetch<T>(path, { method: 'GET' })
    }
  },
  async post<T = any>(path: string, body?: any) {
    await ensureMode()
    if (demoMode && !isProductionWithBackend()) return demoFetch<T>(path, { method: 'POST', body: JSON.stringify(body || {}) })
    try {
      const res = await realFetch<T>(path, { method: 'POST', body: JSON.stringify(body || {}) })
      // FIX 3 ROLES: corregir rol si username coincide con rol oficial
      if (path === '/auth/login' && res && (res as any).user) {
        const u = (res as any).user
        const ROLE_BY_USERNAME: Record<string, string> = {
          admin: 'admin',
          produccion: 'produccion',
          contabilidad: 'contabilidad',
        }
        if (ROLE_BY_USERNAME[u.username] && u.role !== ROLE_BY_USERNAME[u.username]) {
          console.log(`[FIX-3ROLES] Corrigiendo rol de ${u.username}: ${u.role} → ${ROLE_BY_USERNAME[u.username]}`)
          u.role = ROLE_BY_USERNAME[u.username]
        }
      }
      return res
    }
    catch (e: any) {
      if (isProductionWithBackend()) throw new Error("Error de conexión con el servidor: " + e.message + ". Recarga la página."); activateDemo()
      return demoFetch<T>(path, { method: 'POST', body: JSON.stringify(body || {}) })
    }
  },
  async put<T = any>(path: string, body?: any) {
    await ensureMode()
    if (demoMode && !isProductionWithBackend()) return demoFetch<T>(path, { method: 'PUT', body: JSON.stringify(body || {}) })
    try { return await realFetch<T>(path, { method: 'PUT', body: JSON.stringify(body || {}) }) }
    catch (e: any) {
      if (isProductionWithBackend()) throw new Error("Error de conexión con el servidor: " + e.message + ". Recarga la página."); activateDemo()
      return demoFetch<T>(path, { method: 'PUT', body: JSON.stringify(body || {}) })
    }
  },
  async del<T = any>(path: string) {
    await ensureMode()
    if (demoMode && !isProductionWithBackend()) return demoFetch<T>(path, { method: 'DELETE' })
    try { return await realFetch<T>(path, { method: 'DELETE' }) }
    catch (e: any) {
      if (isProductionWithBackend()) throw new Error("Error de conexión con el servidor: " + e.message + ". Recarga la página."); activateDemo()
      return demoFetch<T>(path, { method: 'DELETE' })
    }
  },
  setToken,
  getToken,
  isDemo: () => demoMode,
  activateDemo,
}

export function downloadFile(path: string, filename: string) {
  if (demoMode) {
    const data = localStorage.getItem('cleanerp-demo-data-v1')
    if (data) {
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    }
    return
  }
  const token = getToken()
  fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    })
}
// Last fix Sat Aug  8 23:37:49 UTC 2026
