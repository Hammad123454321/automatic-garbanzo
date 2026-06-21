import { useQuery } from '@tanstack/react-query';
import { Building2, Store, Monitor, Users, ShoppingCart, TrendingUp } from 'lucide-react';
import api from '@/lib/api';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { data } = useQuery({ queryKey: ['sa-stats'], queryFn: () => api.get('/super-admin/stats').then((r) => r.data.data) });
  const { data: merchants } = useQuery({ queryKey: ['sa-merchants'], queryFn: () => api.get('/super-admin/merchants?limit=5').then((r) => r.data) });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Platform Overview</h1>
      <p className="text-gray-500 mb-8">Real-time health across all merchants</p>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <StatCard label="Active Merchants" value={data?.merchants ?? '—'} icon={Building2} color="bg-primary-600" />
        <StatCard label="Active Stores" value={data?.stores ?? '—'} icon={Store} color="bg-success-600" />
        <StatCard label="Devices Online" value={data?.devices ?? '—'} icon={Monitor} color="bg-purple-600" />
        <StatCard label="Active Staff" value={data?.staff ?? '—'} icon={Users} color="bg-orange-500" />
        <StatCard label="Orders Today" value={data?.ordersToday ?? '—'} icon={ShoppingCart} color="bg-pink-600" />
      </div>

      {/* Recent merchants */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Recent Merchants</h2>
          <a href="/super-admin/merchants" className="text-sm text-primary-600 hover:underline">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Merchant</th><th>Email</th><th>Plan</th><th>Stores</th><th>Staff</th><th>Status</th></tr>
            </thead>
            <tbody>
              {merchants?.data?.map((m: { id: string; name: string; email: string; billingPlan: string; isActive: boolean; _count: { stores: number; staff: number } }) => (
                <tr key={m.id}>
                  <td className="font-medium"><a href={`/super-admin/merchants/${m.id}`} className="text-primary-600 hover:underline">{m.name}</a></td>
                  <td className="text-gray-500">{m.email}</td>
                  <td><span className="badge-blue">{m.billingPlan}</span></td>
                  <td>{m._count.stores}</td>
                  <td>{m._count.staff}</td>
                  <td><span className={m.isActive ? 'badge-green' : 'badge-red'}>{m.isActive ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
