
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { I18nProvider } from './lib/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'

// Provider order matters:
//   ThemeProvider: standalone, no deps
//   AuthProvider:  needs ThemeProvider (reads theme? actually no, but order is fine)
//   DataProvider:  needs AuthProvider (uses useAuth to get the token)
function Safe({ name, children }: { name: string; children: React.ReactNode }) {
  return <ErrorBoundary label={name}>{children}</ErrorBoundary>
}

// Detectar el basename para GitHub Pages (subpath /cleansahel)
// Guardar el basepath para uso futuro
const __initialPath = window.location.pathname
if (__initialPath.startsWith('/cleansahel')) {
  sessionStorage.setItem('cleansahel-basepath', '/cleansahel')
}

const getBasename = () => {
  const path = window.location.pathname
  // Si la URL es /cleansahel/ o /cleansahel/login, el basename es /cleansahel
  if (path.startsWith('/cleansahel')) return '/cleansahel'
  return ''
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Safe name="root">
      <BrowserRouter basename={getBasename()}>
        <I18nProvider>
          <Safe name="theme">
            <ThemeProvider>
              <Safe name="auth">
                <AuthProvider>
                  <Safe name="data">
                    <DataProvider>
                      <Safe name="app">
                        <App />
                      </Safe>
                    </DataProvider>
                  </Safe>
                </AuthProvider>
              </Safe>
            </ThemeProvider>
          </Safe>
        </I18nProvider>
      </BrowserRouter>
    </Safe>
  </React.StrictMode>,
)