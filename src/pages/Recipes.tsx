import { useState, useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ChefHat, Plus, Edit2, Trash2, Beaker, Package } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type { Recipe } from '@/types'

const empty: any = {
  productId: '', productName: '',
  batchSize: 1000,  // Tamaño del lote de fabricación (litros)
  items: []
}

export default function Recipes() {
  const { recipes, products, rawMaterials, packaging, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [confirm, setConfirm] = useState<Recipe | null>(null)

  const recipesWithProducts = recipes.map(r => ({ ...r, product: products.find(p => p.id === r.productId) }))
  const productIdsWithRecipe = new Set(recipes.map(r => r.productId))
  const productsWithout = products.filter(p => !productIdsWithRecipe.has(p.id))

  function openNew() {
    setEditing({ ...empty, productId: productsWithout[0]?.id || '', productName: productsWithout[0]?.name || '' })
  }
  function openExisting(r: Recipe) {
    setEditing({ ...r, items: [...(r.items || [])] })
  }

  async function save() {
    if (!editing.productName?.trim() && !editing.productId) return alert('Selecciona un producto')
    if (!editing.batchSize || editing.batchSize <= 0) return alert('Indica el tamaño del lote de fabricación (en litros)')
    if (!editing.items.length) return alert('Añade al menos un ingrediente')
    try {
      // Auto-crear producto si escribimos uno nuevo
      let productId = editing.productId
      if (!editing.id && editing.productName && !productId) {
        let match = products.find((p: any) => p.name.toLowerCase() === editing.productName.toLowerCase())
        if (match) productId = match.id
        else {
          try {
            const newP = await api.post('/products', { name: editing.productName, code: 'P-' + Date.now().toString().slice(-6), active: true, unit: 'unidad', price: 0 })
            productId = (newP as any).id
            await refreshOne('products')
          } catch (e: any) { return alert('No se pudo crear el producto: ' + e.message) }
        }
      }
      // Auto-crear materiales en las líneas si fueron escritos a mano
      const items = [...(editing.items || [])]
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.materialName && !it.materialId) {
          const list = it.materialType === 'raw' ? rawMaterials : packaging
          let match = list.find((m: any) => m.name.toLowerCase() === it.materialName.toLowerCase())
          if (match) it.materialId = match.id
          else {
            const endpoint = it.materialType === 'raw' ? '/raw-materials' : '/packaging'
            try {
              const newM = await api.post(endpoint, { name: it.materialName, code: (it.materialType === 'raw' ? 'RM-' : 'PK-') + Date.now().toString().slice(-6) + '-' + i, unit: it.unit || 'L', stock: 0, price: 0, active: true })
              it.materialId = (newM as any).id
              await refreshOne(it.materialType === 'raw' ? 'rawMaterials' : 'packaging')
            } catch {}
          }
        }
      }
      const payload = {
        ...editing,
        productId,
        items,
        // Mantener campos legacy con valores neutros para no romper el backend
        bottleSize: 0, bottlesPerBox: 0, boxesPerPallet: 0, yieldPerLiter: 0,
        batchSize: Number(editing.batchSize) || 1000
      }
      if (editing.id) await api.put(`/recipes/${editing.id}`, payload)
      else await api.post('/recipes', payload)
      await refreshOne('recipes')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
  }

  async function remove(r: Recipe) {
    try { await api.del(`/recipes/${r.id}`); await refreshOne('recipes') }
    catch (e: any) { alert(e.message) }
  }

  function addItem() {
    setEditing({ ...editing, items: [...(editing.items || []), { materialId: '', materialType: 'raw', quantity: 0, unit: 'L' }] })
  }

  function updateItem(idx: number, key: string, value: any) {
    const items = [...(editing.items || [])]
    items[idx] = { ...items[idx], [key]: value }
    setEditing({ ...editing, items })
  }

  function removeItem(idx: number) {
    const items = [...(editing.items || [])]
    items.splice(idx, 1)
    setEditing({ ...editing, items })
  }

  // Pre-cálculo de cantidades por unidad de volumen (para mostrar info útil)
  const batch = Number(editing?.batchSize) || 0

  return (
    <div className="space-y-4">
      <PageHeader title="Recetas de Fabricación" subtitle="Define la fórmula de cada producto por lote de fabricación (en litros). El sistema calcula automáticamente las cantidades al producir."
        actions={can('recipes.write') && <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> Nueva receta</button>}
      />

      {recipesWithProducts.length === 0 ? (
        <EmptyState icon={<ChefHat className="w-5 h-5" />} title="Sin recetas" description="Crea la primera receta para empezar a fabricar productos." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recipesWithProducts.map((r) => (
            <div key={r.id} className="card p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{r.product?.name || 'Producto'}</h3>
                  <p className="text-xs text-surface-500">{r.product?.code} · Lote tipo: <strong>{formatNumber(r.batchSize || 1000, 0)} L</strong></p>
                </div>
                {can('recipes.write') && (
                  <div className="flex gap-1">
                    <button onClick={() => openExisting(r)} className="btn-ghost p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                    {can('produccion') && <button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {r.items.map((it: any, i) => {
                  const mat = it.materialType === 'raw' ? rawMaterials.find(m => m.id === it.materialId) : packaging.find(p => p.id === it.materialId)
                  return (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {it.materialType === 'raw' ? <Beaker className="w-3.5 h-3.5 text-cyan-600 shrink-0" /> : <Package className="w-3.5 h-3.5 text-violet-600 shrink-0" />}
                        <span className="truncate">{mat?.name || 'Material'}</span>
                      </div>
                      <span className="font-mono text-xs tabular-nums shrink-0">{formatNumber(it.quantity, 3)} {it.unit}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar receta' : 'Nueva receta'} size="xl"
          footer={<><button onClick={() => setEditing(null)} className="btn-secondary">Cancelar</button><button onClick={save} className="btn-primary">Guardar receta</button></>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Producto</label>
                <input
                  className="input"
                  list="recipes-products-list"
                  value={editing.productName || ''}
                  onChange={e => {
                    const v = e.target.value
                    const list = editing.id ? products.filter(p => p.id === editing.productId) : productsWithout
                    const match = list.find((p: any) => p.name.toLowerCase() === v.toLowerCase())
                    setEditing({ ...editing, productName: v, productId: match?.id || '' })
                  }}
                  placeholder="Selecciona o escribe un producto"
                  disabled={!!editing.id}
                  style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                />
                <datalist id="recipes-products-list">
                  {(editing.id ? products.filter(p => p.id === editing.productId) : productsWithout).map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                {editing.id && <p className="text-[10px] text-surface-500 mt-1">El producto no se puede cambiar en recetas existentes</p>}
              </div>
              <div>
                <label className="label">Tamaño del lote de fabricación (L) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input"
                  value={editing.batchSize || 0}
                  onChange={e => setEditing({ ...editing, batchSize: Number(e.target.value) })}
                  placeholder="1000"
                  style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                />
                <p className="text-[10px] text-surface-500 mt-1">Litros del lote que produce esta receta (ej: 500, 1000, 10000)</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">Ingredientes (para todo el lote de {formatNumber(batch, 0)} L)</p>
                  <p className="text-[11px] text-surface-500">Introduce la cantidad TOTAL necesaria para fabricar el lote completo</p>
                </div>
                <button onClick={addItem} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Añadir</button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(editing.items || []).map((it: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                    <select
                      className="input col-span-2"
                      value={it.materialType}
                      onChange={e => updateItem(i, 'materialType', e.target.value)}
                      style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                    >
                      <option value="raw">Materia prima</option>
                      <option value="packaging">Embalaje</option>
                    </select>
                    <div className="col-span-5 relative">
                      <input
                        className="input"
                        list={`recipes-materials-${i}`}
                        value={it.materialName || ''}
                        onChange={e => {
                          const v = e.target.value
                          const list = it.materialType === 'raw' ? rawMaterials : packaging
                          const match = list.find((m: any) => m.name.toLowerCase() === v.toLowerCase())
                          updateItem(i, 'materialName', v)
                          updateItem(i, 'materialId', match?.id || '')
                        }}
                        placeholder="Escribe o selecciona material"
                        autoComplete="off"
                        style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                      />
                      <datalist id={`recipes-materials-${i}`}>
                        {(it.materialType === 'raw' ? rawMaterials : packaging).map(m => <option key={m.id} value={m.name} />)}
                      </datalist>
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      className="input col-span-2"
                      placeholder="Cantidad"
                      value={it.quantity || 0}
                      onChange={e => updateItem(i, 'quantity', Number(e.target.value))}
                      style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                    <select
                      className="input col-span-2"
                      value={it.unit}
                      onChange={e => updateItem(i, 'unit', e.target.value)}
                      style={{ color: '#0f172a', WebkitTextFillColor: '#0f172a', backgroundColor: '#ffffff' }}
                    >
                      {['L','ml','kg','g','ud'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button onClick={() => removeItem(i)} className="btn-ghost p-1.5 text-red-600 col-span-1 justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-950/30 text-xs text-surface-600 dark:text-surface-400">
              <p><strong>Ejemplo:</strong> si indicas lote de <strong>1000 L</strong> y necesitas 400 L de agua, al fabricar 5000 L el sistema calculará automáticamente: 400 × (5000/1000) = <strong>2000 L de agua</strong>.</p>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} title="Borrar receta" message="¿Eliminar la receta seleccionada?" danger />
    </div>
  )
}
