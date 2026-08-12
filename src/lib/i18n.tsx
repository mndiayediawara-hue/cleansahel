
// Sistema i18n simple para ES/FR
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Lang = 'es' | 'fr'
export type Currency = 'EUR' | 'XOF'

interface I18nContextValue {
  lang: Lang
  currency: Currency
  setLang: (l: Lang) => void
  setCurrency: (c: Currency) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  formatMoney: (value: number, decimals?: number) => string
  formatDate: (date: string | Date) => string
  formatDateTime: (date: string | Date) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

// Diccionario de traducciones. Solo las cadenas más usadas.
// Las que no estén aquí, devuelven la clave (fallback).
const translations: Record<Lang, Record<string, string>> = {
  es: {
    // Login
    'login.title': 'Iniciar sesión',
    'login.subtitle': 'Accede a tu panel de control',
    'login.user': 'Usuario',
    'login.password': 'Contraseña',
    'login.submit': 'Entrar',
    'login.entering': 'Entrando...',
    'login.error_generic': 'Error de inicio de sesión',
    'login.brand_subtitle': 'Control total de tu fábrica de limpieza',
    'login.demo_accounts': 'Cuentas de prueba',
    'login.tag_metrics': 'Materias primas',
    'login.tag_trace': 'Trazabilidad',
    'login.tag_modules': 'Módulos',
    'login.tag_roles': 'Roles',

    // Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.alerts': 'Alertas',
    'nav.search': 'Búsqueda',
    'nav.scanner': 'Escáner',
    'nav.raw_materials': 'Materias Primas',
    'nav.raw_material_lots': 'Lotes de MP',
    'nav.packaging': 'Embalaje',
    'nav.recipes': 'Recetas',
    'nav.production': 'Producción',
    'nav.lots': 'Lotes',
    'nav.lot_generator': 'Generar lote',
    'nav.recalls': 'Retiradas',
    'nav.products': 'Productos',
    'nav.customers': 'Clientes',
    'nav.orders': 'Pedidos',
    'nav.sales': 'Ventas',
    'nav.purchases': 'Compras',
    'nav.expenses': 'Gastos',
    'nav.reports': 'Informes',
    'nav.history': 'Historial',
    'nav.users': 'Usuarios',
    'nav.settings': 'Configuración',
    'nav.section_general': 'General',
    'nav.section_production': 'Producción',
    'nav.section_commercial': 'Comercial',
    'nav.section_operations': 'Operaciones',
    'nav.section_analysis': 'Análisis',

    // Header
    'header.search_placeholder': 'Buscar clientes, productos, pedidos, lotes...',
    'header.notifications': 'Notificaciones',
    'header.mark_all_read': 'Marcar todo leído',
    'header.profile': 'Mi perfil',
    'header.logout': 'Cerrar sesión',
    'header.lang': 'Idioma',
    'header.currency': 'Moneda',

    // Dashboard
    'dash.greeting_morning': 'Buenos días',
    'dash.greeting_afternoon': 'Buenas tardes',
    'dash.greeting_evening': 'Buenas noches',
    'dash.welcome': 'Aquí tienes el estado actual de tu fábrica en tiempo real.',
    'dash.live': 'En vivo',
    'dash.updated': 'Actualizado',
    'dash.kpi.inventory_value': 'Valor del inventario',
    'dash.kpi.raw_materials': 'Materias primas',
    'dash.kpi.packaging': 'Envases y embalajes',
    'dash.kpi.products': 'Productos terminados',
    'dash.kpi.low_stock': 'Stock bajo',
    'dash.kpi.production_today': 'Producción hoy',
    'dash.kpi.production_week': 'Producción semanal',
    'dash.kpi.production_month': 'Producción mensual',
    'dash.kpi.sales_today': 'Ventas hoy',
    'dash.kpi.sales_month': 'Ventas del mes',
    'dash.kpi.expenses_month': 'Gastos del mes',
    'dash.kpi.benefit': 'Beneficio',
    'dash.chart.sales_vs_expenses': 'Ventas vs Gastos',
    'dash.chart.last_7': 'Últimos 7 días',
    'dash.chart.inventory_comp': 'Composición del inventario',
    'dash.chart.top_products': 'Productos más vendidos (mes)',
    'dash.chart.top_customers': 'Clientes principales',
    'dash.recent.orders': 'Últimos pedidos',
    'dash.recent.purchases': 'Últimas compras',
    'dash.recent.lots': 'Producción reciente',
    'dash.recent.see_all': 'Ver todos',

    // Common
    'common.search': 'Buscar...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Borrar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.new': 'Nuevo',
    'common.export_csv': 'CSV',
    'common.view_all': 'Ver todos',
    'common.loading': 'Cargando...',
    'common.no_data': 'Sin datos',
    'common.confirm_delete': 'Confirmar borrado',
    'common.confirm_delete_msg': '¿Está seguro de eliminar este registro? Esta acción quedará registrada en el historial.',
    'common.back': 'Volver',
    'common.close': 'Cerrar',
    'common.actions': 'Acciones',
    'common.status': 'Estado',
    'common.date': 'Fecha',
    'common.total': 'Total',
    'common.all': 'Todos',

    // Settings
    'settings.title': 'Configuración',
    'settings.subtitle': 'Personaliza el comportamiento del sistema',
    'settings.save': 'Guardar cambios',
    'settings.saving': 'Guardando...',
    'settings.saved': '¡Guardado!',
    'settings.section_company': 'Datos de la empresa',
    'settings.section_defaults': 'Valores por defecto',
    'settings.section_security': 'Seguridad',
    'settings.section_lot': 'Formato de número de lote',
    'settings.section_backup': 'Copias de seguridad',
    'settings.lang_currency': 'Idioma y moneda',

    // Lot Generator
    'lotgen.title': 'Generador de Números de Lote',
    'lotgen.subtitle': 'Creación asistida: el sistema asigna el número automáticamente. Nunca se introduce a mano.',
    'lotgen.create': 'Crear nuevo lote',
    'lotgen.preview': 'Número de lote generado',
    'lotgen.preview_hint': 'Este número es único e irrepetible. Se asigna al guardar.',

    // Lots
    'lots.title': 'Lotes de Fabricación',
    'lots.subtitle': 'Trazabilidad completa: cada lote registra operador, máquina, fecha, MP utilizada con sus lotes',
    'lots.kpi.total': 'Lotes fabricados',
    'lots.kpi.units': 'Unidades totales',
    'lots.kpi.week': 'Últimos 7 días',
    'lots.kpi.blocked': 'MP bloqueadas/caducadas',
  },
  fr: {
    // Login
    'login.title': 'Connexion',
    'login.subtitle': 'Accédez à votre tableau de bord',
    'login.user': 'Utilisateur',
    'login.password': 'Mot de passe',
    'login.submit': 'Entrer',
    'login.entering': 'Connexion...',
    'login.error_generic': 'Erreur de connexion',
    'login.brand_subtitle': 'Contrôle total de votre usine de produits nettoyants',
    'login.demo_accounts': 'Comptes de démonstration',
    'login.tag_metrics': 'Matières premières',
    'login.tag_trace': 'Traçabilité',
    'login.tag_modules': 'Modules',
    'login.tag_roles': 'Rôles',

    // Sidebar
    'nav.dashboard': 'Tableau de bord',
    'nav.alerts': 'Alertes',
    'nav.search': 'Recherche',
    'nav.scanner': 'Scanner',
    'nav.raw_materials': 'Matières Premières',
    'nav.raw_material_lots': 'Lots de MP',
    'nav.packaging': 'Emballage',
    'nav.recipes': 'Recettes',
    'nav.production': 'Production',
    'nav.lots': 'Lots',
    'nav.lot_generator': 'Générer un lot',
    'nav.recalls': 'Rappels',
    'nav.products': 'Produits',
    'nav.customers': 'Clients',
    'nav.orders': 'Commandes',
    'nav.sales': 'Ventes',
    'nav.purchases': 'Achats',
    'nav.expenses': 'Dépenses',
    'nav.reports': 'Rapports',
    'nav.history': 'Historique',
    'nav.users': 'Utilisateurs',
    'nav.settings': 'Paramètres',
    'nav.section_general': 'Général',
    'nav.section_production': 'Production',
    'nav.section_commercial': 'Commercial',
    'nav.section_operations': 'Opérations',
    'nav.section_analysis': 'Analyse',
    'nav.demo_banner': 'MODE DÉMO · données dans ce navigateur',

    // Header
    'header.search_placeholder': 'Rechercher clients, produits, commandes, lots...',
    'header.notifications': 'Notifications',
    'header.mark_all_read': 'Tout marquer comme lu',
    'header.profile': 'Mon profil',
    'header.logout': 'Déconnexion',
    'header.lang': 'Langue',
    'header.currency': 'Devise',

    // Dashboard
    'dash.greeting_morning': 'Bonjour',
    'dash.greeting_afternoon': 'Bon après-midi',
    'dash.greeting_evening': 'Bonsoir',
    'dash.welcome': 'Voici l\'état actuel de votre usine en temps réel.',
    'dash.live': 'En direct',
    'dash.updated': 'Mis à jour',
    'dash.kpi.inventory_value': 'Valeur du stock',
    'dash.kpi.raw_materials': 'Matières premières',
    'dash.kpi.packaging': 'Emballages',
    'dash.kpi.products': 'Produits finis',
    'dash.kpi.low_stock': 'Stock bas',
    'dash.kpi.production_today': 'Production aujourd\'hui',
    'dash.kpi.production_week': 'Production hebdomadaire',
    'dash.kpi.production_month': 'Production mensuelle',
    'dash.kpi.sales_today': 'Ventes aujourd\'hui',
    'dash.kpi.sales_month': 'Ventes du mois',
    'dash.kpi.expenses_month': 'Dépenses du mois',
    'dash.kpi.benefit': 'Bénéfice',
    'dash.chart.sales_vs_expenses': 'Ventes vs Dépenses',
    'dash.chart.last_7': '7 derniers jours',
    'dash.chart.inventory_comp': 'Composition du stock',
    'dash.chart.top_products': 'Produits les plus vendus (mois)',
    'dash.chart.top_customers': 'Meilleurs clients',
    'dash.recent.orders': 'Dernières commandes',
    'dash.recent.purchases': 'Derniers achats',
    'dash.recent.lots': 'Production récente',
    'dash.recent.see_all': 'Voir tout',

    // Common
    'common.search': 'Rechercher...',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.create': 'Créer',
    'common.new': 'Nouveau',
    'common.export_csv': 'CSV',
    'common.view_all': 'Voir tout',
    'common.loading': 'Chargement...',
    'common.no_data': 'Aucune donnée',
    'common.confirm_delete': 'Confirmer la suppression',
    'common.confirm_delete_msg': 'Êtes-vous sûr de vouloir supprimer cet enregistrement ? Cette action sera consignée dans l\'historique.',
    'common.back': 'Retour',
    'common.close': 'Fermer',
    'common.actions': 'Actions',
    'common.status': 'Statut',
    'common.date': 'Date',
    'common.total': 'Total',
    'common.all': 'Tous',

    // Settings
    'settings.title': 'Paramètres',
    'settings.subtitle': 'Personnalisez le comportement du système',
    'settings.save': 'Enregistrer les modifications',
    'settings.saving': 'Enregistrement...',
    'settings.saved': 'Enregistré !',
    'settings.section_company': 'Données de l\'entreprise',
    'settings.section_defaults': 'Valeurs par défaut',
    'settings.section_security': 'Sécurité',
    'settings.section_lot': 'Format du numéro de lot',
    'settings.section_backup': 'Sauvegardes',
    'settings.lang_currency': 'Langue et devise',

    // Lot Generator
    'lotgen.title': 'Générateur de Numéros de Lot',
    'lotgen.subtitle': 'Création assistée : le système attribue automatiquement le numéro. Jamais saisi à la main.',
    'lotgen.create': 'Créer un nouveau lot',
    'lotgen.preview': 'Numéro de lot généré',
    'lotgen.preview_hint': 'Ce numéro est unique et irrépétable. Il est attribué à l\'enregistrement.',

    // Lots
    'lots.title': 'Lots de Fabrication',
    'lots.subtitle': 'Traçabilité complète : chaque lot enregistre opérateur, machine, date, MP utilisée avec leurs lots',
    'lots.kpi.total': 'Lots fabriqués',
    'lots.kpi.units': 'Unités totales',
    'lots.kpi.week': '7 derniers jours',
    'lots.kpi.blocked': 'MP bloquées/périmées',
  },
}

// Configuración de monedas
const currencyConfig: Record<Currency, { locale: string; symbol: string; decimals: number; position: 'before' | 'after' }> = {
  EUR: { locale: 'fr-FR', symbol: '€', decimals: 2, position: 'after' },
  XOF: { locale: 'fr-FR', symbol: 'FCFA', decimals: 0, position: 'after' },
}

function formatMoneyValue(value: number, currency: Currency, decimals?: number): string {
  const cfg = currencyConfig[currency]
  const d = decimals ?? cfg.decimals
  // Formatear el número con separadores según locale
  const formatted = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(value)
  // FCFA no tiene decimales, mostrar entero con separador
  if (currency === 'XOF') {
    // Intl.NumberFormat con fr-FR y 0 decimales da "1 234 567", lo dejamos así
    return `${formatted} ${cfg.symbol}`
  }
  return cfg.position === 'before' ? `${cfg.symbol}${formatted}` : `${formatted} ${cfg.symbol}`
}

function formatDateLocalized(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const locale = lang === 'fr' ? 'fr-FR' : 'es-ES'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function formatDateTimeLocalized(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const locale = lang === 'fr' ? 'fr-FR' : 'es-ES'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'es'
    return (localStorage.getItem('cleanerp-lang') as Lang) || 'es'
  })
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === 'undefined') return 'EUR'
    return (localStorage.getItem('cleanerp-currency') as Currency) || 'EUR'
  })

  useEffect(() => {
    localStorage.setItem('cleanerp-lang', lang)
    document.documentElement.lang = lang
  }, [lang])
  useEffect(() => {
    localStorage.setItem('cleanerp-currency', currency)
  }, [currency])

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let s = translations[lang]?.[key] || translations.es[key] || key
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, String(v)) })
    }
    return s
  }

  const value: I18nContextValue = {
    lang, currency,
    setLang: setLangState,
    setCurrency: setCurrencyState,
    t,
    formatMoney: (v, d) => formatMoneyValue(v, currency, d),
    formatDate: (d) => formatDateLocalized(d, lang),
    formatDateTime: (d) => formatDateTimeLocalized(d, lang),
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be inside I18nProvider')
  return ctx
}