
import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { ShoppingBag, DollarSign, Plus, Search, Truck, FileText, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, exportCSV } from '@/lib/utils'
import type { Purchase } from '@/types'

const empty: any = { supplierId: '', invoice: '', items: [], status: 'recibida', date: new Date().toISOString().slice(0, 10), notes: '' }

export default function Purchases() {
  const { purchases, suppliers, rawMaterials, packaging, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [confirm, setConfirm] = useState<Purchase | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = purchases.filter(p => !query || [p.number, p.invoice, suppliers.find(s => s.id === p.supplierId)?.name].some(v => String(v || '').toLowerCase().includes(query.toLowerCase())))

  const total = purchases.reduce((s, p) => s + p.total, 0)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const monthTotal = purchases.filter(p => new Date(p.date) >= monthStart).reduce((s, p) => s + p.total, 0)

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const items = editing.items || []
      // Auto-crear proveedor si escribimos un nombre que no existe
      let supplierId = editing.supplierId || ''
      let supplierName = editing.supplierName || ''
      if (supplierName && !supplierId) {
        const match = suppliers.find((s: any) => s.name.toLowerCase() === supplierName.toLowerCase())
        if (match) { supplierId = match.id; supplierName = match.name }
        else {
          try {
            const newS = await api.post('/suppliers', { name: supplierName, country: 'España' })
            supplierId = (newS as any).id
            supplierName = (newS as any).name
            await refreshOne('suppliers')
          } catch {}
        }
      } else if (supplierId && !supplierName) {
        const s = suppliers.find((x: any) => x.id === supplierId)
        if (s) supplierName = s.name
      }
      const subtotal = items.reduce((s: number, it: any) => s + (it.unitPrice || 0) * (it.quantity || 0), 0)
      const tax = subtotal * 0.21
      const total = subtotal + tax
      const payload = { ...editing, supplierId, supplierName, subtotal, tax, total }
      if (editing.id) await api.put(`/purchases/${editing.id}`, payload)
      else await api.post('/purchases', payload)
      await refreshOne('purchases')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(p: Purchase) {
    try { await api.del(`/purchases/${p.id}`); await refreshOne('purchases') }
    catch (e: any) { alert(e.message) }
  }

  const columns = [
    { key: 'number', label: 'Número', sortable: true, render: (r: Purchase) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'date', label: 'Fecha', sortable: true, render: (r: Purchase) => <span className="text-xs">{formatDate(r.date)}</span> },
    { key: 'supplier', label: 'Proveedor', render: (r: Purchase) => suppliers.find(s => s.id === r.supplierId)?.name || '-' },
    { key: 'invoice', label: 'Factura', render: (r: Purchase) => <span className="font-mono text-xs">{r.invoice || '-'}</span> },
    { key: 'items', label: 'Items', align: 'right' as const, render: (r: Purchase) => <span className="tabular-nums">{r.items.length}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: Purchase) => <span className="font-semibold tabular-nums">{formatCurrency(r.total)}</span> },
    { key: 'status', label: 'Estado', render: (r: Purchase) => <span className={`badge ${r.status === 'recibida' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : r.status === 'cancelada' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{r.status}</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: Purchase) => can('purchases.write') ? (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setEditing(r)} className="btn-ghost p-1.5 text-xs">Ver</button>
          {can('admin') && <button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600 text-xs">Borrar</button>}
        </div>
      ) : null
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Compras" subtitle="Registro de compras a proveedores con actualización automática de inventario"
        actions={<>
          <button onClick={() => exportCSV('compras', filtered as any)} className="btn-secondary">CSV</button>
          {can('purchases.write') && <button onClick={() => setEditing({ ...empty, supplierId: suppliers[0]?.id || '', supplierName: suppliers[0]?.name || '', items: [{ materialType: 'raw', materialId: rawMaterials[0]?.id || '', materialName: rawMaterials[0]?.name || '', quantity: 1, unitPrice: rawMaterials[0]?.price || 0 }] })} className="btn-primary"><Plus className="w-4 h-4" /> Nueva compra</button>}
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total compras" value={purchases.length} icon={ShoppingBag} tone="brand" />
        <StatCard label="Volumen total" value={formatCurrency(total)} icon={DollarSign} tone="emerald" />
        <StatCard label="Volumen mes" value={formatCurrency(monthTotal)} icon={ShoppingBag} tone="violet" />
        <StatCard label="Proveedores" value={suppliers.length} icon={Truck} tone="cyan" />
      </div>

      <div className="card p-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por número, factura o proveedor..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} compras</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="w-5 h-5" />} title="Sin compras" description="Registra la primera compra." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {editing && <PurchaseForm editing={editing} setEditing={setEditing} onClose={() => setEditing(null)} onSave={save} saving={saving} suppliers={suppliers} rawMaterials={rawMaterials} packaging={packaging} />}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} title="Borrar compra" message={`¿Eliminar la compra ${confirm?.number}?`} danger />
    </div>
  )
}

function PurchaseForm({ editing, setEditing, onClose, onSave, saving, suppliers, rawMaterials, packaging }: any) {
  function addItem() {
    setEditing({ ...editing, items: [...(editing.items || []), { materialType: 'raw', materialId: rawMaterials[0]?.id || '', materialName: rawMaterials[0]?.name || '', quantity: 1, unitPrice: rawMaterials[0]?.price || 0 }] })
  }
  function updateItem(i: number, key: string, value: any) {
    const items = [...editing.items]
    items[i] = { ...items[i], [key]: value }
    setEditing({ ...editing, items })
  }
  function removeItem(i: number) {
    const items = [...editing.items]
    items.splice(i, 1)
    setEditing({ ...editing, items })
  }
  const subtotal = (editing.items || []).reduce((s: number, it: any) => s + it.unitPrice * it.quantity, 0)
  const tax = subtotal * 0.21
  const total = subtotal + tax

  return (
    <Modal open onClose={onClose} title={editing.id ? `Compra ${editing.number}` : 'Nueva compra'} size="xl"
      footer={<><button onClick={onClose} className="btn-secondary">Cancelar</button><button onClick={onSave} disabled={saving} className="btn-primary">{saving ? '...' : 'Guardar'}</button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Proveedor</label>
            <input className="input" list="purchases-suppliers-list" value={editing.supplierName || ''} onChange={e => {
              const v = e.target.value
              const match = suppliers.find((s: any) => s.name.toLowerCase() === v.toLowerCase())
              setEditing({ ...editing, supplierName: v, supplierId: match?.id || '' })
            }} placeholder="Selecciona o escribe" />
            <datalist id="purchases-suppliers-list">
              {suppliers.map((s: any) => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>
          <div><label className="label">Factura</label><input className="input" value={editing.invoice || ''} onChange={e => setEditing({ ...editing, invoice: e.target.value })} /></div>
          <div><label className="label">Fecha</label><input type="date" className="input" value={editing.date?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, date: e.target.value })} /></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Líneas</p>
            <button onClick={addItem} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Añadir</button>
          </div>
          <div className="space-y-1.5">
            {(editing.items || []).map((it: any, i: number) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                <select className="input col-span-2" value={it.materialType} onChange={e => updateItem(i, 'materialType', e.target.value)}>
                  <option value="raw">Materia prima</option>
                  <option value="packaging">Embalaje</option>
                </select>
                <input className="input col-span-6" list={`purchases-materials-${i}`} value={it.materialName || ''} onChange={e => {
                  const v = e.target.value
                  const list = it.materialType === 'raw' ? rawMaterials : packaging
                  const match = list.find((m: any) => m.name.toLowerCase() === v.toLowerCase())
                  updateItem(i, 'materialName', v)
                  updateItem(i, 'materialId', match?.id || '')
                  if (match) updateItem(i, 'unitPrice', match.price || 0)
                }} placeholder="Escribe o selecciona material" />
                <datalist id={`purchases-materials-${i}`}>
                  {(it.materialType === 'raw' ? rawMaterials : packaging).map((m: any) => <option key={m.id} value={m.name} />)}
                </datalist>
                <input type="number" step="0.01" className="input col-span-2" value={it.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                <input type="number" step="0.01" className="input col-span-1" value={it.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} />
                <button onClick={() => removeItem(i)} className="btn-ghost p-1.5 text-red-600 col-span-1 justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal:</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between"><span>IVA 21%:</span><span className="tabular-nums">{formatCurrency(tax)}</span></div>
          <div className="flex justify-between pt-2 border-t border-surface-200 dark:border-surface-700 text-base font-bold"><span>TOTAL:</span><span className="tabular-nums text-brand-600">{formatCurrency(total)}</span></div>
        </div>
      </div>
    </Modal>
  )
}