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
  admin: ['*'],
  // Producción: todo el ciclo de fabricación, puede crear y editar pero NO borrar lotes/MPs
  produccion: [
    'dashboard', 'alerts',
    'recipes.read', 'recipes.write',
    'products.read', 'products.write',
    'rawMaterials.read', 'rawMaterials.write',
    'packaging.read', 'packaging.write',
    'lots.read', 'lots.write',
    'rawMaterialLots.read', 'rawMaterialLots.write',
    'machines.read', 'machines.write',
    'purchases.read', 'purchases.write',  // para registrar entradas de MP
    'suppliers.read',
  ],
  // Contabilidad: gastos, compras, informes, ver productos
  contabilidad: [
    'dashboard', 'alerts',
    'expenses.read', 'expenses.write',
    'purchases.read', 'purchases.write',
    'suppliers.read', 'suppliers.write',
    'products.read',
    'reports.read',
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
    window.location.href = '/login'
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
