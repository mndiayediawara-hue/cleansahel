import { useAuth } from '@/contexts/AuthContext'
import { ReactNode } from 'react'

// Component to conditionally render children based on permissions
// Usage: <Can do="users.create"><button>Crear usuario</button></Can>
//        <Can module="rawMaterials" action="delete"><button>Borrar</button></Can>
export function Can({
  do: action,
  module,
  action: moduleAction,
  children,
  fallback = null
}: {
  do?: string
  module?: string
  action?: 'read' | 'write' | 'delete'
  children: ReactNode
  fallback?: ReactNode
}) {
  const { can, canRead, canWrite, canDelete } = useAuth()

  let allowed = false
  if (action) {
    allowed = can(action)
  } else if (module && moduleAction) {
    if (moduleAction === 'read') allowed = canRead(module)
    else if (moduleAction === 'write') allowed = canWrite(module)
    else if (moduleAction === 'delete') allowed = canDelete(module)
  }

  return allowed ? <>{children}</> : <>{fallback}</>
}
