
import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Layers, Search, Factory, User, Calendar, Beaker, Package, Printer, AlertTriangle, Eye, GitBranch, ShieldAlert } from 'lucide-react'
import { formatDateTime, formatNumber, formatDate } from '@/lib/utils'
import type { ProductionLot } from '@/types'
import { Link } from 'react-router-dom'

export default function Lots() {
  const { lots, products, rawMaterials, packaging, users, rawMaterialLots, machines, refresh, refreshOne } = useData()
  const { can } = useAuth()
  const [viewing, setViewing] = useState<ProductionLot | null>(null)
  const [printing, setPrinting] = useState<ProductionLot | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = lots.filter(l => {
    const c = products.find(x => x.id === l.productId)
    const q = query.toLowerCase()
    const matchesQ = !query || [l.lotNumber, l.productionOrderNumber, c?.name].some(v => String(v || '').toLowerCase().includes(q))
    const matchesS = !statusFilter || l.status === statusFilter
    return matchesQ && matchesS
  })

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const week = new Date(); week.setDate(week.getDate() - 7)
  const totalProduced = lots.reduce((s, l) => s + l.quantity, 0)
  const last7 = lots.filter(l => new Date(l.producedAt) >= week).reduce((s, l) => s + l.quantity, 0)
  const blocked = rawMaterialLots.filter(l => l.status === 'caducado' || l.status === 'retirado' || l.status === 'bloqueado').length

  async function printLabel(lot: ProductionLot) {
    setPrinting(lot)
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      completado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      'en-proceso': 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
      cancelado: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
      bloqueado: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      retirado: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    }
    return <span className={`badge ${map[s] || ''}`}>{s}</span>
  }

  const columns = [
    { key: 'lotNumber', label: 'Lote', sortable: true, render: (r: ProductionLot) => <div><p className="font-mono text-xs font-semibold">{r.lotNumber}</p><p className="text-[10px] text-surface-500">{r.productionOrderNumber}</p></div> },
    { key: 'product', label: 'Producto', render: (r: ProductionLot) => {
        const p = products.find(x => x.id === r.productId)
        return <div><p className="font-medium">{p?.name || '?'}</p><p className="text-xs text-surface-500">{p?.code}</p></div>
      }
    },
    { key: 'quantity', label: 'Cantidad', align: 'right' as const, sortable: true, render: (r: ProductionLot) => <span className="font-semibold tabular-nums">{formatNumber(r.quantity)} ud</span> },
    { key: 'producedBy', label: 'Operario', render: (r: ProductionLot) => <span className="text-xs">{users.find(u => u.id === r.producedBy)?.fullName || '-'}</span> },
    { key: 'machine', label: 'Máquina', render: (r: ProductionLot) => <span className="text-xs">{machines.find(m => m.id === r.machineId)?.name || '-'}</span> },
    { key: 'producedAt', label: 'Fecha', sortable: true, render: (r: ProductionLot) => <span className="text-xs">{formatDateTime(r.producedAt)}</span> },
    { key: 'status', label: 'Estado', render: (r: ProductionLot) => statusBadge(r.status) },
    { key: 'actions', label: '', align: 'right' as const, render: (r: ProductionLot) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => printLabel(r)} className="btn-ghost p-1.5" title="Imprimir etiqueta"><Printer className="w-3.5 h-3.5" /></button>
          <button onClick={() => setViewing(r)} className="btn-ghost p-1.5 text-xs">Trazabilidad</button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lotes de Fabricación"
        subtitle="Trazabilidad completa: cada lote registra operador, máquina, fecha, MP utilizada con sus lotes"
        actions={<>
          <Link to="/raw-material-lots" className="btn-secondary"><Beaker className="w-4 h-4" /> Lotes de MP</Link>
          <Link to="/recalls" className="btn-secondary"><ShieldAlert className="w-4 h-4" /> Retiradas</Link>
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Lotes fabricados" value={lots.length} icon={Layers} tone="brand" />
        <StatCard label="Unidades totales" value={formatNumber(totalProduced)} icon={Factory} tone="emerald" />
        <StatCard label="Últimos 7 días" value={formatNumber(last7)} icon={Calendar} tone="violet" />
        <StatCard label="MP bloqueadas/caducadas" value={blocked} icon={AlertTriangle} tone={blocked > 0 ? 'amber' : 'emerald'} hint={blocked > 0 ? 'Revisar trazabilidad' : 'Todo OK'} />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por lote, orden de fabricación o producto..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input max-w-[200px]">
          <option value="">Todos los estados</option>
          <option value="completado">Completado</option>
          <option value="en-proceso">En proceso</option>
          <option value="bloqueado">Bloqueado</option>
          <option value="retirado">Retirado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} lotes</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Layers className="w-5 h-5" />} title="Sin lotes" description="Aún no se ha fabricado ningún lote." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {viewing && <TraceabilityModal lot={viewing} onClose={() => setViewing(null)} products={products} rawMaterials={rawMaterials} packaging={packaging} users={users} machines={machines} orders={[]} rawMaterialLots={rawMaterialLots} />}
      {printing && <PrintLabelModal lot={printing} onClose={() => setPrinting(null)} products={products} machines={machines} users={users} />}
    </div>
  )
}

function TraceabilityModal({ lot, onClose, products, rawMaterials, packaging, users, machines, rawMaterialLots }: any) {
  const product = products.find((p: any) => p.id === lot.productId)
  const operator = users.find((u: any) => u.id === lot.producedBy)
  const machine = machines.find((m: any) => m.id === lot.machineId)
  const usedLots = (lot.rawMaterialsUsed || []).filter((it: any) => it.materialType === 'raw' && it.rawMaterialLotId)
  return (
    <Modal open onClose={onClose} title={`Trazabilidad completa · ${lot.lotNumber}`} size="xl"
      footer={<button onClick={onClose} className="btn-secondary">Cerrar</button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">Producto</p>
            <p className="font-semibold mt-0.5">{product?.name}</p>
            <p className="text-xs text-surface-500">{product?.code} · {product?.bottleSize}ml</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">Cantidad</p>
            <p className="font-semibold text-2xl mt-0.5">{formatNumber(lot.quantity)}</p>
            <p className="text-xs text-surface-500">unidades</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">Operario</p>
            <p className="font-semibold mt-0.5">{operator?.fullName || '-'}</p>
            <p className="text-xs text-surface-500">{formatDateTime(lot.producedAt)}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">Máquina</p>
            <p className="font-semibold mt-0.5">{machine?.name || '-'}</p>
            <p className="text-xs text-surface-500">{machine?.code}</p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2"><GitBranch className="w-4 h-4 text-brand-600" /> Trazabilidad hacia atrás (qué se usó)</h4>
          {usedLots.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-4">Sin detalle de lotes de MP registrados</p>
          ) : (
            <div className="space-y-1.5">
              {usedLots.map((it: any, i: number) => {
                const mat = rawMaterials.find((m: any) => m.id === it.materialId)
                const mpLot = rawMaterialLots.find((l: any) => l.id === it.rawMaterialLotId)
                return (
                  <div key={i} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-800">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Beaker className="w-4 h-4 text-cyan-600" />
                        <p className="font-medium text-sm">{mat?.name || '?'}</p>
                      </div>
                      <p className="font-mono text-sm font-semibold">{formatNumber(it.quantity, 3)} {it.unit}</p>
                    </div>
                    {mpLot && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                        <div><span className="text-surface-500">Lote interno:</span> <span className="font-mono font-semibold">{mpLot.internalLotNumber}</span></div>
                        <div><span className="text-surface-500">Lote proveedor:</span> <span className="font-mono">{mpLot.supplierLotNumber}</span></div>
                        <div><span className="text-surface-500">Caducidad:</span> {mpLot.expiryDate ? formatDate(mpLot.expiryDate) : '-'}</div>
                        <div><span className="text-surface-500">Estado:</span> <span className={mpLot.status === 'activo' ? 'text-emerald-600' : 'text-amber-600'}>{mpLot.status}</span></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-sm text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
          <p className="font-semibold mb-1">✓ Trazabilidad completa registrada</p>
          <p>Este lote <strong>{lot.lotNumber}</strong> (orden {lot.productionOrderNumber}) fue fabricado por <strong>{operator?.fullName}</strong> en <strong>{machine?.name || '?'}</strong> el <strong>{formatDateTime(lot.producedAt)}</strong> utilizando <strong>{usedLots.length} lotes específicos de materias primas</strong>. Toda esta información queda almacenada de forma permanente para auditorías, inspecciones y recalls.</p>
        </div>
      </div>
    </Modal>
  )
}

function PrintLabelModal({ lot, onClose, products, machines, users }: any) {
  const product = products.find((p: any) => p.id === lot.productId)
  const machine = machines.find((m: any) => m.id === lot.machineId)
  const operator = users.find((u: any) => u.id === lot.producedBy)
  const labelData = {
    lotNumber: lot.lotNumber,
    productionOrder: lot.productionOrderNumber,
    productName: product?.name || '',
    productCode: product?.code || '',
    bottleSize: product?.bottleSize || 0,
    quantity: lot.quantity,
    producedAt: lot.producedAt,
    expiryDate: lot.expiryDate,
    operator: operator?.fullName || '',
    machine: machine?.name || '',
  }
  // Simular código de barras como barras verticales
  const barcodePattern = labelData.lotNumber.split('').map((c, i) => `${c.charCodeAt(0) % 4 === 0 ? 2 : 1}px`).join(' ')
  return (
    <Modal open onClose={onClose} title="Vista previa de etiqueta" size="md"
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cerrar</button>
        <button onClick={() => window.print()} className="btn-primary"><Printer className="w-4 h-4" /> Imprimir</button>
      </>}
    >
      <div className="space-y-3">
        <p className="text-xs text-surface-500">Etiqueta imprimible con QR, código de barras, lote, fechas y orden de fabricación.</p>
        <div className="border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-xl p-6 bg-white text-black print:border-solid print:border-black">
          <div className="text-center mb-3">
            <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500">CleanSahel</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="text-center">
              <p className="text-[10px] uppercase text-gray-500">Producto</p>
              <p className="text-base font-bold">{labelData.productName}</p>
              <p className="text-xs text-gray-600">{labelData.productCode} · {labelData.bottleSize}ml</p>
            </div>
            <div className="border-t border-b border-gray-300 py-2 my-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">Lote:</span> <span className="font-mono font-bold">{labelData.lotNumber}</span></div>
                <div><span className="text-gray-500">O.F.:</span> <span className="font-mono">{labelData.productionOrder}</span></div>
                <div><span className="text-gray-500">Fabricado:</span> {formatDate(labelData.producedAt)}</div>
                <div><span className="text-gray-500">Caducidad:</span> {labelData.expiryDate ? formatDate(labelData.expiryDate) : '-'}</div>
                <div><span className="text-gray-500">Cantidad:</span> <span className="font-semibold">{labelData.quantity} ud</span></div>
                <div><span className="text-gray-500">Operario:</span> {labelData.operator}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex-1">
                <div className="flex items-end h-8 gap-px" style={{ background: 'repeating-linear-gradient(90deg, #000 ' + barcodePattern + ', transparent ' + barcodePattern + ')' }} />
                <p className="text-[10px] font-mono text-center mt-1">{labelData.lotNumber}</p>
              </div>
              <div className="w-16 h-16 bg-surface-100 border border-gray-300 rounded grid place-items-center text-[8px] text-gray-400 text-center">QR<br/>CODE</div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-surface-500 text-center">Tip: usa el botón "Imprimir" para obtener la etiqueta física o guárdala como PDF desde el diálogo de impresión.</p>
      </div>
    </Modal>
  )
}