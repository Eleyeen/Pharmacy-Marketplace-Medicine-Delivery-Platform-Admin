import { useEffect } from 'react'
import { MapPinned } from 'lucide-react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminLayout } from './components/admin-layout'
import { Card, PageSkeleton } from './components/ui'
import { LoginPage } from './features/auth/login-page'
import { DashboardPage } from './features/dashboard/dashboard-page'
import { ResourcePage } from './features/resources/resource-page'
import { adminService } from './services/admin-service'
import { useAuthStore } from './store/auth-store'

function ProtectedLayout() {
  const admin = useAuthStore((state) => state.admin)
  const hydrated = useAuthStore((state) => state.hydrated)
  const location = useLocation()

  if (!hydrated) return <div className="boot-screen"><PageSkeleton rows={4} /></div>
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <AdminLayout />
}

function UnavailablePage({ title }: { title: string }) {
  return (
    <div className="page">
      <header className="page-header"><div><span className="page-kicker">PLANNED MODULE</span><h1>{title}</h1><p>This module is intentionally unavailable until its live service is connected.</p></div></header>
      <Card><div className="page-state"><span className="page-state__icon"><MapPinned /></span><h3>Integration required</h3><p>No simulated data is shown. Configure the corresponding backend and provider credentials to enable this workspace.</p></div></Card>
    </div>
  )
}

export default function App() {
  const setSession = useAuthStore((state) => state.setSession)
  const setHydrated = useAuthStore((state) => state.setHydrated)

  useEffect(() => {
    let active = true
    adminService.restoreSession()
      .then((session) => active && setSession(session.accessToken, session.admin))
      .catch(() => active && setHydrated(true))
    return () => { active = false }
  }, [setHydrated, setSession])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<ResourcePage type="users" />} />
        <Route path="pharmacies" element={<ResourcePage type="pharmacies" />} />
        <Route path="orders" element={<ResourcePage type="orders" />} />
        <Route path="medicines" element={<ResourcePage type="medicines" />} />
        <Route path="payments" element={<ResourcePage type="payments" />} />
        <Route path="reviews" element={<ResourcePage type="reviews" />} />
        <Route path="map" element={<UnavailablePage title="Live operations map" />} />
        <Route path="notifications" element={<UnavailablePage title="Notification center" />} />
        <Route path="settings" element={<UnavailablePage title="System settings" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
