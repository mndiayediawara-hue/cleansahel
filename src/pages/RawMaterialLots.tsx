
import { useState, useEffect, useRef } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Beaker, Search, Plus, FileText, Calendar, AlertTriangle, ShieldOff, Download, Eye, GitBranch, Truck, Lock, Printer, QrCode } from 'lucide-react'
import { formatDate, formatNumber, formatDateTime, relativeTime } from '@/lib/utils'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import type { RawMaterialLot, Certificate } from '@/types'

export default function RawMaterialLots() {
  const { rawMaterialLots, rawMaterials, suppliers, users, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [viewing, setViewing] = useState<RawMaterialLot | null>(null)
  const [printing, setPrinting] = useState<RawMaterialLot | null>(null)
  const [blocking, setBlocking] = useState<RawMaterialLot | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')

  const filtered = rawMaterialLots.filter(l => {
    const m = rawMaterials.find(x => x.id === l.rawMaterialId)
    const s = suppliers.find(x => x.id === l.supplierId)
    const matchesQ = !query || [l.internalLotNumber, l.supplierLotNumber, m?.name, s?.name].some(v => String(v || '').toLowerCase().includes(query.toLowerCase()))
    const matchesS = !statusFilter || l.status === statusFilter
    const matchesM = !materialFilter || l.rawMaterialId === materialFilter
    return matchesQ && matchesS && matchesM
  })

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      // Auto-crear materia prima si escribimos una nueva
      let rawMaterialId = editing.rawMaterialId || ''
      if (editing.rawMaterialName && !rawMaterialId) {
        const match = rawMaterials.find((m: any) => m.name.toLowerCase() === editing.rawMaterialName.toLowerCase())
        if (match) rawMaterialId = match.id
        else {
          try {
            const newM = await api.post('/raw-materials', { name: editing.rawMaterialName, code: 'RM-' + Date.now().toString().slice(-6), unit: editing.unit || 'L', category: 'General', stock: 0, minStock: 0, price: 0, active: true })
            rawMaterialId = (newM as any).id
            await refreshOne('rawMaterials')
          } catch (e: any) { return alert('No se pudo crear la materia prima: ' + e.message) }
        }
      }
      // Auto-crear proveedor si escribimos uno nuevo
      let supplierId = editing.supplierId || ''
      if (editing.supplierName && !supplierId) {
        const match = suppliers.find((s: any) => s.name.toLowerCase() === editing.supplierName.toLowerCase())
        if (match) supplierId = match.id
        else {
          try {
            const newS = await api.post('/suppliers', { name: editing.supplierName, country: 'España' })
            supplierId = (newS as any).id
            await refreshOne('suppliers')
          } catch (e: any) { return alert('No se pudo crear el proveedor: ' + e.message) }
          }
      }
      const payload = { ...editing, rawMaterialId, supplierId, certificates: editing.certificates || [], quantityRemaining: editing.quantityReceived || 0 }
      await api.post('/raw-material-lots', payload)
      await refreshOne('rawMaterialLots')
      await refreshOne('rawMaterials')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function block() {
    if (!blocking) return
    try {
      await api.post(`/raw-material-lots/${blocking.id}/block`, { reason: blockReason })
      await refreshOne('rawMaterialLots')
      setBlocking(null); setBlockReason('')
    } catch (e: any) { alert(e.message) }
  }

  const expiredCount = rawMaterialLots.filter(l => l.status === 'caducado').length
  const activeCount = rawMaterialLots.filter(l => l.status === 'activo').length
  const blockedCount = rawMaterialLots.filter(l => l.status === 'bloqueado' || l.status === 'retirado').length
  const expiringSoon = rawMaterialLots.filter(l => {
    if (l.status !== 'activo') return false
    const exp = new Date(l.expiryDate).getTime()
    const now = Date.now()
    return (exp - now) < 60 * 86400000 // 60 días
  }).length

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      activo: { label: 'Activo', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
      bloqueado: { label: 'Bloqueado', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
      caducado: { label: 'Caducado', cls: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' },
      retirado: { label: 'Retirado', cls: 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200' },
      agotado: { label: 'Agotado', cls: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300' },
    }
    return <span className={`badge ${map[s]?.cls || ''}`}>{map[s]?.label || s}</span>
  }

  const columns = [
    { key: 'internalLotNumber', label: 'Lote interno', sortable: true, render: (l: RawMaterialLot) => <div><p className="font-mono text-xs font-semibold">{l.internalLotNumber}</p><p className="text-[10px] text-surface-500">Prov: {l.supplierLotNumber}</p></div> },
    { key: 'material', label: 'Material', render: (l: RawMaterialLot) => {
        const m = rawMaterials.find(x => x.id === l.rawMaterialId)
        return <div><p className="font-medium">{m?.name || '?'}</p><p className="text-xs text-surface-500">{m?.code}</p></div>
      }
    },
    { key: 'supplier', label: 'Proveedor', render: (l: RawMaterialLot) => <span className="text-xs">{suppliers.find(x => x.id === l.supplierId)?.name || '-'}</span> },
    { key: 'quantity', label: 'Stock', align: 'right' as const, render: (l: RawMaterialLot) => {
        const pct = l.quantityReceived > 0 ? (l.quantityRemaining / l.quantityReceived) * 100 : 0
        return <div><p className="font-semibold tabular-nums">{formatNumber(l.quantityRemaining)} / {formatNumber(l.quantityReceived)} {l.unit}</p><div className="w-20 h-1 bg-surface-200 dark:bg-surface-700 rounded-full mt-0.5"><div className={`h-full rounded-full ${pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div></div>
      }
    },
    { key: 'expiryDate', label: 'Caducidad', sortable: true, render: (l: RawMaterialLot) => {
        const exp = new Date(l.expiryDate).getTime()
        const days = Math.floor((exp - Date.now()) / 86400000)
        const cls = days < 0 ? 'text-red-600' : days < 30 ? 'text-amber-600' : days < 90 ? 'text-orange-600' : 'text-surface-700 dark:text-surface-300'
        return <div><p className={`text-xs font-medium ${cls}`}>{formatDate(l.expiryDate)}</p><p className="text-[10px] text-surface-500">{days < 0 ? `Caducado hace ${Math.abs(days)}d` : days < 60 ? `En ${days} días` : ''}</p></div>
      }
    },
    { key: 'certs', label: 'Docs', render: (l: RawMaterialLot) => <span className="text-xs inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {(l.certificates || []).length}</span> },
    { key: 'status', label: 'Estado', render: (l: RawMaterialLot) => statusBadge(l.status) },
    { key: 'actions', label: '', align: 'right' as const, render: (l: RawMaterialLot) => (
        <div className="flex items-center justify-end gap-1">
          <Link to={`/trace/${l.id}`} className="btn-ghost p-1.5" title="Trazabilidad"><GitBranch className="w-3.5 h-3.5" /></Link>
          <button onClick={() => setViewing(l)} className="btn-ghost p-1.5" title="Ver"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => setPrinting(l)} className="btn-ghost p-1.5 text-brand-600" title="Imprimir etiqueta"><Printer className="w-3.5 h-3.5" /></button>
          {l.status === 'activo' && can('almacen') && <button onClick={() => setBlocking(l)} className="btn-ghost p-1.5 text-amber-600" title="Bloquear"><Lock className="w-3.5 h-3.5" /></button>}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lotes de Materias Primas"
        subtitle="Trazabilidad desde el origen: cada lote de MP queda registrado con su origen, caducidad y certificados"
        actions={
          can('almacen') && <button onClick={() => setEditing({
            internalLotNumber: `INT-${new Date().getFullYear()}-${String(rawMaterialLots.length + 1).padStart(4, '0')}`,
            supplierLotNumber: '', rawMaterialId: rawMaterials[0]?.id || '', rawMaterialName: rawMaterials[0]?.name || '', supplierId: suppliers[0]?.id || '', supplierName: suppliers[0]?.name || '',
            receivedDate: new Date().toISOString().slice(0, 10), manufactureDate: '', expiryDate: '',
            quantityReceived: 0, unit: rawMaterials[0]?.unit || 'L', notes: '', certificates: [],
          })} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo lote MP</button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Lotes activos" value={activeCount} icon={Beaker} tone="emerald" />
        <StatCard label="Caducan < 60 días" value={expiringSoon} icon={Calendar} tone={expiringSoon > 0 ? 'amber' : 'emerald'} hint="Priorizar consumo" />
        <StatCard label="Caducados" value={expiredCount} icon={AlertTriangle} tone={expiredCount > 0 ? 'red' : 'slate'} />
        <StatCard label="Bloqueados/Retirados" value={blockedCount} icon={ShieldOff} tone="amber" />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por lote interno, lote proveedor, material..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="input max-w-[200px]">
          <option value="">Todos los materiales</option>
          {rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input max-w-[200px]">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="bloqueado">Bloqueado</option>
          <option value="caducado">Caducado</option>
          <option value="retirado">Retirado</option>
        </select>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} lotes</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Beaker className="w-5 h-5" />} title="Sin lotes" description="Registra la primera entrada de materia prima con su lote." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {editing && <LotForm editing={editing} setEditing={setEditing} onClose={() => setEditing(null)} onSave={save} saving={saving} rawMaterials={rawMaterials} suppliers={suppliers} users={users} />}

      {viewing && <LotDetailModal lot={viewing} onClose={() => setViewing(null)} rawMaterials={rawMaterials} suppliers={suppliers} users={users} />}

      {printing && <PrintLotLabelModal lot={printing} onClose={() => setPrinting(null)} rawMaterials={rawMaterials} suppliers={suppliers} users={users} />}

      {blocking && (
        <Modal open onClose={() => setBlocking(null)} title={`Bloquear lote ${blocking.internalLotNumber}`} size="sm"
          footer={<><button onClick={() => setBlocking(null)} className="btn-secondary">Cancelar</button><button onClick={block} className="btn-danger">Bloquear lote</button></>}
        >
          <p className="text-sm text-surface-600 dark:text-surface-400 mb-3">El lote no podrá ser utilizado en producción hasta que se desbloquee. Indica el motivo:</p>
          <textarea className="input min-h-[80px]" value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Ej: Resultados de análisis fuera de especificación..." />
        </Modal>
      )}
    </div>
  )
}

function LotForm({ editing, setEditing, onClose, onSave, saving, rawMaterials, suppliers, users }: any) {
  const mat = rawMaterials.find((m: any) => m.id === editing.rawMaterialId)
  function addCert() {
    setEditing({ ...editing, certificates: [...(editing.certificates || []), { id: `cert-${Date.now()}`, name: '', type: 'COA', reference: '' }] })
  }
  function updateCert(i: number, key: string, value: string) {
    const certs = [...editing.certificates]
    certs[i] = { ...certs[i], [key]: value }
    setEditing({ ...editing, certificates: certs })
  }
  function removeCert(i: number) {
    const certs = [...editing.certificates]
    certs.splice(i, 1)
    setEditing({ ...editing, certificates: certs })
  }
  return (
    <Modal open onClose={onClose} title={editing.id ? 'Editar lote' : 'Nuevo lote de materia prima'} size="lg"
      footer={<><button onClick={onClose} className="btn-secondary">Cancelar</button><button onClick={onSave} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Registrar lote'}</button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Lote interno <span className="text-red-500">*</span></label>
            <input className="input font-mono" value={editing.internalLotNumber || ''} onChange={e => setEditing({ ...editing, internalLotNumber: e.target.value })} />
            <p className="text-[10px] text-surface-500 mt-1">Único. Si intentas duplicar, el sistema rechazará el guardado.</p>
          </div>
          <div>
            <label className="label">Lote del proveedor <span className="text-red-500">*</span></label>
            <input className="input font-mono" value={editing.supplierLotNumber || ''} onChange={e => setEditing({ ...editing, supplierLotNumber: e.target.value })} placeholder="Ej: L-2025-001" />
          </div>
          <div>
            <label className="label">Materia prima <span className="text-red-500">*</span></label>
            <input className="input" list="rml-materials-list" value={editing.rawMaterialName || ''} onChange={e => {
              const v = e.target.value
              const m = rawMaterials.find((x: any) => x.name.toLowerCase() === v.toLowerCase())
              setEditing({ ...editing, rawMaterialName: v, rawMaterialId: m?.id || '', unit: m?.unit || editing.unit || 'L' })
            }} placeholder="Selecciona o escribe" />
            <datalist id="rml-materials-list">
              {rawMaterials.map((m: any) => <option key={m.id} value={m.name} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Proveedor <span className="text-red-500">*</span></label>
            <input className="input" list="rml-suppliers-list" value={editing.supplierName || ''} onChange={e => {
              const v = e.target.value
              const s = suppliers.find((x: any) => x.name.toLowerCase() === v.toLowerCase())
              setEditing({ ...editing, supplierName: v, supplierId: s?.id || '' })
            }} placeholder="Selecciona o escribe" />
            <datalist id="rml-suppliers-list">
              {suppliers.map((s: any) => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Fecha de recepción <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={editing.receivedDate?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, receivedDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Fecha de fabricación (opcional)</label>
            <input type="date" className="input" value={editing.manufactureDate?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, manufactureDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Fecha de caducidad <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={editing.expiryDate?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, expiryDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Cantidad recibida <span className="text-red-500">*</span> ({mat?.unit || 'ud'})</label>
            <input type="number" step="0.01" className="input" value={editing.quantityReceived || 0} onChange={e => setEditing({ ...editing, quantityReceived: Number(e.target.value) })} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold flex items-center gap-1.5"><FileText className="w-4 h-4" /> Certificados / Documentos</p>
            <button onClick={addCert} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Añadir</button>
          </div>
          {(!editing.certificates || editing.certificates.length === 0) ? (
            <p className="text-xs text-surface-500 text-center py-3 bg-surface-50 dark:bg-surface-800/50 rounded">Sin certificados adjuntos</p>
          ) : (
            <div className="space-y-2">
              {(editing.certificates || []).map((c: Certificate, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                  <select className="input col-span-2" value={c.type} onChange={e => updateCert(i, 'type', e.target.value)}>
                    <option value="COA">COA</option>
                    <option value="MSDS">MSDS</option>
                    <option value="otro">Otro</option>
                  </select>
                  <input className="input col-span-5" placeholder="Nombre del documento" value={c.name} onChange={e => updateCert(i, 'name', e.target.value)} />
                  <input className="input col-span-4" placeholder="Referencia" value={c.reference || ''} onChange={e => updateCert(i, 'reference', e.target.value)} />
                  <button onClick={() => removeCert(i)} className="btn-ghost p-1.5 text-red-600 col-span-1">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">Notas</label>
          <textarea className="input min-h-[60px]" value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} placeholder="Observaciones, condiciones especiales..." />
        </div>
      </div>
    </Modal>
  )
}

function PrintLotLabelModal({ lot, onClose, rawMaterials, suppliers, users }: any) {
  const mat = rawMaterials.find((m: any) => m.id === lot.rawMaterialId)
  const sup = suppliers.find((s: any) => s.id === lot.supplierId)
  const recv = users.find((u: any) => u.id === lot.receivedBy)
  const [qrUrl, setQrUrl] = useState('')

  const lotCode = lot.internalLotNumber || lot.code || '—'
  const lotProv = lot.supplierLotNumber || '—'

  // El QR codifica un JSON con la info del lote que el operario puede escanear
  const qrPayload = JSON.stringify({
    type: 'rml',
    id: lot.id,
    int: lotCode,
    prov: lotProv,
    mat: mat?.name,
    qty: lot.remaining ?? lot.quantity ?? 0,
    unit: lot.unit,
    exp: lot.expiryDate,
  })

  useEffect(() => {
    QRCode.toDataURL(qrPayload, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl(''))
  }, [qrPayload])

  // Patrón de código de barras simulado a partir del lote interno
  const barcode = (lotCode || '').split('').map((c: string, i: number) => (c.charCodeAt(0) % 4 === 0 ? 2 : 1) + (i % 2)).join(' ')

  return (
    <Modal open onClose={onClose} title="Imprimir etiqueta de lote de MP" size="md"
      footer={<>
        <button onClick={onClose} className="btn-secondary no-print">Cerrar</button>
        <button onClick={() => window.print()} className="btn-primary no-print"><Printer className="w-4 h-4" /> Imprimir</button>
      </>}
    >
      <div className="space-y-3 no-print">
        <p className="text-xs text-surface-500">Etiqueta imprimible con QR + código de barras. Pégala en el barril/envase al recibir la materia prima.</p>
      </div>
      <div className="space-y-3 printable">
        <div className="border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-xl p-5 bg-white text-black print:border-solid print:border-black" id="lot-label-printable">
          <div className="text-center mb-3 pb-2 border-b border-gray-300">
            <p className="text-[9px] uppercase font-bold tracking-widest text-gray-500">CleanSahel · Lote MP</p>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <p className="text-[9px] uppercase text-gray-500">Materia prima</p>
              <p className="text-base font-bold leading-tight">{mat?.name || '-'}</p>
              <p className="text-[10px] text-gray-600 font-mono">{mat?.code || ''}</p>
            </div>

            <div className="border-t border-gray-300 py-2 my-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div><span className="text-gray-500">Lote interno:</span> <span className="font-mono font-bold">{lotCode}</span></div>
                <div><span className="text-gray-500">Lote prov.:</span> <span className="font-mono">{lotProv}</span></div>
                <div><span className="text-gray-500">Recibido:</span> {formatDate(lot.receivedAt || lot.receivedDate)}</div>
                <div><span className="text-gray-500">Caducidad:</span> <span className="font-semibold">{formatDate(lot.expiryDate)}</span></div>
                <div><span className="text-gray-500">Cantidad:</span> <span className="font-semibold">{formatNumber(lot.remaining ?? lot.quantity ?? 0)} {lot.unit}</span></div>
                <div><span className="text-gray-500">Proveedor:</span> {sup?.name || '-'}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex-1">
                <div className="flex items-end h-9 gap-px" style={{ background: 'repeating-linear-gradient(90deg, #000 ' + barcode + ', transparent ' + barcode + ')' }} />
                <p className="text-[9px] font-mono text-center mt-1 text-gray-600">{lotCode}</p>
              </div>
              <div className="shrink-0">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR" className="w-[100px] h-[100px]" />
                ) : (
                  <div className="w-[100px] h-[100px] bg-surface-100 border border-gray-300 rounded grid place-items-center text-[8px] text-gray-400 text-center">Generando<br/>QR...</div>
                )}
                <p className="text-[8px] text-center text-gray-500 mt-0.5">Escanea para ver detalle</p>
              </div>
            </div>

            <div className="pt-1 border-t border-gray-300 flex items-center justify-between text-[9px] text-gray-500">
              <span>Rec.: {lot.supplierName || recv?.fullName || '-'}</span>
              <span>Estado: <span className="font-semibold uppercase">{lot.status === 'active' ? 'ACTIVO' : (lot.status === 'blocked' ? 'BLOQUEADO' : lot.status?.toUpperCase() || '-')}</span></span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-surface-500 text-center no-print">Tip: imprime en papel adhesivo y pégalo en el barril. Al usarlo en producción, escanea el QR con la sección Escáner para localizar el lote.</p>
      </div>
    </Modal>
  )
}


function LotDetailModal({ lot, onClose, rawMaterials, suppliers, users }: any) {
  const mat = rawMaterials.find((m: any) => m.id === lot.rawMaterialId)
  const sup = suppliers.find((s: any) => s.id === lot.supplierId)
  const recv = users.find((u: any) => u.id === lot.receivedBy)
  const lotCode = lot.internalLotNumber || lot.code || '—'
  return (
    <Modal open onClose={onClose} title={`Lote ${lotCode}`} size="lg"
      footer={<button onClick={onClose} className="btn-secondary">Cerrar</button>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Lote proveedor</p>
            <p className="font-mono font-semibold">{lot.supplierLotNumber || '-'}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Material</p>
            <p className="font-semibold">{mat?.name}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Proveedor</p>
            <p className="font-semibold">{sup?.name || '-'}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Cantidad</p>
            <p className="font-semibold">{formatNumber(lot.remaining ?? lot.quantity ?? 0)} / {formatNumber(lot.quantity ?? 0)} {lot.unit}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Recepción</p>
            <p className="font-semibold">{formatDate(lot.receivedAt || lot.receivedDate)}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
            <p className="text-xs text-surface-500">Caducidad</p>
            <p className="font-semibold">{formatDate(lot.expiryDate)}</p>
          </div>
        </div>
        {lot.notes && <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm">{lot.notes}</div>}
        {lot.blockedReason && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300"><strong>Bloqueado:</strong> {lot.blockedReason}</div>}
        <div>
          <p className="text-sm font-semibold mb-2">Certificados ({(lot.certificates || []).length})</p>
          {(!lot.certificates || lot.certificates.length === 0) ? <p className="text-xs text-surface-500">Sin certificados</p> : (
            <div className="space-y-1.5">
              {(lot.certificates || []).map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded bg-surface-50 dark:bg-surface-800/50 text-sm">
                  <FileText className="w-3.5 h-3.5 text-surface-500" />
                  <span className="font-medium">{c.name}</span>
                  <span className="badge bg-surface-200 dark:bg-surface-700 text-[10px]">{c.type}</span>
                  {c.reference && <span className="text-xs text-surface-500 font-mono">{c.reference}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}