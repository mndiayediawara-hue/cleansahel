
import { useEffect, useRef, useState } from 'react'
import { Bell, Sun, Moon, LogOut, Search, User, Menu, Globe, Coins, Repeat } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useI18n } from '@/lib/i18n'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { relativeTime } from '@/lib/utils'

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { theme, toggle } = useTheme()
  const { user, logout } = useAuth()
  const { notifications, refreshOne } = useData()
  const { lang, setLang, currency, setCurrency, t } = useI18n()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const debounce = useRef<any>(null)

  useEffect(() => {
    if (globalQuery.length < 2) { setResults([]); return }
    setSearching(true)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      try {
        const res = await api.get<{ results: any[] }>(`/search?q=${encodeURIComponent(globalQuery)}`)
        setResults(res.results)
      } catch {} finally { setSearching(false) }
    }, 250)
  }, [globalQuery])

  const unread = notifications.filter(n => !n.read).length

  async function handleReadAll() {
    await api.post('/notifications/read-all')
    refreshOne('notifications')
    setNotifOpen(false)
  }

  const typeLabels: Record<string, string> = {
    'stock-bajo': 'Stock bajo', caducidad: 'Caducidad', lote: 'Lote', pedido: 'Pedido',
    produccion: 'Producción', sistema: 'Sistema', 'lote-proximo': 'Lote próximo'
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-surface-900/80 backdrop-blur-md border-b border-surface-200 dark:border-surface-800 flex items-center px-4 lg:px-6 gap-3">
      <button onClick={onMenuClick} className="lg:hidden btn-ghost p-2">
        <Menu className="w-5 h-5" />
      </button>

      <div className="hidden md:flex flex-1 max-w-xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          value={globalQuery}
          onChange={(e) => setGlobalQuery(e.target.value)}
          onFocus={() => navigate('/search')}
          placeholder="Buscar clientes, productos, pedidos, lotes..."
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {globalQuery.length >= 2 && results.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 card max-h-80 overflow-y-auto z-50">
            {searching && <div className="p-3 text-xs text-surface-500">Buscando...</div>}
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => {
                  const map: Record<string, string> = {
                    producto: '/products', cliente: '/customers', proveedor: '/settings',
                    materia_prima: '/raw-materials', lote: '/lots', pedido: '/orders',
                  }
                  navigate(map[r.type] || '/')
                  setGlobalQuery(''); setResults([])
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800 text-left text-sm"
              >
                <span className="text-[10px] font-bold uppercase text-surface-500 w-24 shrink-0">{r.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-surface-500 truncate">{r.subtitle}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 md:hidden" />

      <button onClick={toggle} className="btn-ghost p-2" aria-label="Cambiar tema">
        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      {/* Swap rápido de moneda: EUR ↔ FCFA */}
      <button
        onClick={() => setCurrency(currency === 'EUR' ? 'XOF' : 'EUR')}
        className="btn-ghost text-xs font-mono font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700"
        title="Cambiar moneda (EUR ↔ FCFA)"
      >
        <Coins className="w-3.5 h-3.5" />
        <span className={currency === 'EUR' ? 'text-emerald-600' : 'text-amber-600'}>
          {currency === 'EUR' ? '€ EUR' : 'FCFA'}
        </span>
        <Repeat className="w-3 h-3 text-surface-400" />
      </button>

      <div className="relative">
        <button onClick={() => setLangOpen(!langOpen)} className="btn-ghost text-xs font-semibold flex items-center gap-1 px-2" aria-label="Idioma">
          <Globe className="w-3.5 h-3.5" />
          <span>{lang === 'es' ? 'ES' : 'FR'}</span>
          <span className="hidden sm:inline text-surface-500">· {currency}</span>
        </button>
        {langOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 card shadow-2xl z-50 p-2">
              <p className="px-2 py-1.5 text-[10px] uppercase font-bold text-surface-500 tracking-wider">{t('header.lang')}</p>
              <button
                onClick={() => { setLang('es'); setLangOpen(false) }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm ${lang === 'es' ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300' : 'hover:bg-surface-50 dark:hover:bg-surface-800'}`}
              >
                <span className="flex items-center gap-2"><span>🇪🇸</span> Español</span>
                {lang === 'es' && <span className="text-xs">✓</span>}
              </button>
              <button
                onClick={() => { setLang('fr'); setLangOpen(false) }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm ${lang === 'fr' ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300' : 'hover:bg-surface-50 dark:hover:bg-surface-800'}`}
              >
                <span className="flex items-center gap-2"><span>🇫🇷</span> Français</span>
                {lang === 'fr' && <span className="text-xs">✓</span>}
              </button>
              <div className="border-t border-surface-200 dark:border-surface-800 my-1" />
              <p className="px-2 py-1.5 text-[10px] uppercase font-bold text-surface-500 tracking-wider">{t('header.currency')}</p>
              <button
                onClick={() => setCurrency('EUR')}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm ${currency === 'EUR' ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300' : 'hover:bg-surface-50 dark:hover:bg-surface-800'}`}
              >
                <span className="flex items-center gap-2"><Coins className="w-3.5 h-3.5" /> Euro (€)</span>
                {currency === 'EUR' && <span className="text-xs">✓</span>}
              </button>
              <button
                onClick={() => setCurrency('XOF')}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm ${currency === 'XOF' ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300' : 'hover:bg-surface-50 dark:hover:bg-surface-800'}`}
              >
                <span className="flex items-center gap-2"><Coins className="w-3.5 h-3.5" /> Franc CFA (FCFA)</span>
                {currency === 'XOF' && <span className="text-xs">✓</span>}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <button onClick={() => setNotifOpen(!notifOpen)} className="btn-ghost p-2 relative" aria-label="Notificaciones">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-surface-900" />
          )}
        </button>
        {notifOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
            <div className="absolute right-0 mt-2 w-96 card shadow-2xl z-50 max-h-[70vh] flex flex-col">
              <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
                <p className="font-semibold">Notificaciones</p>
                {unread > 0 && <button onClick={handleReadAll} className="text-xs text-brand-600 hover:underline">Marcar todo leído</button>}
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <p className="p-8 text-center text-sm text-surface-500">Sin notificaciones</p>
                ) : notifications.slice(0, 20).map((n) => (
                  <Link
                    key={n.id}
                    to={n.relatedId?.startsWith('lot:') ? '/lots' : n.relatedId?.startsWith('order:') ? '/orders' : '/alerts'}
                    onClick={async () => { setNotifOpen(false); await api.post(`/notifications/${n.id}/read`); refreshOne('notifications') }}
                    className={`block px-4 py-3 border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800 ${!n.read ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${
                        n.severity === 'critical' ? 'bg-red-500' :
                        n.severity === 'warning' ? 'bg-amber-500' :
                        n.severity === 'success' ? 'bg-emerald-500' : 'bg-sky-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{n.title}</p>
                        <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-surface-400 mt-1 uppercase">{typeLabels[n.type] || n.type} · {relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <button onClick={() => setUserOpen(!userOpen)} className="flex items-center gap-2 p-1 pr-3 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-xs font-semibold">
            {user?.fullName?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold leading-tight">{user?.fullName}</p>
            <p className="text-[10px] text-surface-500 capitalize">{user?.role}</p>
          </div>
        </button>
        {userOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 card shadow-2xl z-50 py-1">
              <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-800">
                <p className="text-sm font-semibold">{user?.fullName}</p>
                <p className="text-xs text-surface-500">{user?.email}</p>
              </div>
              <Link to="/settings" onClick={() => setUserOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-800">
                <User className="w-4 h-4" /> Mi perfil
              </Link>
              <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}