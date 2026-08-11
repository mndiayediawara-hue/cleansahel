import { useState, useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Factory, Beaker, Package, AlertTriangle, CheckCircle2, Play, Cpu, Droplet, Box } from 'lucide-react'
import { formatNumber, formatCurrency } from '@/lib/utils'

// Formatos de botella predefinidos (en ml)
const BOTTLE_FORMATS = [
  { ml: 250, label: '250 ml' },
  { ml: 500, label: '500 ml' },
  { ml: 750, label: '750 ml' },
  { ml: 1000, label: '1 L' },
  { ml: 1500, label: '1,5 L' },
  { ml: 5000, label: '5 L (garrafa)' },
]

export default function Production() {
  const { products, recipes, rawMaterials, packaging, lots, rawMaterialLots, machines, refreshOne, refresh } = useData()
  const { user } = useAuth()
  const [producing, setProducing] = useState<string>('') // productId
  const [batchSize, setBatchSize] = useState(1000) // Tamaño del lote a fabricar (L)
  const [bottleFormat, setBottleFormat] = useState<number>(750) // Tamaño de botella elegido (ml)
  const [customBottle, setCustomBottle] = useState<number | ''>('') // Para formato personalizado
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

  // Total fabricado en litros
  const totalLitros = batchSize
  // Tamaño de botella efectivo (si hay custom, lo usa; si no, el seleccionado)
  const effectiveBottleMl = customBottle !== '' ? Number(customBottle) : bottleFormat
  // Cálculo de botellas: litros * 1000 / ml_por_botella
  const totalBottles = effectiveBottleMl > 0 ? Math.floor((totalLitros * 1000) / effectiveBottleMl) : 0

  // Tabla de comparación de botellas por formato
  const bottleComparison = useMemo(() => {
    return BOTTLE_FORMATS.map(f => ({
      ...f,
      bottles: Math.floor((totalLitros * 1000) / f.ml)
    }))
  }, [totalLitros])

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
      setSuccess(`¡Fabricación completada! Lote ${res.lotNumber} (${res.productionOrderNumber}) — ${formatNumber(batchSize, 0)} L · ${formatNumber(totalBottles, 0)} botellas de ${effectiveBottleMl}ml`)
      setTimeout(() => setSuccess(''), 6000)
      setProducing(''); setBatchSize(1000); setBottleFormat(750); setCustomBottle(''); setNotes(''); setMachineId('')
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
      <PageHeader title="Producción" subtitle="Fabrica productos: indica el lote a fabricar y el sistema calcula las materias primas + botellas a obtener." />

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

            {/* ==== TAMAÑO DEL LOTE ==== */}
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
                <p className="text-[10px] text-surface-500 mt-1">Receta base: {formatNumber(selectedRecipe.batchSize || 1000, 0)} L · Ratio: ×{formatNumber(batchSize / (selectedRecipe.batchSize || 1000), 3)}</p>
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

            {/* ==== RESUMEN: TOTAL FABRICADO + BOTELLAS ==== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="card p-4 bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800">
                <div className="flex items-center gap-2 mb-1">
                  <Droplet className="w-4 h-4 text-brand-600" />
                  <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wide">Total a fabricar</p>
                </div>
                <p className="text-3xl font-bold text-brand-900 dark:text-brand-100 tabular-nums">{formatNumber(totalLitros, 0)} <span className="text-lg">L</span></p>
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">Volumen total del lote de fabricación</p>
              </div>

              <div className="card p-4 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-1">
                  <Box className="w-4 h-4 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Botellas a obtener</p>
                </div>
                <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">{formatNumber(totalBottles, 0)} <span className="text-lg">ud</span></p>
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">En formato de {effectiveBottleMl} ml por botella</p>
              </div>
            </div>

            {/* ==== SELECTOR DE FORMATO DE BOTELLA ==== */}
            <div className="card p-4">
              <p className="text-sm font-semibold mb-3">Formato de botella</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {BOTTLE_FORMATS.map(f => (
                  <button
                    key={f.ml}
                    type="button"
                    onClick={() => { setBottleFormat(f.ml); setCustomBottle('') }}
                    className={`p-2 rounded-lg border text-sm font-medium transition ${
                      bottleFormat === f.ml && customBottle === ''
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white dark:bg-surface-800 border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-brand-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs text-surface-600 dark:text-surface-400">Personalizado (ml):</label>
                <input
                  type="number"
                  min="1"
                  className="input flex-1 max-w-[120px]"
                  value={customBottle}
                  onChange={e => setCustomBottle(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="ej: 330"
                  style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                />
              </div>
            </div>

            {/* ==== TABLA COMPARATIVA DE BOTELLAS POR FORMATO ==== */}
            <div className="card p-4">
              <p className="text-sm font-semibold mb-2">Comparativa de botellas según formato</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-surface-500 border-b border-surface-200 dark:border-surface-700">
                      <th className="py-2 pr-2">Formato</th>
                      <th className="py-2 pr-2 text-right">Botellas completas</th>
                      <th className="py-2 pr-2 text-right">Capacidad total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottleComparison.map(f => {
                      const isSelected = (customBottle !== '' ? Number(customBottle) : bottleFormat) === f.ml
                      return (
                        <tr
                          key={f.ml}
                          onClick={() => { setBottleFormat(f.ml); setCustomBottle('') }}
                          className={`border-b border-surface-100 dark:border-surface-800 cursor-pointer ${
                            isSelected ? 'bg-brand-50 dark:bg-brand-950/30' : 'hover:bg-surface-50 dark:hover:bg-surface-800/30'
                          }`}
                        >
                          <td className="py-2 pr-2 font-medium">{f.label}{isSelected && <span className="ml-2 badge bg-brand-600 text-white text-[10px]">✓</span>}</td>
                          <td className="py-2 pr-2 text-right tabular-nums font-semibold">{formatNumber(f.bottles, 0)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-surface-500">{formatNumber((f.bottles * f.ml) / 1000, 2)} L</td>
                        </tr>
                      )
                    })}
                    {customBottle !== '' && Number(customBottle) > 0 && !BOTTLE_FORMATS.find(f => f.ml === Number(customBottle)) && (
                      <tr className="border-b border-surface-100 dark:border-surface-800 bg-brand-50 dark:bg-brand-950/30">
                        <td className="py-2 pr-2 font-medium">{customBottle} ml (personalizado) <span className="ml-2 badge bg-brand-600 text-white text-[10px]">✓</span></td>
                        <td className="py-2 pr-2 text-right tabular-nums font-semibold">{formatNumber(Math.floor((totalLitros * 1000) / Number(customBottle)), 0)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-surface-500">{formatNumber((Math.floor((totalLitros * 1000) / Number(customBottle)) * Number(customBottle)) / 1000, 2)} L</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-surface-500 mt-2">Cálculo: {formatNumber(totalLitros, 0)} L ÷ {effectiveBottleMl} ml × 1000 = {formatNumber(totalBottles, 0)} botellas completas (se descartan los restos)</p>
            </div>

            {/* ==== INGREDIENTES NECESARIOS ==== */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Materias primas necesarias para fabricar {formatNumber(batchSize, 0)} L</p>
                <p className="text-xs text-surface-500">Receta: {formatNumber(selectedRecipe.batchSize || 1000, 0)} L × {formatNumber(batchSize / (selectedRecipe.batchSize || 1000), 3)}</p>
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

            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 text-sm">
              <p>Operario: <strong>{user?.fullName}</strong> {machineId && `· Máquina: <strong>${machines.find(m => m.id === machineId)?.name}</strong>`} · Lote: <strong>{formatNumber(batchSize, 0)} L</strong> · Botellas: <strong>{formatNumber(totalBottles, 0)} ud de {effectiveBottleMl} ml</strong></p>
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
