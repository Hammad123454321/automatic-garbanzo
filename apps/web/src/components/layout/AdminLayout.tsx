import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, ClipboardList, Users, Package, BarChart3, UserCog, Wallet, Calendar, Map, Settings, LogOut, Gift, ChevronLeft, Menu, Utensils } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const allNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/products', label: 'Products / Menu', icon: ShoppingBag, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/tables', label: 'Tables', icon: Utensils, modes: ['RESTAURANT'] },
  { to: '/admin/appointments', label: 'Appointments', icon: Calendar, modes: ['BEAUTY'] },
  { to: '/admin/customers', label: 'Customers', icon: Users, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/gift-cards', label: 'Gift Cards', icon: Gift, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/inventory', label: 'Inventory', icon: Package, modes: ['RETAIL', 'RESTAURANT'] },
  { to: '/admin/staff', label: 'Staff', icon: UserCog, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/roles', label: 'Roles & Perms', icon: UserCog, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/payroll', label: 'Payroll', icon: Wallet, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
  { to: '/admin/settings', label: 'Settings', icon: Settings, modes: ['RETAIL', 'RESTAURANT', 'BEAUTY'] },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const mode = user?.businessMode || 'RETAIL';
  const navItems = allNav.filter((n) => n.modes.includes(mode));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-gray-900 text-white transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
          {!collapsed && (
            <div>
              <p className="font-bold text-white text-sm">POS Platform</p>
              <p className="text-xs text-gray-400">{mode.charAt(0) + mode.slice(1).toLowerCase()}</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white">
            {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`} title={collapsed ? label : undefined}>
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-gray-700 space-y-1">
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{user?.firstName?.[0] || 'S'}</div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.roles?.[0] || 'Staff'}</p>
              </div>
            </div>
          )}
          <button onClick={() => navigate('/pos')} className="flex items-center gap-3 w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
            <Map className="w-4 h-4 shrink-0" />{!collapsed && 'Switch to POS'}
          </button>
          <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-3 w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
            <LogOut className="w-4 h-4 shrink-0" />{!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
