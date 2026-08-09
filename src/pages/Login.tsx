import { useState, FormEvent } from 'react'

// Logo de la empresa
const LOGO_URL = '/cleansahel/logo.svg'
const LOGO_ALT = 'SAHEL'
import { useNavigate } from 'react-router-dom'
import { Factory, Sun, Moon, LogIn, Eye, EyeOff, AlertCircle, Loader2, Globe, Coins } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useI18n } from '@/lib/i18n'

export default function Login() {
  const { login } = useAuth()
  const { theme, toggle } = useTheme()
  const { lang, setLang, currency, setCurrency, t } = useI18n()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(username, password)
      // Recargar a la base URL. Detectamos el subpath actual.
      // El pathname actual en GitHub Pages después del login es '/' (basename aplicado)
      // Pero queremos volver al base real
      const currentPath = window.location.pathname
      const fullPath = sessionStorage.getItem('cleansahel-basepath') || currentPath
      // Si la URL no contiene /cleansahel, lo añadimos
      let baseUrl = window.location.origin
      if (!fullPath.includes('/cleansahel') && window.location.hostname.includes('github.io')) {
        baseUrl += '/cleansahel'
      }
      window.location.href = baseUrl + '/'
    } catch (err: any) {
      setError(err?.message || 'Error de inicio de sesión')
    } finally {
      setLoading(false)
    }
  }

  function quick(u: string, p: string) {
    setUsername(u); setPassword(p)
  }

  return (
    <div className="min-h-screen flex items-stretch bg-surface-50 dark:bg-surface-950">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white p-12 flex-col justify-between">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-brand-500/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-white p-1.5 shadow-lg flex items-center justify-center">
              <img src={LOGO_URL} alt={LOGO_ALT} className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-2xl font-bold">SAHEL</p>
              <p className="text-sm text-brand-100">Produits d'Hygiène</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">{lang === 'fr' ? 'Contrôle total de votre usine de nettoyage' : 'Control total de tu fábrica de limpieza'}</h2>
          <p className="text-brand-100 text-lg">{lang === 'fr' ? 'Inventaire, production, ventes, clients et finances — tout en un seul endroit, en temps réel.' : 'Inventario, producción, ventas, clientes y finanzas — todo en un solo lugar, en tiempo real.'}</p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { label: lang === 'fr' ? 'Matières premières' : 'Materias primas', value: '100%' },
              { label: lang === 'fr' ? 'Traçabilité' : 'Trazabilidad', value: lang === 'fr' ? 'Totale' : 'Total' },
              { label: lang === 'fr' ? 'Modules' : 'Módulos', value: '22' },
              { label: lang === 'fr' ? 'Rôles' : 'Roles', value: '5' },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-lg bg-white/5 backdrop-blur ring-1 ring-white/10">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-brand-100 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-brand-200">© 2025 SAHEL · Produits d'Hygiène</div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col p-6 lg:p-12 max-w-md lg:max-w-none w-full mx-auto">
        <div className="flex justify-end gap-2">
          <div className="flex rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            <button onClick={() => setLang('es')} className={`px-2 py-1.5 text-xs font-semibold ${lang === 'es' ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>ES</button>
            <button onClick={() => setLang('fr')} className={`px-2 py-1.5 text-xs font-semibold ${lang === 'fr' ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>FR</button>
          </div>
          <div className="flex rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
            <button onClick={() => setCurrency('EUR')} className={`px-2 py-1.5 text-xs font-semibold ${currency === 'EUR' ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>€</button>
            <button onClick={() => setCurrency('XOF')} className={`px-2 py-1.5 text-xs font-semibold ${currency === 'XOF' ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>FCFA</button>
          </div>
          <button onClick={toggle} className="btn-ghost p-2" aria-label="Cambiar tema">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm space-y-8">
            <div className="lg:hidden text-center mb-8">
              <div className="w-40 h-20 mx-auto mb-3 flex items-center justify-center">
                <img src={LOGO_URL} alt={LOGO_ALT} className="w-full h-full object-contain" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold">{t('login.title')}</h2>
              <p className="text-sm text-surface-500 mt-1">{t('login.subtitle')}</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">{t('login.user')}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  required
                  autoComplete="off"
                  name="demo_user_field"
                />
              </div>
              <div>
                <label className="label">{t('login.password')}</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    required
                    autoComplete="off"
                    name="demo_pass_field"
                  />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-surface-400 hover:text-surface-700">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {loading ? t('login.entering') : t('login.submit')}
              </button>
            </form>

            <div className="p-4 rounded-lg bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-800">
              <p className="text-xs font-semibold text-surface-600 dark:text-surface-400 mb-2 uppercase tracking-wide">{t('login.demo_accounts')}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['admin', 'admin123', lang === 'fr' ? 'Administrateur' : 'Administrador'],
                  ['produccion', 'produccion123', lang === 'fr' ? 'Production' : 'Producción'],
                  ['almacen', 'almacen123', lang === 'fr' ? 'Entrepôt' : 'Almacén'],
                  ['comercial', 'comercial123', lang === 'fr' ? 'Commercial' : 'Comercial'],
                  ['contabilidad', 'contabilidad123', lang === 'fr' ? 'Comptabilité' : 'Contabilidad'],
                ].map(([u, p, label]) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => quick(u, p)}
                    className="text-left text-[11px] p-2 rounded-md hover:bg-white dark:hover:bg-surface-900 transition"
                  >
                    <p className="font-semibold">{label}</p>
                    <p className="text-surface-500 font-mono">{u}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
console.log('LOGO_URL=', '/cleansahel/logo.svg')
