import { useState, useEffect } from 'react'
import { useData } from '@/contexts/DataContext'
import { PageHeader } from '@/components/ui/Common'
import { StatCard } from '@/components/ui/StatCard'
import { FileBarChart, FileText, FileSpreadsheet, BarChart3, Package, Factory, ShoppingCart, Receipt, TrendingUp, Beaker, Download } from 'lucide-react'
import { formatCurrency, formatNumber, exportCSV, downloadFile } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useAuth } from '@/contexts/AuthContext'

type ReportType = 'inventory' | 'production' | 'sales' | 'expenses' | 'consumption' | 'profit'

export default function Reports() {
  const { products, customers, orders, expenses, config } = useData()
  const { token } = useAuth()
  const [active, setActive] = useState<ReportType>('inventory')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const reports: { id: ReportType; label: string; icon: any; description: string }[] = [
    { id: 'inventory', label: 'Inventario', icon: Package, description: 'Stock actual de materias primas, embalajes y productos' },
    { id: 'production', label: 'Producción', icon: Factory, description: 'Historial de lotes fabricados' },
    { id: 'sales', label: 'Ventas', icon: ShoppingCart, description: 'Pedidos con totales, IVA y descuentos' },
    { id: 'expenses', label: 'Gastos', icon: Receipt, description: 'Listado de gastos operativos' },
    { id: 'consumption', label: 'Consumo MP', icon: Beaker, description: 'Materias primas consumidas en producción' },
    { id: 'profit', label: 'Beneficios', icon: TrendingUp, description: 'Comparativa ventas vs gastos' },
  ]

  useEffect(() => {
    loadReport()
  }, [active])

  async function loadReport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/${active}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setData(json)
    } finally { setLoading(false) }
  }

  function exportPDF() {
    if (!data.length) return
    const html = `
      <html><head><meta charset="utf-8"><title>Informe ${active}</title>
      <style>body{font-family:system-ui;padding:20px;color:#0f172a}h1{margin:0 0 8px;color:#1b7df5}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:11px}th{background:#1b7df5;color:#fff;padding:8px;text-align:left}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}</style>
      </head><body>
      <h1>Informe de ${reports.find(r => r.id === active)?.label}</h1>
      <p style="color:#64748b">${reports.find(r => r.id === active)?.description}</p>
      <p style="color:#64748b">Generado: ${new Date().toLocaleString('es-ES')}</p>
      <table><thead><tr>${Object.keys(data[0]).map(k => `<th>${k}</th>`).join('')}</tr></thead>
      <tbody>${data.map(row => `<tr>${Object.values(row).map(v => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </body></html>
    `
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300) }
  }

  // Profit summary
  const totalSales = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.total, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const profit = totalSales - totalExpenses

  // Monthly data for profit chart
  const months: any[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1); d.setHours(0, 0, 0, 0)
    const next = new Date(d); next.setMonth(next.getMonth() + 1)
    const sales = orders.filter(o => { const t = new Date(o.createdAt); return t >= d && t < next && o.status !== 'cancelado' }).reduce((s, o) => s + o.total, 0)
    const exp = expenses.filter(e => { const t = new Date(e.date); return t >= d && t < next }).reduce((s, e) => s + e.amount, 0)
    months.push({ mes: d.toLocaleDateString('es-ES', { month: 'short' }), ventas: sales, gastos: exp, beneficio: sales - exp })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Informes" subtitle="Genera y exporta informes detallados en PDF, Excel o CSV" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {reports.map(r => {
          const Icon = r.icon
          return (
            <button
              key={r.id}
              onClick={() => setActive(r.id)}
              className={`card p-4 text-left transition ${active === r.id ? 'ring-2 ring-brand-500 border-brand-300 dark:border-brand-700' : 'card-hover'}`}
            >
              <Icon className={`w-5 h-5 mb-2 ${active === r.id ? 'text-brand-600' : 'text-surface-500'}`} />
              <p className="font-semibold text-sm">{r.label}</p>
              <p className="text-[10px] text-surface-500 mt-1">{r.description}</p>
            </button>
          )
        })}
      </div>

      {active === 'profit' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Ventas totales" value={formatCurrency(totalSales)} icon={TrendingUp} tone="emerald" />
            <StatCard label="Gastos totales" value={formatCurrency(totalExpenses)} icon={Receipt} tone="red" />
            <StatCard label="Beneficio" value={formatCurrency(profit)} icon={TrendingUp} tone={profit >= 0 ? 'emerald' : 'red'} />
          </div>
          <div className="card p-5">
            <h3 className="font-semibold mb-3">Evolución mensual</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-800" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={v => `${v/1000}k€`} />
                <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(v: any) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="beneficio" fill="#329bff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
            <h3 className="font-semibold">{reports.find(r => r.id === active)?.label}</h3>
            <div className="flex gap-2">
              <button onClick={() => exportCSV(active, data)} className="btn-secondary text-xs"><FileSpreadsheet className="w-3.5 h-3.5" /> CSV</button>
              <button onClick={exportPDF} className="btn-secondary text-xs"><FileText className="w-3.5 h-3.5" /> PDF</button>
              <button onClick={loadReport} className="btn-ghost text-xs">Recargar</button>
            </div>
          </div>
          {loading ? <p className="p-8 text-center text-sm text-surface-500">Cargando...</p> :
            data.length === 0 ? <p className="p-8 text-center text-sm text-surface-500">Sin datos</p> :
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800/50">
                  <tr>{Object.keys(data[0]).map(k => <th key={k} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-surface-500">{k}</th>)}</tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                      {Object.values(row).map((v: any, j) => <td key={j} className="px-3 py-2 text-xs">{typeof v === 'number' ? v.toLocaleString('es-ES', { maximumFractionDigits: 4 }) : String(v ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        </div>
      )}
    </div>
  )
}
