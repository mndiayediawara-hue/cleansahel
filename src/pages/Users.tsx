
import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { Can } from '@/components/Can'
import { api } from '@/lib/api'
import { PageHeader, DataTable, EmptyState } from '@/components/ui/Common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { UserCog, Plus, Shield, Users as UsersIcon, Mail, Key, Edit2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

const ROLES: { value: string; label: string; perms: string }[] = [
  { value: 'admin', label: 'Administrador', perms: 'Acceso total al sistema' },
  { value: 'produccion', label: 'Producción', perms: 'Fabricar, ver recetas y materiales' },
  { value: 'contabilidad', label: 'Contabilidad', perms: 'Gastos, compras, informes' },
]

const empty: any = { username: '', password: '', fullName: '', email: '', role: 'produccion', active: true }

export default function Users() {
  const { users, refreshOne } = useData()
  const [editing, setEditing] = useState<any | null>(null)
  const [confirm, setConfirm] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [pwReset, setPwReset] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      if (editing.id) await api.put(`/users/${editing.id}`, editing)
      else await api.post('/users', editing)
      await refreshOne('users')
      setEditing(null)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(u: User) {
    try { await api.del(`/users/${u.id}`); await refreshOne('users') }
    catch (e: any) { alert(e.message) }
  }

  async function resetPassword() {
    if (!pwReset || !newPassword) return
    try {
      await api.put(`/users/${pwReset.id}`, { password: newPassword })
      setPwReset(null); setNewPassword('')
      alert('Contraseña actualizada')
    } catch (e: any) { alert(e.message) }
  }

  const columns = [
    { key: 'fullName', label: 'Nombre', render: (r: User) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-xs font-semibold">{(r.fullName || r.username || '?').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}</div>
          <div><p className="font-medium">{r.fullName}</p><p className="text-xs text-surface-500">@{r.username}</p></div>
        </div>
      )
    },
    { key: 'email', label: 'Email', render: (r: User) => <span className="text-xs">{r.email}</span> },
    { key: 'role', label: 'Rol', render: (r: User) => <span className="badge bg-surface-100 dark:bg-surface-800 capitalize">{ROLES.find(x => x.value === r.role)?.label || r.role}</span> },
    { key: 'active', label: 'Estado', render: (r: User) => r.active ? <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Activo</span> : <span className="badge bg-red-100 text-red-800">Bloqueado</span> },
    { key: 'lastLogin', label: 'Último acceso', render: (r: User) => r.lastLogin ? <span className="text-xs">{formatDate(r.lastLogin)}</span> : <span className="text-xs text-surface-400">Nunca</span> },
    { key: 'actions', label: '', align: 'right' as const, render: (r: User) => (
        <div className="flex items-center justify-end gap-1">
          <Can do="users.admin"><button onClick={() => { setPwReset(r); setNewPassword('') }} className="btn-ghost p-1.5" title="Reset contraseña"><Key className="w-3.5 h-3.5" /></button></Can>
          <Can do="users.admin"><button onClick={() => setEditing(r)} className="btn-ghost p-1.5 text-xs">Editar</button></Can>
          <Can do="users.admin"><button onClick={() => setConfirm(r)} className="btn-ghost p-1.5 text-red-600 text-xs">Borrar</button></Can>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Usuarios y Permisos" subtitle="Gestión de cuentas y roles de acceso"
        actions={<Can do="users.admin"><button onClick={() => setEditing({ ...empty })} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo usuario</button></Can>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Usuarios totales" value={users.length} icon={UsersIcon} tone="brand" />
        <StatCard label="Activos" value={users.filter(u => u.active).length} icon={Shield} tone="emerald" />
        <StatCard label="Roles" value={new Set(users.map(u => u.role)).size} icon={Shield} tone="violet" />
        <StatCard label="Admins" value={users.filter(u => u.role === 'admin').length} icon={UserCog} tone="amber" />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">Permisos por rol</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map(r => (
            <div key={r.value} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
              <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-brand-600" /><p className="font-semibold text-sm">{r.label}</p></div>
              <p className="text-xs text-surface-500">{r.perms}</p>
            </div>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={users} />

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar usuario' : 'Nuevo usuario'}
          footer={<><button onClick={() => setEditing(null)} className="btn-secondary">Cancelar</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? '...' : 'Guardar'}</button></>}
        >
          <div className="space-y-3">
            {!editing.id && <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">El usuario se creará con esta contraseña inicial. Puede cambiarla después.</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nombre completo</label><input className="input" value={editing.fullName || ''} onChange={e => setEditing({ ...editing, fullName: e.target.value })} /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              <div><label className="label">Usuario</label><input className="input" value={editing.username || ''} onChange={e => setEditing({ ...editing, username: e.target.value })} disabled={!!editing.id} /></div>
              {!editing.id && <div><label className="label">Contraseña</label><input type="password" className="input" value={editing.password || ''} onChange={e => setEditing({ ...editing, password: e.target.value })} /></div>}
              <div><label className="label">Rol</label>
                <select className="input" value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5"><input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({ ...editing, active: e.target.checked })} /><label className="text-sm">Usuario activo</label></div>
            </div>
          </div>
        </Modal>
      )}

      {pwReset && (
        <Modal open onClose={() => setPwReset(null)} title={`Reset contraseña: ${pwReset.fullName}`}
          footer={<><button onClick={() => setPwReset(null)} className="btn-secondary">Cancelar</button><button onClick={resetPassword} className="btn-primary">Actualizar</button></>}
        >
          <div><label className="label">Nueva contraseña</label><input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus /></div>
        </Modal>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && remove(confirm)} title="Borrar usuario" message={`¿Eliminar a "${confirm?.fullName}"?`} danger />
    </div>
  )
}