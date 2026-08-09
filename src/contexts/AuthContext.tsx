import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'

export type Role = 'admin' | 'produccion' | 'contabilidad'

export interface User {
  id: string
  username: string
  fullName: string
  email: string
  role: Role
}

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  hasRole: (...roles: Role[]) => boolean
  can: (action: string) => boolean
  canRead: (module: string) => boolean
  canWrite: (module: string) => boolean
  canDelete: (module: string) => boolean
  canManageUsers: () => boolean
  isAdmin: () => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// SISTEMA DE PERMISOS granulares:
// '*'           = puede hacer TODO (solo admin)
// 'users.admin' = gestionar usuarios
// 'module.read'  = ver módulo
// 'module.write' = crear/editar en módulo
// 'module.delete' = borrar en módulo
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  // ADMIN: puede hacer TODO, incluido gestionar usuarios
  admin: ['*'],

  // PRODUCCIÓN: ciclo completo de fabricación
  // Ve TODO (dashboard, alertas, productos, MPs, recetas, lotes, embalajes, máquinas, clientes, ventas, informes)
  // Crea y edita todo lo de producción
  // NO puede: borrar nada, gestionar usuarios, entrar a config
  produccion: [
    'dashboard', 'alerts', 'reports.read',
    'products.read', 'products.write',
    'rawMaterials.read', 'rawMaterials.write',
    'packaging.read', 'packaging.write',
    'recipes.read', 'recipes.write',
    'lots.read', 'lots.write',
    'rawMaterialLots.read', 'rawMaterialLots.write',
    'machines.read', 'machines.write',
    'customers.read', 'customers.write',
    'suppliers.read',
  ],

  // CONTABILIDAD: todo lo financiero
  // Ve TODO (dashboard, alertas, productos, ventas, compras, gastos, clientes, proveedores, informes)
  // Crea y edita solo lo financiero (gastos, compras, ventas, pedidos)
  // NO puede: borrar nada, gestionar usuarios, ni tocar producción/recetas/lotes
  contabilidad: [
    'dashboard', 'alerts', 'reports.read',
    'expenses.read', 'expenses.write',
    'purchases.read', 'purchases.write',
    'sales.read', 'sales.write',
    'orders.read', 'orders.write',
    'customers.read', 'customers.write',
    'suppliers.read', 'suppliers.write',
    'products.read',
    'rawMaterials.read',
    'packaging.read',
    'lots.read',
    'rawMaterialLots.read',
  ],
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // On production with backend, NEVER trust stale localStorage user data
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => {
    // Only keep the token, the user object will be re-fetched from backend
    return localStorage.getItem('cleanerp-token')
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      // Si el token es de demo (empieza con "demo."), usar el user del localStorage directamente
      if (token.startsWith('demo.')) {
        try {
          const u = localStorage.getItem('cleanerp-user')
          if (u) setUser(JSON.parse(u))
        } catch {}
        setLoading(false)
        return
      }
      // Always re-validate token with backend to get fresh user data
      api.get<User>('/auth/me')
        .then(u => { setUser(u); localStorage.setItem('cleanerp-user', JSON.stringify(u)) })
        .catch(() => { setToken(null); setUser(null); localStorage.removeItem('cleanerp-token'); localStorage.removeItem('cleanerp-user') })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { username, password })
    setToken(res.token)
    setUser(res.user)
    localStorage.setItem('cleanerp-token', res.token)
    localStorage.setItem('cleanerp-user', JSON.stringify(res.user))
    return res.user
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('cleanerp-token')
    localStorage.removeItem('cleanerp-user')
    // NO recargar la página. El ProtectedRoute ya detecta que no hay user
    // y muestra el Login inline. Solo cambiamos la URL con replaceState
    // para que el back button no vuelva a la página protegida.
    try {
      const basePath = window.location.pathname.startsWith('/cleansahel') ? '/cleansahel' : ''
      window.history.replaceState({}, '', window.location.origin + basePath + '/')
    } catch {}
  }

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role)
  
  // Check if user can perform an action. Supports wildcard '*' for admin.
  const can = (action: string) => {
    if (!user) return false
    const perms = ROLE_PERMISSIONS[user.role] || []
    if (perms.includes('*')) return true
    return perms.includes(action)
  }
  
  // Check if user can access a module (read permission)
  const canRead = (module: string) => can(module + '.read') || can(module)
  // Check if user can create/edit in a module
  const canWrite = (module: string) => can(module + '.write')
  // Check if user can delete in a module
  const canDelete = (module: string) => can(module + '.delete')
  // Special: only admin/subadmin can manage users
  const canManageUsers = () => can('users.admin') || can('users.create')
  // Check if user is admin (full or subadmin)
  const isAdmin = () => !!user && user.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole, can, canRead, canWrite, canDelete, canManageUsers, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
