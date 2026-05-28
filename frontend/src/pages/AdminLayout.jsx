import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { to: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/admin/hc', icon: '✈️', label: 'Hand Carry' },
  { to: '/admin/wh', icon: '🏭', label: 'Warehouse' },
  { to: '/admin/archive', icon: '📁', label: 'Arsip' },
  { to: '/admin/codes', icon: '🔑', label: 'Kode Akses' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function logout() {
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  return (
    <div className="flex h-screen bg-cream-100 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-56 bg-matcha-800 flex flex-col shadow-xl
        transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        {/* Brand */}
        <div className="px-5 py-5 border-b border-matcha-700/60">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">🍵</span>
            <div>
              <p className="text-white font-bold text-base leading-tight">Djematcha</p>
              <p className="text-matcha-300 text-xs">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-matcha-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-matcha-700/60">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-matcha-300 hover:bg-white/10 hover:text-white transition-all"
          >
            <span className="text-base w-5 text-center">🚪</span>
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Main area ───────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden bg-matcha-800 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-md">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-white text-xl p-0.5 leading-none"
          >
            ☰
          </button>
          <span className="text-xl">🍵</span>
          <span className="font-bold text-sm">Djematcha Admin</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
