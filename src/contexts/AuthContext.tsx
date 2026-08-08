import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'

export type Role = 'admin' | 'produccion' | 'almacen' | 'comercial' | 'contabilidad'

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
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ['*'],
  produccion: ['produccion', 'recipes.read', 'recipes.write', 'products.read', 'materials.read', 'dashboard', 'lots', 'alerts'],
  almacen: ['materials.read', 'materials.write', 'packaging.read', 'packaging.write', 'purchases.read', 'purchases.write', 'dashboard', 'alerts'],
  comercial: ['customers.read', 'customers.write', 'orders.read', 'orders.write', 'products.read', 'dashboard', 'sales'],
  contabilidad: ['expenses.read', 'expenses.write', 'purchases.read', 'purchases.write', 'suppliers.read', 'suppliers.write', 'reports', 'dashboard', 'sales'],
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('cleanerp-user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cleanerp-token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token && !user) {
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
  const can = (action: string) => {
    if (!user) return false
    const perms = ROLE_PERMISSIONS[user.role] || []
    return perms.includes('*') || perms.includes(action)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
