
import { useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { PageHeader } from '@/components/ui/Common'
import { StatCard } from '@/components/ui/StatCard'
import { TrendingUp, ShoppingCart, DollarSign, BarChart3 } from 'lucide-react'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line, AreaChart, Area } from 'recharts'
import { useState } from 'react'

export default function Sales() {
  const { orders, customers, products } = useData()
  const [period, setPeriod] = useState<'7' | '30' | '365'>('30')

  const valid = orders.filter(o => o.status !== 'cancelado')

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const stats = {
    today: valid.filter(o => new Date(o.createdAt) >= todayStart).reduce((s, o) => s + o.total, 0),
    week: valid.filter(o => new Date(o.createdAt) >= weekStart).reduce((s, o) => s + o.total, 0),
    month: valid.filter(o => new Date(o.createdAt) >= monthStart).reduce((s, o) => s + o.total, 0),
    year: valid.filter(o => new Date(o.createdAt) >= yearStart).reduce((s, o) => s + o.total, 0),
    ordersToday: valid.filter(o => new Date(o.createdAt) >= todayStart).length,
    ordersMonth: valid.filter(o => new Date(o.createdAt) >= monthStart).length,
  }

  const benefitMonth = stats.month - (useData().expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + e.amount, 0))

  const days = Number(period)
  const series = useMemo(() => {
    const arr: any[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      const next = new Date(d); next.setDate(next.getDate() + 1)
      const dayOrders = valid.filter(o => { const t = new Date(o.createdAt); return t >= d && t < next })
      arr.push({
        date: d.toISOString().slice(5, 10),
        ventas: dayOrders.reduce((s, o) => s + o.total, 0),
        pedidos: dayOrders.length,
      })
    }
    return arr
  }, [period, orders])

  // Top products
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  valid.forEach(o => {
    o.items.forEach(it => {
      const p = products.find(x => x.id === it.productId)
      if (!p) return
      if (!productMap[p.id]) productMap[p.id] = { name: p.name, qty: 0, revenue: 0 }
      productMap[p.id].qty += it.quantity
      productMap[p.id].revenue += it.quantity * it.unitPrice * (1 - (it.discount || 0) / 100)
    })
  })
  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 10)

  // Top customers
  const custMap: Record<string, number> = {}
  valid.forEach(o => { custMap[o.customerId] = (custMap[o.customerId] || 0) + o.total })
  const topCustomers = Object.entries(custMap).map(([id, total]) => ({ name: customers.find(c => c.id === id)?.name || '?', total })).sort((a, b) => b.total - a.total).slice(0, 10)

  return (
    <div className="space-y-4">
      <PageHeader title="Ventas" subtitle="Análisis de ventas por período" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Ventas hoy" value={formatCurrency(stats.today)} icon={DollarSign} tone="emerald" />
        <StatCard label="Ventas semana" value={formatCurrency(stats.week)} icon={TrendingUp} tone="brand" />
        <StatCard label="Ventas mes" value={formatCurrency(stats.month)} icon={TrendingUp} tone="violet" hint={`${stats.ordersMonth} pedidos`} />
        <StatCard label="Ventas año" value={formatCurrency(stats.year)} icon={BarChart3} tone="cyan" />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Evolución de ventas</h3>
          <div className="flex gap-1 p-1 rounded-lg bg-surface-100 dark:bg-surface-800">
            {([['7', '7d'], ['30', '30d'], ['365', '12m']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setPeriod(k as any)} className={`px-3 py-1 rounded text-xs font-semibold ${period === k ? 'bg-white dark:bg-surface-900 shadow-soft' : 'text-surface-500'}`}>{label}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-800" />
            <XAxis dataKey="date" fontSize={11} stroke="currentColor" className="text-surface-500" />
            <YAxis fontSize={11} stroke="currentColor" className="text-surface-500" tickFormatter={v => `${v}€`} />
            <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(v: any) => formatCurrency(v)} />
            <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2} fill="url(#gV)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Productos más vendidos</h3>
          <div className="space-y-2">
            {topProducts.length === 0 ? <p className="text-sm text-surface-500 py-4 text-center">Sin datos</p> :
              topProducts.map((p, i) => {
                const max = topProducts[0].qty
                return (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium truncate">{i + 1}. {p.name}</span><span className="tabular-nums">{formatNumber(p.qty)} ud · {formatCurrency(p.revenue)}</span></div>
                    <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${(p.qty / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-3">Clientes principales</h3>
          <div className="space-y-2">
            {topCustomers.length === 0 ? <p className="text-sm text-surface-500 py-4 text-center">Sin datos</p> :
              topCustomers.map((c, i) => {
                const max = topCustomers[0].total
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium truncate">{i + 1}. {c.name}</span><span className="tabular-nums">{formatCurrency(c.total)}</span></div>
                    <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${(c.total / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    </div>
  )
}