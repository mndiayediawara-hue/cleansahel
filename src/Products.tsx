import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Boxes, AlertTriangle, DollarSign, Plus, Search, TrendingUp } from 'lucide-react'
import { formatCurrency, formatNumber, exportCSV } from '@/lib/utils'
import type { Product } from '@/types'

const empty: any = { code: '', name: '', description: '', category: 'Multiusos', bottleSize: 750, stock: 0, minStock: 0, maxStock: 0, price: 0, cost: 0, recipeId: '', active: true }

export default function Products() {
  const { products, recipes, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [confirm, setConfirm] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = products.filter(p => !query || [p.code, p.name, p.category].some(v => String(v || '').toLowerCase().includes(query.toLowerCase())))

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const payload = { ...editing }
      if (editing.id) await api.put(`/products/${editing.id}`, payload)
      else await api.post('/products', payload)
      await refreshOne('products')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(p: Product) {
    try { await api.del(`/products/${p.id}`); await refreshOne('products') }
    catch (e: any) { alert(e.message) }
  }

  const totalValue = products.reduce((s, p) => s + p.stock * p.price, 0)
  const lowCount = products.filter(p => p.stock < p.minStock).length

  const columns = [
    { key: 'code', label: 'Código', sortable: true, render: (r: Product) => <span className="font-mono text-xs">{r.code}</span> },
    { key: 'name', label: 'Producto', sortable: true, render: (r: Product) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-surface-500">{r.category} · {r.bottleSize}ml</p>
        </div>
      )
    },
    { key: 'stock', label: 'Stock', sortable: true, align: 'right' as const, render: (r: Product) => {
        const low = r.stock < r.minStock
        return <div><p className={`font-semibold tabular-nums ${low ? 'text-red-600' : ''}`}>{formatNumber(r.stock)}</p>{low && <p className="text-[10px] text-red-600">Mín: {r.minStock}</p>}</div>
      }
    },
    { key: 'price', label: 'Precio venta', align: 'right' as const, sortable: true, render: (r: Product) => <span className="tabular-nums">{formatCurrency(r.price)}</span> },
    { key: 'cost', label: 'Coste', align: 'right' as const, render: (r: Product) => <span className="tabular-nums text-surface-500">{formatCurrency(r.cost)}</span> },
    { key: 'margin', label: 'Margen', align: 'right' as const, render: (r: Product) => {
        const m = r.price > 0 ? ((r.price - r.cost) / r.price) * 100 : 0
        return <span className={`tabular-nums font-semibold ${m > 50 ? 'text-emerald-600' : m > 25 ? 'text-amber-600' : 'text-red-600'}`}>{m.toFixed(1)}%</span>
      }
    },
    { key: 'value', label: 'Valor', align: 'right' as const, render: (r: Product) => <span className="tabular-nums font-semibold">{formatCurrency(r.stock * r.price)}</span> },
    { key: 'active', label: 'Estado', render: (r: Product) => r.active ? <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Activo</span> : <span className="badge bg-surface-100 text-surface-600">Inactivo</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: Product) => can('admin') ? (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setEditing(r)} className="btn-ghost p-1.5 text-xs">Editar</button>
          <button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600 text-xs">Borrar</button>
        </div>
      ) : null
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Productos Terminados" subtitle="Catálogo de productos fabricados y vendidos"
        actions={<>
          <button onClick={() => exportCSV('productos', filtered as any)} className="btn-secondary">CSV</button>
          {can('admin') && <button onClick={() => setEditing({ ...empty, code: `P-${String(products.length + 1).padStart(3, '0')}` })} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo producto</button>}
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total productos" value={products.length} icon={Boxes} tone="brand" />
        <StatCard label="Activos" value={products.filter(p => p.active).length} icon={Boxes} tone="emerald" />
        <StatCard label="Stock bajo" value={lowCount} icon={AlertTriangle} tone={lowCount > 0 ? 'amber' : 'emerald'} />
        <StatCard label="Valor stock" value={formatCurrency(totalValue)} icon={DollarSign} tone="violet" />
      </div>

      <div className="card p-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar producto..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} productos</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Boxes className="w-5 h-5" />} title="Sin productos" description="Crea tu primer producto." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar producto' : 'Nuevo producto'} size="lg"
          footer={<><button onClick={() => setEditing(null)} className="btn-secondary">Cancelar</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? '...' : 'Guardar'}</button></>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Código</label><input className="input" value={editing.code || ''} onChange={e => setEditing({ ...editing, code: e.target.value })} /></div>
            <div><label className="label">Nombre</label><input className="input" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Descripción</label><input className="input" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><label className="label">Categoría</label><input className="input" value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
            <div><label className="label">Tamaño botella (ml)</label><input type="number" className="input" value={editing.bottleSize || 0} onChange={e => setEditing({ ...editing, bottleSize: Number(e.target.value) })} /></div>
            <div><label className="label">Stock</label><input type="number" className="input" value={editing.stock || 0} onChange={e => setEditing({ ...editing, stock: Number(e.target.value) })} /></div>
            <div><label className="label">Stock mínimo</label><input type="number" className="input" value={editing.minStock || 0} onChange={e => setEditing({ ...editing, minStock: Number(e.target.value) })} /></div>
            <div><label className="label">Stock máximo</label><input type="number" className="input" value={editing.maxStock || 0} onChange={e => setEditing({ ...editing, maxStock: Number(e.target.value) })} /></div>
            <div><label className="label">Precio venta (€)</label><input type="number" step="0.01" className="input" value={editing.price || 0} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
            <div><label className="label">Coste (€)</label><input type="number" step="0.01" className="input" value={editing.cost || 0} onChange={e => setEditing({ ...editing, cost: Number(e.target.value) })} /></div>
            <div><label className="label">Receta</label>
              <select className="input" value={editing.recipeId || ''} onChange={e => setEditing({ ...editing, recipeId: e.target.value })}>
                <option value="">— Sin receta —</option>
                {recipes.map(r => { const p = products.find(p => p.id === r.productId); return <option key={r.id} value={r.id}>{p?.name || r.id}</option> })}
              </select>
            </div>
            <div className="flex items-center gap-2 col-span-2 pt-2"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} /><label className="text-sm">Producto activo</label></div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} title="Borrar producto" message={`¿Eliminar "${confirm?.name}"?`} danger />
    </div>
  )
}
