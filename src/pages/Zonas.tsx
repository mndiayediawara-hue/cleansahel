import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import {
  MapPin, Users, ShoppingCart, DollarSign, TrendingUp, Package,
  BarChart3, Filter, ChevronDown, X, ArrowUpDown, Globe2
} from 'lucide-react'

interface Zone {
  id: string
  name: string
  type: 'city' | 'region'
  parent: string | null
  color: string
  order: number
  customers: number
  orders: number
  pendingOrders: number
  deliveredOrders: number
  revenue: number
  cost: number
  margin: number
  marginPct: number
  units: number
  avgTicket: number
  newCustomers: number
  level: 'none' | 'low' | 'medium' | 'high'
  cities: string[]
  recentOrders: { id: string; number: string; total: number; status: string; delivered_at: string; created_at: string }[]
}

interface ZonasData {
  zones: Zone[]
  totals: { customers: number; orders: number; revenue: number; margin: number; units: number; avgTicket: number; newCustomers: number; marginPct: number }
  highZones: number
  mediumZones: number
  noZones: number
  count: number
}

const PERIODS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 año', days: 365 },
  { label: 'Todo', days: 0 },
]

const SORT_OPTIONS = [
  { key: 'revenue', label: 'Facturación' },
  { key: 'customers', label: 'Clientes' },
  { key: 'orders', label: 'Pedidos' },
  { key: 'units', label: 'Unidades' },
  { key: 'margin', label: 'Margen' },
  { key: 'avgTicket', label: 'Ticket medio' },
  { key: 'newCustomers', label: 'Nuevos clientes' },
]

// SVG map of Mali regions (simplified polygon paths)
const MALI_MAP_REGIONS: Record<string, { path: string; label: string; cx: number; cy: number }> = {
  'kayes': { path: 'M10,10 L80,10 L100,30 L90,80 L60,100 L20,80 L5,40 Z', label: 'Kayes', cx: 45, cy: 50 },
  'koulikoro': { path: 'M80,10 L180,10 L200,60 L180,100 L130,100 L100,80 L100,30 Z', label: 'Koulikoro', cx: 145, cy: 55 },
  'sikasso': { path: 'M180,100 L280,80 L300,120 L280,200 L200,220 L160,200 L130,150 L130,100 Z', label: 'Sikasso', cx: 210, cy: 160 },
  'segou': { path: 'M100,30 L200,30 L220,60 L200,100 L160,100 L130,100 L130,60 Z', label: 'Ségou', cx: 162, cy: 65 },
  'mopti': { path: 'M130,150 L200,150 L220,180 L200,220 L160,230 L120,220 L100,200 Z', label: 'Mopti', cx: 160, cy: 190 },
  'tombouctou': { path: 'M60,100 L130,100 L150,120 L140,150 L100,160 L60,150 L50,120 Z', label: 'Tombouctou', cx: 98, cy: 128 },
  'gao': { path: 'M140,50 L220,50 L240,70 L230,110 L180,120 L150,110 L140,80 Z', label: 'Gao', cx: 190, cy: 82 },
  'kidal': { path: 'M220,10 L300,10 L310,40 L290,70 L240,70 L230,50 Z', label: 'Kidal', cx: 262, cy: 40 },
  'taoudeni': { path: 'M20,80 L60,80 L70,100 L60,120 L30,130 L10,110 Z', label: 'Taoudéni', cx: 40, cy: 102 },
  'menaka': { path: 'M240,70 L290,70 L310,90 L300,120 L260,130 L240,110 Z', label: 'Ménaka', cx: 272, cy: 97 },
  'bamako': { path: 'M145,95 L165,95 L165,115 L145,115 Z', label: 'Bamako', cx: 155, cy: 105 },
}

const LEVEL_COLORS = {
  high: { fill: '#10b981', text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
  medium: { fill: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  low: { fill: '#f97316', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  none: { fill: '#e2e8f0', text: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-500' },
}

export default function Zonas() {
  const { t, formatMoney } = useI18n()
  const [data, setData] = useState<ZonasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)
  const [sortKey, setSortKey] = useState('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<Zone | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = period > 0
        ? new Date(Date.now() - period * 86400000).toISOString().slice(0, 10)
        : ''
      const d = await api.get<ZonasData>('/zonas?' + new URLSearchParams(from ? { from } : {}).toString())
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  function handleZoneClick(zone: Zone) {
    setSelected(zone)
    setShowDetail(true)
  }

  const sortedZones = data ? [...data.zones].sort((a, b) => {
    const av = (a as any)[sortKey] || 0
    const bv = (b as any)[sortKey] || 0
    return sortDir === 'desc' ? bv - av : av - bv
  }) : []

  const activeZones = sortedZones.filter(z => z.type === 'region' || z.id === 'bamako')
  const totalActive = activeZones.filter(z => z.level !== 'none').length

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-surface-500">Cargando cobertura...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Globe2 className="w-7 h-7 text-primary-600" />
            Zonas Comerciales
          </h1>
          <p className="text-sm text-surface-500 mt-1">Cobertura y actividad comercial por zona de Mali</p>
        </div>

        {/* Period filter */}
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                period === p.days
                  ? 'bg-white dark:bg-surface-700 text-primary-600 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Clientes', value: data.totals.customers, icon: Users, color: 'text-blue-600' },
            { label: 'Pedidos', value: data.totals.orders, icon: ShoppingCart, color: 'text-purple-600' },
            { label: 'Facturación', value: formatMoney(data.totals.revenue), icon: DollarSign, color: 'text-green-600', large: true },
            { label: 'Margen', value: formatMoney(data.totals.margin), icon: TrendingUp, color: 'text-emerald-600', sub: data.totals.marginPct > 0 ? `+${data.totals.marginPct}%` : '0%' },
            { label: 'Unidades', value: formatNumber(data.totals.units), icon: Package, color: 'text-orange-600' },
            { label: 'Ticket medio', value: formatMoney(data.totals.avgTicket), icon: BarChart3, color: 'text-cyan-600' },
            { label: 'Nuevos', value: data.totals.newCustomers, icon: Users, color: 'text-indigo-600' },
          ].map(({ label, value, icon: Icon, color, sub, large }) => (
            <div key={label} className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-surface-500 font-medium">{label}</span>
                <Icon className={cn('w-4 h-4', color)} />
              </div>
              <div className={cn('font-bold text-surface-900 dark:text-white', large ? 'text-lg' : 'text-base')}>{value}</div>
              {sub && <div className="text-xs text-surface-400 mt-0.5">{sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Coverage legend */}
      {data && (
        <div className="flex items-center gap-6 text-xs text-surface-500">
          <span className="font-semibold text-surface-700 dark:text-surface-300">Actividad:</span>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500"></span> Alta ({data.highZones} zonas)</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400"></span> Media ({data.mediumZones} zonas)</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-300"></span> Sin clientes ({data.noZones} zonas)</div>
          <div className="ml-auto text-xs">
            {totalActive} de {activeZones.length} zonas con actividad
          </div>
        </div>
      )}

      {/* Map + Table */}
      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        {/* SVG Map of Mali */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
            <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-500" />
              Mapa de Mali
            </h2>
          </div>
          <div className="p-4">
            <svg viewBox="0 0 320 240" className="w-full h-auto" style={{ maxHeight: 320 }}>
              {Object.entries(MALI_MAP_REGIONS).map(([id, r]) => {
                const zone = data?.zones.find(z => z.id === id)
                const level = zone?.level || 'none'
                const colors = LEVEL_COLORS[level as keyof typeof LEVEL_COLORS]
                const hasCustomers = zone && zone.customers > 0
                return (
                  <g key={id} onClick={() => zone && handleZoneClick(zone)} style={{ cursor: zone ? 'pointer' : 'default' }}>
                    <path
                      d={r.path}
                      fill={colors.fill}
                      stroke={hasCustomers ? '#1e40af' : '#cbd5e1'}
                      strokeWidth={id === 'bamako' ? 2.5 : 1.5}
                      opacity={level === 'none' ? 0.5 : 1}
                      className="transition-all duration-200 hover:opacity-80"
                      rx={4}
                    />
                    {hasCustomers && (
                      <>
                        <circle cx={r.cx} cy={r.cy} r={zone!.customers >= 5 ? 10 : zone!.customers >= 2 ? 7 : 5} fill="#1e40af" />
                        <text
                          x={r.cx} y={r.cy + 1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize={zone!.customers >= 10 ? 9 : 7}
                          fontWeight="bold"
                        >
                          {zone!.customers}
                        </text>
                      </>
                    )}
                    {id === 'bamako' && (
                      <text x={r.cx} y={r.cy + 22} textAnchor="middle" fontSize={8} fill="#1e40af" fontWeight="bold">Bamako</text>
                    )}
                    {id !== 'bamako' && (
                      <text x={r.cx} y={r.cy} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#475569" opacity={0.8}>{r.label}</text>
                    )}
                  </g>
                )
              })}
            </svg>
            <p className="text-center text-xs text-surface-400 mt-2">
              Haz clic en una zona para ver detalles · El número indica clientes
            </p>
          </div>
        </div>

        {/* Sortable Table */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
            <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-500" />
              Zonas por ranking
            </h2>
            <select
              value={sortKey}
              onChange={e => { setSortKey(e.target.value); setSortDir('desc') }}
              className="text-xs border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 bg-surface-50 dark:bg-surface-800 text-surface-700 dark:text-surface-300"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800 border-b border-surface-100 dark:border-surface-700">
                  <th className="text-left px-4 py-2.5 font-semibold text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wider">Zona</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wider">Clientes</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wider">Pedidos</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wider">Facturación</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wider">Margen</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedZones
                  .filter(z => z.type === 'region' || z.id === 'bamako')
                  .map((zone, i) => {
                    const colors = LEVEL_COLORS[zone.level as keyof typeof LEVEL_COLORS]
                    const levelLabels = { high: 'Alta', medium: 'Media', low: 'Baja', none: 'Sin clientes' }
                    return (
                      <tr
                        key={zone.id}
                        onClick={() => handleZoneClick(zone)}
                        className="border-b border-surface-50 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', colors.fill.replace('bg-', 'bg-'))}
                              style={{ backgroundColor: colors.fill.includes('#') ? colors.fill : undefined }} />
                            <div>
                              <div className="font-medium text-surface-900 dark:text-white text-sm">{zone.name}</div>
                              {zone.cities.length > 0 && (
                                <div className="text-xs text-surface-400">{zone.cities.join(', ')}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-surface-800 dark:text-surface-200">{zone.customers}</td>
                        <td className="px-3 py-3 text-right text-surface-700 dark:text-surface-300">{zone.orders}</td>
                        <td className="px-3 py-3 text-right font-semibold text-surface-900 dark:text-white">{zone.revenue > 0 ? formatMoney(zone.revenue) : '—'}</td>
                        <td className="px-3 py-3 text-right">
                          {zone.margin > 0 ? (
                            <span className="text-green-600 font-medium text-xs">{formatMoney(zone.margin)}</span>
                          ) : zone.revenue > 0 ? (
                            <span className="text-surface-400 text-xs">—</span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium', colors.badge)}>
                            {levelLabels[zone.level as keyof typeof levelLabels]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Zone detail modal */}
      {showDetail && selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-surface-800 border-b border-surface-100 dark:border-surface-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">{selected.name}</h2>
                <span className={cn('inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium', LEVEL_COLORS[selected.level as keyof typeof LEVEL_COLORS].badge)}>
                  {selected.level === 'high' ? 'Alta actividad' : selected.level === 'medium' ? 'Actividad media' : selected.level === 'low' ? 'Poca actividad' : 'Sin clientes'}
                </span>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
                <X className="w-5 h-5 text-surface-400" />
              </button>
            </div>

            {/* Stats grid */}
            <div className="px-6 py-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Clientes', value: selected.customers, icon: Users, color: 'text-blue-600' },
                { label: 'Pedidos', value: selected.orders, icon: ShoppingCart, color: 'text-purple-600' },
                { label: 'Pendientes', value: selected.pendingOrders, icon: Package, color: 'text-amber-600' },
                { label: 'Facturación', value: selected.revenue > 0 ? formatMoney(selected.revenue) : '—', icon: DollarSign, color: 'text-green-600', large: true },
                { label: 'Margen', value: selected.margin > 0 ? formatMoney(selected.margin) : '—', icon: TrendingUp, color: 'text-emerald-600' },
                { label: 'Unidades', value: formatNumber(selected.units), icon: Package, color: 'text-orange-600' },
                { label: 'Ticket medio', value: selected.avgTicket > 0 ? formatMoney(selected.avgTicket) : '—', icon: BarChart3, color: 'text-cyan-600' },
                { label: 'Margen %', value: selected.marginPct > 0 ? `${selected.marginPct}%` : '—', icon: TrendingUp, color: 'text-green-600' },
                { label: 'Nuevos clientes', value: selected.newCustomers, icon: Users, color: 'text-indigo-600' },
              ].map(({ label, value, icon: Icon, color, large }) => (
                <div key={label} className={cn('bg-surface-50 dark:bg-surface-700 rounded-xl p-3 text-center', large && 'col-span-3')}>
                  <div className="text-xs text-surface-500 mb-1">{label}</div>
                  <div className={cn('font-bold text-surface-900 dark:text-white flex items-center justify-center gap-1', large ? 'text-xl justify-start' : 'text-base')}>
                    {Icon && <Icon className={cn('w-4 h-4', color)} />}
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Cities */}
            {selected.cities.length > 0 && (
              <div className="px-6 pb-4">
                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Ciudades con clientes</div>
                <div className="flex flex-wrap gap-2">
                  {selected.cities.map(city => (
                    <span key={city} className="px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium">
                      {city}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {selected.recentOrders.length > 0 && (
              <div className="px-6 pb-6">
                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Últimos pedidos</div>
                <div className="space-y-2">
                  {selected.recentOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-surface-800 dark:text-surface-200">{o.number}</div>
                        <div className="text-xs text-surface-400">{o.created_at?.slice(0, 10)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-surface-900 dark:text-white">{formatMoney(o.total)}</div>
                        <div className="text-xs text-surface-400">{o.delivered_at ? '✓ Entregado' : o.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
