
// API client for the REAL shared backend only.
// Demo/localStorage fallback is intentionally disabled so production data can
// never silently diverge between devices/users.

let realAvailable = true
const demoMode = false
const BASE = 'https://cleansahel.onrender.com/api'

function getToken() { return localStorage.getItem('cleanerp-token') || '' }
function setToken(t: string) { localStorage.setItem('cleanerp-token', t) }
export function isDemoMode() { return false }

async function realFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as any || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch (e: any) {
    throw new Error('No se puede conectar con el servidor. Comprueba Render/backend y vuelve a intentarlo.')
  }
  if (res.status === 401) {
    localStorage.removeItem('cleanerp-token')
    localStorage.removeItem('cleanerp-user')
    throw new Error('Sesión no autorizada o caducada. Vuelve a iniciar sesión.')
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  async get<T = any>(path: string) { return realFetch<T>(path, { method: 'GET' }) },
  async post<T = any>(path: string, body?: any) { return realFetch<T>(path, { method: 'POST', body: JSON.stringify(body || {}) }) },
  async put<T = any>(path: string, body?: any) { return realFetch<T>(path, { method: 'PUT', body: JSON.stringify(body || {}) }) },
  async patch<T = any>(path: string, body?: any) { return realFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body || {}) }) },
  async del<T = any>(path: string) { return realFetch<T>(path, { method: 'DELETE' }) },
  setToken,
  getToken,
  isDemo: () => false,
}

export function downloadFile(path: string, filename: string) {
  const token = getToken()
  fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async r => {
      if (!r.ok) throw new Error(`Error ${r.status}`)
      return r.blob()
    })
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    })
    .catch(e => alert(e.message || 'No se pudo descargar el archivo'))
}
// Last fix Sat Aug  8 23:37:49 UTC 2026