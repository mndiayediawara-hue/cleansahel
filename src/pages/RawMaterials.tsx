
import { useState, useEffect } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { formatCurrency, formatNumber, formatDate, exportCSV } from '@/lib/utils'
import { Beaker, AlertTriangle, DollarSign, Plus, Download, Search, Truck, Filter, Printer } from 'lucide-react'
import QRCode from 'qrcode'
import type { RawMaterial } from '@/types'

const CATEGORIES = [
  { value: 'concentrado', label: 'Concentrado' },
  { value: 'agua', label: 'Agua' },
  { value: 'colorante', label: 'Colorante' },
  { value: 'aroma', label: 'Aroma' },
  { value: 'conservante', label: 'Conservante' },
  { value: 'espesante', label: 'Espesante' },
  { value: 'sal', label: 'Sal' },
  { value: 'otro', label: 'Otro' },
]
const UNITS = ['L', 'ml', 'kg', 'g', 'ud']

const emptyMaterial: any = {
  code: '', name: '', category: 'otro', unit: 'L',
  stock: 0, minStock: 0, maxStock: 0, price: 0, location: '', supplierId: '', lot: '', expiryDate: ''
}

export default function RawMaterials() {
  const { rawMaterials, suppliers, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [labelData, setLabelData] = useState<any | null>(null)
  const [entryFor, setEntryFor] = useState<RawMaterial | null>(null)
  const [confirm, setConfirm] = useState<RawMaterial | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowOnly, setLowOnly] = useState(false)

  const filtered = rawMaterials.filter(m =>
    (!categoryFilter || m.category === categoryFilter) &&
    (!lowOnly || m.stock < m.minStock) &&
    (!query || [m.code, m.name, m.location, m.lot].some(v => String(v || '').toLowerCase().includes(query.toLowerCase())))
  )

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      let supplierId = editing.supplierId || ''
      if (editing.supplierName && !supplierId) {
        try {
          const newSup = await api.post('/suppliers', { name: editing.supplierName, country: 'España' })
          supplierId = (newSup as any).id
          await refreshOne('suppliers')
        } catch {}
      }
      const payload = { ...editing, supplierId }
      if (editing.id) {
        await api.put(`/raw-materials/${editing.id}`, payload)
        await refreshOne('rawMaterials')
        setEditing(null)
      } else {
        const created = await api.post('/raw-materials', payload) as any
        await refreshOne('rawMaterials')
        setEditing(null)
        setLabelData({ ...editing, id: created.id, supplierId })
      }
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(m: RawMaterial) {
    try { await api.del(`/raw-materials/${m.id}`); await refreshOne('rawMaterials') }
    catch (e: any) { alert(e.message) }
  }

  const totalValue = rawMaterials.reduce((s, m) => s + m.stock * m.price, 0)
  const lowCount = rawMaterials.filter(m => m.stock < m.minStock).length

  const columns = [
    { key: 'code', label: 'Código', sortable: true, render: (r: RawMaterial) => <span className="font-mono text-xs">{r.code}</span> },
    { key: 'name', label: 'Nombre', sortable: true, render: (r: RawMaterial) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-surface-500 capitalize">{r.category}</p></div> },
    { key: 'stock', label: 'Stock', sortable: true, align: 'right' as const, render: (r: RawMaterial) => {
        const low = r.stock < r.minStock
        return (
          <div>
            <p className={`font-semibold tabular-nums ${low ? 'text-red-600' : ''}`}>{formatNumber(r.stock, 2)} {r.unit}</p>
            {low && <p className="text-[10px] text-red-600">Mín: {r.minStock}</p>}
          </div>
        )
      }
    },
    { key: 'price', label: 'Precio', sortable: true, align: 'right' as const, render: (r: RawMaterial) => <span className="tabular-nums">{formatCurrency(r.price)}/{r.unit}</span> },
    { key: 'value', label: 'Valor', align: 'right' as const, render: (r: RawMaterial) => <span className="tabular-nums font-semibold">{formatCurrency(r.stock * r.price)}</span> },
    { key: 'supplier', label: 'Proveedor', render: (r: RawMaterial) => <span className="text-xs">{suppliers.find(s => s.id === r.supplierId)?.name || '-'}</span> },
    { key: 'location', label: 'Ubicación', render: (r: RawMaterial) => <span className="text-xs font-mono">{r.location}</span> },
    { key: 'expiryDate', label: 'Caducidad', render: (r: RawMaterial) => r.expiryDate ? <span className="text-xs">{formatDate(r.expiryDate)}</span> : <span className="text-xs text-surface-400">-</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: RawMaterial) => (
        <div className="flex items-center justify-end gap-1">
          {can('materials.write') && <button onClick={() => setEntryFor(r)} className="btn-ghost p-1.5" title="Registrar entrada"><Truck className="w-3.5 h-3.5" /></button>}
          {can('materials.write') && <button onClick={() => setEditing(r)} className="btn-ghost p-1.5 text-xs">Editar</button>}
          {can('admin') && <button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600 text-xs">Borrar</button>}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Materias Primas"
        subtitle="Control de concentrados, agua, colorantes, aromas, conservantes y demás componentes químicos"
        actions={
          <>
            <button onClick={() => exportCSV('materias-primas', filtered as any)} className="btn-secondary"><Download className="w-4 h-4" /> CSV</button>
            {can('materials.write') && (
              <button onClick={() => setEditing({ ...emptyMaterial, code: `RM-${String(rawMaterials.length + 1).padStart(3, '0')}` })} className="btn-primary"><Plus className="w-4 h-4" /> Nueva materia prima</button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total referencias" value={rawMaterials.length} icon={Beaker} tone="brand" />
        <StatCard label="Valor total" value={formatCurrency(totalValue)} icon={DollarSign} tone="emerald" />
        <StatCard label="Stock bajo" value={lowCount} icon={AlertTriangle} tone="amber" hint={lowCount > 0 ? 'Revisa las alertas' : 'Todo OK'} />
        <StatCard label="Categorías" value={new Set(rawMaterials.map(m => m.category)).size} icon={Filter} tone="violet" hint="Tipos diferentes" />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por código, nombre, lote..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input max-w-[200px]">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="rounded" />
          <span>Solo stock bajo</span>
        </label>
        <div className="text-xs text-surface-500 ml-auto">{filtered.length} de {rawMaterials.length}</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Beaker className="w-5 h-5" />} title="Sin materias primas" description="Crea tu primera materia prima para empezar." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title={editing.id ? 'Editar materia prima' : 'Nueva materia prima'} size="lg"
          footer={<>
            <button onClick={() => setEditing(null)} className="btn-secondary">Cerrar</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Código</label><input className="input" value={editing.code || ''} onChange={e => setEditing({ ...editing, code: e.target.value })} /></div>
            <div><label className="label">Nombre</label><input className="input" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label className="label">Categoría</label>
              <select className="input" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div><label className="label">Unidad</label>
              <select className="input" value={editing.unit} onChange={e => setEditing({ ...editing, unit: e.target.value })}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="label">Stock</label><input type="number" step="0.01" className="input" value={editing.stock || 0} onChange={e => setEditing({ ...editing, stock: Number(e.target.value) })} /></div>
            <div><label className="label">Stock mínimo</label><input type="number" step="0.01" className="input" value={editing.minStock || 0} onChange={e => setEditing({ ...editing, minStock: Number(e.target.value) })} /></div>
            <div><label className="label">Stock máximo</label><input type="number" step="0.01" className="input" value={editing.maxStock || 0} onChange={e => setEditing({ ...editing, maxStock: Number(e.target.value) })} /></div>
            <div><label className="label">Precio (€/{editing.unit})</label><input type="number" step="0.0001" className="input" value={editing.price || 0} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
            <div>
              <label className="label">Proveedor</label>
              <input
                className="input"
                list="suppliers-list"
                value={editing.supplierName || ''}
                onChange={e => {
                  const v = e.target.value
                  const match = suppliers.find(s => s.name.toLowerCase() === v.toLowerCase())
                  setEditing({ ...editing, supplierName: v, supplierId: match?.id || '' })
                }}
                placeholder="Escribe o selecciona un proveedor"
              />
              <datalist id="suppliers-list">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
              <p className="text-[10px] text-surface-500 mt-1">Si el proveedor no existe, se crea automáticamente al guardar.</p>
            </div>
            <div><label className="label">Ubicación</label><input className="input" value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} /></div>
            <div><label className="label">Lote</label><input className="input" value={editing.lot || ''} onChange={e => setEditing({ ...editing, lot: e.target.value })} /></div>
            <div><label className="label">Fecha de caducidad</label><input type="date" className="input" value={editing.expiryDate?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, expiryDate: e.target.value })} /></div>
          </div>
        </Modal>
      )}

      {entryFor && <EntryModal material={entryFor} onClose={() => setEntryFor(null)} onSaved={() => { setEntryFor(null); refreshOne('rawMaterials') }} />}

      {labelData && <PrintMaterialLabelModal material={labelData} suppliers={suppliers} onClose={() => setLabelData(null)} />}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && remove(confirm)}
        title="Confirmar borrado"
        message={`¿Eliminar "${confirm?.name}"? Esta acción no se puede deshacer y quedará registrada en el historial.`}
        danger
      />
    </div>
  )
}

function EntryModal({ material, onClose, onSaved }: { material: RawMaterial; onClose: () => void; onSaved: () => void }) {
  const [quantity, setQuantity] = useState(0)
  const [price, setPrice] = useState(material.price)
  const [lot, setLot] = useState('')
  const [expiry, setExpiry] = useState('')
  const [invoice, setInvoice] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (quantity <= 0) return alert('Cantidad debe ser mayor a 0')
    setSaving(true)
    try {
      await api.post(`/raw-materials/${material.id}/entry`, { quantity, price, lot, expiryDate: expiry, invoice })
      onSaved()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Entrada de ${material.name}`} size="md"
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Registrando...' : 'Registrar entrada'}</button>
      </>}
    >
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800 text-sm">
          <p>Stock actual: <strong>{formatNumber(material.stock)} {material.unit}</strong> · Mín: {material.minStock}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Cantidad recibida ({material.unit})</label><input type="number" step="0.01" className="input" value={quantity} onChange={e => setQuantity(Number(e.target.value))} autoFocus /></div>
          <div><label className="label">Precio unitario (€)</label><input type="number" step="0.0001" className="input" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div><label className="label">Lote</label><input className="input" value={lot} onChange={e => setLot(e.target.value)} /></div>
          <div><label className="label">Fecha de caducidad</label><input type="date" className="input" value={expiry} onChange={e => setExpiry(e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Número de factura</label><input className="input" value={invoice} onChange={e => setInvoice(e.target.value)} placeholder="F-2025/0000" /></div>
        </div>
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-sm text-emerald-800 dark:text-emerald-300">
          <p>Stock resultante: <strong>{formatNumber(material.stock + quantity)} {material.unit}</strong> · Valor: <strong>{formatCurrency((material.stock + quantity) * price)}</strong></p>
        </div>
      </div>
    </Modal>
  )
}

function PrintMaterialLabelModal({ material, suppliers, onClose }: { material: any; suppliers: any[]; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState('')
  const sup = suppliers.find((s: any) => s.id === material.supplierId)
  const catLabel = CATEGORIES.find(c => c.value === material.category)?.label || material.category

  useEffect(() => {
    const qrPayload = JSON.stringify({ type: 'rm', id: material.id, code: material.code, name: material.name, cat: catLabel })
    QRCode.toDataURL(qrPayload, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl(''))
  }, [material.id])

  const barcode = (material.code || '').split('').map((c: string, i: number) => (c.charCodeAt(0) % 4 === 0 ? 2 : 1) + (i % 2)).join(' ')

  return (
    <Modal open onClose={onClose} title="Etiqueta de materia prima" size="md"
      footer={<>
        <button onClick={onClose} className="btn-secondary no-print">Cerrar</button>
        <button onClick={() => window.print()} className="btn-primary no-print"><Printer className="w-4 h-4" /> Imprimir</button>
      </>}
    >
      <div className="space-y-3 no-print">
        <p className="text-xs text-surface-500">Etiqueta con QR y código de barras para pegar en el barril o envase.</p>
      </div>
      <div className="space-y-3 printable">
        <div className="border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-xl p-5 bg-white text-black print:border-solid print:border-black" id="material-label-printable">
          <div className="text-center mb-3 pb-2 border-b border-gray-300">
            <p className="text-[9px] uppercase font-bold tracking-widest text-gray-500">CleanSahel · Materia Prima</p>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-[9px] uppercase text-gray-500">Nombre</p>
              <p className="text-base font-bold leading-tight">{material.name || '-'}</p>
              <p className="text-[10px] text-gray-600 font-mono">{material.code || ''}</p>
            </div>
            <div className="border-t border-gray-300 py-2 my-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div><span className="text-gray-500">Categoría:</span> {catLabel}</div>
                <div><span className="text-gray-500">Unidad:</span> {material.unit}</div>
                <div><span className="text-gray-500">Stock mín:</span> {formatNumber(material.minStock || 0)}</div>
                <div><span className="text-gray-500">Stock máx:</span> {formatNumber(material.maxStock || 0)}</div>
                <div><span className="text-gray-500">Ubicación:</span> {material.location || '-'}</div>
                <div><span className="text-gray-500">Proveedor:</span> {sup?.name || material.supplierName || '-'}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex-1">
                <div className="flex items-end h-9 gap-px" style={{ background: 'repeating-linear-gradient(90deg, #000 ' + barcode + ', transparent ' + barcode + ')' }} />
                <p className="text-[9px] font-mono text-center mt-1 text-gray-600">{material.code}</p>
              </div>
              <div className="shrink-0">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR" className="w-[90px] h-[90px]" />
                ) : (
                  <div className="w-[90px] h-[90px] bg-surface-100 border border-gray-300 rounded grid place-items-center text-[8px] text-gray-400 text-center">Generando QR...</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-surface-500 text-center no-print">Imprime en papel adhesivo y pégalo en el envase. Escanea el QR para ver la info del producto.</p>
      </div>
    </Modal>
  )
}