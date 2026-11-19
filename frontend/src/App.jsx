import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { MainLayout } from './components/layout/MainLayout'
import { PageLoader } from './components/ui/Spinner'

const Login         = lazy(() => import('./pages/Login'))
const Inventario    = lazy(() => import('./pages/Inventario'))
const Ingresos      = lazy(() => import('./pages/Ingresos'))
const Salidas       = lazy(() => import('./pages/Salidas'))
const Consultas     = lazy(() => import('./pages/Consultas'))
const OrdenSalida   = lazy(() => import('./pages/OrdenSalida'))
const OrdenEntrada  = lazy(() => import('./pages/OrdenEntrada'))
const Aduana        = lazy(() => import('./pages/Aduana'))
const Lista         = lazy(() => import('./pages/Lista'))
const Reportes      = lazy(() => import('./pages/Reportes'))
const Usuarios      = lazy(() => import('./pages/Usuarios'))
const Auditoria     = lazy(() => import('./pages/Auditoria'))
const ImportarExcel = lazy(() => import('./pages/ImportarExcel'))
const ScannerQR    = lazy(() => import('./pages/ScannerQR'))
const Compras      = lazy(() => import('./pages/Compras'))
const Maquinaria   = lazy(() => import('./pages/Maquinaria'))
const Equipos      = lazy(() => import('./pages/Equipos'))
const KardexContable = lazy(() => import('./pages/KardexContable'))
const Abastecimiento = lazy(() => import('./pages/Abastecimiento'))

import { MfaChallengeModal } from './components/ui/MfaChallengeModal'
import { MfaEnrollmentModal } from './components/ui/MfaEnrollmentModal'

function ProtectedRoute({ children, modulo }) {
  const { user, loading, tienePermiso, mfaPendiente, mfaObligatorio, recargarPerfil } = useAuth()
  if (loading) return <PageLoader />
  if (!user)   return <Navigate to="/login" replace />
  if (mfaObligatorio) return <MfaEnrollmentModal open={true} esObligatorio={true} onClose={() => recargarPerfil()} />
  if (mfaPendiente) return <MfaChallengeModal open={true} />
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
  const { user, loading, mfaPendiente, mfaObligatorio, recargarPerfil } = useAuth()
  if (loading) return <PageLoader />
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : mfaObligatorio ? <MfaEnrollmentModal open={true} esObligatorio={true} onClose={() => recargarPerfil()} /> : mfaPendiente ? <MfaChallengeModal open={true} /> : <Navigate to="/inventario" replace />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/inventario" replace />} />
          <Route path="inventario"      element={<ProtectedRoute modulo="inventario">    <Inventario    /></ProtectedRoute>} />
          <Route path="kardex-contable" element={<ProtectedRoute modulo="kardex">        <KardexContable /></ProtectedRoute>} />
          <Route path="ingresos"        element={<ProtectedRoute modulo="ingresos">      <Ingresos      /></ProtectedRoute>} />
          <Route path="salidas"         element={<ProtectedRoute modulo="salidas">       <Salidas       /></ProtectedRoute>} />
          <Route path="consultas"       element={<ProtectedRoute modulo="consultas">     <Consultas     /></ProtectedRoute>} />
          <Route path="orden-salida"    element={<ProtectedRoute modulo="ordenSalida">   <OrdenSalida   /></ProtectedRoute>} />
          <Route path="orden-entrada"   element={<ProtectedRoute modulo="ordenEntrada">  <OrdenEntrada  /></ProtectedRoute>} />
          <Route path="maquinaria"      element={<ProtectedRoute modulo="maquinaria">    <Maquinaria    /></ProtectedRoute>} />
          <Route path="equipos"         element={<ProtectedRoute modulo="equipos">       <Equipos       /></ProtectedRoute>} />
          <Route path="abastecimiento"  element={<ProtectedRoute modulo="abastecimiento"><Abastecimiento /></ProtectedRoute>} />
          <Route path="aduana"          element={<ProtectedRoute modulo="aduana">        <Aduana        /></ProtectedRoute>} />
          <Route path="lista"           element={<ProtectedRoute modulo="lista">         <Lista         /></ProtectedRoute>} />
          <Route path="reportes"        element={<ProtectedRoute modulo="reportes">      <Reportes      /></ProtectedRoute>} />
          <Route path="usuarios"        element={<ProtectedRoute modulo="usuarios">      <Usuarios      /></ProtectedRoute>} />
          <Route path="auditoria"       element={<ProtectedRoute modulo="usuarios">      <Auditoria     /></ProtectedRoute>} />
          <Route path="importar"        element={<ProtectedRoute modulo="importar">      <ImportarExcel /></ProtectedRoute>} />
          <Route path="scanner"         element={<ProtectedRoute modulo="importar">      <ScannerQR     /></ProtectedRoute>} />
          <Route path="compras"         element={<ProtectedRoute modulo="compras">       <Compras       /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/inventario" replace />} />
      </Routes>
    </Suspense>
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