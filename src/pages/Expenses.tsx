
import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Receipt, Plus, Search, Zap, Droplet, Flame, Wifi, Fuel, Home, Users, Megaphone, Calculator, Wrench, FileText, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, exportCSV } from '@/lib/utils'
import type { Expense } from '@/types'

const CATEGORIES = [
  { value: 'electricidad', label: 'Electricidad', icon: Zap, tone: 'amber' },
  { value: 'agua', label: 'Agua', icon: Droplet, tone: 'cyan' },
  { value: 'gas', label: 'Gas', icon: Flame, tone: 'red' },
  { value: 'internet', label: 'Internet', icon: Wifi, tone: 'violet' },
  { value: 'combustible', label: 'Combustible', icon: Fuel, tone: 'amber' },
  { value: 'alquiler', label: 'Alquiler', icon: Home, tone: 'brand' },
  { value: 'sueldos', label: 'Sueldos', icon: Users, tone: 'emerald' },
  { value: 'publicidad', label: 'Publicidad', icon: Megaphone, tone: 'pink' },
  { value: 'impuestos', label: 'Impuestos', icon: Calculator, tone: 'red' },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: Wrench, tone: 'cyan' },
  { value: 'otros', label: 'Otros', icon: FileText, tone: 'slate' },
]

const empty: any = { date: new Date().toISOString().slice(0, 10), category: 'electricidad', amount: 0, description: '' }

export default function Expenses() {
  const { expenses, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [confirm, setConfirm] = useState<Expense | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('')

  const filtered = expenses.filter(e => (!catFilter || e.category === catFilter) && (!query || e.description.toLowerCase().includes(query.toLowerCase())))

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const monthTotal = expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + e.amount, 0)
  const byCategory = CATEGORIES.map(c => ({ ...c, total: expenses.filter(e => e.category === c.value).reduce((s, e) => s + e.amount, 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const payload = { ...editing, date: new Date(editing.date).toISOString() }
      if (editing.id) await api.put(`/expenses/${editing.id}`, payload)
      else await api.post('/expenses', payload)
      await refreshOne('expenses')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(e: Expense) {
    try { await api.del(`/expenses/${e.id}`); await refreshOne('expenses') }
    catch (e: any) { alert(e.message) }
  }

  const columns = [
    { key: 'date', label: 'Fecha', sortable: true, render: (r: Expense) => <span className="text-xs">{formatDate(r.date)}</span> },
    { key: 'category', label: 'Categoría', render: (r: Expense) => {
        const c = CATEGORIES.find(x => x.value === r.category)
        return <span className="badge bg-surface-100 dark:bg-surface-800 capitalize">{c?.label || r.category}</span>
      }
    },
    { key: 'description', label: 'Descripción', render: (r: Expense) => <span>{r.description}</span> },
    { key: 'amount', label: 'Importe', align: 'right' as const, sortable: true, render: (r: Expense) => <span className="font-semibold tabular-nums">{formatCurrency(r.amount)}</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: Expense) => can('expenses.write') ? (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setEditing({ ...r, date: r.date.slice(0, 10) })} className="btn-ghost p-1.5 text-xs">Editar</button>
          <button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600 text-xs">Borrar</button>
        </div>
      ) : null
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Gastos" subtitle="Registro de gastos operativos: electricidad, sueldos, alquiler, etc."
        actions={<>
          <button onClick={() => exportCSV('gastos', filtered as any)} className="btn-secondary">CSV</button>
          {can('expenses.write') && <button onClick={() => setEditing({ ...empty })} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo gasto</button>}
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Gastos totales" value={formatCurrency(total)} icon={Receipt} tone="amber" />
        <StatCard label="Gastos del mes" value={formatCurrency(monthTotal)} icon={Receipt} tone="red" />
        <StatCard label="Nº de gastos" value={expenses.length} icon={FileText} tone="slate" />
        <StatCard label="Promedio" value={formatCurrency(expenses.length ? total / expenses.length : 0)} icon={Calculator} tone="violet" />
      </div>

      {byCategory.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Por categoría</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {byCategory.map(c => {
              const Icon = c.icon
              return (
                <div key={c.value} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-surface-500 truncate">{c.label}</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(c.total)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar descripción..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input max-w-[200px]">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} gastos</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="w-5 h-5" />} title="Sin gastos" description="Registra el primer gasto." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar gasto' : 'Nuevo gasto'}
          footer={<><button onClick={() => setEditing(null)} className="btn-secondary">Cancelar</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? '...' : 'Guardar'}</button></>}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Fecha</label><input type="date" className="input" value={editing.date?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, date: e.target.value })} /></div>
              <div><label className="label">Importe (€)</label><input type="number" step="0.01" className="input" value={editing.amount || 0} onChange={e => setEditing({ ...editing, amount: Number(e.target.value) })} /></div>
            </div>
            <div><label className="label">Categoría</label>
              <select className="input" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div><label className="label">Descripción</label><input className="input" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Factura, concepto, proveedor..." /></div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} title="Borrar gasto" message={`¿Eliminar este gasto de ${formatCurrency(confirm?.amount || 0)}?`} danger />
    </div>
  )
}