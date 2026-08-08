import { useState, useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { ShoppingCart, DollarSign, Plus, Trash2, Package, Search, CheckCircle2, Clock } from 'lucide-react'
import { formatCurrency, formatDate, exportCSV } from '@/lib/utils'
import type { Order, OrderStatus } from '@/types'

const STATUS_TONES: Record<OrderStatus, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  confirmado: { label: 'Confirmado', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300' },
  preparando: { label: 'Preparando', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300' },
  enviado: { label: 'Enviado', cls: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-300' },
  entregado: { label: 'Entregado', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' },
}

export default function Orders() {
  const { orders, customers, products, config, refreshOne } = useData()
  const { can } = useAuth()
  const [editing, setEditing] = useState<any | null>(null)
  const [confirm, setConfirm] = useState<Order | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filtered = orders.filter(o => {
    const c = customers.find(x => x.id === o.customerId)
    const matchesQ = !query || [o.number, c?.name, c?.company].some(v => String(v || '').toLowerCase().includes(query.toLowerCase()))
    const matchesS = !statusFilter || o.status === statusFilter
    return matchesQ && matchesS
  })

  const totalSales = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.total, 0)
  const pendingCount = orders.filter(o => o.status === 'pendiente' || o.status === 'confirmado').length

  async function save() {
    if (!editing) return
    try {
      // Auto-crear cliente si escribimos un nombre que no existe
      let customerId = editing.customerId || ''
      let customerName = editing.customerName || ''
      if (customerName && !customerId) {
        const match = customers.find((c: any) => c.name.toLowerCase() === customerName.toLowerCase())
        if (match) { customerId = match.id; customerName = match.name }
        else {
          try {
            const newC = await api.post('/customers', { name: customerName, company: customerName, country: 'España' })
            customerId = (newC as any).id
            customerName = (newC as any).name
            await refreshOne('customers')
          } catch {}
        }
      } else if (customerId && !customerName) {
        const c = customers.find((x: any) => x.id === customerId)
        if (c) customerName = c.name
      }
      // Auto-crear productos en las líneas si fueron escritos a mano
      const items = editing.items || []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.productName && !it.productId) {
          const match = products.find((p: any) => p.name.toLowerCase() === it.productName.toLowerCase())
          if (match) { it.productId = match.id }
          else {
            try {
              const newP = await api.post('/products', { name: it.productName, code: 'P-' + Date.now().toString().slice(-6) + '-' + i, active: true, unit: 'unidad', price: it.unitPrice || 0 })
              it.productId = (newP as any).id
              await refreshOne('products')
            } catch {}
          }
        }
      }
      const taxRate = (config.defaults.tax || 21) / 100
      const subtotal = items.reduce((s: number, it: any) => s + (it.unitPrice * it.quantity), 0)
      const totalDiscount = items.reduce((s: number, it: any) => s + (it.unitPrice * it.quantity * (it.discount || 0) / 100), 0)
      const taxable = subtotal - totalDiscount
      const tax = taxable * taxRate
      const total = taxable + tax
      const payload = { ...editing, customerId, customerName, items, subtotal, tax, discount: totalDiscount, total }
      if (editing.id) await api.put(`/orders/${editing.id}`, payload)
      else await api.post('/orders', payload)
      await refreshOne('orders')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
  }

  async function changeStatus(o: Order, status: OrderStatus) {
    try { await api.put(`/orders/${o.id}`, { status }); await refreshOne('orders') }
    catch (e: any) { alert(e.message) }
  }

  async function remove(o: Order) {
    try { await api.del(`/orders/${o.id}`); await refreshOne('orders') }
    catch (e: any) { alert(e.message) }
  }

  const columns = [
    { key: 'number', label: 'Número', sortable: true, render: (r: Order) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'customer', label: 'Cliente', render: (r: Order) => <p className="font-medium">{customers.find(c => c.id === r.customerId)?.name || '-'}</p> },
    { key: 'date', label: 'Fecha', sortable: true, render: (r: Order) => <span className="text-xs">{formatDate(r.createdAt)}</span> },
    { key: 'items', label: 'Items', align: 'right' as const, render: (r: Order) => <span className="tabular-nums">{r.items.length}</span> },
    { key: 'subtotal', label: 'Subtotal', align: 'right' as const, render: (r: Order) => <span className="tabular-nums text-xs">{formatCurrency(r.subtotal)}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: Order) => <span className="font-semibold tabular-nums">{formatCurrency(r.total)}</span> },
    { key: 'status', label: 'Estado', render: (r: Order) => <span className={`badge ${STATUS_TONES[r.status].cls}`}>{STATUS_TONES[r.status].label}</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: Order) => (
        <div className="flex items-center justify-end gap-1">
          {can('orders.write') && r.status === 'pendiente' && <button onClick={() => changeStatus(r, 'confirmado')} className="btn-ghost p-1.5 text-emerald-600" title="Confirmar"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
          {can('orders.write') && (r.status === 'confirmado' || r.status === 'pendiente') && <button onClick={() => changeStatus(r, 'preparando')} className="btn-ghost p-1.5" title="Preparando"><Package className="w-3.5 h-3.5" /></button>}
          <button onClick={() => setEditing(r)} className="btn-ghost p-1.5 text-xs">Ver</button>
          {can('admin') && <button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600 text-xs">Borrar</button>}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Pedidos" subtitle="Gestión de pedidos de clientes. Al confirmar se descuenta el stock automáticamente."
        actions={<>
          <button onClick={() => exportCSV('pedidos', filtered as any)} className="btn-secondary">CSV</button>
          {can('orders.write') && <button onClick={() => setEditing({ customerId: customers[0]?.id || '', customerName: customers[0]?.name || '', items: [{ productId: products[0]?.id || '', productName: products[0]?.name || '', quantity: 1, unitPrice: products[0]?.price || 0, discount: 0 }], status: 'pendiente', notes: '' })} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo pedido</button>}
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total pedidos" value={orders.length} icon={ShoppingCart} tone="brand" />
        <StatCard label="Pendientes" value={pendingCount} icon={Clock} tone="amber" hint="Por confirmar" />
        <StatCard label="Volumen total" value={formatCurrency(totalSales)} icon={DollarSign} tone="emerald" />
        <StatCard label="Entregados" value={orders.filter(o => o.status === 'entregado').length} icon={CheckCircle2} tone="violet" />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por número o cliente..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input max-w-[200px]">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_TONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="w-5 h-5" />} title="Sin pedidos" description="Crea el primer pedido." />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {editing && <OrderForm order={editing} setOrder={setEditing} onClose={() => setEditing(null)} onSave={save} customers={customers} products={products} tax={config.defaults.tax || 21} canEdit={can('orders.write')} />}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} title="Borrar pedido" message={`¿Eliminar el pedido ${confirm?.number}?`} danger />
    </div>
  )
}

function OrderForm({ order, setOrder, onClose, onSave, customers, products, tax, canEdit }: any) {
  function addItem() {
    setOrder({ ...order, items: [...(order.items || []), { productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.price || 0, discount: 0 }] })
  }
  function updateItem(i: number, key: string, value: any) {
    const items = [...order.items]
    items[i] = { ...items[i], [key]: value }
    if (key === 'productId') {
      const p = products.find((x: any) => x.id === value)
      if (p) items[i].unitPrice = p.price
    }
    setOrder({ ...order, items })
  }
  function removeItem(i: number) {
    const items = [...order.items]
    items.splice(i, 1)
    setOrder({ ...order, items })
  }

  const subtotal = (order.items || []).reduce((s: number, it: any) => s + it.unitPrice * it.quantity, 0)
  const totalDiscount = (order.items || []).reduce((s: number, it: any) => s + it.unitPrice * it.quantity * (it.discount || 0) / 100, 0)
  const taxable = subtotal - totalDiscount
  const iva = taxable * (tax / 100)
  const total = taxable + iva

  return (
    <Modal open onClose={onClose} title={order.id ? `Pedido ${order.number}` : 'Nuevo pedido'} size="xl"
      footer={<><button onClick={onClose} className="btn-secondary">Cancelar</button><button onClick={onSave} disabled={!canEdit} className="btn-primary">{order.id ? 'Actualizar' : 'Crear pedido'}</button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Cliente</label>
            <input className="input" list="orders-customers-list" value={order.customerName || ''} onChange={e => {
              const v = e.target.value
              const match = customers.find((c: any) => c.name.toLowerCase() === v.toLowerCase() || c.company?.toLowerCase() === v.toLowerCase())
              setOrder({ ...order, customerName: v, customerId: match?.id || '' })
            }} placeholder="Selecciona o escribe" disabled={!canEdit} />
            <datalist id="orders-customers-list">
              {customers.map((c: any) => <option key={c.id} value={`${c.name} (${c.company || ''})`} />)}
            </datalist>
          </div>
          <div><label className="label">Estado</label>
            <select className="input" value={order.status} onChange={e => setOrder({ ...order, status: e.target.value })} disabled={!canEdit}>
              {Object.entries(STATUS_TONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Productos</p>
            {canEdit && <button onClick={addItem} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Añadir línea</button>}
          </div>
          <div className="space-y-1.5">
            {(order.items || []).map((it: any, i: number) => {
              const p = products.find((x: any) => x.id === it.productId)
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                  <input className="input col-span-5" list={`orders-products-${i}`} value={it.productName || ''} onChange={e => {
                    const v = e.target.value
                    const match = products.find((p: any) => p.name.toLowerCase() === v.toLowerCase())
                    updateItem(i, 'productName', v)
                    updateItem(i, 'productId', match?.id || '')
                    if (match) updateItem(i, 'unitPrice', match.price || 0)
                  }} placeholder="Escribe o selecciona producto" disabled={!canEdit} />
                  <datalist id={`orders-products-${i}`}>
                    {products.map((p: any) => <option key={p.id} value={p.name} />)}
                  </datalist>
                  <input type="number" className="input col-span-2" value={it.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} disabled={!canEdit} placeholder="Cant." />
                  <input type="number" step="0.01" className="input col-span-2" value={it.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} disabled={!canEdit} placeholder="Precio" />
                  <input type="number" className="input col-span-2" value={it.discount || 0} onChange={e => updateItem(i, 'discount', Number(e.target.value))} disabled={!canEdit} placeholder="Dto.%" />
                  {canEdit && <button onClick={() => removeItem(i)} className="btn-ghost p-1.5 text-red-600 col-span-1 justify-center"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Notas</label><textarea className="input min-h-[60px]" value={order.notes || ''} onChange={e => setOrder({ ...order, notes: e.target.value })} disabled={!canEdit} /></div>
          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1.5 text-sm">
            <div className="flex justify-between"><span>Subtotal:</span><span className="tabular-nums font-semibold">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-red-600"><span>Descuento:</span><span className="tabular-nums">-{formatCurrency(totalDiscount)}</span></div>
            <div className="flex justify-between"><span>Base imponible:</span><span className="tabular-nums">{formatCurrency(taxable)}</span></div>
            <div className="flex justify-between"><span>IVA ({tax}%):</span><span className="tabular-nums">{formatCurrency(iva)}</span></div>
            <div className="flex justify-between pt-2 border-t border-surface-200 dark:border-surface-700 text-base font-bold"><span>TOTAL:</span><span className="tabular-nums text-brand-600">{formatCurrency(total)}</span></div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
