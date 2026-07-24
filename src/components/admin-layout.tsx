import { memo, useCallback, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ClipboardList, LayoutDashboard, LogOut, Menu, Pill,
  Search, ShieldCheck, Star, Users, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { adminService } from '../services/admin-service'
import { useAuthStore } from '../store/auth-store'

const navigation = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Pharmacies', path: '/pharmacies', icon: ShieldCheck },
  { label: 'Orders', path: '/orders', icon: ClipboardList },
  { label: 'Users', path: '/users', icon: Users },
  { label: 'Medicines', path: '/medicines', icon: Pill },
  { label: 'Reviews', path: '/reviews', icon: Star },
]

const NavItem = memo(function NavItem({ item, onClick }: {
  item: (typeof navigation)[number]
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onClick}
      className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
    >
      <Icon size={19} />
      <span>{item.label}</span>
    </NavLink>
  )
})

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const admin = useAuthStore((state) => state.admin)
  const clearSession = useAuthStore((state) => state.clearSession)
  const closeMenu = useCallback(() => setMobileOpen(false), [])

  const logout = useCallback(async () => {
    try {
      await adminService.logout()
    } catch {
      toast.warning('Your local session was cleared.')
    } finally {
      clearSession()
      navigate('/login', { replace: true })
    }
  }, [clearSession, navigate])

  return (
    <div className="admin-shell">
      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
        <div className="brand">
          <span className="brand__mark"><Pill size={21} /></span>
          <div><strong>Pharma<span>Flow</span></strong><small>SUPER ADMIN</small></div>
          <button className="icon-button sidebar__close" onClick={closeMenu}><X /></button>
        </div>
        <nav className="sidebar__nav">
          <span className="nav-label">WORKSPACE</span>
          {navigation.map((item) => <NavItem item={item} key={item.path} onClick={closeMenu} />)}
        </nav>
        <button className="logout-button" onClick={logout}><LogOut size={18} /> Sign out</button>
      </aside>

      {mobileOpen && <button className="sidebar-overlay" onClick={closeMenu} aria-label="Close menu" />}
      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}><Menu /></button>
          <label className="global-search"><Search size={18} /><input placeholder="Search pharmacies, orders, users..." readOnly onFocus={() => toast.info('Use each module’s search for now.')} /></label>
          <div className="topbar__actions">
            <div className="admin-profile">
              <span>{admin?.name?.slice(0, 2).toUpperCase() ?? 'AD'}</span>
              <div><strong>{admin?.name ?? 'Administrator'}</strong><small>Admin</small></div>
            </div>
          </div>
        </header>
        <div className="content"><Outlet /></div>
      </main>
    </div>
  )
}
