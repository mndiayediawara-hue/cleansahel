import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { formatCurrency, formatNumber, exportCSV } from '@/lib/utils'
import { Package, AlertTriangle, DollarSign, Plus, Download, Search, Truck } from 'lucide-react'
import type { Packaging } from '@/types'

const TYPES = [
  { value: 'botella', label: 'Botella' },
  { value: 'tapon', label: 'Tapón' },
  { value: 'pulverizador', label: 'Pulverizador' },
  { value: 'etiqueta', label: 'Etiqueta' },
  { value: 'caja', label: 'Caja' },
  { value: 'palet', label: 'Palet' },
  { value: 'film', label: 'Film' },
  { value: 'precinto', label: 'Precinto' },
]

const empty: any = { code: '', name: '', type: 'botella', size: '', stock: 0, minStock: 0, maxStock: 0, price: 0, location: '', supplierId: '' }

export default function PackagingPage() {
  const { packaging, suppliers, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [entryFor, setEntryFor] = useState<Packaging | null>(null)
  const [confirm, setConfirm] = useState<Packaging | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [lowOnly, setLowOnly] = useState(false)

  const filtered = packaging.filter(p =>
    (!typeFilter || p.type === typeFilter) &&
    (!lowOnly || p.stock < p.minStock) &&
    (!query || [p.code, p.name, p.location].some(v => String(v || '').toLowerCase().includes(query.toLowerCase())))
  )

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      if (editing.id) await api.put(`/packaging/${editing.id}`, editing)
      else await api.post('/packaging', editing)
      await refreshOne('packaging')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(p: Packaging) {
    try { await api.del(`/packaging/${p.id}`); await refreshOne('packaging') }
    catch (e: any) { alert(e.message) }
  }

  const totalValue = packaging.reduce((s, p) => s + p.stock * p.price, 0)
  const lowCount = packaging.filter(p => p.stock < p.minStock).length

  const columns = [
    { key: 'code', label: 'Código', sortable: true, render: (r: Packaging) => <span className="font-mono text-xs">{r.code}</span> },
    { key: 'name', label: 'Material', sortable: true, render: (r: Packaging) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-surface-500 capitalize">{r.type}{r.size ? ` · ${r.size}` : ''}</p>
        </div>
      )
    },
    { key: 'stock', label: 'Stock', sortable: true, align: 'right' as const, render: (r: Packaging) => {
        const low = r.stock < r.minStock
        return <div><p className={`font-semibold tabular-nums ${low ? 'text-red-600' : ''}`}>{formatNumber(r.stock, 0)}</p>{low && <p className="text-[10px] text-red-600">Mín: {r.minStock}</p>}</div>
      }
    },
    { key: 'price', label: 'Precio', align: 'right' as const, render: (r: Packaging) => <span className="tabular-nums">{formatCurrency(r.price)}</span> },
    { key: 'value', label: 'Valor', align: 'right' as const, render: (r: Packaging) => <span className="tabular-nums font-semibold">{formatCurrency(r.stock * r.price)}</span> },
    { key: 'supplier', label: 'Proveedor', render: (r: Packaging) => <span className="text-xs">{suppliers.find(s => s.id === r.supplierId)?.name || '-'}</span> },
    { key: 'location', label: 'Ubicación', render: (r: Packaging) => <span className="text-xs font-mono">{r.location}</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: Packaging) => (
        <div className="flex items-center justify-end gap-1">
          {can('packaging.write') && <button onClick={() => setEntryFor(r)} className="btn-ghost p-1.5" title="Entrada"><Truck className="w-3.5 h-3.5" /></button>}
          {can('packaging.write') && <button onClick={() => setEditing(r)} className="btn-ghost p-1.5 text-xs">Editar</button>}
          {can('packaging.write') && <button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600 text-xs">Borrar</button>}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Material de Embalaje" subtitle="Botellas, tapones, etiquetas, cajas, palets y más"
        actions={<>
          <button onClick={() => exportCSV('embalaje', filtered as any)} className="btn-secondary"><Download className="w-4 h-4" /> CSV</button>
          {can('packaging.write') && <button onClick={() => setEditing({ ...empty, code: `PK-${String(packaging.length + 1).padStart(3, '0')}` })} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo material</button>}
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total materiales" value={packaging.length} icon={Package} tone="brand" />
        <StatCard label="Valor total" value={formatCurrency(totalValue)} icon={DollarSign} tone="emerald" />
        <StatCard label="Stock bajo" value={lowCount} icon={AlertTriangle} tone={lowCount > 0 ? 'amber' : 'emerald'} hint={lowCount > 0 ? 'Atención' : 'OK'} />
        <StatCard label="Tipos" value={new Set(packaging.map(p => p.type)).size} icon={Package} tone="violet" />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar material..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input max-w-[200px]">
          <option value="">Todos los tipos</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="rounded" />
          <span>Solo stock bajo</span>
        </label>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} de {packaging.length}</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Package className="w-5 h-5" />} title="Sin materiales" description="Crea tu primer material de embalaje." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar material' : 'Nuevo material'} size="lg"
          footer={<>
            <button onClick={() => setEditing(null)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Código</label><input className="input" value={editing.code || ''} onChange={e => setEditing({ ...editing, code: e.target.value })} /></div>
            <div><label className="label">Nombre</label><input className="input" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label className="label">Tipo</label>
              <select className="input" value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className="label">Tamaño</label><input className="input" value={editing.size || ''} onChange={e => setEditing({ ...editing, size: e.target.value })} placeholder="250ml, 500ml, 1L..." /></div>
            <div><label className="label">Stock</label><input type="number" className="input" value={editing.stock || 0} onChange={e => setEditing({ ...editing, stock: Number(e.target.value) })} /></div>
            <div><label className="label">Stock mínimo</label><input type="number" className="input" value={editing.minStock || 0} onChange={e => setEditing({ ...editing, minStock: Number(e.target.value) })} /></div>
            <div><label className="label">Stock máximo</label><input type="number" className="input" value={editing.maxStock || 0} onChange={e => setEditing({ ...editing, maxStock: Number(e.target.value) })} /></div>
            <div><label className="label">Precio (€)</label><input type="number" step="0.0001" className="input" value={editing.price || 0} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
            <div><label className="label">Proveedor</label>
              <select className="input" value={editing.supplierId || ''} onChange={e => setEditing({ ...editing, supplierId: e.target.value })}>
                <option value="">— Sin proveedor —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Ubicación</label><input className="input" value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} /></div>
          </div>
        </Modal>
      )}

      {entryFor && <PkgEntryModal pkg={entryFor} onClose={() => setEntryFor(null)} onSaved={() => { setEntryFor(null); refreshOne('packaging') }} />}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} title="Confirmar borrado" message={`¿Eliminar "${confirm?.name}"?`} danger />
    </div>
  )
}

function PkgEntryModal({ pkg, onClose, onSaved }: { pkg: Packaging; onClose: () => void; onSaved: () => void }) {
  const [quantity, setQuantity] = useState(0)
  const [price, setPrice] = useState(pkg.price)
  const [invoice, setInvoice] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    if (quantity <= 0) return alert('Cantidad debe ser mayor a 0')
    setSaving(true)
    try {
      await api.post(`/packaging/${pkg.id}/entry`, { quantity, price, invoice })
      onSaved()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Entrada de ${pkg.name}`}
      footer={<><button onClick={onClose} className="btn-secondary">Cancelar</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? '...' : 'Registrar'}</button></>}
    >
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800 text-sm">Stock actual: <strong>{formatNumber(pkg.stock, 0)}</strong></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Cantidad</label><input type="number" className="input" value={quantity} onChange={e => setQuantity(Number(e.target.value))} autoFocus /></div>
          <div><label className="label">Precio unitario</label><input type="number" step="0.0001" className="input" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div className="col-span-2"><label className="label">Factura</label><input className="input" value={invoice} onChange={e => setInvoice(e.target.value)} /></div>
        </div>
      </div>
    </Modal>
  )
}
