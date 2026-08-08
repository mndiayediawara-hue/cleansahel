import { ReactNode, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">{title}</h1>
        {subtitle && <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input pl-9 max-w-xs"
    />
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card p-12 text-center">
      {icon && <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400">{icon}</div>}
      <h3 className="font-semibold text-surface-900 dark:text-surface-100">{title}</h3>
      {description && <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  className?: string
}

export function DataTable<T extends { id: string }>({ columns, data, onRowClick }: { columns: Column<T>[]; data: T[]; onRowClick?: (row: T) => void }) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sortedData = [...data].sort((a, b) => {
    if (!sort) return 0
    const av = (a as any)[sort.key]
    const bv = (b as any)[sort.key]
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number') return sort.dir === 'asc' ? av - bv : bv - av
    return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  const toggleSort = (key: string) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-800">
            <tr>
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-400',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.sortable && 'cursor-pointer select-none hover:text-surface-900 dark:hover:text-surface-200',
                    c.className
                  )}
                  onClick={() => c.sortable && toggleSort(String(c.key))}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sortable && (
                      sort?.key === c.key
                        ? (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                        : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-surface-500">Sin resultados</td></tr>
            ) : sortedData.map((row) => (
              <tr
                key={row.id}
                className={cn('border-b border-surface-100 dark:border-surface-800 last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50')}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((c) => (
                  <td
                    key={String(c.key)}
                    className={cn(
                      'px-4 py-3 text-surface-700 dark:text-surface-300',
                      c.align === 'right' && 'text-right',
                      c.align === 'center' && 'text-center',
                      c.className
                    )}
                  >
                    {c.render ? c.render(row) : String((row as any)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StatBadge({ value, label, tone = 'neutral' }: { value: string | number; label: string; tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    critical: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('inline-flex w-fit px-2 py-0.5 rounded-md text-xs font-semibold', tones[tone])}>{value}</span>
      {label && <span className="text-[10px] text-surface-500 uppercase tracking-wide">{label}</span>}
    </div>
  )
}
