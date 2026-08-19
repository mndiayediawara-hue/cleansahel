import { useState, useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Factory, Beaker, Package, AlertTriangle, CheckCircle2, Play, Cpu, Plus, Clock, CheckCheck, X } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { ProductionOrder } from '@/types'

type Tab = 'pendiente' | 'en_proceso' | 'acabada'

/**
 * Formato inteligente: si el número es entero, no muestra decimales.
 * Si tiene decimales significativos, los muestra con coma (formato español).
 */
function fmt(value: number, maxDecimals = 3): string {
  if (!isFinite(value)) return '0'
  const rounded = Math.round(value * Math.pow(10, maxDecimals)) / Math.pow(10, maxDecimals)
  if (Math.abs(rounded - Math.round(rounded)) < 0.0001) {
    return formatNumber(Math.round(rounded), 0)
  }
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(rounded)
}

export default function Production() {
  const { products, recipes, rawMaterials, packaging, productionOrders, refreshOne, refresh } = useData()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('pendiente')
  const [selected, setSelected] = useState<ProductionOrder | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [newProductId, setNewProductId] = useState('')
  const [newQuantity, setNewQuantity] = useState(100)
  const [newNotes, setNewNotes] = useState('')

  const orders = productionOrders || []

  const pendientes = orders.filter(o => o.status === 'pendiente')
  const enProceso = orders.filter(o => o.status === 'en_proceso')
  const acabadas = orders.filter(o => o.status === 'acabada')

  const filtered = useMemo(() => {
    if (tab === 'pendiente') return pendientes
    if (tab === 'en_proceso') return enProceso
    return acabadas
  }, [tab, pendientes, enProceso, acabadas])

  function getProduct(id: string) {
    return products.find(p => p.id === id)
  }

  function getRecipe(id: string | null) {
    if (!id) return null
    return recipes.find(r => r.id === id) || null
  }

  function calcRequired(recipeId: string | null, qty: number) {
    const r = getRecipe(recipeId)
    if (!r) return []
    const batch = r.batchSize || 1
    const ratio = qty / batch
    return (r.items || []).map((it: any) => {
      const required = (it.quantity || 0) * ratio
      let available = 0
      let name = '?'
      if (it.materialType === 'raw') {
        const m = rawMaterials.find(x => x.id === it.materialId)
        if (m) { available = m.stock || 0; name = m.name }
      } else if (it.materialType === 'packaging') {
        const p = packaging.find(x => x.id === it.materialId)
        if (p) { available = p.stock || 0; name = p.name }
      }
      return { name, type: it.materialType, unit: it.unit, required, available, enough: available >= required }
    })
  }

  const newProduct = newProductId ? getProduct(newProductId) : null
  const newRecipe = newProduct ? recipes.find(r => r.productId === newProduct.id) : null
  const newRequired = newRecipe ? calcRequired(newRecipe.id, newQuantity) : []

  async function startProduction(order: ProductionOrder) {
    setError('')
    setLoading(true)
    try {
      await api.patch(`/production-orders/${order.id}/start`, {})
      setSuccess(`Orden ${order.number} → En proceso`)
      setTimeout(() => setSuccess(''), 4000)
      setSelected(null)
      await refreshOne('productionOrders')
    } catch (e: any) {
      setError(e.message || 'Error al iniciar')
    } finally {
      setLoading(false)
    }
  }

  async function completeProduction(order: ProductionOrder) {
    setError('')
    setLoading(true)
    try {
      await api.patch(`/production-orders/${order.id}/complete`, {})
      setSuccess(`¡Orden ${order.number} completada!`)
      setTimeout(() => setSuccess(''), 5000)
      setSelected(null)
      await refresh()
    } catch (e: any) {
      setError(e.message || 'Error al completar')
    } finally {
      setLoading(false)
    }
  }

  async function deleteOrder(order: ProductionOrder) {
    if (!confirm(`¿Borrar la orden ${order.number}?`)) return
    setError('')
    try {
      await api.del(`/production-orders/${order.id}`)
      setSelected(null)
      await refreshOne('productionOrders')
    } catch (e: any) {
      setError(e.message || 'Error al borrar')
    }
  }

  async function createManual() {
    if (!newProductId) { setError('Selecciona un producto'); return }
    if (!newQuantity || newQuantity <= 0) { setError('Cantidad inválida'); return }
    setError('')
    setLoading(true)
    try {
      const created = await api.post<ProductionOrder>('/production-orders', {
        productId: newProductId,
        quantity: newQuantity,
        notes: newNotes || undefined,
        status: 'pendiente',
      })
      setSuccess(`Orden ${created.number} creada`)
      setTimeout(() => setSuccess(''), 4000)
      setShowNew(false)
      setNewProductId(''); setNewQuantity(100); setNewNotes('')
      await refreshOne('productionOrders')
    } catch (e: any) {
      setError(e.message || 'Error al crear')
    } finally {
      setLoading(false)
    }
  }

  const tabButtons: { key: Tab; label: string; count: number; icon: any }[] = [
    { key: 'pendiente', label: 'Pendientes', count: pendientes.length, icon: Clock },
    { key: 'en_proceso', label: 'En proceso', count: enProceso.length, icon: Play },
    { key: 'acabada', label: 'Acabadas', count: acabadas.length, icon: CheckCheck },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Producción"
        subtitle="Pedidos y stock generan automáticamente las fabricaciones pendientes. Confirma y marca como acabada para actualizar inventario."
        actions={
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Nueva fabricación
          </button>
        }
      />

      {success && (
        <div className="card p-3 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <p className="text-sm text-emerald-800 dark:text-emerald-200">{success}</p>
        </div>
      )}
      {error && (
        <div className="card p-3 bg-red-50 dark:bg-red-950/30 border-red-200 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pendientes" value={pendientes.length} icon={Clock} tone="amber" hint="por iniciar" />
        <StatCard label="En proceso" value={enProceso.length} icon={Play} tone="sky" hint="en fabricación" />
        <StatCard label="Acabadas" value={acabadas.length} icon={CheckCheck} tone="emerald" hint="histórico" />
        <StatCard label="Productos" value={products.filter(p => p.active).length} icon={Beaker} tone="brand" hint="activos" />
      </div>

      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-800">
        {tabButtons.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                active
                  ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                  : 'border-transparent text-surface-500 hover:text-surface-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              <span className={`badge ${active ? 'bg-brand-100 text-brand-800' : 'bg-surface-100 text-surface-600'}`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Factory}
          title={`Sin órdenes ${tab === 'pendiente' ? 'pendientes' : tab === 'en_proceso' ? 'en proceso' : 'acabadas'}`}
          description={tab === 'pendiente' ? 'Las órdenes pendientes se crean automáticamente al confirmar pedidos sin stock suficiente, o puedes crear una manualmente con "Nueva fabricación".' : 'Cuando muevas órdenes a esta sección aparecerán aquí.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(o => {
            const p = getProduct(o.productId)
            const r = getRecipe(o.recipeId)
            const required = calcRequired(o.recipeId, o.quantity)
            const allEnough = required.every(x => x.enough)
            return (
              <div
                key={o.id}
                onClick={() => setSelected(o)}
                className={`card p-4 cursor-pointer hover:shadow-md transition ${
                  tab === 'pendiente' && !allEnough ? 'border-l-4 border-l-amber-400' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-xs text-surface-500">{o.number}</p>
                    <h3 className="font-semibold">{p?.name || '?'}</h3>
                    <p className="text-xs text-surface-500">{p?.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums">{fmt(o.quantity, 0)}</p>
                    <p className="text-xs text-surface-500">L</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {o.pedidoId && (
                    <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 text-[10px]">
                      Auto de pedido
                    </span>
                  )}
                  {r && <span className="badge bg-surface-100 text-surface-600 text-[10px]">Receta OK</span>}
                  {tab === 'pendiente' && !allEnough && (
                    <span className="badge bg-amber-100 text-amber-800 text-[10px]">
                      <AlertTriangle className="w-3 h-3" /> Sin stock
                    </span>
                  )}
                  {tab === 'acabada' && o.finishedAt && (
                    <span className="badge bg-emerald-100 text-emerald-800 text-[10px]">
                      {new Date(o.finishedAt).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (() => {
        const p = getProduct(selected.productId)
        const r = getRecipe(selected.recipeId)
        const required = calcRequired(selected.recipeId, selected.quantity)
        const allEnough = required.every(x => x.enough)
        return (
          <Modal
            open
            onClose={() => setSelected(null)}
            title={`${selected.number} — ${p?.name || '?'}`}
            size="xl"
            footer={
              <>
                <button onClick={() => setSelected(null)} className="btn-secondary">Cerrar</button>
                {selected.status === 'pendiente' && (
                  <>
                    {user?.role === 'admin' && (
                      <button onClick={() => deleteOrder(selected)} className="btn-ghost text-red-600 text-sm">
                        <X className="w-4 h-4" /> Borrar
                      </button>
                    )}
                    <button
                      onClick={() => startProduction(selected)}
                      disabled={loading || !r}
                      className="btn-primary"
                    >
                      <Play className="w-4 h-4" /> {loading ? '...' : 'Confirmar fabricación'}
                    </button>
                  </>
                )}
                {selected.status === 'en_proceso' && (
                  <button
                    onClick={() => completeProduction(selected)}
                    disabled={loading || !allEnough}
                    className="btn-primary"
                    title={!allEnough ? 'Stock insuficiente de MPs' : ''}
                  >
                    <CheckCheck className="w-4 h-4" /> {loading ? '...' : 'Marcar como acabada'}
                  </button>
                )}
              </>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-3 bg-brand-50 dark:bg-brand-950/30">
                  <p className="text-xs text-surface-500">Producto</p>
                  <p className="font-semibold">{p?.name || '?'}</p>
                  <p className="text-xs text-surface-500">{p?.code}</p>
                </div>
                <div className="card p-3 bg-cyan-50 dark:bg-cyan-950/30">
                  <p className="text-xs text-surface-500">Cantidad a fabricar</p>
                  <p className="text-2xl font-bold tabular-nums">{fmt(selected.quantity, 0)} <span className="text-sm">L</span></p>
                </div>
                <div className="card p-3 bg-surface-50 dark:bg-surface-800/50">
                  <p className="text-xs text-surface-500">Estado</p>
                  <p className="font-semibold capitalize">{selected.status.replace('_', ' ')}</p>
                  {selected.pedidoId && <p className="text-[10px] text-surface-500">Origen: pedido</p>}
                </div>
              </div>

              {!r ? (
                <div className="card p-3 bg-red-50 border-red-200 text-sm text-red-700">
                  Esta orden no tiene receta asociada. Ve a Recetas y crea una para el producto.
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold mb-2">Receta: {fmt(r.batchSize || 1, 0)} L de producto</p>
                    <p className="text-xs text-surface-500">
                      Multiplicador: ×{fmt(selected.quantity / (r.batchSize || 1), 3)} (se aplica a cada ingrediente)
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-2">Materias primas y envases necesarios</p>
                    <div className="space-y-1.5 max-h-80 overflow-y-auto border border-surface-200 dark:border-surface-800 rounded-lg p-2">
                      {required.map((it, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between p-2 rounded text-sm ${
                            it.enough ? 'bg-surface-50 dark:bg-surface-800/30' : 'bg-red-50 dark:bg-red-950/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {it.type === 'raw' ? <Beaker className="w-3.5 h-3.5 text-cyan-600" /> : <Package className="w-3.5 h-3.5 text-violet-600" />}
                            <span className="truncate">{it.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs tabular-nums">
                            <span className="font-semibold">Necesario: {fmt(it.required, 3)} {it.unit}</span>
                            <span className="text-surface-500">Disponible: {fmt(it.available, 2)} {it.unit}</span>
                            {it.enough ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selected.status === 'en_proceso' && !allEnough && (
                    <div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      No se puede marcar como acabada: faltan materias primas o envases.
                    </div>
                  )}
                </>
              )}

              {selected.notes && (
                <div className="card p-3 bg-surface-50 dark:bg-surface-800/50 text-sm">
                  <p className="text-xs text-surface-500">Notas</p>
                  <p>{selected.notes}</p>
                </div>
              )}
            </div>
          </Modal>
        )
      })()}

      {showNew && (
        <Modal
          open
          onClose={() => setShowNew(false)}
          title="Nueva fabricación manual"
          size="lg"
          footer={
            <>
              <button onClick={() => setShowNew(false)} className="btn-secondary">Cancelar</button>
              <button onClick={createManual} disabled={loading || !newProductId} className="btn-primary">
                <Plus className="w-4 h-4" /> {loading ? 'Creando...' : 'Crear orden'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label">Producto a fabricar *</label>
              <select className="input" value={newProductId} onChange={e => setNewProductId(e.target.value)}>
                <option value="">— Selecciona producto —</option>
                {products.filter(p => p.active).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code}) — Stock actual: {fmt(p.stock, 0)} L</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cantidad a fabricar (L) *</label>
              <input
                type="number"
                min="1"
                step="any"
                className="input"
                value={newQuantity === 0 ? '' : newQuantity}
                onChange={e => {
                  const v = e.target.value
                  if (v === '') {
                    setNewQuantity(0)
                  } else {
                    const n = parseFloat(v)
                    setNewQuantity(isNaN(n) ? 0 : n)
                  }
                }}
                onBlur={e => {
                  if (!e.target.value || parseFloat(e.target.value) <= 0) {
                    setNewQuantity(100)
                  }
                }}
                placeholder="ej: 100, 200, 1.25"
              />
              {newProduct && newRecipe && (
                <p className="text-[10px] text-surface-500 mt-1">
                  Receta base: {fmt(newRecipe.batchSize || 1, 0)} L · Ratio: ×{fmt(newQuantity / (newRecipe.batchSize || 1), 3)}
                </p>
              )}
            </div>
            <div>
              <label className="label">Notas (opcional)</label>
              <input className="input" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Lote especial, cliente X..." />
            </div>
            {newRequired.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Vista previa: materias primas necesarias</p>
                <div className="space-y-1 max-h-60 overflow-y-auto border border-surface-200 dark:border-surface-800 rounded-lg p-2">
                  {newRequired.map((it, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        it.enough ? 'bg-surface-50 dark:bg-surface-800/30' : 'bg-red-50 dark:bg-red-950/30'
                      }`}
                    >
                      <span>{it.name}</span>
                      <div className="flex items-center gap-3 text-xs tabular-nums">
                        <span className="font-semibold">{fmt(it.required, 3)} {it.unit}</span>
                        <span className="text-surface-500">Disp: {fmt(it.available, 2)} {it.unit}</span>
                        {it.enough ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!newRecipe && newProductId && (
              <div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
                Este producto no tiene receta. Crea una en Recetas antes de poder fabricar.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
