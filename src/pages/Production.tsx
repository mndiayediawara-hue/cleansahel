import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Factory, Beaker, Package, AlertTriangle, CheckCircle2, Play, Cpu } from 'lucide-react'
import { formatNumber, formatCurrency, formatDateTime } from '@/lib/utils'

export default function Production() {
  const { products, recipes, rawMaterials, packaging, lots, rawMaterialLots, machines, refreshOne, refresh } = useData()
  const { user } = useAuth()
  const [producing, setProducing] = useState<string>('') // productId
  const [batchSize, setBatchSize] = useState(1000) // Tamaño del lote a fabricar (L)
  const [notes, setNotes] = useState('')
  const [machineId, setMachineId] = useState<string>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [recipeModal, setRecipeModal] = useState<string>('')

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayProduced = lots.filter(l => new Date(l.producedAt) >= today && l.status === 'completado').reduce((s, l) => s + l.quantity, 0)

  const selectedProduct = products.find(p => p.id === producing)
  const selectedRecipe = recipes.find(r => r.productId === producing)

  /**
   * Calcula los ingredientes necesarios para fabricar un lote de `qty` litros,
   * basándose en la receta (definida para recipe.batchSize litros).
   * 
   * ratio = qty / recipe.batchSize
   * cantidad_necesaria = item.quantity * ratio
   */
  function calcRequired(qty: number) {
    if (!selectedRecipe) return []
    const recipeBatch = selectedRecipe.batchSize || 1000
    const ratio = qty / recipeBatch
    return (selectedRecipe.items || []).map(it => {
      const total = it.quantity * ratio
      const mat = it.materialType === 'raw' ? rawMaterials.find(m => m.id === it.materialId) : packaging.find(p => p.id === it.materialId)
      // Para MP, calcular el stock disponible en lotes activos
      let available: number
      if (it.materialType === 'raw') {
        available = rawMaterialLots.filter(l => l.rawMaterialId === it.materialId && l.status === 'activo').reduce((s, l) => s + l.quantityRemaining, 0)
      } else {
        available = mat?.stock || 0
      }
      return { name: mat?.name || '?', type: it.materialType, unit: it.unit, required: total, available, enough: available >= total }
    })
  }

  const required = calcRequired(batchSize)
  const hasShortage = required.some(r => !r.enough)

  async function produce() {
    if (!producing) return
    setError('')
    if (!batchSize || batchSize <= 0) { setError('Indica un tamaño de lote válido'); return }
    if (hasShortage) {
      setError('No hay stock suficiente para fabricar este lote. Revisa los ingredientes marcados en rojo.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<{ lotNumber: string; productionOrderNumber: string }>('/produce-with-lots', {
        productId: producing, quantity: batchSize, notes, machineId: machineId || undefined,
      })
      setSuccess(`¡Fabricación completada! Lote ${res.lotNumber} (${res.productionOrderNumber}) — ${formatNumber(batchSize, 0)} L`)
      setTimeout(() => setSuccess(''), 5000)
      setProducing(''); setBatchSize(1000); setNotes(''); setMachineId('')
      await refresh()
    } catch (e: any) {
      const shortages = e.data?.shortages
      if (shortages) {
        setError('Stock insuficiente: ' + shortages.map((s: any) => `${s.name} (${formatNumber(s.available)} / ${formatNumber(s.needed)})`).join(', '))
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Producción" subtitle="Fabrica productos: selecciona receta + tamaño del lote y el sistema calcula las cantidades exactas a usar." />

      {success && (
        <div className="card p-4 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <p className="text-sm text-emerald-800 dark:text-emerald-200">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Producido hoy" value={formatNumber(todayProduced) + ' L'} icon={Factory} tone="brand" hint="Volumen" />
        <StatCard label="Lotes totales" value={lots.length} icon={Factory} tone="violet" />
        <StatCard label="Productos activos" value={products.filter(p => p.active).length} icon={Beaker} tone="emerald" />
        <StatCard label="Máquinas operativas" value={machines.filter(m => m.status === 'operativa').length} icon={Cpu} tone="cyan" hint={`de ${machines.length} totales`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {products.filter(p => p.active).map(p => {
          const recipe = recipes.find(r => r.productId === p.id)
          const lowStock = p.stock < p.minStock
          return (
            <div key={p.id} className="card p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-surface-500">
                    {p.code}
                    {recipe && <> · Lote tipo: <strong>{formatNumber(recipe.batchSize || 1000, 0)} L</strong></>}
                  </p>
                </div>
                {lowStock && <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle className="w-3 h-3" /> Stock bajo</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="p-2 rounded bg-surface-50 dark:bg-surface-800/50"><p className="text-surface-500">Stock actual</p><p className={`font-semibold text-base ${lowStock ? 'text-red-600' : ''}`}>{formatNumber(p.stock)}</p></div>
                <div className="p-2 rounded bg-surface-50 dark:bg-surface-800/50"><p className="text-surface-500">Coste</p><p className="font-semibold text-base">{formatCurrency(p.cost)}</p></div>
              </div>
              <div className="flex gap-2">
                {recipe && <button onClick={() => setRecipeModal(p.id)} className="btn-secondary flex-1 text-xs">Ver receta</button>}
                <button onClick={() => { setProducing(p.id); setBatchSize(recipe?.batchSize || 1000) }} className="btn-primary flex-1 text-xs" disabled={!recipe}><Play className="w-3 h-3" /> Fabricar</button>
              </div>
            </div>
          )
        })}
      </div>

      {producing && selectedProduct && selectedRecipe && (
        <Modal open onClose={() => setProducing('')} title={`Fabricar ${selectedProduct.name}`} size="xl"
          footer={<><button onClick={() => setProducing('')} className="btn-secondary">Cancelar</button><button onClick={produce} disabled={loading || hasShortage} className="btn-primary"><Factory className="w-4 h-4" /> {loading ? 'Fabricando...' : 'Confirmar fabricación'}</button></>}
        >
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tamaño del lote a fabricar (L) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input"
                  value={batchSize}
                  onChange={e => setBatchSize(Number(e.target.value))}
                  style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                />
                <p className="text-[10px] text-surface-500 mt-1">La receta está definida para un lote de {formatNumber(selectedRecipe.batchSize || 1000, 0)} L. El sistema escalará las cantidades proporcionalmente.</p>
              </div>
              <div><label className="label">Máquina</label>
                <select
                  className="input"
                  value={machineId}
                  onChange={e => setMachineId(e.target.value)}
                  style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                >
                  <option value="">— Sin asignar —</option>
                  {machines.filter(m => m.status === 'operativa').map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label">Notas (opcional)</label>
                <input
                  className="input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Lote especial, cliente X..."
                  style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Insumos necesarios para {formatNumber(batchSize, 0)} L</p>
                <p className="text-xs text-surface-500">Receta base: {formatNumber(selectedRecipe.batchSize || 1000, 0)} L · Ratio: ×{formatNumber(batchSize / (selectedRecipe.batchSize || 1000), 3)}</p>
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto border border-surface-200 dark:border-surface-800 rounded-lg p-2">
                {required.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between p-2 rounded text-sm ${!r.enough ? 'bg-red-50 dark:bg-red-950/30' : 'bg-surface-50 dark:bg-surface-800/30'}`}>
                    <div className="flex items-center gap-2">
                      {r.type === 'raw' ? <Beaker className="w-3.5 h-3.5 text-cyan-600" /> : <Package className="w-3.5 h-3.5 text-violet-600" />}
                      <span className="truncate">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs tabular-nums">
                      <span className="font-semibold">{formatNumber(r.required, 3)} {r.unit}</span>
                      <span className="text-surface-500">Disp: {formatNumber(r.available, 2)} {r.unit}</span>
                      {r.enough ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-950/30 text-sm">
              <p>Operario: <strong>{user?.fullName}</strong> {machineId && `· Máquina: <strong>${machines.find(m => m.id === machineId)?.name}</strong>`} · Lote a fabricar: <strong>{formatNumber(batchSize, 0)} L</strong></p>
            </div>
          </div>
        </Modal>
      )}

      {recipeModal && (() => {
        const p = products.find(x => x.id === recipeModal)
        const r = recipes.find(x => x.productId === recipeModal)
        if (!p || !r) return null
        return (
          <Modal open onClose={() => setRecipeModal('')} title={`Receta: ${p.name}`} size="lg"
            footer={<button onClick={() => setRecipeModal('')} className="btn-secondary">Cerrar</button>}
          >
            <p className="text-sm text-surface-500 mb-3">Receta definida para un lote de <strong>{formatNumber(r.batchSize || 1000, 0)} L</strong>. Cantidades por lote completo:</p>
            <div className="space-y-1.5">
              {r.items.map((it, i) => {
                const mat = it.materialType === 'raw' ? rawMaterials.find(m => m.id === it.materialId) : packaging.find(m => m.id === it.materialId)
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-50 dark:bg-surface-800/50 text-sm">
                    <span className="flex items-center gap-2"><span className="text-xs text-surface-500 capitalize">{it.materialType === 'raw' ? 'Materia' : 'Embalaje'}</span> {mat?.name || '?'}</span>
                    <span className="font-mono tabular-nums">{formatNumber(it.quantity, 3)} {it.unit}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-surface-500 mt-3">Al fabricar otro tamaño de lote, las cantidades se multiplican por: (lote_a_fabricar / {formatNumber(r.batchSize || 1000, 0)})</p>
          </Modal>
        )
      })()}
    </div>
  )
}
