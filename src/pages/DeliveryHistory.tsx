import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/ui/Common'
import { Lock, Download, Search } from 'lucide-react'

interface DeliveryItem {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  total: number
  itemCount: number
  deliveredAt: string
  deliveredBy: string
}

interface HistoryResponse {
  items: DeliveryItem[]
  total: number
  page: number
  limit: number
  pages: number
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function DeliveryHistory() {
  const { can, token } = useAuth()
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Filtros
  const [filterUser, setFilterUser] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const canView = can('entregas.history')

  useEffect(() => { if (canView) loadData(1) }, [])
  useEffect(() => { if (canView) loadData(1) }, [filterUser, filterCustomer, filterFrom, filterTo])

  async function loadData(p = 1) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' })
      if (filterUser) params.set('deliveredBy', filterUser)
      if (filterCustomer) params.set('customer', filterCustomer)
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)
      const res = await fetch(`/api/delivery-history?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setPage(json.page)
        setTotalPages(json.pages)
      }
    } catch { /* */ } finally { setLoading(false) }
  }

  function exportCSV() {
    if (!data?.items?.length) return
    const headers = ['Pedido', 'Cliente', 'Total (€)', 'Unidades', 'Fecha entrega', 'Repartidor']
    const rows = data.items.map(i => [
      i.orderNumber,
      i.customerName,
      (i.total || 0).toFixed(2),
      i.itemCount,
      formatDate(i.deliveredAt),
      i.deliveredBy,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `historial-entregas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Lock className="w-12 h-12 text-surface-300 mb-4" />
        <h2 className="text-lg font-semibold text-surface-600">Sin permiso</h2>
        <p className="text-sm text-surface-400 mt-1">No tienes acceso al historial de entregas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historial de Entregas"
        subtitle="Registro completo de todas las entregas realizadas"
        actions={
          <button onClick={exportCSV} disabled={!data?.items?.length}
            className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV
          </button>
        }
      />

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-surface-400" />
          <span className="text-sm font-medium text-surface-600 dark:text-surface-300">Filtros</span>
          {(filterUser || filterCustomer || filterFrom || filterTo) && (
            <button onClick={() => { setFilterUser(''); setFilterCustomer(''); setFilterFrom(''); setFilterTo('') }}
              className="ml-auto text-xs text-surface-400 hover:text-red-500">Limpiar</button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Repartidor</label>
            <input className="input text-sm" placeholder="Nombre del repartidor"
              value={filterUser} onChange={e => setFilterUser(e.target.value)} />
          </div>
          <div>
            <label className="label">Cliente</label>
            <input className="input text-sm" placeholder="Nombre del cliente"
              value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} />
          </div>
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input text-sm"
              value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input text-sm"
              value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-surface-500">
            {loading ? 'Cargando...' : `${data?.total || 0} entregas encontradas`}
          </span>
          <button onClick={() => loadData(1)} disabled={loading} className="btn-primary text-sm">
            {loading ? '...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 text-left border-b border-surface-200 dark:border-surface-700">
                <th className="px-4 py-3 text-surface-500 font-medium">Pedido</th>
                <th className="px-4 py-3 text-surface-500 font-medium">Cliente</th>
                <th className="px-4 py-3 text-surface-500 font-medium text-right">Total</th>
                <th className="px-4 py-3 text-surface-500 font-medium text-right">Unidades</th>
                <th className="px-4 py-3 text-surface-500 font-medium">Fecha entrega</th>
                <th className="px-4 py-3 text-surface-500 font-medium">Repartidor</th>
              </tr>
            </thead>
            <tbody>
              {!loading && (!data?.items || data.items.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-surface-400">
                    Sin resultados para los filtros seleccionados
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-surface-400">Cargando...</td>
                </tr>
              )}
              {data?.items?.map(item => (
                <tr key={item.id}
                  className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{item.orderNumber}</td>
                  <td className="px-4 py-3 truncate max-w-40">{item.customerName}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    €{(item.total || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.itemCount}</td>
                  <td className="px-4 py-3 text-xs text-surface-500">{formatDate(item.deliveredAt)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="badge bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300">
                      {item.deliveredBy}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
            <span className="text-xs text-surface-500">
              Página {page} de {totalPages} — {data?.total} entregas
            </span>
            <div className="flex gap-2">
              <button onClick={() => loadData(page - 1)} disabled={page <= 1}
                className="btn-secondary text-xs px-3 py-1.5">← Anterior</button>
              <button onClick={() => loadData(page + 1)} disabled={page >= totalPages}
                className="btn-secondary text-xs px-3 py-1.5">Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
