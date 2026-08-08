import { useEffect, useState } from 'react'
import { Database, AlertTriangle, RefreshCw, X } from 'lucide-react'
import { isDemoMode } from '@/lib/api'

export function BackendStatus() {
  const [status, setStatus] = useState<'checking' | 'real' | 'demo' | 'error'>('checking')
  const [error, setError] = useState<string>('')
  const [dismissed, setDismissed] = useState(false)

  async function check() {
    setStatus('checking')
    setError('')
    try {
      const res = await fetch('/api/health', { method: 'GET' })
      if (res.ok) {
        const j = await res.json()
        if (j.ok === true) {
          setStatus('real')
          return
        }
      }
      setStatus('error')
      setError('Backend no responde correctamente')
    } catch (e: any) {
      setStatus('error')
      setError(e.message || 'No se puede conectar')
    }
  }

  useEffect(() => {
    check()
    if (isDemoMode()) {
      try { localStorage.removeItem('cleanerp-demo-data-v1') } catch {}
    }
  }, [])

  if (dismissed) return null
  if (status === 'real') return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-3 py-2 text-xs flex items-center gap-2 ${
      status === 'error' ? 'bg-red-600 text-white' : status === 'demo' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
    }`}>
      {status === 'checking' && (
        <>
          <Database className="w-3.5 h-3.5 animate-pulse" />
          <span className="flex-1">Conectando con el servidor...</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="flex-1">
            <strong>Sin conexion con el servidor.</strong> Los datos solo se guardan en tu navegador. {error}
          </span>
          <button onClick={check} className="p-1 hover:bg-red-700 rounded"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => location.reload()} className="px-2 py-1 bg-white text-red-600 rounded font-semibold">Recargar</button>
        </>
      )}
      {status === 'demo' && (
        <>
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="flex-1">Modo local. Los datos no se comparten con otros.</span>
          <button onClick={() => location.reload()} className="px-2 py-1 bg-white text-amber-600 rounded font-semibold">Recargar</button>
        </>
      )}
      <button onClick={() => setDismissed(true)} className="p-1 hover:bg-black/20 rounded"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}
