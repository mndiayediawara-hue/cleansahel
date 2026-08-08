import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { ScanLine, Camera, CheckCircle2, AlertCircle, Package, Boxes, Beaker, Users, X, Zap } from 'lucide-react'

// Tipos para BarcodeDetector API
declare global {
  interface Window {
    BarcodeDetector?: any
  }
}

export default function Scanner() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const lastDetectedRef = useRef<{ code: string; at: number } | null>(null)

  async function lookup(c?: string) {
    const target = c ?? code
    if (!target) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await api.get(`/barcode/${encodeURIComponent(target)}`)
      setResult(res)
    } catch (e: any) {
      setError(e.message || 'No encontrado')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  async function startCamera() {
    setError('')
    try {
      // Verificar soporte de BarcodeDetector
      if (!('BarcodeDetector' in window)) {
        setError('Tu navegador no soporta lectura de códigos por cámara. Usa Chrome, Edge o Safari reciente. También puedes escribir el código manualmente.')
        return
      }
      // Crear detector
      const formats = await window.BarcodeDetector.getSupportedFormats()
      detectorRef.current = new window.BarcodeDetector({ formats: formats.length ? formats : ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] })
      // Pedir cámara
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      setScanStatus('Buscando código...')
      tick()
    } catch (e: any) {
      setError('No se pudo acceder a la cámara: ' + (e.message || e.name || 'Error desconocido'))
      setScanning(false)
    }
  }

  function tick() {
    if (!videoRef.current || !detectorRef.current) return
    if (videoRef.current.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    detectorRef.current.detect(videoRef.current).then((codes: any[]) => {
      if (codes && codes.length > 0) {
        const raw = codes[0].rawValue
        const now = Date.now()
        // Evitar re-detectar el mismo código en menos de 3s
        if (lastDetectedRef.current && lastDetectedRef.current.code === raw && (now - lastDetectedRef.current.at) < 3000) {
          // Continuar
        } else {
          lastDetectedRef.current = { code: raw, at: now }
          setCode(raw)
          setScanStatus('✓ Detectado: ' + raw)
          lookup(raw)
          // Sonido de beep opcional
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const osc = ctx.createOscillator()
            osc.frequency.value = 1000
            osc.connect(ctx.destination)
            osc.start()
            setTimeout(() => osc.stop(), 100)
          } catch {}
        }
      }
      if (scanning || streamRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }).catch(() => {
      if (scanning || streamRef.current) rafRef.current = requestAnimationFrame(tick)
    })
  }

  function stopCamera() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    detectorRef.current = null
    setScanning(false)
    setScanStatus('')
  }

  function simulateScan() {
    const codes = ['P-LIM-750', 'RM-001', 'PK-750', 'C-001']
    const c = codes[Math.floor(Math.random() * codes.length)]
    setCode(c)
    lookup(c)
  }

  const typeMeta: Record<string, { icon: any; label: string; color: string }> = {
    producto: { icon: Boxes, label: 'Producto', color: 'bg-emerald-100 text-emerald-700' },
    materia_prima: { icon: Beaker, label: 'Materia Prima', color: 'bg-cyan-100 text-cyan-700' },
    packaging: { icon: Package, label: 'Embalaje', color: 'bg-violet-100 text-violet-700' },
    cliente: { icon: Users, label: 'Cliente', color: 'bg-brand-100 text-brand-700' },
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Escáner de Códigos" subtitle="Escanea códigos de barras o QR para entradas y salidas rápidas" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold">Introducir código manualmente</h3>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="P-LIM-750, RM-001, PK-750..."
              className="input"
              autoFocus
            />
            <button onClick={() => lookup()} disabled={loading} className="btn-primary">Buscar</button>
          </div>
          <p className="text-xs text-surface-500">Compatible con códigos de barras y QR. Pulsa Enter para buscar.</p>

          <div className="pt-3 border-t border-surface-200 dark:border-surface-800">
            <p className="text-sm font-semibold mb-2">Cámara</p>
            {!scanning ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button onClick={startCamera} className="btn-secondary"><Camera className="w-4 h-4" /> Activar cámara</button>
                  <button onClick={simulateScan} className="btn-ghost text-xs"><Zap className="w-3 h-3" /> Probar con código demo</button>
                </div>
                <p className="text-[10px] text-surface-500">Apoya a QR/códigos de barras frente a la cámara. Compatible con Chrome, Edge, Safari 17+.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-24 border-2 border-emerald-400 rounded-lg animate-pulse" />
                  </div>
                  <div className="absolute top-2 left-2 right-2 flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-red-500 text-white font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> EN VIVO
                    </span>
                    {scanStatus && <span className="px-2 py-1 rounded bg-emerald-500/90 text-white font-mono">{scanStatus}</span>}
                  </div>
                </div>
                <button onClick={stopCamera} className="btn-secondary w-full"><X className="w-4 h-4" /> Detener cámara</button>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-3">Resultado</h3>
          {loading ? <p className="text-sm text-surface-500">Buscando...</p> :
           error ? (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
           ) : result ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">¡Código encontrado!</p>
              </div>
              {(() => {
                const meta = typeMeta[result.type] || { icon: Package, label: result.type, color: 'bg-surface-100 text-surface-700' }
                const Icon = meta.icon
                const d = result.data
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.color}`}><Icon className="w-4 h-4" /></div>
                      <span className="text-xs font-semibold uppercase text-surface-500">{meta.label}</span>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-surface-500">Código:</span><span className="font-mono">{d.code || d.cif || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-surface-500">Nombre:</span><span className="font-semibold">{d.name || d.company}</span></div>
                      {'stock' in d && <div className="flex justify-between"><span className="text-surface-500">Stock:</span><span className="font-semibold tabular-nums">{d.stock} {d.unit || 'ud'}</span></div>}
                      {'price' in d && <div className="flex justify-between"><span className="text-surface-500">Precio:</span><span className="font-semibold tabular-nums">{d.price}€</span></div>}
                      {'location' in d && d.location && <div className="flex justify-between"><span className="text-surface-500">Ubicación:</span><span className="font-mono">{d.location}</span></div>}
                    </div>
                  </div>
                )
              })()}
            </div>
           ) : (
            <EmptyState icon={<ScanLine className="w-5 h-5" />} title="Sin resultados aún" description="Escanea o introduce un código para empezar." />
           )}
        </div>
      </div>
    </div>
  )
}
