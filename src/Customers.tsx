import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Users, DollarSign, Plus, Search, Mail, Phone, MapPin, Building2 } from 'lucide-react'
import { formatCurrency, exportCSV } from '@/lib/utils'
import type { Customer } from '@/types'

const empty: any = { name: '', company: '', cif: '', address: '', city: '', country: 'España', phone: '', email: '', contact: '', notes: '' }

export default function Customers() {
  const { customers, orders, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [confirm, setConfirm] = useState<Customer | null>(null)
  const [viewing, setViewing] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = customers.filter(c => !query || [c.name, c.company, c.cif, c.email, c.city].some(v => String(v || '').toLowerCase().includes(query.toLowerCase())))

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      if (editing.id) await api.put(`/customers/${editing.id}`, editing)
      else await api.post('/customers', editing)
      await refreshOne('customers')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(c: Customer) {
    try { await api.del(`/customers/${c.id}`); await refreshOne('customers') }
    catch (e: any) { alert(e.message) }
  }

  const totalSales = customers.reduce((s, c) => s + c.totalPurchases, 0)

  const columns = [
    { key: 'code', label: 'Código', sortable: true, render: (r: Customer) => <span className="font-mono text-xs">{r.code}</span> },
    { key: 'name', label: 'Cliente', sortable: true, render: (r: Customer) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-surface-500">{r.company}</p>
        </div>
      )
    },
    { key: 'cif', label: 'CIF/NIF', render: (r: Customer) => <span className="font-mono text-xs">{r.cif || '-'}</span> },
    { key: 'contact', label: 'Contacto', render: (r: Customer) => <div className="text-xs"><p>{r.contact || '-'}</p><p className="text-surface-500">{r.email}</p></div> },
    { key: 'city', label: 'Ciudad', render: (r: Customer) => <span className="text-xs">{r.city}, {r.country}</span> },
    { key: 'orders', label: 'Pedidos', align: 'right' as const, render: (r: Customer) => <span className="tabular-nums">{orders.filter(o => o.customerId === r.id).length}</span> },
    { key: 'totalPurchases', label: 'Total comprado', align: 'right' as const, sortable: true, render: (r: Customer) => <span className="tabular-nums font-semibold">{formatCurrency(r.totalPurchases)}</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: Customer) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setViewing(r)} className="btn-ghost p-1.5 text-xs">Ver</button>
          {can('customers.write') && <button onClick={() => setEditing(r)} className="btn-ghost p-1.5 text-xs">Editar</button>}
          {can('admin') && <button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600 text-xs">Borrar</button>}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Clientes" subtitle="Base de datos de clientes con historial de compras"
        actions={<>
          <button onClick={() => exportCSV('clientes', filtered as any)} className="btn-secondary">CSV</button>
          {can('customers.write') && <button onClick={() => setEditing({ ...empty })} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo cliente</button>}
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total clientes" value={customers.length} icon={Users} tone="brand" />
        <StatCard label="Con pedidos" value={customers.filter(c => orders.some(o => o.customerId === c.id)).length} icon={Users} tone="emerald" />
        <StatCard label="Volumen total" value={formatCurrency(totalSales)} icon={DollarSign} tone="violet" />
        <StatCard label="Ticket medio" value={formatCurrency(customers.length ? totalSales / customers.length : 0)} icon={DollarSign} tone="cyan" />
      </div>

      <div className="card p-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, CIF, email..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} clientes</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="w-5 h-5" />} title="Sin clientes" description="Añade tu primer cliente." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar cliente' : 'Nuevo cliente'} size="lg"
          footer={<><button onClick={() => setEditing(null)} className="btn-secondary">Cancelar</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? '...' : 'Guardar'}</button></>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombre</label><input className="input" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label className="label">Empresa</label><input className="input" value={editing.company || ''} onChange={e => setEditing({ ...editing, company: e.target.value })} /></div>
            <div><label className="label">CIF/NIF</label><input className="input" value={editing.cif || ''} onChange={e => setEditing({ ...editing, cif: e.target.value })} /></div>
            <div><label className="label">Persona de contacto</label><input className="input" value={editing.contact || ''} onChange={e => setEditing({ ...editing, contact: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Dirección</label><input className="input" value={editing.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></div>
            <div><label className="label">Ciudad</label><input className="input" value={editing.city || ''} onChange={e => setEditing({ ...editing, city: e.target.value })} /></div>
            <div><label className="label">País</label><input className="input" value={editing.country || ''} onChange={e => setEditing({ ...editing, country: e.target.value })} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Notas / observaciones</label><textarea className="input min-h-[60px]" value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.name} size="lg"
          footer={<button onClick={() => setViewing(null)} className="btn-secondary">Cerrar</button>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                <p className="text-xs text-surface-500">Empresa</p>
                <p className="font-semibold">{viewing.company || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                <p className="text-xs text-surface-500">CIF</p>
                <p className="font-mono">{viewing.cif || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 flex items-start gap-2">
                <Mail className="w-4 h-4 text-surface-500 mt-0.5" />
                <div><p className="text-xs text-surface-500">Email</p><p className="text-sm">{viewing.email || '-'}</p></div>
              </div>
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 flex items-start gap-2">
                <Phone className="w-4 h-4 text-surface-500 mt-0.5" />
                <div><p className="text-xs text-surface-500">Teléfono</p><p className="text-sm">{viewing.phone || '-'}</p></div>
              </div>
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 col-span-2 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-surface-500 mt-0.5" />
                <div><p className="text-xs text-surface-500">Dirección</p><p className="text-sm">{viewing.address || '-'}, {viewing.city || ''} {viewing.country || ''}</p></div>
              </div>
              {viewing.notes && <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 col-span-2 text-sm">{viewing.notes}</div>}
            </div>

            <div>
              <p className="font-semibold mb-2">Historial de pedidos</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {orders.filter(o => o.customerId === viewing.id).map(o => (
                  <div key={o.id} className="flex items-center justify-between p-2 rounded bg-surface-50 dark:bg-surface-800/50 text-sm">
                    <div><p className="font-mono text-xs">{o.number}</p><p className="text-xs text-surface-500 capitalize">{o.status}</p></div>
                    <span className="font-semibold tabular-nums">{formatCurrency(o.total)}</span>
                  </div>
                ))}
                {orders.filter(o => o.customerId === viewing.id).length === 0 && <p className="text-sm text-surface-500 text-center py-4">Sin pedidos</p>}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} title="Borrar cliente" message={`¿Eliminar a "${confirm?.name}"?`} danger />
    </div>
  )
}
