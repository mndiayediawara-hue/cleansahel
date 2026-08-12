
import { useState, useEffect } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Hash, Plus, Search, Eye, Printer, Calendar, Beaker, Package, Cpu, User as UserIcon, Sparkles, ShieldCheck, X, Settings as SettingsIcon } from 'lucide-react'
import { formatNumber, formatDate, formatDateTime, relativeTime } from '@/lib/utils'
import { Link } from 'react-router-dom'
import type { ProductionLot } from '@/types'

const BOTTLE_FORMATS = [
  { value: '250ml', label: '250 ml' },
  { value: '500ml', label: '500 ml' },
  { value: '750ml', label: '750 ml' },
  { value: '1L', label: '1 Litro' },
  { value: '2L', label: '2 Litros' },
  { value: '5L', label: '5 Litros' },
  { value: '10L', label: '10 Litros' },
  { value: '25L', label: '25 Litros (garrafa)' },
]

export default function LotGenerator() {
  const { products, lots, users, machines, config, refreshOne } = useData()
  // Fallbacks por si el config del usuario no tiene aromas/colors (localStorage antiguo)
  const AROMAS = config.aromas?.length ? config.aromas : ['Limón', 'Pino', 'Lavanda', 'Manzana', 'Floral', 'Marsella', 'Cítricos', 'Sin aroma', 'Menta', 'Vainilla']
  const COLORS = config.colors?.length ? config.colors : ['Transparente', 'Azul', 'Verde', 'Amarillo', 'Rosa', 'Rojo', 'Naranja', 'Incoloro']
  // Fallbacks de productos y máquinas (por si el localStorage está vacío)
  const PRODUCT_LIST = products?.length ? products : [
    { id: 'p-fallback-1', name: 'Limpiador Multiusos 750 ml', code: 'P-LIM-750', active: true },
    { id: 'p-fallback-2', name: 'Limpiador Multiusos 1 L', code: 'P-LIM-1L', active: true },
    { id: 'p-fallback-3', name: 'Desinfectante Pino 1 L', code: 'P-DES-1L', active: true },
    { id: 'p-fallback-4', name: 'Fregasuelos Concentrado 2 L', code: 'P-FREG-2L', active: true },
    { id: 'p-fallback-5', name: 'Limpiacristales 500 ml', code: 'P-VIT-500', active: true },
    { id: 'p-fallback-6', name: 'Limpiador Baños 750 ml', code: 'P-BAN-750', active: true },
  ]
  const MACHINE_LIST = machines?.length ? machines : [
    { id: 'm-fb-1', code: 'MZC-01', name: 'Mezcladora Central 1', status: 'operativa' },
    { id: 'm-fb-2', code: 'ENV-01', name: 'Envasadora Industrial 1', status: 'operativa' },
    { id: 'm-fb-3', code: 'ETQ-01', name: 'Etiquetadora Automática', status: 'operativa' },
  ]
  const { user, can } = useAuth()
  const [creating, setCreating] = useState(false)
  const [printing, setPrinting] = useState<ProductionLot | null>(null)
  const [query, setQuery] = useState('')
  const [previewNumber, setPreviewNumber] = useState('')
  const [form, setForm] = useState<any>({
    productId: '', productName: '', format: '750ml', aroma: 'Limón', color: 'Transparente',
    machineId: '', machineName: '', manufacturedAt: new Date().toISOString().slice(0, 10),
    manufacturedTime: new Date().toTimeString().slice(0, 5),
    expiryDate: '', quantity: 500, notes: '',
  })

  // Generar preview del número de lote cuando cambian los datos relevantes
  useEffect(() => {
    if (!creating) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await api.get<{ lotNumber: string }>(`/lots/preview-number?date=${form.manufacturedAt}`)
        if (!cancelled) setPreviewNumber(res.lotNumber)
      } catch { if (!cancelled) setPreviewNumber('ERROR') }
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [creating, form.manufacturedAt, lots.length])

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.productName?.trim()) return alert('Indica un producto (selecciónalo de la lista o escribe uno nuevo)')
    if (form.quantity <= 0) return alert('La cantidad debe ser mayor a 0')
    try {
      // Verificar que el producto seleccionado EXISTE en los datos reales
      // (los fallbacks tienen IDs ficticios como 'p-fallback-1' que no están en localStorage)
      let productId = form.productId
      let realProduct = productId ? products.find((p: any) => p.id === productId) : null
      if (!realProduct && form.productName) {
        // Intentar buscar por nombre por si ya existe
        realProduct = products.find((p: any) => p.name.toLowerCase() === form.productName.toLowerCase())
        if (realProduct) productId = realProduct.id
      }
      if (!realProduct) {
        // Crear el producto nuevo en datos reales
        try {
          const newP = await api.post('/products', { name: form.productName, code: 'P-' + Date.now().toString().slice(-6), active: true, unit: 'unidad' })
          productId = (newP as any).id
          await refreshOne('products')
        } catch (e: any) { return alert('No se pudo crear el producto: ' + e.message) }
      }
      const lot = await api.post('/lots/generate', { ...form, productId })
      setCreating(false)
      setPrinting(lot as any)
      setForm({ ...form, notes: '' })
      await refreshOne('lots')
      await refreshOne('products')
    } catch (e: any) { alert(e.message) }
  }

  const filtered = lots.filter(l => !query || [l.lotNumber, l.productionOrderNumber, products.find(p => p.id === l.productId)?.name].some(v => String(v || '').toLowerCase().includes(query.toLowerCase())))

  const today = lots.filter(l => new Date(l.producedAt).toDateString() === new Date().toDateString()).length
  const total = lots.length
  const blocked = lots.filter(l => l.status === 'bloqueado' || l.status === 'retirado').length

  const columns = [
    { key: 'lotNumber', label: 'Nº Lote', sortable: true, render: (l: ProductionLot) => (
        <div>
          <p className="font-mono text-sm font-bold flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-brand-500" /> {l.lotNumber}
          </p>
          <p className="text-[10px] text-surface-500 font-mono">{l.productionOrderNumber}</p>
        </div>
      )
    },
    { key: 'product', label: 'Producto · Formato', render: (l: ProductionLot) => {
        const p = products.find(x => x.id === l.productId)
        const notes = l.notes || ''
        const formatMatch = notes.match(/\[Formato: ([^\]]+)\]/)
        const format = formatMatch?.[1] || `${p?.bottleSize}ml`
        return <div><p className="font-medium text-sm">{p?.name}</p><p className="text-xs text-surface-500">{format}</p></div>
      }
    },
    { key: 'meta', label: 'Aroma · Color', render: (l: ProductionLot) => {
        const notes = l.notes || ''
        const aromaMatch = notes.match(/\[Aroma: ([^\]]+)\]/)
        const colorMatch = notes.match(/\[Color: ([^\]]+)\]/)
        return (
          <div className="flex flex-wrap gap-1">
            {aromaMatch && <span className="badge bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300 text-[10px]">{aromaMatch[1]}</span>}
            {colorMatch && <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 text-[10px]">{colorMatch[1]}</span>}
          </div>
        )
      }
    },
    { key: 'quantity', label: 'Cantidad', align: 'right' as const, render: (l: ProductionLot) => <span className="font-semibold tabular-nums">{formatNumber(l.quantity)} ud</span> },
    { key: 'producedBy', label: 'Operario', render: (l: ProductionLot) => <span className="text-xs">{users.find(u => u.id === l.producedBy)?.fullName || '-'}</span> },
    { key: 'producedAt', label: 'Fabricado', sortable: true, render: (l: ProductionLot) => <span className="text-xs">{formatDate(l.producedAt)}</span> },
    { key: 'expiryDate', label: 'Caducidad', render: (l: ProductionLot) => l.expiryDate ? <span className="text-xs">{formatDate(l.expiryDate)}</span> : <span className="text-xs text-surface-400">-</span> },
    { key: 'status', label: 'Estado', render: (l: ProductionLot) => {
        const map: Record<string, string> = {
          completado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
          'en-proceso': 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
          bloqueado: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
          retirado: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
          cancelado: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
        }
        return <span className={`badge ${map[l.status] || ''}`}>{l.status}</span>
      }
    },
    { key: 'actions', label: '', align: 'right' as const, render: (l: ProductionLot) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setPrinting(l)} className="btn-ghost p-1.5" title="Imprimir etiqueta"><Printer className="w-3.5 h-3.5" /></button>
          <Link to={`/trace/${l.id}`} className="btn-ghost p-1.5" title="Trazabilidad"><Eye className="w-3.5 h-3.5" /></Link>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Generador de Números de Lote"
        subtitle="Creación asistida: el sistema asigna el número automáticamente. Nunca se introduce a mano."
        actions={<>
          {can('admin') && <Link to="/settings" className="btn-secondary"><SettingsIcon className="w-4 h-4" /> Configurar formato</Link>}
          <button onClick={() => { setCreating(true); setPreviewNumber('...') }} className="btn-primary"><Plus className="w-4 h-4" /> Crear nuevo lote</button>
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Lotes totales" value={total} icon={Hash} tone="brand" />
        <StatCard label="Generados hoy" value={today} icon={Calendar} tone="emerald" />
        <StatCard label="Bloqueados/Retirados" value={blocked} icon={ShieldCheck} tone={blocked > 0 ? 'amber' : 'emerald'} />
        <StatCard label="Formato activo" value={config.lotFormat?.template || '{PREFIX}-{YYYY}{MM}{DD}-{####}'} icon={SettingsIcon} tone="violet" />
      </div>

      <div className="card p-4 bg-gradient-to-br from-brand-50 to-violet-50 dark:from-brand-950/30 dark:to-violet-950/30 border-brand-200 dark:border-brand-900/50">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-brand-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-brand-900 dark:text-brand-200">Generación 100% automática</p>
            <p className="text-sm text-brand-800 dark:text-brand-300 mt-1">
              El sistema asigna el número de lote siguiendo el formato <code className="px-1.5 py-0.5 rounded bg-white dark:bg-surface-900 font-mono text-xs">{config.lotFormat?.template}</code> · prefijo <strong>{config.lotFormat?.prefix}</strong> · contador de <strong>{config.lotFormat?.counterPadding} dígitos</strong>.
              {' '}Si intentas crear dos lotes el mismo día, el contador continúa automáticamente. El número nunca se repite aunque el producto se elimine.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por número de lote, OF o producto..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} lotes</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Hash className="w-5 h-5" />} title="Sin lotes" description="Pulsa «Crear nuevo lote» para generar el primero." action={
          <button onClick={() => setCreating(true)} className="btn-primary"><Plus className="w-4 h-4" /> Crear nuevo lote</button>
        } />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {creating && (
        <Modal open onClose={() => setCreating(false)} title="Crear nuevo lote" size="lg"
          footer={<>
            <button onClick={() => setCreating(false)} className="btn-secondary">Cancelar</button>
            <button onClick={generate} className="btn-primary"><Sparkles className="w-4 h-4" /> Generar lote</button>
          </>}
        >
          <form onSubmit={generate} className="space-y-4">
            <div className="card p-4 bg-gradient-to-br from-brand-50 to-violet-50 dark:from-brand-950/30 dark:to-violet-950/30 border-2 border-dashed border-brand-300 dark:border-brand-800">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider">Número de lote generado</p>
              <p className="text-3xl font-bold font-mono text-brand-900 dark:text-brand-100 mt-1 tracking-wider">{previewNumber || '...'}</p>
              <p className="text-[10px] text-brand-700/70 dark:text-brand-300/70 mt-1">Este número es único e irrepetible. Se asigna al guardar.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Producto <span className="text-red-500">*</span></label>
                <input className="input" list="products-list" value={form.productName || ''} onChange={e => {
                  const v = e.target.value
                  const match = PRODUCT_LIST.find(p => p.name.toLowerCase() === v.toLowerCase())
                  setForm({ ...form, productId: match?.id || '', productName: v })
                }} placeholder="Selecciona o escribe" required />
                <datalist id="products-list">
                  {PRODUCT_LIST.filter(p => p.active).map(p => <option key={p.id} value={p.name} />)}
                </datalist>
              </div>
              <div>
                <label className="label">Formato <span className="text-red-500">*</span></label>
                <select className="input" value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}>
                  {BOTTLE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Aroma / Fragancia <span className="text-red-500">*</span></label>
                <input className="input" list="aromas-list" value={form.aroma} onChange={e => setForm({ ...form, aroma: e.target.value })} placeholder="Selecciona o escribe" />
                <datalist id="aromas-list">
                  {AROMAS.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
              <div>
                <label className="label">Color <span className="text-red-500">*</span></label>
                <input className="input" list="colors-list" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="Selecciona o escribe" />
                <datalist id="colors-list">
                  {COLORS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="label">Línea / Máquina (opcional)</label>
                <input className="input" list="machines-list" value={form.machineName || ''} onChange={e => {
                  const v = e.target.value
                  const match = MACHINE_LIST.find(m => (m.name + ' (' + m.code + ')').toLowerCase() === v.toLowerCase() || m.name.toLowerCase() === v.toLowerCase())
                  setForm({ ...form, machineId: match?.id || '', machineName: v })
                }} placeholder="— Sin asignar —" />
                <datalist id="machines-list">
                  {MACHINE_LIST.filter(m => m.status === 'operativa').map(m => <option key={m.id} value={`${m.name} (${m.code})`} />)}
                </datalist>
              </div>
              <div>
                <label className="label">Cantidad (botellas) <span className="text-red-500">*</span></label>
                <input type="number" min="1" className="input" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} required />
              </div>
              <div>
                <label className="label">Fecha de fabricación <span className="text-red-500">*</span></label>
                <input type="date" className="input" value={form.manufacturedAt} onChange={e => setForm({ ...form, manufacturedAt: e.target.value })} required />
              </div>
              <div>
                <label className="label">Hora de fabricación <span className="text-red-500">*</span></label>
                <input type="time" className="input" value={form.manufacturedTime} onChange={e => setForm({ ...form, manufacturedTime: e.target.value })} required />
                <p className="text-[10px] text-surface-500 mt-1">Hora local de la fábrica</p>
              </div>
              <div>
                <label className="label">Fecha de caducidad</label>
                <input type="date" className="input" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
                <p className="text-[10px] text-surface-500 mt-1">Si no se indica, se calcula +2 años por defecto</p>
              </div>
            </div>

            <div>
              <label className="label">Notas (opcional)</label>
              <textarea className="input min-h-[60px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones..." />
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Validaciones automáticas:</p>
                <ul className="mt-1 space-y-0.5 list-disc pl-4">
                  <li>El número de lote es único en toda la base de datos</li>
                  <li>Si ya existe, el sistema asigna automáticamente el siguiente disponible</li>
                  <li>El lote se registra con fecha, hora y usuario creador</li>
                  <li>El lote no se puede modificar salvo por administradores</li>
                  <li>Aunque el producto se elimine, el lote queda registrado para auditoría</li>
                </ul>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {printing && <PrintLabelModal lot={printing} onClose={() => setPrinting(null)} products={products} machines={machines} users={users} />}
    </div>
  )
}

function PrintLabelModal({ lot, onClose, products, machines, users }: any) {
  const product = products.find((p: any) => p.id === lot.productId)
  const machine = machines.find((m: any) => m.id === lot.machineId)
  const operator = users.find((u: any) => u.id === lot.producedBy)
  const notes = lot.notes || ''
  const aromaMatch = notes.match(/\[Aroma: ([^\]]+)\]/)
  const colorMatch = notes.match(/\[Color: ([^\]]+)\]/)
  const formatMatch = notes.match(/\[Formato: ([^\]]+)\]/)
  const format = formatMatch?.[1] || `${product?.bottleSize}ml`

  return (
    <Modal open onClose={onClose} title={`Etiqueta · ${lot.lotNumber}`} size="md"
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cerrar</button>
        <button onClick={() => window.print()} className="btn-primary"><Printer className="w-4 h-4" /> Imprimir</button>
      </>}
    >
      <div className="space-y-3">
        <p className="text-xs text-surface-500">Etiqueta imprimible con QR, código de barras, lote, fechas y orden de fabricación.</p>
        <div className="border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-xl p-6 bg-white text-black print:border-solid print:border-black">
          <div className="text-center mb-3">
            <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500">CleanSahel</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="text-center">
              <p className="text-[10px] uppercase text-gray-500">Producto</p>
              <p className="text-base font-bold">{product?.name}</p>
              <p className="text-xs text-gray-600">{product?.code} · {format} · {aromaMatch?.[1] || ''} · {colorMatch?.[1] || ''}</p>
            </div>
            <div className="border-t border-b border-gray-300 py-2 my-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">Lote:</span> <span className="font-mono font-bold">{lot.lotNumber}</span></div>
                <div><span className="text-gray-500">O.F.:</span> <span className="font-mono">{lot.productionOrderNumber}</span></div>
                <div><span className="text-gray-500">Fabricado:</span> {formatDate(lot.producedAt)}</div>
                <div><span className="text-gray-500">Caducidad:</span> {lot.expiryDate ? formatDate(lot.expiryDate) : '-'}</div>
                <div><span className="text-gray-500">Cantidad:</span> <span className="font-semibold">{formatNumber(lot.quantity)} ud</span></div>
                <div><span className="text-gray-500">Operario:</span> {operator?.fullName}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex-1">
                <div className="flex items-end h-8 gap-px" style={{ background: 'repeating-linear-gradient(90deg, #000 ' + lot.lotNumber.split('').map(c => `${c.charCodeAt(0) % 4 === 0 ? 2 : 1}px`).join(', transparent ') + ')' }} />
                <p className="text-[10px] font-mono text-center mt-1">{lot.lotNumber}</p>
              </div>
              <div className="w-16 h-16 bg-surface-100 border border-gray-300 rounded grid place-items-center text-[8px] text-gray-400 text-center">QR<br/>CODE</div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-surface-500 text-center">Imprime en etiqueta adhesiva o guárdala como PDF.</p>
      </div>
    </Modal>
  )
}