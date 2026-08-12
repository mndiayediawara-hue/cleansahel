
import { useState, useRef } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/ui/Common'
import { StatCard } from '@/components/ui/StatCard'
import { Settings as SettingsIcon, Save, Building2, DollarSign, Shield, Database, Upload, Download, RefreshCw, Hash, Sparkles } from 'lucide-react'

export default function Settings() {
  const { config, refresh } = useData()
  const { can } = useAuth()
  const [form, setForm] = useState<any>(config)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function save() {
    setSaving(true)
    try {
      await api.put('/config', form)
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function downloadBackup() {
    const backup = await api.get<any>('/backup')
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cleansahel-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function uploadBackup(file: File) {
    if (!confirm('¿Restaurar este backup? Se sobrescribirán TODOS los datos actuales.')) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await api.post('/restore', data)
      alert('Backup restaurado. La página se recargará.')
      window.location.reload()
    } catch (e: any) { alert('Error: ' + e.message) }
  }

  async function resetDB() {
    if (!confirm('¿Borrar TODOS los datos y volver al estado inicial? Esta acción es irreversible.')) return
    try {
      await api.post('/reset')
      localStorage.removeItem('cleanerp-token')
      localStorage.removeItem('cleanerp-user')
      window.location.reload()
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Configuración" subtitle="Personaliza el comportamiento del sistema"
        actions={can('admin') && <button onClick={save} disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar cambios'}</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-brand-600" />
            <h3 className="font-semibold">Datos de la empresa</h3>
          </div>
          <div className="space-y-3">
            <div><label className="label">Nombre</label><input className="input" value={form.company?.name || ''} onChange={e => setForm({ ...form, company: { ...form.company, name: e.target.value } })} disabled={!can('admin')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">CIF</label><input className="input" value={form.company?.cif || ''} onChange={e => setForm({ ...form, company: { ...form.company, cif: e.target.value } })} disabled={!can('admin')} /></div>
              <div><label className="label">Teléfono</label><input className="input" value={form.company?.phone || ''} onChange={e => setForm({ ...form, company: { ...form.company, phone: e.target.value } })} disabled={!can('admin')} /></div>
            </div>
            <div><label className="label">Email</label><input className="input" value={form.company?.email || ''} onChange={e => setForm({ ...form, company: { ...form.company, email: e.target.value } })} disabled={!can('admin')} /></div>
            <div><label className="label">Dirección</label><input className="input" value={form.company?.address || ''} onChange={e => setForm({ ...form, company: { ...form.company, address: e.target.value } })} disabled={!can('admin')} /></div>
          </div>
        </div>

        {can('admin') && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold">Formato de número de lote</h3>
            </div>
            <p className="text-xs text-surface-500 mb-3">Configura cómo se generan automáticamente los números de lote. Usa tokens: <code className="px-1 bg-surface-100 dark:bg-surface-800 rounded font-mono">{'{PREFIX}'}</code> <code className="px-1 bg-surface-100 dark:bg-surface-800 rounded font-mono">{'{YYYY}'}</code> <code className="px-1 bg-surface-100 dark:bg-surface-800 rounded font-mono">{'{YY}'}</code> <code className="px-1 bg-surface-100 dark:bg-surface-800 rounded font-mono">{'{MM}'}</code> <code className="px-1 bg-surface-100 dark:bg-surface-800 rounded font-mono">{'{DD}'}</code> <code className="px-1 bg-surface-100 dark:bg-surface-800 rounded font-mono">{'{####}'}</code> (contador).</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Prefijo</label><input className="input font-mono" value={form.lotFormat?.prefix || ''} onChange={e => setForm({ ...form, lotFormat: { ...form.lotFormat, prefix: e.target.value } })} /></div>
                <div><label className="label">Padding del contador</label>
                  <select className="input" value={form.lotFormat?.counterPadding || 4} onChange={e => setForm({ ...form, lotFormat: { ...form.lotFormat, counterPadding: Number(e.target.value) } })}>
                    <option value="3">3 dígitos (001-999)</option>
                    <option value="4">4 dígitos (0001-9999)</option>
                    <option value="5">5 dígitos (00001-99999)</option>
                    <option value="6">6 dígitos (000001-999999)</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Plantilla del lote</label>
                <select className="input font-mono" value={form.lotFormat?.template || ''} onChange={e => setForm({ ...form, lotFormat: { ...form.lotFormat, template: e.target.value } })}>
                  <option value="{PREFIX}-{YYYY}{MM}{DD}-{####}">{'{PREFIX}-{YYYY}{MM}{DD}-{####}'} → SAH-20260805-0001</option>
                  <option value="{PREFIX}-{DD}{MM}{YY}-{####}">{'{PREFIX}-{DD}{MM}{YY}-{####}'} → SAH-050826-0001</option>
                  <option value="{PREFIX}-{YYYY}-{####}">{'{PREFIX}-{YYYY}-{####}'} → SAH-2026-0001</option>
                  <option value="{PREFIX}{YY}{MM}{DD}{####}">{'{PREFIX}{YY}{MM}{DD}{####}'} → SAH2608050001</option>
                  <option value="{YYYY}{MM}{DD}-{PREFIX}-{####}">{'{YYYY}{MM}{DD}-{PREFIX}-{####}'} → 20260805-SAH-0001</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.lotFormat?.resetCounterYearly || false} onChange={e => setForm({ ...form, lotFormat: { ...form.lotFormat, resetCounterYearly: e.target.checked } })} id="resetYearly" />
                <label htmlFor="resetYearly" className="text-sm">Reiniciar contador cada año (requiere {'{YYYY}'} en la plantilla)</label>
              </div>
              <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-950/30 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span>Vista previa: <code className="font-mono font-bold">{(form.lotFormat?.template || '{PREFIX}-{YYYY}{MM}{DD}-{####}').replace(/\{PREFIX\}/g, form.lotFormat?.prefix || 'SAH').replace(/\{YYYY\}/g, '2026').replace(/\{YY\}/g, '26').replace(/\{MM\}/g, '08').replace(/\{DD\}/g, '05').replace(/\{#+\}/g, String(1).padStart(form.lotFormat?.counterPadding || 4, '0'))}</code></span>
              </div>
            </div>
          </div>
        )}

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold">Valores por defecto</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">IVA por defecto (%)</label><input type="number" className="input" value={form.defaults?.tax || 0} onChange={e => setForm({ ...form, defaults: { ...form.defaults, tax: Number(e.target.value) } })} disabled={!can('admin')} /></div>
              <div><label className="label">Moneda</label>
                <select className="input" value={form.defaults?.currency || 'EUR'} onChange={e => setForm({ ...form, defaults: { ...form.defaults, currency: e.target.value } })} disabled={!can('admin')}>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div><label className="label">Botellas por caja</label><input type="number" className="input" value={form.defaults?.bottlesPerBox || 0} onChange={e => setForm({ ...form, defaults: { ...form.defaults, bottlesPerBox: Number(e.target.value) } })} disabled={!can('admin')} /></div>
              <div><label className="label">Cajas por palet</label><input type="number" className="input" value={form.defaults?.boxesPerPallet || 0} onChange={e => setForm({ ...form, defaults: { ...form.defaults, boxesPerPallet: Number(e.target.value) } })} disabled={!can('admin')} /></div>
              <div><label className="label">Stock mínimo por defecto</label><input type="number" className="input" value={form.defaults?.minStockDefault || 0} onChange={e => setForm({ ...form, defaults: { ...form.defaults, minStockDefault: Number(e.target.value) } })} disabled={!can('admin')} /></div>
              <div><label className="label">Stock máximo por defecto</label><input type="number" className="input" value={form.defaults?.maxStockDefault || 0} onChange={e => setForm({ ...form, defaults: { ...form.defaults, maxStockDefault: Number(e.target.value) } })} disabled={!can('admin')} /></div>
              <div><label className="label">Idioma</label>
                <select className="input" value={form.defaults?.language || 'es'} onChange={e => setForm({ ...form, defaults: { ...form.defaults, language: e.target.value } })} disabled={!can('admin')}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="pt">Português</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold">Seguridad</h3>
          </div>
          <div className="space-y-3">
            <div><label className="label">Tiempo de sesión (minutos)</label><input type="number" className="input" value={form.security?.sessionTimeoutMin || 30} onChange={e => setForm({ ...form, security: { ...form.security, sessionTimeoutMin: Number(e.target.value) } })} disabled={!can('admin')} /></div>
            <div><label className="label">Máx. intentos fallidos</label><input type="number" className="input" value={form.security?.maxFailedAttempts || 5} onChange={e => setForm({ ...form, security: { ...form.security, maxFailedAttempts: Number(e.target.value) } })} disabled={!can('admin')} /></div>
            <div><label className="label">Backup automático (horas)</label><input type="number" className="input" value={form.security?.autoBackupHours || 24} onChange={e => setForm({ ...form, security: { ...form.security, autoBackupHours: Number(e.target.value) } })} disabled={!can('admin')} /></div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300">
              ✓ Contraseñas cifradas con bcrypt · ✓ API protegida con JWT · ✓ Bloqueo automático tras intentos fallidos
            </div>
          </div>
        </div>

        {can('admin') && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-violet-600" />
              <h3 className="font-semibold">Copias de seguridad</h3>
            </div>
            <p className="text-sm text-surface-500 mb-3">Descarga o restaura una copia completa de la base de datos (formato JSON).</p>
            <div className="space-y-2">
              <button onClick={downloadBackup} className="btn-secondary w-full justify-start"><Download className="w-4 h-4" /> Descargar backup completo</button>
              <button onClick={() => fileRef.current?.click()} className="btn-secondary w-full justify-start"><Upload className="w-4 h-4" /> Restaurar desde archivo</button>
              <input type="file" ref={fileRef} accept=".json" onChange={e => e.target.files?.[0] && uploadBackup(e.target.files[0])} className="hidden" />
              <button onClick={resetDB} className="btn-secondary w-full justify-start text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><RefreshCw className="w-4 h-4" /> Reiniciar base de datos</button>
            </div>
            <div className="mt-3 p-2 rounded bg-surface-50 dark:bg-surface-800/50 text-xs">
              <p className="font-semibold mb-1">Estado del sistema</p>
              <p>Versión: 1.0.0</p>
              <p>Base de datos: SQLite</p>
              <p>API: REST + JWT</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}