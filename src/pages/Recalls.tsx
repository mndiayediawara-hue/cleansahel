
import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { ShieldAlert, Plus, AlertTriangle, Users as UsersIcon, Package, Search, Eye, X, CheckCircle2, FileText } from 'lucide-react'
import { formatDateTime, formatNumber } from '@/lib/utils'
import type { Recall } from '@/types'

export default function Recalls() {
  const { recalls, lots, rawMaterialLots, products, customers, refreshOne } = useData()
  const { can } = useAuth()
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<Recall | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ lotType: 'materia_prima', lotId: '', reason: '', severity: 'alta' })
  const [preview, setPreview] = useState<any>(null)

  async function loadPreview() {
    if (!form.lotId) return setPreview(null)
    try {
      const res = await api.get(`/traceability/${form.lotType === 'materia_prima' ? 'raw_lot' : 'lot'}/${form.lotId}`)
      setPreview(res)
    } catch (e: any) { alert(e.message) }
  }

  async function initiate() {
    if (!form.lotId || !form.reason) return alert('Selecciona lote y motivo')
    setSaving(true)
    try {
      const recall = await api.post('/recalls', form) as Recall
      await refreshOne('recalls')
      await refreshOne('rawMaterialLots')
      await refreshOne('lots')
      setCreating(false); setForm({ lotType: 'materia_prima', lotId: '', reason: '', severity: 'alta' }); setPreview(null)
      setViewing(recall)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function complete(r: Recall) {
    const notes = prompt('Notas de cierre de la retirada:') || ''
    try { await api.post(`/recalls/${r.id}/complete`, { notes }); await refreshOne('recalls') }
    catch (e: any) { alert(e.message) }
  }

  const active = recalls.filter(r => r.status === 'iniciado' || r.status === 'en-curso').length
  const totalAffected = recalls.reduce((s, r) => s + r.totalAffected, 0)
  const customersAffected = new Set(recalls.flatMap(r => r.affectedCustomers.map(c => c.customerId))).size

  const columns = [
    { key: 'reference', label: 'Referencia', sortable: true, render: (r: Recall) => <span className="font-mono text-xs font-semibold">{r.reference}</span> },
    { key: 'sourceLotNumber', label: 'Lote origen', render: (r: Recall) => (
        <div><p className="font-mono text-xs">{r.sourceLotNumber}</p><p className="text-[10px] text-surface-500">{r.lotType === 'materia_prima' ? 'Materia prima' : 'Producto'}</p></div>
      )
    },
    { key: 'severity', label: 'Severidad', render: (r: Recall) => {
        const colors: Record<string, string> = { critica: 'bg-red-100 text-red-800', alta: 'bg-orange-100 text-orange-800', media: 'bg-amber-100 text-amber-800', baja: 'bg-sky-100 text-sky-800' }
        return <span className={`badge ${colors[r.severity]}`}>{r.severity}</span>
      }
    },
    { key: 'totalAffected', label: 'Afectadas', align: 'right' as const, render: (r: Recall) => <span className="font-semibold tabular-nums">{formatNumber(r.totalAffected)}</span> },
    { key: 'affectedCustomers', label: 'Clientes', align: 'right' as const, render: (r: Recall) => <span className="tabular-nums">{r.affectedCustomers.length}</span> },
    { key: 'status', label: 'Estado', render: (r: Recall) => {
        const map: Record<string, string> = { iniciado: 'bg-red-100 text-red-800', 'en-curso': 'bg-amber-100 text-amber-800', completado: 'bg-emerald-100 text-emerald-800', cancelado: 'bg-surface-100 text-surface-700' }
        return <span className={`badge ${map[r.status]}`}>{r.status}</span>
      }
    },
    { key: 'initiatedAt', label: 'Fecha', sortable: true, render: (r: Recall) => <span className="text-xs">{formatDateTime(r.initiatedAt)}</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: Recall) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setViewing(r)} className="btn-ghost p-1.5 text-xs"><Eye className="w-3.5 h-3.5" /></button>
          {r.status !== 'completado' && r.status !== 'cancelado' && can('admin') && <button onClick={() => complete(r)} className="btn-ghost p-1.5 text-emerald-600" title="Cerrar"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Retiradas de Producto (Recall)"
        subtitle="Sistema de retirada: localiza productos y clientes afectados por un lote problemático"
        actions={can('admin') && <button onClick={() => { setCreating(true); setTimeout(loadPreview, 100) }} className="btn-primary"><Plus className="w-4 h-4" /> Iniciar retirada</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Retiradas activas" value={active} icon={ShieldAlert} tone={active > 0 ? 'red' : 'emerald'} hint={active > 0 ? 'Atención requerida' : 'Todo OK'} />
        <StatCard label="Total realizadas" value={recalls.length} icon={FileText} tone="brand" />
        <StatCard label="Ud afectadas" value={formatNumber(totalAffected)} icon={Package} tone="amber" />
        <StatCard label="Clientes afectados" value={customersAffected} icon={UsersIcon} tone="violet" />
      </div>

      {recalls.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="w-5 h-5" />} title="Sin retiradas" description="No se ha iniciado ninguna retirada. Si todo va bien, esta lista permanecerá vacía." />
      ) : (
        <DataTable columns={columns} data={recalls} />
      )}

      {creating && (
        <Modal open onClose={() => { setCreating(false); setPreview(null) }} title="Iniciar retirada de producto" size="xl"
          footer={<><button onClick={() => { setCreating(false); setPreview(null) }} className="btn-secondary">Cancelar</button><button onClick={initiate} disabled={saving || !form.lotId} className="btn-danger"><ShieldAlert className="w-4 h-4" /> {saving ? 'Iniciando...' : 'Iniciar retirada'}</button></>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo de lote</label>
                <select className="input" value={form.lotType} onChange={e => { setForm({ ...form, lotType: e.target.value, lotId: '' }); setPreview(null) }}>
                  <option value="materia_prima">Materia prima</option>
                  <option value="producto_terminado">Producto terminado</option>
                </select>
              </div>
              <div>
                <label className="label">Severidad</label>
                <select className="input" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                  <option value="critica">Crítica</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Lote a retirar</label>
              <select className="input" value={form.lotId} onChange={e => { setForm({ ...form, lotId: e.target.value }); setTimeout(loadPreview, 50) }}>
                <option value="">— Selecciona lote —</option>
                {form.lotType === 'materia_prima' ? rawMaterialLots.map((l: any) => {
                  const m = products // not used
                  const mat = l.rawMaterialId
                  return <option key={l.id} value={l.id}>{l.internalLotNumber} · {l.supplierLotNumber} · {l.status}</option>
                }) : lots.map((l: any) => {
                  const p = products.find(x => x.id === l.productId)
                  return <option key={l.id} value={l.id}>{l.lotNumber} · {p?.name} · {l.status}</option>
                })}
              </select>
            </div>
            <div>
              <label className="label">Motivo de la retirada</label>
              <textarea className="input min-h-[80px]" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Ej: Resultados microbiológicos fuera de límites, contaminación detectada..." />
            </div>

            {preview && preview.direction?.forward && (
              <div className="border-2 border-red-200 dark:border-red-900/50 rounded-lg p-4 bg-red-50/30 dark:bg-red-950/20">
                <p className="font-semibold text-sm flex items-center gap-1.5 text-red-700 dark:text-red-300 mb-3"><AlertTriangle className="w-4 h-4" /> Vista previa del impacto</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded bg-white dark:bg-surface-900">
                    <p className="text-xs text-surface-500">Lotes de producto afectados</p>
                    <p className="text-2xl font-bold">{preview.direction.forward.length}</p>
                  </div>
                  <div className="p-3 rounded bg-white dark:bg-surface-900">
                    <p className="text-xs text-surface-500">Total ud afectadas</p>
                    <p className="text-2xl font-bold">{preview.direction.forward.reduce((s: number, x: any) => s + (x.lot?.quantity || 0), 0)}</p>
                  </div>
                </div>
                {preview.direction.forward.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {preview.direction.forward.slice(0, 5).map((x: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded bg-white dark:bg-surface-900 flex justify-between">
                        <span className="font-mono">{x.lot?.lotNumber} · {x.product?.name}</span>
                        <span className="tabular-nums">{x.lot?.quantity} ud</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {viewing && <RecallDetailModal recall={viewing} onClose={() => setViewing(null)} customers={customers} products={products} />}
    </div>
  )
}

function RecallDetailModal({ recall, onClose, customers, products }: any) {
  return (
    <Modal open onClose={onClose} title={`Retirada ${recall.reference}`} size="xl"
      footer={<button onClick={onClose} className="btn-secondary">Cerrar</button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Lote origen</p>
            <p className="font-mono font-semibold">{recall.sourceLotNumber}</p>
            <p className="text-xs text-surface-500 capitalize">{recall.lotType.replace('_', ' ')}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Severidad</p>
            <p className="font-semibold capitalize">{recall.severity}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Estado</p>
            <p className="font-semibold capitalize">{recall.status}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Iniciada</p>
            <p className="font-semibold text-sm">{formatDateTime(recall.initiatedAt)}</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-sm">
          <p className="font-semibold text-red-700 dark:text-red-300">Motivo:</p>
          <p className="text-red-700 dark:text-red-300 mt-1">{recall.reason}</p>
        </div>

        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Lotes de producto afectados ({recall.affectedProductLots.length})</h4>
          {recall.affectedProductLots.length === 0 ? <p className="text-sm text-surface-500">Ninguno</p> : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800/50">
                  <tr className="text-left text-[10px] uppercase font-bold text-surface-500">
                    <th className="px-3 py-2">Lote</th><th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2 text-right">En almacén</th><th className="px-3 py-2 text-right">Vendido</th><th className="px-3 py-2 text-right">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {recall.affectedProductLots.map((al: any) => (
                    <tr key={al.lotId} className="border-t border-surface-100 dark:border-surface-800">
                      <td className="px-3 py-2 font-mono text-xs">{al.lotNumber}</td>
                      <td className="px-3 py-2">{al.productName}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-semibold">{al.inStock}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">{al.sold}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">{al.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Clientes afectados ({recall.affectedCustomers.length})</h4>
          {recall.affectedCustomers.length === 0 ? <p className="text-sm text-surface-500">Ninguno</p> : (
            <div className="space-y-1.5">
              {recall.affectedCustomers.map((c: any) => (
                <div key={c.customerId} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.customerName}</p>
                    <p className="text-xs text-surface-500">Pedidos: {c.orderNumbers.join(', ')}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{c.totalUnits} ud</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}