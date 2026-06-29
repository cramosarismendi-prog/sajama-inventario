import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { MainLayout } from './components/layout/MainLayout'
import { PageLoader } from './components/ui/Spinner'
import Login         from './pages/Login'
import Inventario    from './pages/Inventario'
import Ingresos      from './pages/Ingresos'
import Salidas       from './pages/Salidas'
import Consultas     from './pages/Consultas'
import OrdenSalida   from './pages/OrdenSalida'
import OrdenEntrada  from './pages/OrdenEntrada'
import Lista         from './pages/Lista'
import Reportes      from './pages/Reportes'
import Usuarios      from './pages/Usuarios'
import Auditoria     from './pages/Auditoria'
import ImportarExcel from './pages/ImportarExcel'
import ScannerQR    from './pages/ScannerQR'
import Compras      from './pages/Compras'

function ProtectedRoute({ children, modulo }) {
  const { user, loading, tienePermiso } = useAuth()
  if (loading) return <PageLoader />
  if (!user)   return <Navigate to="/login" replace />
  if (modulo && !tienePermiso(modulo)) return (
    <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2 p-8">
      <p className="text-4xl">🔒</p>
      <p className="font-semibold text-lg">Acceso restringido</p>
      <p className="text-sm text-center">No tienes permisos para acceder a este módulo.</p>
    </div>
  )
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/inventario" replace />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/inventario" replace />} />
        <Route path="inventario"      element={<ProtectedRoute modulo="inventario">    <Inventario    /></ProtectedRoute>} />
        <Route path="ingresos"        element={<ProtectedRoute modulo="ingresos">      <Ingresos      /></ProtectedRoute>} />
        <Route path="salidas"         element={<ProtectedRoute modulo="salidas">       <Salidas       /></ProtectedRoute>} />
        <Route path="consultas"       element={<ProtectedRoute modulo="consultas">     <Consultas     /></ProtectedRoute>} />
        <Route path="orden-salida"    element={<ProtectedRoute modulo="ordenSalida">   <OrdenSalida   /></ProtectedRoute>} />
        <Route path="orden-entrada"   element={<ProtectedRoute modulo="ordenEntrada">  <OrdenEntrada  /></ProtectedRoute>} />
        <Route path="lista"           element={<ProtectedRoute modulo="lista">         <Lista         /></ProtectedRoute>} />
        <Route path="reportes"        element={<ProtectedRoute modulo="reportes">      <Reportes      /></ProtectedRoute>} />
        <Route path="usuarios"        element={<ProtectedRoute modulo="usuarios">      <Usuarios      /></ProtectedRoute>} />
        <Route path="auditoria"       element={<ProtectedRoute modulo="usuarios">      <Auditoria     /></ProtectedRoute>} />
        <Route path="importar"        element={<ProtectedRoute modulo="ingresos">      <ImportarExcel /></ProtectedRoute>} />
        <Route path="scanner"         element={<ProtectedRoute modulo="ingresos">      <ScannerQR     /></ProtectedRoute>} />
        <Route path="compras"         element={<ProtectedRoute modulo="ingresos">      <Compras       /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/inventario" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        style: { fontSize: '14px', borderRadius: '10px', padding: '12px 16px' },
        success: { style: { background: '#D6EFE0', color: '#1D7044', border: '1px solid #1D7044' } },
        error:   { style: { background: '#FADBD8', color: '#C0392B', border: '1px solid #C0392B' } },
      }} />
      <AppRoutes />
    </AuthProvider>
  )
}
