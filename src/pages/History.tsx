
import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { StatCard } from '@/components/ui/StatCard'
import { History as HistoryIcon, Filter, Search, User, Calendar, Activity, Download } from 'lucide-react'
import { formatDateTime, exportCSV } from '@/lib/utils'

const ACTION_TONES: Record<string, string> = {
  crear: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  modificar: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  borrar: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  login: 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  logout: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
  produccion: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-300',
  venta: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  compra: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
}

export default function History() {
  const { history } = useData()
  const [query, setQuery] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const modules = Array.from(new Set(history.map(h => h.module)))
  const actions = Array.from(new Set(history.map(h => h.action)))

  const filtered = history.filter(h => {
    if (moduleFilter && h.module !== moduleFilter) return false
    if (actionFilter && h.action !== actionFilter) return false
    if (query && !`${h.userName} ${h.description}`.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const byDay = history.reduce((acc: any, h) => {
    const day = h.timestamp.slice(0, 10)
    acc[day] = (acc[day] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <PageHeader title="Historial" subtitle="Registro completo e inmutable de todos los movimientos del sistema"
        actions={<button onClick={() => exportCSV('historial', filtered as any)} className="btn-secondary"><Download className="w-4 h-4" /> Exportar</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total eventos" value={history.length} icon={HistoryIcon} tone="brand" />
        <StatCard label="Días con actividad" value={Object.keys(byDay).length} icon={Calendar} tone="emerald" />
        <StatCard label="Usuarios activos" value={new Set(history.map(h => h.userName)).size} icon={User} tone="violet" />
        <StatCard label="Módulos" value={modules.length} icon={Activity} tone="cyan" />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por usuario o descripción..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="input max-w-[180px]">
          <option value="">Todos los módulos</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input max-w-[180px]">
          <option value="">Todas las acciones</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} eventos</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<HistoryIcon className="w-5 h-5" />} title="Sin eventos" description="No hay registros que coincidan con los filtros." />
      ) : (
        <div className="card divide-y divide-surface-100 dark:divide-surface-800">
          {filtered.slice(0, 200).map((h) => (
            <div key={h.id} className="p-4 flex items-start gap-3 hover:bg-surface-50 dark:hover:bg-surface-800/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                {h.userName?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{h.userName}</p>
                  <span className={`badge ${ACTION_TONES[h.action] || 'bg-surface-100 text-surface-700'}`}>{h.action}</span>
                  <span className="badge bg-surface-100 dark:bg-surface-800">{h.module}</span>
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{h.description}</p>
                <p className="text-[10px] text-surface-500 mt-1">{formatDateTime(h.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}