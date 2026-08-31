import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/ui/Common'
import { StatCard } from '@/components/ui/StatCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Truck, TrendingUp, Calendar, Users, Lock, ChevronDown } from 'lucide-react'

type Period = 'today' | 'week' | 'month' | 'year' | 'all'

interface Stats {
  summary: { total: number; today: number; thisWeek: number; thisMonth: number; thisYear: number }
  byUser: { userName: string; total: number; today: number; thisWeek: number; thisMonth: number; thisYear: number }[]
  byDay: { date: string; count: number }[]
  recent: { id: string; number: string; customerName: string; total: number; deliveredAt: string; deliveredBy: string }[]
  userDailyStats?: {
    days: string[]
    users: Record<string, Record<string, number>>
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DeliveryStats() {
  const { can, token } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [showUserDetail, setShowUserDetail] = useState(false)

  const canView = can('entregas.stats')

  useEffect(() => { if (canView) loadStats() }, [period, selectedUser])

  async function loadStats() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (selectedUser) params.set('userId', selectedUser)
      const res = await fetch(`/api/delivery-stats?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setStats(await res.json())
    } catch { /* */ } finally { setLoading(false) }
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
  const byUser = stats?.byUser || []

  // Datos para gráfico del repartidor seleccionado
  const userDaily = stats?.userDailyStats
  const selectedUserData = selectedUser && userDaily?.users ? userDaily.users[selectedUser] : null
  const userChartData = userDaily
    ? userDaily.days.map(day => ({ date: day, count: selectedUser ? (selectedUserData?.[day] || 0) : (() => {
        let sum = 0
        for (const u of Object.values(userDaily.users)) sum += u[day] || 0
        return sum
      })() }))
    : []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estadísticas de Entregas"
        subtitle="Resumen y rendimiento de entregas por repartidor"
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
        <select className="input text-sm" value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setShowUserDetail(false) }}>
          <option value="">Ver todos</option>
          {byUser.map(u => (
            <option key={u.userName} value={u.userName}>{u.userName}</option>
          ))}
        </select>
        {selectedUser && (
          <button onClick={() => setShowUserDetail(!showUserDetail)}
            className="btn-secondary text-sm flex items-center gap-1">
            <ChevronDown className={`w-3.5 h-3.5 transition ${showUserDetail ? 'rotate-180' : ''}`} />
            Detalle
          </button>
        )}
        <button onClick={loadStats} disabled={loading} className="btn-secondary text-sm ml-auto">
          {loading ? '...' : '↺'}
        </button>
      </div>

      {/* Resumen general */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total" value={s.total} icon={Truck} tone="slate" />
          <StatCard label="Hoy" value={s.today} icon={Calendar} tone="emerald" />
          <StatCard label="Esta semana" value={s.thisWeek} icon={TrendingUp} tone="brand" />
          <StatCard label="Este mes" value={s.thisMonth} icon={TrendingUp} tone="violet" />
          <StatCard label="Este año" value={s.thisYear} icon={TrendingUp} tone="amber" />
        </div>
      )}

      {/* Por repartidor — tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {byUser.map(u => {
          const isSelected = selectedUser === u.userName
          return (
            <div key={u.userName}
              className={`card p-4 cursor-pointer transition border-2 ${isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-transparent hover:border-surface-300 dark:hover:border-surface-600'}`}
              onClick={() => setSelectedUser(isSelected ? '' : u.userName)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm">{u.userName}</p>
                  <p className="text-xs text-surface-500">{u.total} entregas totales</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-brand-600">{u.total}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-1.5">
                  <p className="text-lg font-bold text-emerald-600">{u.today}</p>
                  <p className="text-[10px] text-emerald-600">Hoy</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-1.5">
                  <p className="text-lg font-bold text-blue-600">{u.thisWeek}</p>
                  <p className="text-[10px] text-blue-600">Semana</p>
                </div>
                <div className="bg-violet-50 dark:bg-violet-950/30 rounded p-1.5">
                  <p className="text-lg font-bold text-violet-600">{u.thisMonth}</p>
                  <p className="text-[10px] text-violet-600">Mes</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-1.5">
                  <p className="text-lg font-bold text-amber-600">{u.thisYear}</p>
                  <p className="text-[10px] text-amber-600">Año</p>
                </div>
              </div>
              {/* Mini barra de progreso del mes vs año */}
              <div className="mt-2 h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: u.thisYear > 0 ? `${Math.round((u.thisMonth / u.thisYear) * 100)}%` : '0%' }} />
              </div>
              <p className="text-[10px] text-surface-400 mt-1 text-right">{u.thisMonth}/{u.thisYear} este año</p>
            </div>
          )
        })}
      </div>

      {/* Detalle del repartidor seleccionado — gráfico diario */}
      {showUserDetail && selectedUser && (
        <div className="card p-5">
          <h3 className="font-semibold mb-1">Rendimiento diario — {selectedUser}</h3>
          <p className="text-xs text-surface-500 mb-4">Últimos 14 días</p>
          {userChartData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-700" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={d => `Fecha: ${d}`}
                    formatter={(v: number) => [`${v} entregas`, 'Cantidad']} />
                  <Bar dataKey="count" fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-8">Sin datos disponibles</p>
          )}
        </div>
      )}

      {/* Gráfico general por día */}
      {!selectedUser && stats?.byDay && stats.byDay.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Entregas por día (últimos 30 días)</h3>
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
                  <th className="pb-2 text-surface-500">Repartidor</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map(r => (
                  <tr key={r.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/30">
                    <td className="py-2 font-mono text-xs">{r.number}</td>
                    <td className="py-2 truncate max-w-32">{r.customerName}</td>
                    <td className="py-2 text-right font-medium">€{(r.total || 0).toFixed(2)}</td>
                    <td className="py-2 text-xs text-surface-500">{fmtDate(r.deliveredAt)}</td>
                    <td className="py-2 text-xs">{r.deliveredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-8 text-surface-400">Cargando...</div>}
    </div>
  )
}
