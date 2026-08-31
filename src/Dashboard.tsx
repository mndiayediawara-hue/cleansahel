import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useI18n } from '@/lib/i18n'
import { formatNumber, formatDateTime, formatCurrency, relativeTime } from '@/lib/utils'
import { StatCard } from '@/components/ui/StatCard'
import {
  Package, Boxes, Factory, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  ShoppingCart, ShoppingBag, Receipt, Bell, Activity, Wallet, FileBarChart, Beaker, ArrowUpRight
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'

interface DashboardData {
  inventory: {
    totalValue: number; rawValue: number; pkgValue: number; prodValue: number
    rawCount: number; rawQty: number; pkgCount: number; pkgQty: number
    prodCount: number; prodQty: number
    lowRaw: number; lowPkg: number; lowProd: number
  }
  sales: { today: number; month: number }
  expenses: { month: number }
  benefit: number
  production: { today: number; week: number; month: number }
  pendingOrders: number
  charts: {
    last7: { date: string; ventas: number; gastos: number }[]
    salesByProduct: { name: string; qty: number }[]
    topCustomers: { name: string; total: number }[]
  }
  recent: {
    orders: any[]; purchases: any[]; lots: any[]
  }
  unreadNotifs: number
}

const COLORS = ['#329bff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Dashboard() {
  const { user } = useAuth()
  const { refresh, refreshOne } = useData()
  const { t, formatMoney } = useI18n()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 30000)
    return () => clearInterval(id)
  }, [])

  async function load(silent = false) {
    try {
      if (!silent) { setLoading(true); setError(null) }
      const d = await api.get<DashboardData>('/dashboard')
      setData(d)
    } catch (e: any) {
      setError(e?.message || 'Error al cargar el dashboard')
    } finally { setLoading(false) }
  }

  if (loading && !data) {
    return <div className="space-y-6">{[1,2,3].map(i => <div key={i} className="card p-6 animate-pulse h-32" />)}</div>
  }
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-red-500 font-semibold mb-2">Error al cargar el dashboard</p>
        <p className="text-surface-500 text-sm mb-4">{error}</p>
        <button onClick={() => load()} className="btn btn-primary">Reintentar</button>
      </div>
    )
  }
  if (!data) return null

  const inventoryPie = [
    { name: 'Materias Primas', value: data.inventory.rawValue, color: '#329bff' },
    { name: 'Embalaje', value: data.inventory.pkgValue, color: '#8b5cf6' },
    { name: 'Productos', value: data.inventory.prodValue, color: '#10b981' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">Dashboard</p>
          <h1 className="text-3xl font-bold mt-1">{t('dash.greeting_morning')}, {user?.fullName?.split(' ')[0] || 'Usuario'} 👋</h1>
          <p className="text-sm text-surface-500 mt-1">{t('dash.welcome')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t('dash.live')}
          </span>
          <span>{t('dash.updated')} {formatDateTime(new Date())}</span>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label={t('dash.kpi.inventory_value')} value={formatCurrency(data.inventory.totalValue)} icon={Wallet} tone="brand" />
        <StatCard label={t('dash.kpi.raw_materials')} value={formatNumber(data.inventory.rawQty)} icon={Beaker} tone="cyan" hint={`${data.inventory.rawCount} refs`} />
        <StatCard label={t('dash.kpi.packaging')} value={formatNumber(data.inventory.pkgQty)} icon={Package} tone="violet" hint={`${data.inventory.pkgCount}`} />
        <StatCard label={t('dash.kpi.products')} value={formatNumber(data.inventory.prodQty)} icon={Boxes} tone="emerald" hint={`${data.inventory.prodCount} SKUs`} />
        <StatCard label={t('dash.kpi.low_stock')} value={data.inventory.lowRaw + data.inventory.lowPkg + data.inventory.lowProd} icon={AlertTriangle} tone="amber" />
        <StatCard label={t('dash.kpi.production_today')} value={formatNumber(data.production.today)} icon={Factory} tone="brand" />
        <StatCard label={t('dash.kpi.production_week')} value={formatNumber(data.production.week)} icon={Activity} tone="cyan" />
        <StatCard label={t('dash.kpi.production_month')} value={formatNumber(data.production.month)} icon={Activity} tone="violet" />
        <StatCard label={t('dash.kpi.sales_today')} value={formatCurrency(data.sales.today)} icon={ShoppingCart} tone="emerald" />
        <StatCard label={t('dash.kpi.sales_month')} value={formatCurrency(data.sales.month)} icon={TrendingUp} tone="emerald" />
        <StatCard label={t('dash.kpi.expenses_month')} value={formatCurrency(data.expenses.month)} icon={Receipt} tone="amber" />
        <StatCard label={t('dash.kpi.benefit')} value={formatCurrency(data.benefit)} icon={data.benefit >= 0 ? TrendingUp : TrendingDown} tone={data.benefit >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">{t('dash.chart.sales_vs_expenses')}</h3>
              <p className="text-xs text-surface-500">{t('dash.chart.last_7')}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500" /> {t('dash.kpi.sales_today').split(' ')[0]}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> {t('dash.kpi.expenses_month').split(' ')[0]}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.charts.last7} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#329bff" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#329bff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-800" />
              <XAxis dataKey="date" stroke="currentColor" className="text-surface-500" fontSize={11} />
              <YAxis stroke="currentColor" className="text-surface-500" fontSize={11} tickFormatter={(v) => `${v}€`} />
              <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(v: any) => formatCurrency(v)} />
              <Area type="monotone" dataKey="ventas" stroke="#329bff" strokeWidth={2} fill="url(#gVentas)" />
              <Area type="monotone" dataKey="gastos" stroke="#f59e0b" strokeWidth={2} fill="url(#gGastos)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-1">{t('dash.chart.inventory_comp')}</h3>
          <p className="text-xs text-surface-500 mb-4">Valor por categoría</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={inventoryPie} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {inventoryPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(v: any) => formatCurrency(v)} />
              <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top products & customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Boxes className="w-4 h-4 text-emerald-600" /> {t('dash.chart.top_products')}</h3>
          {data.charts.salesByProduct.length === 0 ? (
            <p className="text-sm text-surface-500 py-8 text-center">Sin datos este mes</p>
          ) : (
            <div className="space-y-3">
              {data.charts.salesByProduct.map((p, i) => {
                const max = Math.max(...data.charts.salesByProduct.map(x => x.qty))
                return (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="text-surface-500 tabular-nums">{formatNumber(p.qty)} ud</span>
                    </div>
                    <div className="h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${(p.qty / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-brand-600" /> {t('dash.chart.top_customers')}</h3>
          {data.charts.topCustomers.length === 0 ? (
            <p className="text-sm text-surface-500 py-8 text-center">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {data.charts.topCustomers.map((c, i) => {
                const max = Math.max(...data.charts.topCustomers.map(x => x.total))
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-surface-500 tabular-nums">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${(c.total / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-brand-600" /> {t('dash.recent.orders')}</h3>
            <Link to="/orders" className="text-xs text-brand-600 hover:underline flex items-center gap-1">{t('dash.recent.see_all')} <ArrowUpRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-2">
            {data.recent.orders.length === 0 ? <p className="text-sm text-surface-500 py-4 text-center">Sin pedidos</p> :
              data.recent.orders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{o.number}</p>
                    <p className="text-xs text-surface-500 truncate">{o.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</p>
                    <p className="text-[10px] text-surface-500 capitalize">{o.status}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-violet-600" /> {t('dash.recent.purchases')}</h3>
            <Link to="/purchases" className="text-xs text-brand-600 hover:underline flex items-center gap-1">Ver todas <ArrowUpRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-2">
            {data.recent.purchases.length === 0 ? <p className="text-sm text-surface-500 py-4 text-center">Sin compras</p> :
              data.recent.purchases.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.number}</p>
                    <p className="text-xs text-surface-500 truncate">{p.supplier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(p.total)}</p>
                    <p className="text-[10px] text-surface-500">{relativeTime(p.date)}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Factory className="w-4 h-4 text-emerald-600" /> {t('dash.recent.lots')}</h3>
            <Link to="/lots" className="text-xs text-brand-600 hover:underline flex items-center gap-1">{t('dash.recent.see_all')} <ArrowUpRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-2">
            {data.recent.lots.length === 0 ? <p className="text-sm text-surface-500 py-4 text-center">Sin producción</p> :
              data.recent.lots.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{l.lotNumber}</p>
                    <p className="text-xs text-surface-500 truncate">{l.product}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatNumber(l.quantity)} ud</p>
                    <p className="text-[10px] text-surface-500 capitalize">{l.status}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
