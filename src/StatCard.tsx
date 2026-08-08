import { ReactNode } from 'react'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  tone?: 'brand' | 'emerald' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate'
  trend?: { value: number; positive?: boolean }
  format?: 'number' | 'currency' | 'percent' | 'none'
}

const TONES: Record<string, { bg: string; text: string; ring: string }> = {
  brand: { bg: 'bg-brand-50 dark:bg-brand-950/40', text: 'text-brand-600 dark:text-brand-400', ring: 'ring-brand-200/50 dark:ring-brand-800/50' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200/50 dark:ring-emerald-800/50' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200/50 dark:ring-amber-800/50' },
  red: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-200/50 dark:ring-red-800/50' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-200/50 dark:ring-violet-800/50' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-600 dark:text-cyan-400', ring: 'ring-cyan-200/50 dark:ring-cyan-800/50' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-900/40', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-200/50 dark:ring-slate-800/50' },
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', trend }: StatCardProps) {
  const t = TONES[tone]
  return (
    <div className={cn('card p-5 flex flex-col gap-3 relative overflow-hidden card-hover')}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-50 mt-1.5 tabular-nums truncate">{value}</p>
        </div>
        {Icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center ring-1', t.bg, t.text, t.ring)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        {hint && <span className="text-surface-500 dark:text-surface-400">{hint}</span>}
        {trend && (
          <span className={cn('inline-flex items-center gap-0.5 font-semibold', trend.positive ? 'text-emerald-600' : 'text-red-600')}>
            {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value > 0 ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    </div>
  )
}
