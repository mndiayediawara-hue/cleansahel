// Core domain types for CleanERP

export type Role = 'admin' | 'produccion' | 'almacen' | 'comercial' | 'contabilidad'

export interface User {
  id: string
  username: string
  fullName: string
  email: string
  role: Role
  active: boolean
  createdAt: string
  lastLogin?: string
  failedAttempts?: number
}

export type Unit = 'L' | 'ml' | 'kg' | 'g' | 'ud' | 'caja' | 'palet'

export interface Supplier {
  id: string
  name: string
  cif: string
  email: string
  phone: string
  contact: string
  address: string
  city: string
  country: string
}

export interface RawMaterial {
  id: string
  code: string
  name: string
  category: 'concentrado' | 'agua' | 'colorante' | 'aroma' | 'conservante' | 'espesante' | 'sal' | 'otro'
  unit: Unit
  stock: number
  minStock: number
  maxStock: number
  price: number // per unit
  supplierId: string
  location: string
  expiryDate?: string
  lot?: string
  lastUpdated: string
}

export interface Packaging {
  id: string
  code: string
  name: string
  type: 'botella' | 'tapon' | 'pulverizador' | 'etiqueta' | 'caja' | 'palet' | 'film' | 'precinto'
  size?: string // 250ml, 500ml, etc.
  stock: number
  minStock: number
  maxStock: number
  price: number
  supplierId: string
  location: string
  lastUpdated: string
}

export interface RecipeItem {
  materialId: string // raw material or packaging
  materialType: 'raw' | 'packaging'
  quantity: number // per liter of product
  unit: Unit
}

export interface Recipe {
  id: string
  productId: string
  items: RecipeItem[]
  // calculated per bottle
  bottleSize: number // ml per bottle
  bottlesPerBox: number
  boxesPerPallet: number
  yieldPerLiter: number // number of bottles per liter of mixture
  updatedAt: string
}

export interface Product {
  id: string
  code: string
  name: string
  description: string
  category: string
  bottleSize: number // ml
  stock: number
  minStock: number
  maxStock: number
  price: number
  cost: number
  image?: string
  recipeId?: string
  active: boolean
}

export interface ProductionLot {
  id: string
  lotNumber: string
  productionOrderNumber: string
  productId: string
  recipeId: string
  quantity: number // bottles produced
  rawMaterialsUsed: { materialId: string; materialType: 'raw' | 'packaging'; quantity: number; unit: Unit; rawMaterialLotId?: string }[]
  producedBy: string // user id
  machineId?: string
  producedAt: string
  expiryDate?: string
  status: 'completado' | 'en-proceso' | 'cancelado' | 'bloqueado' | 'retirado'
  notes?: string
}

// === LOTES DE MATERIAS PRIMAS ===
export interface RawMaterialLot {
  id: string
  internalLotNumber: string         // generado por el sistema, único
  supplierLotNumber: string         // número de lote del proveedor
  rawMaterialId: string
  supplierId: string
  receivedDate: string              // fecha de recepción
  manufactureDate?: string          // fecha de fabricación (si existe)
  expiryDate: string                // fecha de caducidad
  quantityReceived: number
  quantityRemaining: number         // stock actual de este lote
  unit: Unit
  certificates: Certificate[]      // documentos adjuntos
  status: 'activo' | 'bloqueado' | 'caducado' | 'retirado' | 'agotado'
  notes?: string
  receivedBy: string                // userId
  blockedReason?: string
}

export interface Certificate {
  id: string
  name: string
  type: 'COA' | 'MSDS' | 'otro'
  reference?: string
  issueDate?: string
  fileName?: string                 // nombre simulado del adjunto
  fileSize?: number
}

// === MÁQUINAS ===
export interface Machine {
  id: string
  code: string
  name: string
  type: 'mezcladora' | 'envasadora' | 'etiquetadora' | 'empacadora' | 'paletizadora' | 'reactor'
  status: 'operativa' | 'mantenimiento' | 'fuera-de-servicio'
  lastMaintenance?: string
  notes?: string
}

// === RECALL (RETIRADA) ===
export interface Recall {
  id: string
  reference: string                 // REC-2025-0001
  lotType: 'materia_prima' | 'producto_terminado'
  sourceLotId: string               // id del lote origen
  sourceLotNumber: string
  reason: string
  severity: 'critica' | 'alta' | 'media' | 'baja'
  initiatedBy: string               // userId
  initiatedAt: string
  status: 'iniciado' | 'en-curso' | 'completado' | 'cancelado'
  affectedProductLots: { lotId: string; lotNumber: string; productName: string; quantity: number; inStock: number; sold: number; pending: number }[]
  affectedCustomers: { customerId: string; customerName: string; totalUnits: number; orderNumbers: string[] }[]
  totalAffected: number             // total ud afectadas
  notes?: string
  completedAt?: string
}

export interface Customer {
  id: string
  code: string
  name: string
  company: string
  cif: string
  address: string
  city: string
  country: string
  phone: string
  email: string
  contact: string
  notes: string
  totalPurchases: number
  createdAt: string
}

export type OrderStatus = 'pendiente' | 'confirmado' | 'preparando' | 'enviado' | 'entregado' | 'cancelado'

export interface OrderItem {
  productId: string
  quantity: number
  unitPrice: number
  discount: number
}

export interface Order {
  id: string
  number: string
  customerId: string
  items: OrderItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  status: OrderStatus
  createdAt: string
  deliveryDate?: string
  notes?: string
  createdBy: string
}

export type PurchaseStatus = 'pendiente' | 'recibida' | 'cancelada'

export interface Purchase {
  id: string
  number: string
  supplierId: string
  invoice: string
  items: { materialId: string; materialType: 'raw' | 'packaging'; quantity: number; unitPrice: number }[]
  subtotal: number
  tax: number
  total: number
  status: PurchaseStatus
  date: string
  notes?: string
}

export type ExpenseCategory = 'electricidad' | 'agua' | 'gas' | 'internet' | 'combustible' | 'alquiler' | 'sueldos' | 'publicidad' | 'impuestos' | 'mantenimiento' | 'otros'

export interface Expense {
  id: string
  date: string
  category: ExpenseCategory
  amount: number
  description: string
  attachment?: string
  createdBy: string
}

export interface Notification {
  id: string
  type: 'stock-bajo' | 'caducidad' | 'lote-proximo' | 'pedido' | 'produccion' | 'sistema'
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical' | 'success'
  read: boolean
  createdAt: string
  relatedId?: string
}

export interface HistoryEntry {
  id: string
  userId: string
  userName: string
  action: 'crear' | 'modificar' | 'borrar' | 'login' | 'logout' | 'produccion' | 'venta' | 'compra'
  module: string
  entityId?: string
  description: string
  before?: any
  after?: any
  timestamp: string
}

export interface AppConfig {
  company: {
    name: string
    cif: string
    address: string
    phone: string
    email: string
    logo?: string
  }
  defaults: {
    bottlesPerBox: number
    boxesPerPallet: number
    tax: number
    currency: string
    language: 'es' | 'en' | 'fr' | 'pt'
    minStockDefault: number
    maxStockDefault: number
    bottleSizes: number[]
  }
  security: {
    sessionTimeoutMin: number
    maxFailedAttempts: number
    autoBackupHours: number
  }
  // Formato del número de lote generado automáticamente
  // Tokens disponibles: {PREFIX}{YYYY}{YY}{MM}{DD}{####}{#####}
  // {####} = contador de 4 dígitos, {#####} = 5 dígitos
  // Ejemplos:
  //   "SAH-{YYYY}{MM}{DD}-{####}"        → SAH-20260805-0001
  //   "{PREFIX}-{DD}{MM}{YY}-{####}"     → SAH-050826-0001
  //   "{PREFIX}-{YYYY}-{####}"           → SAH-2026-0001
  lotFormat: {
    template: string
    prefix: string
    counterPadding: number       // 3, 4, 5, 6 dígitos
    counterStart: number         // desde qué número empezar (típico 1)
    resetCounterYearly: boolean  // si true, el contador se reinicia cada año
  }
  // Lista de aromas / fragancias predefinidos (para autocompletar)
  aromas: string[]
  // Colores predefinidos
  colors: string[]
}

export interface AppData {
  users: User[]
  rawMaterials: RawMaterial[]
  packaging: Packaging[]
  products: Product[]
  recipes: Recipe[]
  customers: Customer[]
  suppliers: Supplier[]
  orders: Order[]
  purchases: Purchase[]
  expenses: Expense[]
  lots: ProductionLot[]
  rawMaterialLots: RawMaterialLot[]
  machines: Machine[]
  recalls: Recall[]
  notifications: Notification[]
  history: HistoryEntry[]
  config: AppConfig
}
