import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminLayout } from './components/admin-layout'
import { PageSkeleton } from './components/ui'
import { LoginPage } from './features/auth/login-page'
import { DashboardPage } from './features/dashboard/dashboard-page'
import { MedicinesPage } from './features/medicines/medicines-page'
import { OrderDetailPage } from './features/orders/order-detail-page'
import { OrdersPage } from './features/orders/orders-page'
import { PharmaciesPage } from './features/pharmacies/pharmacies-page'
import { PharmacyDetailPage } from './features/pharmacies/pharmacy-detail-page'
import { PharmacyFormPage } from './features/pharmacies/pharmacy-form-page'
import { PharmacyVerifyPage } from './features/pharmacies/pharmacy-verify-page'
import { ReviewsPage } from './features/reviews/reviews-page'
import { UserDetailPage } from './features/users/user-detail-page'
import { UsersPage } from './features/users/users-page'
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
        <Route path="pharmacies" element={<PharmaciesPage />} />
        <Route path="pharmacies/new" element={<PharmacyFormPage />} />
        <Route path="pharmacies/:pharmacyId" element={<PharmacyDetailPage />} />
        <Route path="pharmacies/:pharmacyId/edit" element={<PharmacyFormPage />} />
        <Route path="pharmacies/:pharmacyId/verify" element={<PharmacyVerifyPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:userId" element={<UserDetailPage />} />
        <Route path="medicines" element={<MedicinesPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
