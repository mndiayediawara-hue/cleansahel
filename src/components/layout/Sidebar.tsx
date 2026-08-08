import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Beaker, Package, Boxes, ChefHat, Factory, Users, ShoppingCart, ShoppingBag, Receipt,
  TrendingUp, FileBarChart, UserCog, History, Settings, Bell, Layers, Search, ScanLine, Hash, AlertTriangle
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { useData } from '@/contexts/DataContext'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'

interface NavItem {
  to: string
  label: string
  icon: any
  permission?: string
  badge?: number
  section?: string
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can, user } = useAuth()
  const { notifications, products, rawMaterials, packaging, orders } = useData()
  const { t, lang, currency } = useI18n()
  const unread = notifications.filter(n => !n.read).length
  const lowStockCount =
    products.filter(p => p.stock < p.minStock).length +
    rawMaterials.filter(m => m.stock < m.minStock).length +
    packaging.filter(p => p.stock < p.minStock).length
  const pendingOrders = orders.filter(o => o.status === 'pendiente' || o.status === 'confirmado').length
  const demo = api.isDemo()

  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: t('nav.section_general'),
      items: [
        { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
        { to: '/alerts', label: t('nav.alerts'), icon: Bell, badge: unread },
        { to: '/search', label: t('nav.search'), icon: Search },
        { to: '/scanner', label: t('nav.scanner'), icon: ScanLine },
      ],
    },
    {
      title: 'PRODUCCIÓN',
      items: [
        { to: '/raw-materials', label: 'Materias Primas', icon: Beaker, permission: 'rawMaterials.read' },
        { to: '/raw-material-lots', label: 'Lotes de MP', icon: Beaker, permission: 'rawMaterialLots.read' },
        { to: '/packaging', label: 'Embalaje', icon: Package, permission: 'packaging.read' },
        { to: '/recipes', label: 'Recetas', icon: ChefHat, permission: 'recipes.read' },
        { to: '/production', label: 'Producción', icon: Factory, permission: 'produccion' },
        { to: '/lots', label: 'Lotes', icon: Layers, permission: 'lots.read' },
        { to: '/lot-generator', label: 'Generar lote', icon: Hash, permission: 'lots.read' },
        { to: '/recalls', label: 'Retiradas', icon: AlertTriangle, permission: 'users.admin' },
      ],
    },
    {
      title: 'COMERCIAL',
      items: [
        { to: '/products', label: 'Productos', icon: Boxes, permission: 'products.read' },
        { to: '/customers', label: 'Clientes', icon: Users, permission: 'customers.read' },
        { to: '/orders', label: 'Pedidos', icon: ShoppingCart, permission: 'orders.read', badge: pendingOrders },
        { to: '/sales', label: 'Ventas', icon: TrendingUp, permission: 'sales.read' },
      ],
    },
    {
      title: 'OPERACIONES',
      items: [
        { to: '/purchases', label: 'Compras', icon: ShoppingBag, permission: 'purchases.read' },
        { to: '/expenses', label: 'Gastos', icon: Receipt, permission: 'expenses.read' },
      ],
    },
    {
      title: 'ANÁLISIS',
      items: [
        { to: '/reports', label: 'Informes', icon: FileBarChart, permission: 'reports.read' },
        { to: '/history', label: 'Historial', icon: History },
        { to: '/users', label: 'Usuarios', icon: UserCog, permission: 'users.admin' },
        { to: '/settings', label: 'Configuración', icon: Settings, permission: 'users.admin' },
      ],
    },
  ]

  return (
    <aside className="w-64 shrink-0 h-full bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 flex flex-col">
      <div className="px-5 py-5 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-surface-900 dark:text-surface-50">CleanSahel</p>
            <p className="text-[10px] text-surface-500 uppercase tracking-wider">Gestión Industrial</p>
          </div>
        </div>
        {api.isDemo() && (
          <div className="mt-3 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[10px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> {t('nav.demo_banner')}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {sections.map((s) => {
          const items = s.items.filter(i => {
            // Safety net: admin ve todo
            if (user?.role === 'admin' || user?.role === '*') return true
            return !i.permission || can(i.permission)
          })
          if (items.length === 0) return null
          return (
            <div key={s.title}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-surface-400 dark:text-surface-500">{s.title}</p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) => cn('nav-item group', isActive && 'nav-item-active')}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-semibold">{item.badge}</span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {lowStockCount > 0 && (
        <div className="m-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Bell className="w-4 h-4" />
            <p className="text-xs font-semibold">{lowStockCount} artículos con stock bajo</p>
          </div>
        </div>
      )}
    </aside>
  )
}
