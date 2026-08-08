import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import { api } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui/Common'
import { StatCard } from '@/components/ui/StatCard'
import { GitBranch, ArrowRight, ArrowLeft, Package, Beaker, Users as UsersIcon, Factory, Truck, Calendar, AlertTriangle, Search, CheckCircle2, X, Clock } from 'lucide-react'
import { formatDateTime, formatNumber, formatDate } from '@/lib/utils'

export default function Traceability() {
  const { id } = useParams<{ id: string }>()
  const { rawMaterialLots, lots, products, rawMaterials, suppliers, users, machines } = useData()
  const [type, setType] = useState<'raw_lot' | 'lot' | 'product' | 'raw_material'>('raw_lot')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    if (id) {
      // Auto-detect type based on what's in the lot tables
      if (lots.find(l => l.id === id)) loadTrace('lot', id)
      else if (rawMaterialLots.find(l => l.id === id)) loadTrace('raw_lot', id)
    }
  }, [id])

  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      try { const res = await api.get<{ results: any[] }>(`/lot-search?q=${encodeURIComponent(query)}`); setSearchResults(res.results) } catch {}
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  async function loadTrace(t: string, targetId: string) {
    setLoading(true); setType(t as any)
    try { setData(await api.get(`/traceability/${t}/${targetId}`)) }
    catch (e: any) { alert(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Trazabilidad bidireccional" subtitle="Desde un lote: hacia atrás (qué se usó) y hacia adelante (a qué clientes se vendió)" />

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por número de lote (interno o proveedor)..." className="input pl-9" />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 border border-surface-200 dark:border-surface-800 rounded-lg divide-y divide-surface-100 dark:divide-surface-800">
            {searchResults.map(r => (
              <button key={`${r.type}-${r.id}`} onClick={() => { loadTrace(r.type, r.id); setQuery(''); setSearchResults([]) }} className="w-full text-left p-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase text-surface-500 w-24 shrink-0">{r.type.replace('_', ' ')}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-surface-500 truncate">{r.subtitle}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-surface-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-surface-500 text-center py-8">Cargando trazabilidad...</p>}

      {!loading && !data && (
        <EmptyState icon={<GitBranch className="w-5 h-5" />} title="Selecciona un lote" description="Busca por número de lote para ver su trazabilidad completa." />
      )}

      {!loading && data && type === 'raw_lot' && <RawLotTrace data={data} suppliers={suppliers} users={users} products={products} />}
      {!loading && data && type === 'lot' && <ProductLotTrace data={data} users={users} machines={machines} customers={[]} />}
      {!loading && data && type === 'product' && <ProductTrace data={data} lots={lots} customers={[]} />}
      {!loading && data && type === 'raw_material' && <RawMaterialTrace data={data} rawMaterialLots={rawMaterialLots} products={products} />}
    </div>
  )
}

function RawLotTrace({ data, suppliers, users, products }: any) {
  const { lot, material, supplier, summary, direction } = data
  return (
    <div className="space-y-4">
      <div className="card p-5 bg-cyan-50/30 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900/50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-cyan-100 dark:bg-cyan-950/40 grid place-items-center"><Beaker className="w-6 h-6 text-cyan-600" /></div>
          <div className="flex-1">
            <p className="text-xs text-surface-500 uppercase font-bold tracking-wider">Lote de materia prima</p>
            <p className="text-2xl font-bold font-mono">{lot.internalLotNumber}</p>
            <p className="text-sm text-surface-600 dark:text-surface-400">Lote proveedor: <span className="font-mono">{lot.supplierLotNumber}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-surface-500">Estado</p>
            <span className={`badge ${lot.status === 'activo' ? 'bg-emerald-100 text-emerald-800' : lot.status === 'caducado' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{lot.status}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Info label="Material" value={material?.name} />
          <Info label="Proveedor" value={supplier?.name} />
          <Info label="Recibido" value={formatDate(lot.receivedDate)} />
          <Info label="Caducidad" value={formatDate(lot.expiryDate)} />
          <Info label="Recibido" value={`${formatNumber(lot.quantityReceived)} ${lot.unit}`} />
          <Info label="Restante" value={`${formatNumber(lot.quantityRemaining)} ${lot.unit}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Productos donde se usó" value={direction.forward.length} icon={Package} tone="brand" />
        <StatCard label="Lotes de producto" value={direction.forward.length} icon={Factory} tone="violet" />
        <StatCard label="Cantidad restante" value={`${formatNumber(lot.quantityRemaining)} ${lot.unit}`} icon={Beaker} tone="emerald" />
        <StatCard label="Caducidad" value={formatDate(lot.expiryDate)} icon={Calendar} tone="amber" />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-emerald-600" /> Trazabilidad hacia adelante — ¿En qué productos se usó este lote?</h3>
        {direction.forward.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-4">Este lote aún no se ha utilizado en ninguna fabricación.</p>
        ) : (
          <div className="space-y-2">
            {direction.forward.map((f: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold">{f.lot.lotNumber}</p>
                  <p className="text-xs text-surface-500">{f.product?.name} · {formatDateTime(f.lot.producedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-surface-500">Consumido</p>
                  <p className="font-semibold tabular-nums">{formatNumber(f.quantityUsed, 3)} {f.unit}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductLotTrace({ data, users, machines, customers }: any) {
  const { lot, product, operator, machine, summary, direction } = data
  return (
    <div className="space-y-4">
      <div className="card p-5 bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 grid place-items-center"><Package className="w-6 h-6 text-emerald-600" /></div>
          <div className="flex-1">
            <p className="text-xs text-surface-500 uppercase font-bold tracking-wider">Lote de producto terminado</p>
            <p className="text-2xl font-bold font-mono">{lot.lotNumber}</p>
            <p className="text-sm text-surface-600 dark:text-surface-400">O.F.: <span className="font-mono">{lot.productionOrderNumber}</span> · {formatNumber(lot.quantity)} ud de {product?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-surface-500">Estado</p>
            <span className={`badge ${lot.status === 'completado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{lot.status}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Info label="Operario" value={operator?.fullName} />
          <Info label="Máquina" value={machine?.name} />
          <Info label="Fabricado" value={formatDateTime(lot.producedAt)} />
          <Info label="Caducidad" value={lot.expiryDate ? formatDate(lot.expiryDate) : '-'} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Lotes de MP usados" value={direction.backward.length} icon={Beaker} tone="cyan" />
        <StatCard label="Cantidad producida" value={formatNumber(lot.quantity)} icon={Factory} tone="emerald" />
        <StatCard label="Clientes" value={direction.forward.length} icon={UsersIcon} tone="violet" />
        <StatCard label="Operario" value={operator?.fullName?.split(' ')[0] || '-'} icon={UsersIcon} tone="brand" />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><ArrowLeft className="w-4 h-4 text-cyan-600" /> Trazabilidad hacia atrás — ¿Qué materias primas se usaron?</h3>
        {direction.backward.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-4">Sin detalle de lotes de MP registrados.</p>
        ) : (
          <div className="space-y-2">
            {direction.backward.map((b: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-cyan-50/30 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/50">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm flex items-center gap-2"><Beaker className="w-3.5 h-3.5 text-cyan-600" />{b.material?.name}</p>
                  <p className="font-mono text-sm font-semibold">{formatNumber(b.quantity, 3)} {b.unit}</p>
                </div>
                {b.lot && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                    <div><span className="text-surface-500">Lote interno:</span> <span className="font-mono font-semibold">{b.lot.internalLotNumber}</span></div>
                    <div><span className="text-surface-500">Lote proveedor:</span> <span className="font-mono">{b.lot.supplierLotNumber}</span></div>
                    <div><span className="text-surface-500">Proveedor:</span> {b.supplier?.name}</div>
                    <div><span className="text-surface-500">Caducidad:</span> {formatDate(b.lot.expiryDate)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-violet-600" /> Trazabilidad hacia adelante — ¿A qué clientes se vendió?</h3>
        {direction.forward.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-4">Este lote aún no se ha vendido.</p>
        ) : (
          <div className="space-y-1.5">
            {direction.forward.map((f: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold">{f.order.number}</p>
                  <p className="text-xs text-surface-500">{f.customer?.name} · {formatDateTime(f.order.createdAt)}</p>
                </div>
                <p className="font-semibold tabular-nums">{f.units} ud</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductTrace({ data, lots, customers }: any) {
  const { product, lots: productLots, customers: productCustomers } = data
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-xl font-bold">{product.name}</h3>
        <p className="text-sm text-surface-500">{product.code} · {product.bottleSize}ml</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <StatCard label="Lotes fabricados" value={productLots.length} icon={Factory} tone="brand" />
          <StatCard label="Total unidades" value={formatNumber(productLots.reduce((s: number, l: any) => s + l.quantity, 0))} icon={Package} tone="emerald" />
          <StatCard label="Stock actual" value={formatNumber(product.stock)} icon={Beaker} tone="violet" />
          <StatCard label="Clientes" value={productCustomers.length} icon={UsersIcon} tone="cyan" />
        </div>
      </div>
    </div>
  )
}

function RawMaterialTrace({ data, rawMaterialLots, products }: any) {
  const { material, lots, usedInProducts } = data
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-xl font-bold flex items-center gap-2"><Beaker className="w-5 h-5 text-cyan-600" />{material.name}</h3>
        <p className="text-sm text-surface-500">{material.code} · Stock actual: {formatNumber(material.stock)} {material.unit}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <StatCard label="Lotes registrados" value={lots.length} icon={Package} tone="brand" />
          <StatCard label="Productos donde se usa" value={usedInProducts.length} icon={Factory} tone="violet" />
        </div>
        <h4 className="font-semibold mt-6 mb-2">Lotes de MP registrados</h4>
        <div className="space-y-1">
          {lots.map((l: any) => (
            <div key={l.id} className="p-2 rounded bg-surface-50 dark:bg-surface-800/50 flex justify-between text-sm">
              <span className="font-mono">{l.internalLotNumber}</span>
              <span className="text-surface-500">{formatNumber(l.quantityRemaining)} {l.unit} · {l.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">{label}</p>
      <p className="font-medium text-sm mt-0.5">{value || '-'}</p>
    </div>
  )
}
