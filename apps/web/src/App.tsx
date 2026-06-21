import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

// Auth
import LoginPage from '@/pages/LoginPage';
import StaffLoginPage from '@/pages/StaffLoginPage';

// Super Admin
import SuperAdminLayout from '@/components/layout/SuperAdminLayout';
import SuperAdminDashboard from '@/pages/superadmin/Dashboard';
import MerchantsPage from '@/pages/superadmin/Merchants';
import MerchantDetailPage from '@/pages/superadmin/MerchantDetail';
import BillingPage from '@/pages/superadmin/Billing';

// Admin
import AdminLayout from '@/components/layout/AdminLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import ProductsPage from '@/pages/admin/Products';
import OrdersPage from '@/pages/admin/Orders';
import CustomersPage from '@/pages/admin/Customers';
import StaffPage from '@/pages/admin/Staff';
import RolesPage from '@/pages/admin/Roles';
import InventoryPage from '@/pages/admin/Inventory';
import ReportsPage from '@/pages/admin/Reports';
import PayrollPage from '@/pages/admin/Payroll';
import AppointmentsPage from '@/pages/admin/Appointments';
import TablesPage from '@/pages/admin/Tables';
import StoreSettingsPage from '@/pages/admin/StoreSettings';
import GiftCardsPage from '@/pages/admin/GiftCards';

// POS
import PosLayout from '@/components/layout/PosLayout';
import RegisterPage from '@/pages/pos/Register';
import KitchenDisplayPage from '@/pages/pos/KitchenDisplay';
import CustomerDisplayPage from '@/pages/pos/CustomerDisplay';
import TableMapPage from '@/pages/pos/TableMap';
import HeldOrdersPage from '@/pages/pos/HeldOrders';

function RequireAuth({ children, role }: { children: React.ReactNode; role?: 'super_admin' | 'staff' }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.type !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.type === 'super_admin') return <Navigate to="/super-admin" replace />;
  return <Navigate to="/pos" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/staff-login" element={<StaffLoginPage />} />

        {/* Super Admin */}
        <Route path="/super-admin" element={<RequireAuth role="super_admin"><SuperAdminLayout /></RequireAuth>}>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="merchants" element={<MerchantsPage />} />
          <Route path="merchants/:id" element={<MerchantDetailPage />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<RequireAuth role="staff"><AdminLayout /></RequireAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="gift-cards" element={<GiftCardsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="settings" element={<StoreSettingsPage />} />
        </Route>

        {/* POS */}
        <Route path="/pos" element={<RequireAuth role="staff"><PosLayout /></RequireAuth>}>
          <Route index element={<RegisterPage />} />
          <Route path="table-map" element={<TableMapPage />} />
          <Route path="held-orders" element={<HeldOrdersPage />} />
        </Route>
        <Route path="/kds" element={<RequireAuth role="staff"><KitchenDisplayPage /></RequireAuth>} />
        <Route path="/customer-display" element={<CustomerDisplayPage />} />
      </Routes>
    </BrowserRouter>
  );
}
