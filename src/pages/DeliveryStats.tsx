import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/ui/Common'
import { StatCard } from '@/components/ui/StatCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Truck, TrendingUp, Calendar, Users, Lock } from 'lucide-react'

type Period = 'today' | 'week' | 'month' | 'year' | 'all'

interface Stats {
  summary: { total: number; today: number; thisWeek: number; thisMonth: number; thisYear: number }
  byUser: { userName: string; total: number; today: number; thisWeek: number; thisMonth: number; thisYear: number }[]
  byDay: { date: string; count: number }[]
  recent: { id: string; number: string; customerName: string; total: number; deliveredAt: string; deliveredBy: string }[]
}

export default function DeliveryStats() {
  const { can, token, users } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')
  const [filterUser, setFilterUser] = useState<string>('')

  const canView = can('entregas.stats')

  useEffect(() => {
    if (!canView) { setLoading(false); return }
    loadStats()
  }, [period, filterUser])

  async function loadStats() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (filterUser) params.set('userId', filterUser)
      const res = await fetch(`/api/delivery-stats?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setStats(await res.json())
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Lock className="w-12 h-12 text-surface-300 mb-4" />
        <h2 className="text-lg font-semibold text-surface-600">Sin permiso</h2>
        <p className="text-sm text-surface-400 mt-1">No tienes acceso a estadísticas de entregas.</p>
      </div>
    )
  }

  const s = stats?.summary
  const usersList = stats?.byUser || []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estadísticas de Entregas"
        subtitle="Resumen de pedidos entregados por período y usuario"
        icon={Truck}
      />

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {(['today', 'week', 'month', 'year', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${period === p
                ? 'bg-brand-500 text-white'
                : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700'}`}>
              {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : p === 'year' ? 'Año' : 'Todo'}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <select className="input text-sm" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">Todos los usuarios</option>
            {usersList.map(u => (
              <option key={u.userName} value={u.userName}>{u.userName}</option>
            ))}
          </select>
        </div>
        <button onClick={loadStats} disabled={loading} className="btn-secondary text-sm">
          {loading ? '...' : '↺'}
        </button>
      </div>

      {/* Resumen */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total" value={s.total} icon={Truck} tone="slate" />
          <StatCard label="Hoy" value={s.today} icon={Calendar} tone="emerald" />
          <StatCard label="Esta semana" value={s.thisWeek} icon={TrendingUp} tone="brand" />
          <StatCard label="Este mes" value={s.thisMonth} icon={TrendingUp} tone="violet" />
          <StatCard label="Este año" value={s.thisYear} icon={TrendingUp} tone="amber" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Por día */}
        {stats?.byDay && stats.byDay.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold mb-4">Entregas por día (últimos 30)</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-700" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={d => `Fecha: ${d}`}
                    formatter={(v: number) => [`${v} entregas`, 'Cantidad']} />
                  <Bar dataKey="count" fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Por usuario */}
        {usersList.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Por usuario
            </h3>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {usersList.map(u => (
                <div key={u.userName} className="flex items-center gap-3 p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.userName}</p>
                    <div className="flex gap-3 mt-0.5 text-xs text-surface-500">
                      <span>Hoy: {u.today}</span>
                      <span>Semana: {u.thisWeek}</span>
                      <span>Mes: {u.thisMonth}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-brand-600">{u.total}</span>
                    <p className="text-[10px] text-surface-400">total</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Historial reciente */}
      {stats?.recent && stats.recent.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Últimas entregas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-surface-200 dark:border-surface-700">
                  <th className="pb-2 text-surface-500">Pedido</th>
                  <th className="pb-2 text-surface-500">Cliente</th>
                  <th className="pb-2 text-surface-500 text-right">Total</th>
                  <th className="pb-2 text-surface-500">Fecha</th>
                  <th className="pb-2 text-surface-500">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map(r => (
                  <tr key={r.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/30">
                    <td className="py-2 font-mono text-xs">{r.number}</td>
                    <td className="py-2 truncate max-w-32">{r.customerName}</td>
                    <td className="py-2 text-right font-medium">€{(r.total || 0).toFixed(2)}</td>
                    <td className="py-2 text-xs text-surface-500">{new Date(r.deliveredAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2 text-xs">{r.deliveredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-surface-400">Cargando...</div>
      )}
    </div>
  )
}
