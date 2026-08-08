import { useState, useEffect } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { Search as SearchIcon, Boxes, Users, Factory, Beaker, Package, ShoppingCart, Layers } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const TYPE_META: Record<string, { icon: any; color: string; label: string; path: string }> = {
  producto: { icon: Boxes, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', label: 'Producto', path: '/products' },
  cliente: { icon: Users, color: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300', label: 'Cliente', path: '/customers' },
  proveedor: { icon: Factory, color: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300', label: 'Proveedor', path: '/settings' },
  materia_prima: { icon: Beaker, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300', label: 'Materia prima', path: '/raw-materials' },
  lote: { icon: Layers, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', label: 'Lote', path: '/lots' },
  pedido: { icon: ShoppingCart, color: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300', label: 'Pedido', path: '/orders' },
}

export default function SearchPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.get<{ results: any[] }>(`/search?q=${encodeURIComponent(query)}`)
        setResults(res.results)
      } catch {} finally { setSearching(false) }
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const byType = results.reduce((acc: any, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc }, {})

  return (
    <div className="space-y-4">
      <PageHeader title="Búsqueda Global" subtitle="Encuentra clientes, productos, pedidos, lotes y materias primas al instante" />

      <div className="card p-6">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            placeholder="Escribe al menos 2 caracteres: cliente, producto, código, lote, CIF..."
            className="w-full pl-12 pr-4 py-4 text-lg rounded-xl bg-surface-100 dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <p className="text-xs text-surface-500 mt-3">Búsqueda en: productos, clientes, proveedores, materias primas, lotes, pedidos</p>
      </div>

      {query.length < 2 ? (
        <EmptyState icon={<SearchIcon className="w-5 h-5" />} title="Empieza a buscar" description="Escribe al menos 2 caracteres para ver resultados." />
      ) : results.length === 0 ? (
        !searching && <EmptyState icon={<SearchIcon className="w-5 h-5" />} title="Sin resultados" description={`No se encontraron coincidencias con "${query}".`} />
      ) : (
        <div className="space-y-4">
          {Object.entries(byType).map(([type, items]: any) => {
            const meta = TYPE_META[type]
            if (!meta) return null
            const Icon = meta.icon
            return (
              <div key={type} className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-semibold text-sm">{meta.label} ({items.length})</p>
                </div>
                <div className="space-y-1.5">
                  {items.map((r: any) => (
                    <button
                      key={`${type}-${r.id}`}
                      onClick={() => navigate(meta.path)}
                      className="w-full text-left p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{r.title}</p>
                        {r.subtitle && <p className="text-xs text-surface-500 truncate">{r.subtitle}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
