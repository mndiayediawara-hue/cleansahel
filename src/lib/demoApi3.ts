// Demo API — full localStorage-backed implementation.
// Used when the real Express backend is not reachable (e.g. on the static deploy).
import { initialData } from './mockData'
import type { AppData, RawMaterialLot, ProductionLot, Recall, Machine } from '@/types'

const KEY = 'cleanerp-demo-data-v1'

function load(): AppData {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as AppData
      // Merge con initialData para garantizar que todas las entidades/arrays existen
      // (en caso de que el localStorage tenga una versión anterior sin algunos campos)
      const merged: any = { ...initialData, ...parsed }
      for (const key of Object.keys(initialData)) {
        const initVal: any = (initialData as any)[key]
        const storedVal = (parsed as any)[key]
        if (Array.isArray(initVal)) {
          merged[key] = Array.isArray(storedVal) ? storedVal : initVal
        } else if (initVal && typeof initVal === 'object' && !Array.isArray(initVal)) {
          merged[key] = { ...initVal, ...(storedVal || {}) }
        }
      }
      return merged as AppData
    }
  } catch {}
  const seed = JSON.parse(JSON.stringify(initialData))
  localStorage.setItem(KEY, JSON.stringify(seed))
  return seed
}

// ============================================================
// COMBINAR FECHA + HORA (respetando zona horaria local)
// ============================================================
// Recibe "2026-08-05" y "14:30" y devuelve ISO en local time.
// Si no se pasa hora, usa la actual del operador.
function combineDateTime(dateStr?: string, timeStr?: string): string {
  const now = new Date()
  if (!dateStr) return now.toISOString()
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return now.toISOString()
  let h = now.getHours(), min = now.getMinutes(), s = now.getSeconds()
  if (timeStr && /^\d{2}:\d{2}/.test(timeStr)) {
    const [hh, mm] = timeStr.split(':').map(Number)
    h = hh; min = mm; s = 0
  }
  // Construye en hora local del navegador, luego convierte a ISO (UTC)
  return new Date(y, m - 1, d, h, min, s).toISOString()
}

// ============================================================
// GENERACIÓN AUTOMÁTICA DE NÚMEROS DE LOTE
// ============================================================
// Tokens: {PREFIX} {YYYY} {YY} {MM} {DD} {####} {#####} {######}
// Garantiza unicidad: si ya existe, prueba el siguiente.
function generateLotNumber(data: AppData, dateIso?: string): string {
  const cfg = data.config.lotFormat || { template: '{PREFIX}-{YYYY}{MM}{DD}-{####}', prefix: 'SAH', counterPadding: 4, counterStart: 1, resetCounterYearly: false }
  const date = dateIso ? new Date(dateIso) : new Date()
  const yyyy = String(date.getFullYear())
  const yy = yyyy.slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const padding = Math.max(1, Math.min(8, cfg.counterPadding || 4))
  const existing = new Set<string>(data.lots.map((l: any) => l.lotNumber))

  // Calcular el siguiente contador disponible
  const baseTemplate = cfg.template
    .replace(/\{PREFIX\}/g, cfg.prefix)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
  // Encontrar el prefijo antes del {####}
  const counterMatch = baseTemplate.match(/^(.*?)\{#+\}(.*)$/)
  if (!counterMatch) {
    // Si no hay {####}, devolver el template tal cual
    return baseTemplate
  }
  const [, prefix, suffix] = counterMatch
  let max = (cfg.counterStart || 1) - 1

  data.lots.forEach((l: any) => {
    if (l.lotNumber?.startsWith(prefix) && l.lotNumber?.endsWith(suffix)) {
      const num = parseInt(l.lotNumber.slice(prefix.length, l.lotNumber.length - suffix.length), 10)
      if (!isNaN(num) && num > max) max = num
    }
  })
  // Si resetCounterYearly, limitamos al año en curso (ya estamos filtrando por prefijo que contiene año)
  // y solo tenemos en cuenta los del año actual para empezar (los demás años no cuentan)
  if (cfg.resetCounterYearly) {
    // Reiniciamos max para considerar solo los del año actual (los del año ya están en prefix)
    // Como prefix contiene el año, los del año son los que empiezan por prefix
    // pero si los del año anterior también comparten prefijo (no contienen año), habría conflicto.
    // Para que funcione con reset por año, el template DEBE contener {YYYY}
    // (que es nuestro caso por defecto). Si no lo contiene, no se resetea.
    if (!cfg.template.includes('{YYYY}') && !cfg.template.includes('{YY}')) {
      // No se puede resetear por año sin año en template, ignorar
    } else {
      // Solo contar los del año actual (los que tienen el prefijo con año)
      const yearPrefix = cfg.template
        .replace(/\{PREFIX\}/g, cfg.prefix)
        .replace(/\{YYYY\}/g, yyyy)
        .replace(/\{YY\}/g, yy)
        .replace(/\{MM\}/g, mm)
        .replace(/\{DD\}/g, dd)
      const cm2 = yearPrefix.match(/^(.*?)\{#+\}(.*)$/)
      if (cm2) {
        const [, p2, s2] = cm2
        max = (cfg.counterStart || 1) - 1
        data.lots.forEach((l: any) => {
          if (l.lotNumber?.startsWith(p2) && l.lotNumber?.endsWith(s2)) {
            const num = parseInt(l.lotNumber.slice(p2.length, l.lotNumber.length - s2.length), 10)
            if (!isNaN(num) && num > max) max = num
          }
        })
      }
    }
  }

  const start = max + 1
  for (let n = start; n < start + 100000; n++) {
    const counter = String(n).padStart(padding, '0')
    const candidate = prefix + counter + suffix
    if (!existing.has(candidate)) return candidate
  }
  // Fallback extremo
  return `${cfg.prefix}-${Date.now()}`
}

function save(data: AppData) {
  localStorage.setItem(KEY, JSON.stringify(data))
  // notify other tabs
  try { window.dispatchEvent(new Event('cleanerp-data-changed')) } catch {}
}

function uid(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function addHistory(data: AppData, userName: string, action: string, module: string, description: string, entityId?: string) {
  return {
    ...data,
    history: [
      { id: uid('h-'), userId: 'demo', userName, action, module, entityId, description, timestamp: new Date().toISOString() },
      ...data.history,
    ].slice(0, 5000),
  }
}

function maybeAddStockNotifications(data: AppData): AppData {
  let changed = false
  const notifs = [...data.notifications]
  const ins = (n: any) => { notifs.unshift(n); changed = true }
  for (const r of data.rawMaterials) {
    if (r.stock < r.minStock) {
      const exists = notifs.find((x: any) => x.type === 'stock-bajo' && x.relatedId === 'raw:'+r.id && !x.read)
      if (!exists) ins({ id: uid('n-'), type: 'stock-bajo', title: 'Stock bajo materia prima', message: `${r.name} por debajo del mínimo (${r.stock} ${r.unit} / ${r.min_stock ?? r.minStock} ${r.unit})`, severity: 'warning', read: false, createdAt: new Date().toISOString(), relatedId: 'raw:'+r.id })
    }
  }
  for (const p of data.packaging) {
    if (p.stock < p.minStock) {
      const exists = notifs.find((x: any) => x.type === 'stock-bajo' && x.relatedId === 'pkg:'+p.id && !x.read)
      if (!exists) ins({ id: uid('n-'), type: 'stock-bajo', title: 'Stock bajo material de embalaje', message: `${p.name} por debajo del mínimo (${p.stock} / ${p.minStock})`, severity: 'critical', read: false, createdAt: new Date().toISOString(), relatedId: 'pkg:'+p.id })
    }
  }
  for (const p of data.products) {
    if (p.stock < p.minStock && p.active) {
      const exists = notifs.find((x: any) => x.type === 'stock-bajo' && x.relatedId === 'prd:'+p.id && !x.read)
      if (!exists) ins({ id: uid('n-'), type: 'stock-bajo', title: 'Stock bajo producto terminado', message: `${p.name} por debajo del mínimo (${p.stock} / ${p.minStock})`, severity: 'warning', read: false, createdAt: new Date().toISOString(), relatedId: 'prd:'+p.id })
    }
  }
  return changed ? { ...data, notifications: notifs.slice(0, 200) } : data
}

// JWT-like demo token (not real JWT, just for UI flow)
const DEMO_TOKEN = 'demo.' + btoa(JSON.stringify({ id: 'u1', username: 'admin', role: 'admin', fullName: 'Admin (Demo)', iat: Date.now() })) + '.demo'

// Update raw material lot statuses based on expiry
function refreshLotStatuses(data: AppData): AppData {
  const now = new Date().toISOString()
  const updated = data.rawMaterialLots.map(lot => {
    let status = lot.status
    if (status === 'retirado' || status === 'bloqueado') return lot
    if (lot.expiryDate < now) status = 'caducado'
    else if (lot.quantityRemaining <= 0) status = 'agotado'
    else status = 'activo'
    return { ...lot, status }
  })
  return { ...data, rawMaterialLots: updated }
}

let currentUser: any = { id: 'u1', username: 'admin', fullName: 'Admin (Demo)', email: 'demo@cleanpro.es', role: 'admin' }

export const demoApi = {
  token: DEMO_TOKEN,

  async login(username: string, password: string) {
    const data = load()
    // Credenciales válidas en modo demo (mismas que el backend)
    const VALID_CREDS: Record<string, { password: string; role: string; fullName: string; email: string }> = {
      admin:        { password: '41668585Z',        role: 'admin',         fullName: 'Administrador',        email: 'admin@cleansahel.com' },
      produccion:   { password: 'produccion2024',    role: 'produccion',    fullName: 'Operario Producción',  email: 'produccion@cleansahel.com' },
      contabilidad: { password: 'contabilidad2024',  role: 'contabilidad',  fullName: 'Operario Contabilidad', email: 'contabilidad@cleansahel.com' },
    }
    const cred = VALID_CREDS[username]
    if (!cred) throw new Error('Usuario no encontrado')
    if (cred.password !== password) throw new Error('Contraseña incorrecta')
    // Buscar/crear el user con el rol correcto
    let user = data.users.find((u: any) => u.username === username)
    if (!user) {
      const id = uid('u-')
      user = {
        id, username,
        fullName: cred.fullName,
        email: cred.email, role: cred.role, active: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      }
      data.users = data.users.concat(user as any)
    } else {
      // Forzar rol correcto (por si quedó antiguo)
      user.role = cred.role
      user.active = true
      user.lastLogin = new Date().toISOString()
    }
    const safeName = user.fullName || user.username || 'Usuario'
    currentUser = {
      id: user.id,
      username: user.username,
      fullName: safeName,
      email: user.email || '',
      role: user.role,
    }
    const updated = addHistory(data, currentUser.fullName, 'login', 'Auth', `Inicio de sesión (demo): ${user.username}`)
    save(updated)
    return { token: DEMO_TOKEN, user: currentUser }
  },

  me() {
    return currentUser
  },

  // GENERIC CRUD
  list(entity: keyof AppData) {
    const data = load()
    return (data[entity] as any[]).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  },

  create(entity: keyof AppData, body: any) {
    const data = load()
    const id = uid(entity.toString().slice(0, 2) + '-')
    const newItem = { id, ...(body || {}) }
    // Garantizar que la entidad destino es un array (por si el localStorage está corrupto)
    const currentList = Array.isArray((data as any)[entity]) ? (data as any)[entity] : []
    const updated = addHistory({ ...data, [entity]: [...currentList, newItem] }, currentUser.fullName, 'crear', entity as string, `Creado registro en ${entity}`)
    save(updated)
    return newItem
  },

  update(entity: keyof AppData, id: string, body: any) {
    const data = load()
    const list = (data[entity] as any[]).map((x: any) => (x.id === id ? { ...x, ...body } : x))
    const updated = addHistory({ ...data, [entity]: list }, currentUser.fullName, 'modificar', entity as string, `Modificado en ${entity}`)
    save(updated)
    return { ok: true }
  },

  remove(entity: keyof AppData, id: string) {
    const data = load()
    const updated = addHistory({ ...data, [entity]: (data[entity] as any[]).filter((x: any) => x.id !== id) }, currentUser.fullName, 'borrar', entity as string, `Eliminado en ${entity}`)
    save(updated)
    return { ok: true }
  },

  // Specialized
  rawMaterialEntry(id: string, body: any) {
    const data = load()
    const m = data.rawMaterials.find(x => x.id === id)
    if (!m) throw new Error('No encontrado')
    const updated = {
      ...data,
      rawMaterials: data.rawMaterials.map(x => x.id === id ? { ...x, stock: x.stock + Number(body.quantity), lastUpdated: new Date().toISOString(), price: body.price ?? x.price, lot: body.lot ?? x.lot, expiryDate: body.expiryDate ?? x.expiryDate } : x),
    }
    save(addHistory(updated, currentUser.fullName, 'compra', 'Almacén', `Entrada de ${body.quantity} ${m.unit} de ${m.name}${body.invoice ? ' — Factura ' + body.invoice : ''}`))
    save(maybeAddStockNotifications(load()))
    return { ok: true }
  },

  packagingEntry(id: string, body: any) {
    const data = load()
    const p = data.packaging.find(x => x.id === id)
    if (!p) throw new Error('No encontrado')
    const updated = {
      ...data,
      packaging: data.packaging.map(x => x.id === id ? { ...x, stock: x.stock + Number(body.quantity), lastUpdated: new Date().toISOString(), price: body.price ?? x.price } : x),
    }
    save(addHistory(updated, currentUser.fullName, 'compra', 'Almacén', `Entrada de ${body.quantity} ud de ${p.name}`))
    save(maybeAddStockNotifications(load()))
    return { ok: true }
  },

  produce(body: { productId: string; quantity: number; notes?: string }) {
    const data = load()
    const product = data.products.find(p => p.id === body.productId)
    if (!product) throw new Error('Producto no encontrado')
    const recipe = data.recipes.find(r => r.productId === body.productId)
    if (!recipe) throw new Error('El producto no tiene receta')
    const totalLiters = body.quantity / (recipe.yieldPerLiter || 1)
    const needed = recipe.items.map(it => {
      const totalQty = (it.unit === 'g' || it.unit === 'ml') ? (it.quantity * body.quantity) : (it.quantity * totalLiters)
      const mat = it.materialType === 'raw' ? data.rawMaterials.find(m => m.id === it.materialId) : data.packaging.find(p => p.id === it.materialId)
      return { ...it, totalQty, available: mat?.stock || 0, name: mat?.name || '?' }
    })
    const shortages = needed.filter(n => n.available < n.totalQty)
    if (shortages.length > 0) {
      const err: any = new Error('Stock insuficiente')
      err.data = { shortages: shortages.map(s => ({ name: s.name, needed: s.totalQty, available: s.available, unit: s.unit })) }
      throw err
    }
    const lotId = uid('l-')
    const lotCount = data.lots.length + 1
    const lotNumber = `LOT-${new Date().getFullYear()}-${String(lotCount).padStart(4, '0')}`
    let updated: AppData = { ...data }
    for (const n of needed) {
      if (n.materialType === 'raw') {
        updated.rawMaterials = updated.rawMaterials.map(x => x.id === n.materialId ? { ...x, stock: x.stock - n.totalQty, lastUpdated: new Date().toISOString() } : x)
      } else {
        updated.packaging = updated.packaging.map(x => x.id === n.materialId ? { ...x, stock: x.stock - n.totalQty, lastUpdated: new Date().toISOString() } : x)
      }
    }
    updated.products = updated.products.map(x => x.id === body.productId ? { ...x, stock: x.stock + body.quantity } : x)
    const lot = {
      id: lotId, lotNumber, productId: body.productId, recipeId: recipe.id, quantity: body.quantity,
      rawMaterials: needed.map(n => ({ materialId: n.materialId, materialType: n.materialType, quantity: n.totalQty, unit: n.unit })),
      producedBy: currentUser.id, producedAt: new Date().toISOString(), status: 'completado', notes: body.notes,
    }
    updated.lots = [lot, ...updated.lots]
    updated.notifications = [
      { id: uid('n-'), type: 'produccion', title: 'Producción completada', message: `Fabricadas ${body.quantity} ud de ${product.name} — Lote ${lotNumber}`, severity: 'success', read: false, createdAt: new Date().toISOString(), relatedId: 'lot:'+lotId },
      ...updated.notifications,
    ].slice(0, 200)
    save(addHistory(updated, currentUser.fullName, 'produccion', 'Producción', `Fabricadas ${body.quantity} ud de ${product.name} — Lote ${lotNumber}`, lotId))
    save(maybeAddStockNotifications(load()))
    return { ok: true, lotId, lotNumber }
  },

  changeOrderStatus(id: string, status: string) {
    const data = load()
    const order = data.orders.find(o => o.id === id)
    if (!order) throw new Error('No encontrado')
    let updated: AppData = { ...data }
    if (status === 'confirmado' && order.status !== 'confirmado' && order.status !== 'entregado' && order.status !== 'cancelado') {
      // deduct product stock
      updated.products = updated.products.map(p => {
        const used = order.items.find(it => it.productId === p.id)
        return used ? { ...p, stock: p.stock - used.quantity } : p
      })
      // add to customer total
      updated.customers = updated.customers.map(c => c.id === order.customerId ? { ...c, totalPurchases: c.totalPurchases + order.total } : c)
    }
    updated.orders = updated.orders.map(o => o.id === id ? { ...o, status: status as any } : o)
    save(addHistory(updated, currentUser.fullName, 'modificar', 'Pedidos', `Pedido ${order.number} → ${status}`))
    save(maybeAddStockNotifications(load()))
    return { ok: true }
  },

  createOrder(body: any) {
    const data = load()
    const count = data.orders.length + 1
    const number = body.number || `PED-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`
    const id = uid('o-')
    const newOrder = {
      id, number, customerId: body.customerId, items: body.items || [],
      subtotal: body.subtotal || 0, tax: body.tax || 0, discount: body.discount || 0, total: body.total || 0,
      status: body.status || 'pendiente', createdAt: new Date().toISOString(), notes: body.notes, createdBy: currentUser.id,
    }
    let updated = addHistory({ ...data, orders: [newOrder, ...data.orders] }, currentUser.fullName, 'crear', 'Pedidos', `Creado pedido ${number}`)
    updated.notifications = [{ id: uid('n-'), type: 'pedido', title: 'Nuevo pedido', message: `Pedido ${number} creado`, severity: 'info', read: false, createdAt: new Date().toISOString(), relatedId: 'order:'+id }, ...updated.notifications].slice(0, 200)
    save(updated)
    return { id, number }
  },

  updateOrder(id: string, body: any) {
    const data = load()
    const updated = addHistory({ ...data, orders: data.orders.map(o => o.id === id ? { ...o, ...body } : o) }, currentUser.fullName, 'modificar', 'Pedidos', `Pedido actualizado`)
    save(updated)
    return { ok: true }
  },

  createPurchase(body: any) {
    const data = load()
    const count = data.purchases.length + 1
    const number = body.number || `C-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`
    const id = uid('pu-')
    let updated: AppData = { ...data }
    updated.purchases = [{ id, number, supplierId: body.supplierId, invoice: body.invoice, items: body.items || [], subtotal: body.subtotal || 0, tax: body.tax || 0, total: body.total || 0, status: body.status || 'recibida', date: body.date || new Date().toISOString(), notes: body.notes }, ...updated.purchases]
    if ((body.status || 'recibida') === 'recibida') {
      for (const it of body.items || []) {
        if (it.materialType === 'raw') updated.rawMaterials = updated.rawMaterials.map(m => m.id === it.materialId ? { ...m, stock: m.stock + it.quantity, lastUpdated: new Date().toISOString() } : m)
        else updated.packaging = updated.packaging.map(p => p.id === it.materialId ? { ...p, stock: p.stock + it.quantity, lastUpdated: new Date().toISOString() } : p)
      }
      updated = maybeAddStockNotifications(updated)
    }
    save(addHistory(updated, currentUser.fullName, 'compra', 'Compras', `Compra ${number} — Factura ${body.invoice || 's/f'}`))
    return { id, number }
  },

  createExpense(body: any) {
    const data = load()
    const id = uid('e-')
    const updated = addHistory({ ...data, expenses: [{ id, date: body.date || new Date().toISOString(), category: body.category, amount: body.amount, description: body.description || '', attachment: body.attachment, createdBy: currentUser.id }, ...data.expenses] }, currentUser.fullName, 'crear', 'Gastos', `Gasto de ${body.category}: ${body.amount}€`)
    save(updated)
    return { id }
  },

  notifications() {
    return load().notifications.slice(0, 100)
  },

  markNotificationRead(id: string) {
    const data = load()
    save({ ...data, notifications: data.notifications.map(n => n.id === id ? { ...n, read: true } : n) })
    return { ok: true }
  },

  markAllNotificationsRead() {
    const data = load()
    save({ ...data, notifications: data.notifications.map(n => ({ ...n, read: true })) })
    return { ok: true }
  },

  history(limit = 300) {
    return load().history.slice(0, limit)
  },

  config() {
    return load().config
  },

  updateConfig(body: any) {
    const data = load()
    save({ ...data, config: { ...data.config, ...body } })
    return { ok: true }
  },

  dashboard() {
    const data = load()
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate()-7)
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
    const rawValue = data.rawMaterials.reduce((s, m) => s + m.stock * m.price, 0)
    const pkgValue = data.packaging.reduce((s, p) => s + p.stock * p.price, 0)
    const prodValue = data.products.reduce((s, p) => s + p.stock * p.price, 0)
    const totalInventoryValue = rawValue + pkgValue + prodValue
    const lowRaw = data.rawMaterials.filter(m => m.stock < m.minStock).length
    const lowPkg = data.packaging.filter(p => p.stock < p.minStock).length
    const lowProd = data.products.filter(p => p.stock < p.minStock && p.active).length
    const ordersToday = data.orders.filter(o => new Date(o.createdAt) >= todayStart).reduce((s, o) => s + o.total, 0)
    const ordersMonth = data.orders.filter(o => new Date(o.createdAt) >= monthStart).reduce((s, o) => s + o.total, 0)
    const expensesMonth = data.expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + e.amount, 0)
    const productionToday = data.lots.filter(l => new Date(l.producedAt) >= todayStart && l.status === 'completado').reduce((s, l) => s + l.quantity, 0)
    const productionWeek = data.lots.filter(l => new Date(l.producedAt) >= weekStart && l.status === 'completado').reduce((s, l) => s + l.quantity, 0)
    const productionMonth = data.lots.filter(l => new Date(l.producedAt) >= monthStart && l.status === 'completado').reduce((s, l) => s + l.quantity, 0)
    const last7: any[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0)
      const next = new Date(d); next.setDate(next.getDate()+1)
      last7.push({ date: d.toISOString().slice(5,10), ventas: data.orders.filter(o => { const t = new Date(o.createdAt); return t >= d && t < next }).reduce((s, o) => s + o.total, 0), gastos: data.expenses.filter(e => { const t = new Date(e.date); return t >= d && t < next }).reduce((s, e) => s + e.amount, 0) })
    }
    const salesByProduct: Record<string, { name: string; qty: number }> = {}
    data.orders.forEach(o => o.items.forEach(it => { const p = data.products.find(x => x.id === it.productId); if (p) salesByProduct[p.id] = { name: p.name, qty: (salesByProduct[p.id]?.qty || 0) + it.quantity } }))
    const topProducts = Object.values(salesByProduct).sort((a, b) => b.qty - a.qty).slice(0, 5)
    const topCustomers = data.customers.slice().sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 5).map(c => ({ name: c.name, total: c.totalPurchases }))
    return {
      inventory: {
        totalValue: totalInventoryValue, rawValue, pkgValue, prodValue,
        rawCount: data.rawMaterials.length, rawQty: data.rawMaterials.reduce((s, m) => s + m.stock, 0),
        pkgCount: data.packaging.length, pkgQty: data.packaging.reduce((s, p) => s + p.stock, 0),
        prodCount: data.products.length, prodQty: data.products.reduce((s, p) => s + p.stock, 0),
        lowRaw, lowPkg, lowProd,
      },
      sales: { today: ordersToday, month: ordersMonth },
      expenses: { month: expensesMonth },
      benefit: ordersMonth - expensesMonth,
      production: { today: productionToday, week: productionWeek, month: productionMonth },
      pendingOrders: data.orders.filter(o => o.status === 'pendiente' || o.status === 'confirmado').length,
      charts: { last7, salesByProduct: topProducts, topCustomers },
      recent: {
        orders: data.orders.slice(0, 5).map(o => ({ id: o.id, number: o.number, customer: data.customers.find(c => c.id === o.customerId)?.name, total: o.total, status: o.status, createdAt: o.createdAt })),
        purchases: data.purchases.slice(0, 5).map(p => ({ id: p.id, number: p.number, supplier: data.suppliers.find(s => s.id === p.supplierId)?.name, total: p.total, date: p.date })),
        lots: data.lots.slice(0, 5).map(l => ({ id: l.id, lotNumber: l.lotNumber, product: data.products.find(p => p.id === l.productId)?.name, quantity: l.quantity, status: l.status, producedAt: l.producedAt })),
      },
      unreadNotifs: data.notifications.filter(n => !n.read).length,
    }
  },

  search(q: string) {
    if (!q || q.length < 2) return { results: [] }
    const ql = q.toLowerCase()
    const data = load()
    const results: any[] = []
    data.products.forEach(p => { if ((p.name || '').toLowerCase().includes(ql) || (p.code || '').toLowerCase().includes(ql)) results.push({ type: 'producto', id: p.id, title: p.name, subtitle: p.code }) })
    data.customers.forEach(c => { if ((c.name || '').toLowerCase().includes(ql) || (c.company || '').toLowerCase().includes(ql) || (c.cif || '').toLowerCase().includes(ql)) results.push({ type: 'cliente', id: c.id, title: c.name, subtitle: c.company }) })
    data.suppliers.forEach(s => { if ((s.name || '').toLowerCase().includes(ql) || (s.cif || '').toLowerCase().includes(ql)) results.push({ type: 'proveedor', id: s.id, title: s.name, subtitle: s.cif }) })
    data.rawMaterials.forEach(r => { if ((r.name || '').toLowerCase().includes(ql) || (r.code || '').toLowerCase().includes(ql) || (r.lot || '').toLowerCase().includes(ql)) results.push({ type: 'materia_prima', id: r.id, title: r.name, subtitle: r.code }) })
    data.lots.forEach(l => { if ((l.lotNumber || '').toLowerCase().includes(ql)) results.push({ type: 'lote', id: l.id, title: l.lotNumber, subtitle: 'Lote' }) })
    data.orders.forEach(o => { if ((o.number || '').toLowerCase().includes(ql)) results.push({ type: 'pedido', id: o.id, title: o.number, subtitle: 'Pedido' }) })
    return { results: results.slice(0, 30) }
  },

  barcode(code: string) {
    const data = load()
    // 1) Si es un QR JSON de un lote de materia prima (formato generado por la app)
    if (code.startsWith('{')) {
      try {
        const obj = JSON.parse(code)
        if (obj.type === 'rml' && obj.id) {
          const lot = data.rawMaterialLots.find((l: any) => l.id === obj.id)
          if (lot) {
            const mat = data.rawMaterials.find((m: any) => m.id === lot.rawMaterialId)
            const sup = data.suppliers.find((s: any) => s.id === lot.supplierId)
            return {
              type: 'lote_mp',
              data: {
                ...lot,
                materialName: mat?.name,
                materialCode: mat?.code,
                supplierName: sup?.name,
                materialId: lot.rawMaterialId,
                code: lot.internalLotNumber,
                name: mat?.name ? `${mat.name} (Lote ${lot.internalLotNumber})` : `Lote MP ${lot.internalLotNumber}`,
                stock: lot.quantityRemaining,
                unit: lot.unit,
                location: sup?.name,
                expiryDate: lot.expiryDate,
              }
            }
          }
        }
        if (obj.type === 'lot' && obj.id) {
          // QR de lote de producto terminado (futuro)
          const lot = data.lots.find((l: any) => l.id === obj.id)
          if (lot) {
            const p = data.products.find((x: any) => x.id === lot.productId)
            return { type: 'lote_producto', data: { ...lot, code: lot.lotNumber, name: p?.name } }
          }
        }
      } catch {}
    }
    // 2) Búsqueda directa por código (P-LIM-750, RM-001, PK-750, etc.)
    const p = data.products.find(x => x.code === code)
    if (p) return { type: 'producto', data: p }
    const r = data.rawMaterials.find(x => x.code === code)
    if (r) return { type: 'materia_prima', data: r }
    const pk = data.packaging.find(x => x.code === code)
    if (pk) return { type: 'packaging', data: pk }
    const c = data.customers.find(x => x.code === code)
    if (c) return { type: 'cliente', data: c }
    // 3) Búsqueda por lote interno (INT-2025-0001) o lote de producto (SAH-20250805-0001)
    const rml = data.rawMaterialLots.find((l: any) => l.internalLotNumber === code)
    if (rml) {
      const mat = data.rawMaterials.find((m: any) => m.id === rml.rawMaterialId)
      const sup = data.suppliers.find((s: any) => s.id === rml.supplierId)
      return {
        type: 'lote_mp',
        data: {
          ...rml,
          materialName: mat?.name,
          materialCode: mat?.code,
          supplierName: sup?.name,
          code: rml.internalLotNumber,
          name: mat?.name ? `${mat.name} (Lote ${rml.internalLotNumber})` : `Lote MP ${rml.internalLotNumber}`,
          stock: rml.quantityRemaining,
          unit: rml.unit,
          location: sup?.name,
        }
      }
    }
    const lot = data.lots.find((l: any) => l.lotNumber === code)
    if (lot) {
      const p = data.products.find((x: any) => x.id === lot.productId)
      return { type: 'lote_producto', data: { ...lot, code: lot.lotNumber, name: p?.name } }
    }
    throw new Error(`No encontrado: "${code}". Escanéa un QR de etiqueta o introduce un código válido.`)
  },

  reports(type: string) {
    const data = load()
    if (type === 'inventory') {
      return [
        ...data.rawMaterials.map(r => ({ tipo: 'Materia Prima', codigo: r.code, nombre: r.name, stock: r.stock, unidad: r.unit, minimo: r.minStock, maximo: r.maxStock, precio: r.price, valor: r.stock * r.price })),
        ...data.packaging.map(p => ({ tipo: 'Embalaje', codigo: p.code, nombre: p.name, stock: p.stock, unidad: 'ud', minimo: p.minStock, maximo: p.maxStock, precio: p.price, valor: p.stock * p.price })),
      ]
    }
    if (type === 'production') return data.lots.slice(0, 200).map(l => ({ lote: l.lotNumber, producto: data.products.find(p => p.id === l.productId)?.name, cantidad: l.quantity, fecha: l.producedAt, estado: l.status }))
    if (type === 'sales') return data.orders.slice(0, 200).map(o => ({ numero: o.number, cliente: data.customers.find(c => c.id === o.customerId)?.name, total: o.total, estado: o.status, fecha: o.createdAt }))
    if (type === 'expenses') return data.expenses.map(e => ({ fecha: e.date, categoria: e.category, importe: e.amount, descripcion: e.description }))
    if (type === 'consumption') {
      const map: Record<string, { material: string; tipo: string; totalConsumido: number }> = {}
      data.lots.forEach(l => (l.rawMaterials || []).forEach((it: any) => {
        const key = it.materialId
        if (!map[key]) {
          const m = it.materialType === 'raw' ? data.rawMaterials.find(x => x.id === it.materialId) : data.packaging.find(x => x.id === it.materialId)
          map[key] = { material: m?.name || it.materialId, tipo: it.materialType, totalConsumido: 0 }
        }
        map[key].totalConsumido += it.quantity
      }))
      return Object.values(map)
    }
    return []
  },

  reset() {
    localStorage.removeItem(KEY)
    return { ok: true }
  },

  isDemo() { return true },

  // ============================================================
  // GESTIÓN DE LOTES DE MATERIAS PRIMAS
  // ============================================================
  rawMaterialLotsList() {
    const data = refreshLotStatuses(load())
    save(data)
    return data.rawMaterialLots.slice().sort((a, b) => (b.receivedDate || '').localeCompare(a.receivedDate || ''))
  },

  createRawMaterialLot(body: any) {
    const data = load()
    // Validar lote interno único
    if (data.rawMaterialLots.some((l: RawMaterialLot) => l.internalLotNumber === body.internalLotNumber)) {
      throw new Error(`Ya existe un lote con el número interno "${body.internalLotNumber}". No se permiten duplicados.`)
    }
    const id = uid('rml-')
    const lot: RawMaterialLot = {
      id,
      internalLotNumber: body.internalLotNumber,
      supplierLotNumber: body.supplierLotNumber || '',
      rawMaterialId: body.rawMaterialId,
      supplierId: body.supplierId,
      receivedDate: body.receivedDate || new Date().toISOString(),
      manufactureDate: body.manufactureDate || null,
      expiryDate: body.expiryDate,
      quantityReceived: Number(body.quantityReceived) || 0,
      quantityRemaining: Number(body.quantityReceived) || 0,
      unit: body.unit || 'L',
      certificates: body.certificates || [],
      status: 'activo',
      receivedBy: currentUser.id,
      notes: body.notes || null,
    }
    // Actualizar stock global del material
    let updated: AppData = { ...data, rawMaterialLots: [lot, ...data.rawMaterialLots] }
    updated.rawMaterials = updated.rawMaterials.map((m: any) => m.id === body.rawMaterialId ? {
      ...m,
      stock: m.stock + lot.quantityRemaining,
      lastUpdated: new Date().toISOString(),
      lot: lot.internalLotNumber,
      expiryDate: lot.expiryDate,
    } : m)
    save(addHistory(updated, currentUser.fullName, 'crear', 'Lotes MP', `Registrado lote ${lot.internalLotNumber} (${lot.supplierLotNumber}) - ${lot.quantityReceived} ${lot.unit} de ${updated.rawMaterials.find((m:any)=>m.id===body.rawMaterialId)?.name || '?'}`))
    return lot
  },

  updateRawMaterialLot(id: string, body: any) {
    const data = load()
    const updated = addHistory({ ...data, rawMaterialLots: data.rawMaterialLots.map((l: RawMaterialLot) => l.id === id ? { ...l, ...body } : l) }, currentUser.fullName, 'modificar', 'Lotes MP', `Modificado lote ${id}`)
    save(updated)
    return { ok: true }
  },

  blockRawMaterialLot(id: string, reason: string) {
    const data = load()
    const lot = data.rawMaterialLots.find((l: RawMaterialLot) => l.id === id)
    if (!lot) throw new Error('Lote no encontrado')
    const updated = addHistory({ ...data, rawMaterialLots: data.rawMaterialLots.map((l: RawMaterialLot) => l.id === id ? { ...l, status: 'bloqueado', blockedReason: reason } : l) }, currentUser.fullName, 'modificar', 'Lotes MP', `Lote ${lot.internalLotNumber} bloqueado: ${reason}`)
    save(updated)
    return { ok: true }
  },

  // ============================================================
  // PRODUCCIÓN CON TRAZABILIDAD DE LOTES (FIFO)
  // ============================================================
  produceWithLots(body: { productId: string; quantity: number; machineId?: string; notes?: string; preferredLotIds?: string[] }) {
    let data = load()
    const product = data.products.find((p: any) => p.id === body.productId)
    if (!product) throw new Error('Producto no encontrado')
    const recipe = data.recipes.find((r: any) => r.productId === body.productId)
    if (!recipe) throw new Error('El producto no tiene receta')
    const totalLiters = body.quantity / (recipe.yieldPerLiter || 1)

    // Calcular necesidades y consumir lotes FIFO
    const consumed: { materialId: string; materialType: string; rawMaterialLotId: string; internalLotNumber: string; quantity: number; unit: string }[] = []
    const shortages: any[] = []
    const blockedUsage: any[] = []

    for (const it of recipe.items) {
      const totalQty = (it.unit === 'g' || it.unit === 'ml') ? (it.quantity * body.quantity) : (it.quantity * totalLiters)
      if (it.materialType === 'packaging') {
        // Packaging se consume sin lote
        const m = data.packaging.find((x: any) => x.id === it.materialId)
        if (!m || m.stock < totalQty) shortages.push({ name: m?.name || it.materialId, needed: totalQty, available: m?.stock || 0, unit: it.unit })
        else consumed.push({ materialId: it.materialId, materialType: 'packaging', rawMaterialLotId: '', internalLotNumber: '-', quantity: totalQty, unit: it.unit })
      } else {
        // Materia prima: consumir de lotes específicos (FIFO por fecha de caducidad)
        let remaining = totalQty
        let lotList = data.rawMaterialLots
          .filter((l: RawMaterialLot) => l.rawMaterialId === it.materialId && l.status === 'activo' && l.quantityRemaining > 0)
          .sort((a: any, b: any) => a.expiryDate.localeCompare(b.expiryDate))
        // Si el usuario prefirió lotes específicos, priorizar esos
        if (body.preferredLotIds?.length) {
          const preferred = lotList.filter((l: any) => body.preferredLotIds.includes(l.id))
          const others = lotList.filter((l: any) => !body.preferredLotIds.includes(l.id))
          lotList = [...preferred, ...others]
        }
        for (const lot of lotList) {
          if (remaining <= 0) break
          const useQty = Math.min(remaining, lot.quantityRemaining)
          consumed.push({ materialId: it.materialId, materialType: 'raw', rawMaterialLotId: lot.id, internalLotNumber: lot.internalLotNumber, quantity: useQty, unit: it.unit })
          remaining -= useQty
        }
        if (remaining > 0.0001) {
          const m = data.rawMaterials.find((x: any) => x.id === it.materialId)
          const available = data.rawMaterialLots.filter((l: RawMaterialLot) => l.rawMaterialId === it.materialId && l.status === 'activo').reduce((s, l) => s + l.quantityRemaining, 0)
          shortages.push({ name: m?.name || it.materialId, needed: totalQty, available, unit: it.unit })
        }
      }
    }

    if (shortages.length > 0) {
      const err: any = new Error('Stock insuficiente para fabricar')
      err.data = { shortages }
      throw err
    }

    // Crear lote de producto terminado
    const lotId = uid('l-')
    const lotCount = data.lots.length + 1
    const lotNumber = `LOT-${new Date().getFullYear()}-${String(lotCount + 900).padStart(4, '0')}`
    const ofNumber = `OF-${new Date().getFullYear()}-${String(lotCount + 250).padStart(4, '0')}`
    const newLot: ProductionLot = {
      id: lotId, lotNumber, productionOrderNumber: ofNumber,
      productId: body.productId, recipeId: recipe.id, quantity: body.quantity,
      rawMaterialsUsed: consumed.map(c => ({ materialId: c.materialId, materialType: c.materialType as any, quantity: c.quantity, unit: c.unit as any, rawMaterialLotId: c.rawMaterialLotId })),
      producedBy: currentUser.id, machineId: body.machineId, producedAt: new Date().toISOString(),
      status: 'completado', notes: body.notes,
      expiryDate: new Date(Date.now() + 730 * 86400000).toISOString(),
    }
    let updated: AppData = { ...data, lots: [newLot, ...data.lots] }
    // Descontar stock global
    for (const c of consumed) {
      if (c.materialType === 'raw') {
        updated.rawMaterialLots = updated.rawMaterialLots.map((l: RawMaterialLot) => l.id === c.rawMaterialLotId ? { ...l, quantityRemaining: Math.max(0, l.quantityRemaining - c.quantity), status: l.quantityRemaining - c.quantity <= 0 ? 'agotado' : l.status } : l)
        updated.rawMaterials = updated.rawMaterials.map((m: any) => m.id === c.materialId ? { ...m, stock: Math.max(0, m.stock - c.quantity), lastUpdated: new Date().toISOString() } : m)
      } else {
        updated.packaging = updated.packaging.map((p: any) => p.id === c.materialId ? { ...p, stock: Math.max(0, p.stock - c.quantity), lastUpdated: new Date().toISOString() } : p)
      }
    }
    // Sumar al stock del producto
    updated.products = updated.products.map((p: any) => p.id === body.productId ? { ...p, stock: p.stock + body.quantity } : p)
    // Notificación
    updated.notifications = [{ id: uid('n-'), type: 'produccion', title: 'Producción completada', message: `Fabricadas ${body.quantity} ud de ${product.name} — Lote ${lotNumber} (${ofNumber})`, severity: 'success', read: false, createdAt: new Date().toISOString(), relatedId: 'lot:'+lotId }, ...updated.notifications].slice(0, 200)
    save(addHistory(updated, currentUser.fullName, 'produccion', 'Producción', `OF ${ofNumber} · Lote ${lotNumber} · ${body.quantity} ud de ${product.name} usando ${consumed.filter(c => c.materialType==='raw').length} lotes de MP`))
    return { ok: true, lotId, lotNumber, productionOrderNumber: ofNumber, consumedLots: consumed.filter(c => c.materialType === 'raw') }
  },

  // ============================================================
  // TRAZABILIDAD BIDIRECCIONAL
  // ============================================================
  traceability(query: { type: 'lot' | 'raw_lot' | 'product' | 'raw_material'; id: string }) {
    const data = load()
    const result: any = { direction: { backward: [], forward: [] }, summary: {} }

    if (query.type === 'lot') {
      // Lote de producto terminado → ver qué MPs usó
      const lot = data.lots.find((l: any) => l.id === query.id)
      if (!lot) throw new Error('Lote no encontrado')
      const product = data.products.find((p: any) => p.id === lot.productId)
      const operator = data.users.find((u: any) => u.id === lot.producedBy)
      const machine = data.machines.find((m: any) => m.id === lot.machineId)
      result.lot = lot
      result.product = product
      result.operator = operator
      result.machine = machine
      // Backward: cada materia prima con su lote
      result.direction.backward = (lot.rawMaterialsUsed || []).filter((it: any) => it.materialType === 'raw').map((it: any) => {
        const mpLot = data.rawMaterialLots.find((l: RawMaterialLot) => l.id === it.rawMaterialLotId)
        const material = data.rawMaterials.find((m: any) => m.id === it.materialId)
        const supplier = mpLot ? data.suppliers.find((s: any) => s.id === mpLot.supplierId) : null
        return { material, supplier, lot: mpLot, quantity: it.quantity, unit: it.unit }
      }).filter((x: any) => x.lot)
      // Forward: clientes que recibieron este lote
      const ordersWithLot = data.orders.filter((o: any) => (o.items || []).some((it: any) => it.lotId === query.id))
      result.direction.forward = ordersWithLot.map((o: any) => {
        const customer = data.customers.find((c: any) => c.id === o.customerId)
        return { order: o, customer, units: o.items.find((it: any) => it.lotId === query.id)?.quantity || 0 }
      })
      result.summary = {
        product: product?.name,
        lotNumber: lot.lotNumber,
        producedAt: lot.producedAt,
        producedBy: operator?.fullName,
        machine: machine?.name,
        rawMaterialsUsed: result.direction.backward.length,
        clientsReceived: result.direction.forward.length,
      }
    } else if (query.type === 'raw_lot') {
      // Lote de MP → ver en qué productos se usó
      const mpLot = data.rawMaterialLots.find((l: RawMaterialLot) => l.id === query.id)
      if (!mpLot) throw new Error('Lote de MP no encontrado')
      const material = data.rawMaterials.find((m: any) => m.id === mpLot.rawMaterialId)
      const supplier = data.suppliers.find((s: any) => s.id === mpLot.supplierId)
      result.lot = mpLot
      result.material = material
      result.supplier = supplier
      // Forward: en qué lotes de producto se usó
      const lotsUsing = data.lots.filter((l: any) => (l.rawMaterialsUsed || []).some((it: any) => it.rawMaterialLotId === query.id))
      result.direction.forward = lotsUsing.map((l: any) => {
        const p = data.products.find((x: any) => x.id === l.productId)
        const use = l.rawMaterialsUsed.find((it: any) => it.rawMaterialLotId === query.id)
        return { lot: l, product: p, quantityUsed: use?.quantity || 0, unit: use?.unit || '' }
      })
      result.summary = {
        material: material?.name,
        internalLot: mpLot.internalLotNumber,
        supplierLot: mpLot.supplierLotNumber,
        supplier: supplier?.name,
        receivedDate: mpLot.receivedDate,
        expiryDate: mpLot.expiryDate,
        quantityReceived: mpLot.quantityReceived,
        quantityRemaining: mpLot.quantityRemaining,
        status: mpLot.status,
        usedInProducts: result.direction.forward.length,
      }
    } else if (query.type === 'product') {
      const product = data.products.find((p: any) => p.id === query.id)
      if (!product) throw new Error('Producto no encontrado')
      const lotsOfProduct = data.lots.filter((l: any) => l.productId === query.id)
      result.product = product
      result.lots = lotsOfProduct
      // Clientes que recibieron este producto
      const ordersOfProduct = data.orders.filter((o: any) => (o.items || []).some((it: any) => it.productId === query.id))
      result.customers = Array.from(new Set(ordersOfProduct.map((o: any) => o.customerId))).map((cid: any) => data.customers.find((c: any) => c.id === cid)).filter(Boolean)
    } else if (query.type === 'raw_material') {
      const material = data.rawMaterials.find((m: any) => m.id === query.id)
      if (!material) throw new Error('Material no encontrado')
      const lotsOfMat = data.rawMaterialLots.filter((l: RawMaterialLot) => l.rawMaterialId === query.id)
      result.material = material
      result.lots = lotsOfMat
      // Productos en los que se usa
      const recipesUsing = data.recipes.filter((r: any) => r.items.some((it: any) => it.materialId === query.id))
      result.usedInProducts = recipesUsing.map((r: any) => data.products.find((p: any) => p.id === r.productId)).filter(Boolean)
    }
    return result
  },

  // ============================================================
  // BUSCADOR DE LOTES
  // ============================================================
  lotSearch(q: string) {
    if (!q || q.length < 2) return { results: [] }
    const ql = q.toLowerCase()
    const data = load()
    const results: any[] = []
    // Lotes internos de producto
    data.lots.forEach((l: any) => {
      if (l.lotNumber.toLowerCase().includes(ql) || (l.productionOrderNumber || '').toLowerCase().includes(ql)) {
        const product = data.products.find((p: any) => p.id === l.productId)
        results.push({ type: 'lot', id: l.id, title: l.lotNumber, subtitle: `${product?.name || '?'} · ${l.productionOrderNumber || ''} · ${l.status}` })
      }
    })
    // Lotes internos de MP
    data.rawMaterialLots.forEach((l: RawMaterialLot) => {
      if (l.internalLotNumber.toLowerCase().includes(ql) || l.supplierLotNumber.toLowerCase().includes(ql)) {
        const mat = data.rawMaterials.find((m: any) => m.id === l.rawMaterialId)
        results.push({ type: 'raw_lot', id: l.id, title: l.internalLotNumber, subtitle: `${mat?.name || '?'} · Lote proveedor: ${l.supplierLotNumber} · ${l.status}` })
      }
    })
    return { results: results.slice(0, 50) }
  },

  // ============================================================
  // RECALL (RETIRADA DE PRODUCTOS)
  // ============================================================
  recallsList() {
    return load().recalls.slice().sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt))
  },

  initiateRecall(body: { lotType: 'materia_prima' | 'producto_terminado'; lotId: string; reason: string; severity: 'critica' | 'alta' | 'media' | 'baja' }) {
    const data = load()
    const id = uid('rec-')
    const count = data.recalls.length + 1
    const reference = `REC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`

    let sourceLot: any = null
    let sourceLotNumber = ''
    let affectedLots: any[] = []
    let affectedCustomers: any[] = []
    let totalAffected = 0

    if (body.lotType === 'materia_prima') {
      const mpLot = data.rawMaterialLots.find((l: RawMaterialLot) => l.id === body.lotId)
      if (!mpLot) throw new Error('Lote de MP no encontrado')
      sourceLot = mpLot
      sourceLotNumber = mpLot.internalLotNumber
      // Localizar todos los lotes de producto que usaron este lote
      const productLots = data.lots.filter((l: any) => (l.rawMaterialsUsed || []).some((it: any) => it.rawMaterialLotId === body.lotId))
      for (const pl of productLots) {
        const product = data.products.find((p: any) => p.id === pl.productId)
        // Calcular stock actual de este lote en productos
        const orders = data.orders.filter((o: any) => o.status !== 'cancelado' && (o.items || []).some((it: any) => it.lotId === pl.id))
        const sold = orders.reduce((s, o) => s + ((o.items || []).find((it: any) => it.lotId === pl.id)?.quantity || 0), 0)
        const pending = data.orders.filter((o: any) => o.status === 'pendiente' && (o.items || []).some((it: any) => it.lotId === pl.id)).reduce((s, o) => s + ((o.items || []).find((it: any) => it.lotId === pl.id)?.quantity || 0), 0)
        const inStock = Math.max(0, pl.quantity - sold - pending)
        affectedLots.push({ lotId: pl.id, lotNumber: pl.lotNumber, productName: product?.name || '?', quantity: pl.quantity, inStock, sold, pending })
        totalAffected += pl.quantity
      }
      // Clientes afectados
      const customerMap: Record<string, { customerId: string; customerName: string; totalUnits: number; orderNumbers: string[] }> = {}
      for (const o of data.orders) {
        if (o.status === 'cancelado') continue
        for (const it of (o.items || [])) {
          if (it.lotId && productLots.some((pl: any) => pl.id === it.lotId)) {
            if (!customerMap[o.customerId]) customerMap[o.customerId] = { customerId: o.customerId, customerName: data.customers.find((c: any) => c.id === o.customerId)?.name || '?', totalUnits: 0, orderNumbers: [] }
            customerMap[o.customerId].totalUnits += it.quantity || 0
            if (!customerMap[o.customerId].orderNumbers.includes(o.number)) customerMap[o.customerId].orderNumbers.push(o.number)
          }
        }
      }
      affectedCustomers = Object.values(customerMap)
      // Bloquear el lote de MP
      data.rawMaterialLots = data.rawMaterialLots.map((l: RawMaterialLot) => l.id === body.lotId ? { ...l, status: 'retirado', blockedReason: `Recall ${reference}: ${body.reason}` } : l)
    } else {
      const lot = data.lots.find((l: any) => l.id === body.lotId)
      if (!lot) throw new Error('Lote no encontrado')
      sourceLot = lot
      sourceLotNumber = lot.lotNumber
      const product = data.products.find((p: any) => p.id === lot.productId)
      const orders = data.orders.filter((o: any) => o.status !== 'cancelado' && (o.items || []).some((it: any) => it.lotId === lot.id))
      const sold = orders.reduce((s, o) => s + ((o.items || []).find((it: any) => it.lotId === lot.id)?.quantity || 0), 0)
      const pending = data.orders.filter((o: any) => o.status === 'pendiente' && (o.items || []).some((it: any) => it.lotId === lot.id)).reduce((s, o) => s + ((o.items || []).find((it: any) => it.lotId === lot.id)?.quantity || 0), 0)
      const inStock = Math.max(0, lot.quantity - sold - pending)
      affectedLots = [{ lotId: lot.id, lotNumber: lot.lotNumber, productName: product?.name || '?', quantity: lot.quantity, inStock, sold, pending }]
      totalAffected = lot.quantity
      const customerMap: Record<string, any> = {}
      for (const o of orders) {
        if (!customerMap[o.customerId]) customerMap[o.customerId] = { customerId: o.customerId, customerName: data.customers.find((c: any) => c.id === o.customerId)?.name || '?', totalUnits: 0, orderNumbers: [] }
        customerMap[o.customerId].totalUnits += (o.items || []).find((it: any) => it.lotId === lot.id)?.quantity || 0
        customerMap[o.customerId].orderNumbers.push(o.number)
      }
      affectedCustomers = Object.values(customerMap)
      // Bloquear el lote
      data.lots = data.lots.map((l: any) => l.id === lot.id ? { ...l, status: 'retirado' } : l)
    }

    const recall: Recall = {
      id, reference, lotType: body.lotType, sourceLotId: body.lotId, sourceLotNumber,
      reason: body.reason, severity: body.severity, initiatedBy: currentUser.id, initiatedAt: new Date().toISOString(),
      status: 'iniciado', affectedProductLots: affectedLots, affectedCustomers, totalAffected,
    }
    const updated = addHistory({ ...data, recalls: [recall, ...data.recalls] }, currentUser.fullName, 'crear', 'Recall', `Iniciada retirada ${reference} para lote ${sourceLotNumber}: ${body.reason}`)
    // Notificación crítica
    updated.notifications = [{ id: uid('n-'), type: 'sistema', title: `🚨 Retirada ${reference}`, message: `Lote ${sourceLotNumber} retirado · ${totalAffected} ud afectadas · ${affectedCustomers.length} clientes`, severity: 'critical', read: false, createdAt: new Date().toISOString(), relatedId: 'recall:'+id }, ...updated.notifications].slice(0, 200)
    save(updated)
    return recall
  },

  completeRecall(id: string, notes: string) {
    const data = load()
    const updated = addHistory({ ...data, recalls: data.recalls.map((r: Recall) => r.id === id ? { ...r, status: 'completado', completedAt: new Date().toISOString(), notes } : r) }, currentUser.fullName, 'modificar', 'Recall', `Recall ${id} completado`)
    save(updated)
    return { ok: true }
  },

  // ============================================================
  // MÁQUINAS
  // ============================================================
  machinesList() {
    return load().machines
  },

  createMachine(body: any) {
    const data = load()
    const id = uid('m-')
    const machine: Machine = { id, code: body.code, name: body.name, type: body.type, status: body.status || 'operativa', lastMaintenance: body.lastMaintenance || null, notes: body.notes || null }
    save(addHistory({ ...data, machines: [machine, ...data.machines] }, currentUser.fullName, 'crear', 'Máquinas', `Registrada máquina ${machine.name}`))
    return machine
  },

  updateMachine(id: string, body: any) {
    const data = load()
    save(addHistory({ ...data, machines: data.machines.map((m: Machine) => m.id === id ? { ...m, ...body } : m) }, currentUser.fullName, 'modificar', 'Máquinas', `Modificada máquina ${id}`))
    return { ok: true }
  },

  deleteMachine(id: string) {
    const data = load()
    save(addHistory({ ...data, machines: data.machines.filter((m: Machine) => m.id !== id) }, currentUser.fullName, 'borrar', 'Máquinas', `Eliminada máquina ${id}`))
    return { ok: true }
  },

  // ============================================================
  // GENERADOR DE LOTES (módulo exclusivo, sin entrada manual)
  // ============================================================
  previewLotNumber(dateIso?: string) {
    const data = load()
    return generateLotNumber(data, dateIso)
  },

  generateLot(body: {
    productId: string
    format: string            // "500ml", "750ml", "1L", "2L"
    aroma: string
    color: string
    machineId?: string
    manufacturedAt: string
    expiryDate?: string
    quantity: number
    notes?: string
  }) {
    const data = load()
    // Generar número automáticamente (NUNCA se permite entrada manual)
    const lotNumber = generateLotNumber(data, body.manufacturedAt)
    // Verificar duplicado por si acaso (doble safety)
    if (data.lots.some((l: any) => l.lotNumber === lotNumber)) {
      throw new Error(`Conflicto generando lote: ${lotNumber} ya existe. Reintenta.`)
    }
    const product = data.products.find((p: any) => p.id === body.productId)
    if (!product) throw new Error('Producto no encontrado')

    const id = uid('l-')
    const ofCount = data.lots.length + 1
    const productionOrderNumber = `OF-${new Date().getFullYear()}-${String(ofCount + 250).padStart(4, '0')}`
    const machine = body.machineId ? data.machines.find((m: any) => m.id === body.machineId) : null
    const newLot: ProductionLot = {
      id, lotNumber, productionOrderNumber,
      productId: body.productId, recipeId: product.recipeId || '',
      quantity: Number(body.quantity) || 0,
      rawMaterialsUsed: [],
      producedBy: currentUser.id,
      machineId: body.machineId,
      // Combinar fecha + hora como local time del operador (sin saltos raros de zona horaria)
      producedAt: combineDateTime(body.manufacturedAt, body.manufacturedTime),
      expiryDate: body.expiryDate,
      status: 'en-proceso',
      notes: body.notes,
    }
    let updated: AppData = { ...data, lots: [newLot, ...data.lots] }
    // Guardar metadata extendida (aroma, color, formato) en notes si no hay campo dedicado
    const meta = `\n[Aroma: ${body.aroma || '-'}] [Color: ${body.color || '-'}] [Formato: ${body.format || '-'}]${machine ? ` [Máquina: ${machine.name}]` : ''}`
    if (newLot.notes) newLot.notes = newLot.notes + meta
    else newLot.notes = meta.trim()

    // Sumar al stock del producto
    updated.products = updated.products.map((p: any) => p.id === body.productId ? { ...p, stock: p.stock + Number(body.quantity) } : p)
    // Notificación
    updated.notifications = [{
      id: uid('n-'), type: 'produccion', title: 'Lote generado',
      message: `Lote ${lotNumber} creado · ${body.quantity} ud de ${product.name} (${body.format || ''} ${body.aroma || ''})`,
      severity: 'success', read: false, createdAt: new Date().toISOString(), relatedId: 'lot:'+id,
    }, ...updated.notifications].slice(0, 200)
    save(addHistory(updated, currentUser.fullName, 'crear', 'Lotes',
      `Lote ${lotNumber} (${productionOrderNumber}) generado: ${body.quantity} ud de ${product.name} · ${body.format} · aroma ${body.aroma} · color ${body.color}${machine ? ` · máquina ${machine.name}` : ''}`))
    return { ...newLot, meta: { aroma: body.aroma, color: body.color, format: body.format } }
  },

  updateLotStatus(lotId: string, status: 'en-proceso' | 'completado' | 'bloqueado' | 'retirado' | 'cancelado', notes?: string) {
    const data = load()
    const lot = data.lots.find((l: any) => l.id === lotId)
    if (!lot) throw new Error('Lote no encontrado')
    const updated = addHistory({ ...data, lots: data.lots.map((l: any) => l.id === lotId ? { ...l, status, notes: notes ? (l.notes || '') + '\n' + notes : l.notes } : l) }, currentUser.fullName, 'modificar', 'Lotes', `Lote ${lot.lotNumber} → ${status}`)
    save(updated)
    return { ok: true }
  },

  // ============================================================
  // ETIQUETAS
  // ============================================================
  generateLabel(lotId: string) {
    const data = load()
    const lot = data.lots.find((l: any) => l.id === lotId)
    if (!lot) throw new Error('Lote no encontrado')
    const product = data.products.find((p: any) => p.id === lot.productId)
    const machine = data.machines.find((m: any) => m.id === lot.machineId)
    const operator = data.users.find((u: any) => u.id === lot.producedBy)
    return {
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
      barcode: lot.lotNumber,
      qrData: JSON.stringify({ l: lot.lotNumber, of: lot.productionOrderNumber, p: product?.code, q: lot.quantity, d: lot.producedAt }),
    }
  },
}
console.log("BUILD VERSION 3 ACTIVE - VALID_CREDS LOADED")
