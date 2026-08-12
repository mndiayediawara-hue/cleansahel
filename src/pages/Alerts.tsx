
import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { api } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { StatCard } from '@/components/ui/StatCard'
import { Bell, AlertTriangle, Package, CheckCheck, Calendar } from 'lucide-react'
import { relativeTime } from '@/lib/utils'
import { Link } from 'react-router-dom'

export default function Alerts() {
  const { notifications, refreshOne } = useData()
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'warning'>('all')

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'critical') return n.severity === 'critical'
    if (filter === 'warning') return n.severity === 'warning' || n.severity === 'critical'
    return true
  })

  async function markAll() {
    await api.post('/notifications/read-all')
    await refreshOne('notifications')
  }

  const critical = notifications.filter(n => n.severity === 'critical' && !n.read).length
  const warning = notifications.filter(n => n.severity === 'warning' && !n.read).length
  const unread = notifications.filter(n => !n.read).length

  const severityStyles: Record<string, { bg: string; dot: string; border: string; icon: any }> = {
    critical: { bg: 'bg-red-50 dark:bg-red-950/30', dot: 'bg-red-500', border: 'border-red-200 dark:border-red-900/50', icon: AlertTriangle },
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-900/50', icon: AlertTriangle },
    info: { bg: 'bg-sky-50 dark:bg-sky-950/30', dot: 'bg-sky-500', border: 'border-sky-200 dark:border-sky-900/50', icon: Bell },
    success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-900/50', icon: CheckCheck },
  }

  const typeLabels: Record<string, string> = {
    'stock-bajo': 'Stock bajo', caducidad: 'Caducidad', lote: 'Lote', pedido: 'Pedido',
    produccion: 'Producción', sistema: 'Sistema', 'lote-proximo': 'Lote próximo'
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Alertas y Notificaciones" subtitle="Eventos críticos del sistema: stock bajo, caducidades, pedidos"
        actions={unread > 0 && <button onClick={markAll} className="btn-secondary"><CheckCheck className="w-4 h-4" /> Marcar todas leídas</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total notificaciones" value={notifications.length} icon={Bell} tone="brand" />
        <StatCard label="Sin leer" value={unread} icon={Bell} tone="violet" />
        <StatCard label="Críticas" value={critical} icon={AlertTriangle} tone="red" />
        <StatCard label="Advertencias" value={warning} icon={AlertTriangle} tone="amber" />
      </div>

      <div className="card p-2 flex items-center gap-1">
        {([['all', 'Todas'], ['unread', 'Sin leer'], ['critical', 'Críticas'], ['warning', 'Advertencias']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k as any)} className={`px-3 py-1.5 rounded text-xs font-semibold ${filter === k ? 'bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300' : 'text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Bell className="w-5 h-5" />} title="Sin notificaciones" description="No hay alertas en este filtro." />
      ) : (
        <div className="card divide-y divide-surface-100 dark:divide-surface-800">
          {filtered.map(n => {
            const style = severityStyles[n.severity] || severityStyles.info
            const Icon = style.icon
            return (
              <Link
                key={n.id}
                to={n.relatedId?.startsWith('lot:') ? '/lots' : n.relatedId?.startsWith('order:') ? '/orders' : n.relatedId?.startsWith('raw:') ? '/raw-materials' : n.relatedId?.startsWith('pkg:') ? '/packaging' : n.relatedId?.startsWith('prd:') ? '/products' : '/alerts'}
                onClick={async () => { if (!n.read) { await api.post(`/notifications/${n.id}/read`); refreshOne('notifications') } }}
                className={`p-4 flex items-start gap-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 ${!n.read ? style.bg : ''}`}
              >
                <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center ${!n.read ? '' : 'opacity-50'}`}>
                  <Icon className={`w-4 h-4 ${n.severity === 'critical' ? 'text-red-600' : n.severity === 'warning' ? 'text-amber-600' : n.severity === 'success' ? 'text-emerald-600' : 'text-sky-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{n.title}</p>
                    {!n.read && <span className={`w-2 h-2 rounded-full ${style.dot}`} />}
                    <span className="badge bg-surface-100 dark:bg-surface-800 text-[10px]">{typeLabels[n.type] || n.type}</span>
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{n.message}</p>
                  <p className="text-[10px] text-surface-500 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {relativeTime(n.createdAt)}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}