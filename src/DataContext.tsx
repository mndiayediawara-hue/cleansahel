import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from './AuthContext'
import type {
  RawMaterial, Packaging, Product, Recipe, Customer, Supplier,
  Order, Purchase, Expense, ProductionLot, Notification, HistoryEntry, AppConfig, User,
  RawMaterialLot, Machine, Recall
} from '@/types'

interface DataContextValue {
  loading: boolean
  error: string | null
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
  users: User[]
  config: AppConfig
  refresh: () => Promise<void>
  refreshOne: (key: keyof DataContextValue | string) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [packaging, setPackaging] = useState<Packaging[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [lots, setLots] = useState<ProductionLot[]>([])
  const [rawMaterialLots, setRawMaterialLots] = useState<RawMaterialLot[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [recalls, setRecalls] = useState<Recall[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [config, setConfig] = useState<AppConfig>({ company: { name: '', cif: '', address: '', phone: '', email: '' }, defaults: { bottlesPerBox: 12, boxesPerPallet: 60, tax: 21, currency: 'EUR', language: 'es', minStockDefault: 100, maxStockDefault: 5000, bottleSizes: [250, 500, 750, 1000] }, security: { sessionTimeoutMin: 30, maxFailedAttempts: 5, autoBackupHours: 24 } })

  const fetchAll = useCallback(async () => {
    if (!token) return
    setError(null)
    try {
      const [rm, pk, pr, rc, cu, su, or, pu, ex, lo, rml, ma, rcalls, no, hi, us, cf] = await Promise.all([
        api.get<RawMaterial[]>('/raw-materials'),
        api.get<Packaging[]>('/packaging'),
        api.get<Product[]>('/products'),
        api.get<Recipe[]>('/recipes'),
        api.get<Customer[]>('/customers'),
        api.get<Supplier[]>('/suppliers'),
        api.get<Order[]>('/orders'),
        api.get<Purchase[]>('/purchases'),
        api.get<Expense[]>('/expenses'),
        api.get<ProductionLot[]>('/lots'),
        api.get<RawMaterialLot[]>('/raw-material-lots'),
        api.get<Machine[]>('/machines'),
        api.get<Recall[]>('/recalls'),
        api.get<Notification[]>('/notifications'),
        api.get<HistoryEntry[]>('/history?limit=300'),
        api.get<User[]>('/users'),
        api.get<AppConfig>('/config'),
      ])
      setRawMaterials(rm); setPackaging(pk); setProducts(pr); setRecipes(rc)
      setCustomers(cu); setSuppliers(su); setOrders(or); setPurchases(pu)
      setExpenses(ex); setLots(lo); setRawMaterialLots(rml); setMachines(ma); setRecalls(rcalls)
      setNotifications(no); setHistory(hi)
      setUsers(us); setConfig(cf)
    } catch (e: any) {
      setError(e.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) { setLoading(true); fetchAll() }
    else { setLoading(false) }
  }, [token, fetchAll])

  const refresh = fetchAll

  const refreshOne = async (key: string) => {
    if (!token) return
    try {
      switch (key) {
        case 'rawMaterials': setRawMaterials(await api.get('/raw-materials')); break
        case 'packaging': setPackaging(await api.get('/packaging')); break
        case 'products': setProducts(await api.get('/products')); break
        case 'recipes': setRecipes(await api.get('/recipes')); break
        case 'customers': setCustomers(await api.get('/customers')); break
        case 'suppliers': setSuppliers(await api.get('/suppliers')); break
        case 'orders': setOrders(await api.get('/orders')); break
        case 'purchases': setPurchases(await api.get('/purchases')); break
        case 'expenses': setExpenses(await api.get('/expenses')); break
        case 'lots': setLots(await api.get('/lots')); break
        case 'rawMaterialLots': setRawMaterialLots(await api.get('/raw-material-lots')); break
        case 'machines': setMachines(await api.get('/machines')); break
        case 'recalls': setRecalls(await api.get('/recalls')); break
        case 'notifications': setNotifications(await api.get('/notifications')); break
        case 'history': setHistory(await api.get('/history?limit=300')); break
        case 'users': setUsers(await api.get('/users')); break
        case 'config': setConfig(await api.get('/config')); break
        default: await fetchAll()
      }
    } catch (e: any) { setError(e.message) }
  }

  return (
    <DataContext.Provider value={{
      loading, error,
      rawMaterials, packaging, products, recipes, customers, suppliers, orders, purchases, expenses,
      lots, rawMaterialLots, machines, recalls,
      notifications, history, users, config,
      refresh, refreshOne,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be inside DataProvider')
  return ctx
}
