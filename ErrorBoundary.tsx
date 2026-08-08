import { Component, ReactNode } from 'react'

interface Props { children: ReactNode; label?: string; fallback?: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: any) {
    console.error(`[CleanERP${this.props.label ? ':' + this.props.label : ''}] crash:`, error, info)
  }
  render() {
    if (this.state.error) {
      const e: any = this.state.error
      const fullText = [
        e.name && `Name: ${e.name}`,
        e.message && `Message: ${e.message}`,
        e.code != null && `Code: ${e.code}`,
        `Stack: ${e.stack || '(no stack)'}`,
        `ComponentStack: ${(e as any).componentStack || '(none)'}`,
      ].filter(Boolean).join('\n\n')

      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: 720, width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h1 style={{ color: '#dc2626', fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>
              Algo se rompió{this.props.label ? ` en ${this.props.label}` : ' al cargar la app'}
            </h1>
            <p style={{ color: '#475569', fontSize: 13, margin: '0 0 12px' }}>Detalle técnico:</p>
            <pre style={{ background: '#0f172a', color: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 360, margin: '0 0 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
{fullText}
            </pre>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { try { localStorage.clear() } catch {} window.location.reload() }}
                style={{ background: '#1b7df5', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Limpiar caché y recargar
              </button>
              <button
                onClick={() => { this.setState({ error: null }) }}
                style={{ background: '#e2e8f0', color: '#0f172a', border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
