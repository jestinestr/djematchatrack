import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/admin/hc', icon: '✈️', label: 'Hand Carry' },
  { to: '/admin/wh', icon: '🏭', label: 'Warehouse' },
  { to: '/admin/requests', icon: '📬', label: 'Setor Resi', badge: true },
  { to: '/admin/archive', icon: '📁', label: 'Arsip' },
  { to: '/admin/codes', icon: '🔑', label: 'Kode Akses' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    function fetchCount() {
      fetch('/api/requests/count')
        .then(r => r.json())
        .then(d => setPendingCount(d.count || 0))
        .catch(() => {});
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  function logout() {
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  return (
    <div className="flex h-screen bg-cream-100 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-56 flex flex-col
        transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}
      style={{ background: 'linear-gradient(180deg, #2A4A40 0%, #1E3D35 100%)' }}>
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
              <img src="/ava.png" alt="Djematcha" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Djematcha</p>
              <p className="text-matcha-300 text-xs opacity-70">Admin Panel</p>
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
                    ? 'bg-white/15 text-white border border-white/10'
                    : 'text-white/60 hover:bg-white/8 hover:text-white/90'
                }`
              }
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white/80 transition-all"
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
          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
            <img src="/ava.png" alt="Djematcha" className="w-full h-full object-cover" />
          </div>
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
