
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Layout } from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RawMaterials from './pages/RawMaterials'
import Packaging from './pages/Packaging'
import Recipes from './pages/Recipes'
import Production from './pages/Production'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Sales from './pages/Sales'
import Purchases from './pages/Purchases'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import UsersPage from './pages/Users'
import HistoryPage from './pages/History'
import SettingsPage from './pages/Settings'
import Alerts from './pages/Alerts'
import Lots from './pages/Lots'
import LotGenerator from './pages/LotGenerator'
import RawMaterialLots from './pages/RawMaterialLots'
import Recalls from './pages/Recalls'
import Traceability from './pages/Traceability'
import SearchPage from './pages/Search'
import Scanner from './pages/Scanner'
import DeliveryStats from './pages/DeliveryStats'

function ProtectedRoute({ children, allow }: { children: React.ReactNode; allow?: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-sm text-surface-500">Cargando...</div></div>
  // Si no hay user, mostrar Login inline (NO Navigate a /login porque da 404 en GitHub Pages)
  if (!user) return <Login />
  if (allow && !allow.includes(user.role)) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/raw-materials" element={<ProtectedRoute><RawMaterials /></ProtectedRoute>} />
      <Route path="/raw-material-lots" element={<ProtectedRoute><RawMaterialLots /></ProtectedRoute>} />
      <Route path="/packaging" element={<ProtectedRoute><Packaging /></ProtectedRoute>} />
      <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
      <Route path="/production" element={<ProtectedRoute allow={['admin','produccion']}><Production /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute allow={['admin']}><UsersPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
      <Route path="/lots" element={<ProtectedRoute><Lots /></ProtectedRoute>} />
      <Route path="/lot-generator" element={<ProtectedRoute><LotGenerator /></ProtectedRoute>} />
      <Route path="/recalls" element={<ProtectedRoute><Recalls /></ProtectedRoute>} />
      <Route path="/trace/:id" element={<ProtectedRoute><Traceability /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/scanner" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
      <Route path="/delivery-stats" element={<ProtectedRoute><DeliveryStats /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}