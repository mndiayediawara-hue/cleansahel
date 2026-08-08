import { useState, ReactNode } from 'react'
import { Plus, Search, Download, Upload, FileText } from 'lucide-react'
import { PageHeader, DataTable, EmptyState } from './Common'
import { Modal, ConfirmDialog } from './Modal'
import { exportCSV } from '@/lib/utils'
import { useData } from '@/contexts/DataContext'

interface CrudPageProps<T extends { id: string }> {
  title: string
  subtitle?: string
  data: T[]
  columns: any[]
  searchKeys: (keyof T)[]
  searchPlaceholder?: string
  onCreate?: () => void
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  createButtonLabel?: string
  onRefresh?: () => void
  createPermission?: boolean
  canExport?: boolean
  emptyTitle?: string
  emptyDescription?: string
  extraActions?: ReactNode
  formModal?: ReactNode
  filterComponent?: ReactNode
  isLoading?: boolean
}

export function CrudPage<T extends { id: string }>({
  title, subtitle, data, columns, searchKeys, searchPlaceholder = 'Buscar...',
  onCreate, onEdit, onDelete, createButtonLabel = 'Nuevo', onRefresh,
  createPermission = true, canExport = true, emptyTitle = 'Sin datos',
  emptyDescription, extraActions, formModal, filterComponent, isLoading
}: CrudPageProps<T>) {
  const [query, setQuery] = useState('')
  const [confirm, setConfirm] = useState<T | null>(null)

  const filtered = data.filter((row) => {
    if (!query) return true
    const q = query.toLowerCase()
    return searchKeys.some((k) => String((row as any)[k] ?? '').toLowerCase().includes(q))
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {filterComponent}
            {canExport && data.length > 0 && (
              <button onClick={() => exportCSV(title.toLowerCase().replace(/\s+/g, '-'), filtered as any)} className="btn-secondary">
                <Download className="w-4 h-4" /> CSV
              </button>
            )}
            {extraActions}
            {onCreate && createPermission && (
              <button onClick={onCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> {createButtonLabel}
              </button>
            )}
          </>
        }
      />

      <div className="card p-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="text-xs text-surface-500 ml-auto">
          {filtered.length} de {data.length} {data.length === 1 ? 'registro' : 'registros'}
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center text-sm text-surface-500">Cargando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-5 h-5" />}
          title={emptyTitle}
          description={emptyDescription}
          action={onCreate && createPermission ? <button onClick={onCreate} className="btn-primary"><Plus className="w-4 h-4" /> {createButtonLabel}</button> : null}
        />
      ) : (
        <DataTable
          columns={columns.map((c) => ({
            ...c,
            render: c.render
              ? c.render
              : c.actions
                ? (row: T) => (
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} className="btn-ghost p-1.5">Editar</button>}
                      {onDelete && <button onClick={(e) => { e.stopPropagation(); setConfirm(row) }} className="btn-ghost p-1.5 text-red-600">Borrar</button>}
                    </div>
                  )
                : undefined,
          }))}
          data={filtered}
        />
      )}

      {formModal}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && onDelete?.(confirm)}
        title="Confirmar borrado"
        message={`¿Está seguro de eliminar este registro? Esta acción quedará registrada en el historial.`}
        danger
      />
    </div>
  )
}
