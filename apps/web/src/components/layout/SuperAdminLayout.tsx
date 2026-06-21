import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, CreditCard, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const nav = [
  { to: '/super-admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/super-admin/merchants', label: 'Merchants', icon: Building2 },
  { to: '/super-admin/billing', label: 'Billing', icon: CreditCard },
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-gray-950 border-r border-gray-800">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <ShieldCheck className="w-8 h-8 text-primary-400" />
          <div>
            <p className="font-bold text-white">POS Platform</p>
            <p className="text-xs text-gray-400">Super Admin</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <Icon className="w-4 h-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">{user?.name?.[0] || user?.email?.[0] || 'S'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || user?.email}</p>
              <p className="text-xs text-gray-400">Super Admin</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 text-gray-900">
        <Outlet />
      </main>
    </div>
  );
}
