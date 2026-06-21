import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { ShoppingCart, DollarSign, Users, TrendingUp, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import api from '@/lib/api';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const storeId = user?.storeId;

  const { data: sales } = useQuery({
    queryKey: ['sales-today', storeId],
    queryFn: () => api.get(`/reports/sales?storeId=${storeId}&period=today`).then((r) => r.data.data),
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  const { data: monthSales } = useQuery({
    queryKey: ['sales-month', storeId],
    queryFn: () => api.get(`/reports/sales?storeId=${storeId}&period=month`).then((r) => r.data.data),
    enabled: !!storeId,
  });

  const revenue = parseFloat(sales?.summary?._sum?.totalAmount || '0');
  const orders = sales?.summary?._count?.id || 0;
  const chartData = (sales?.ordersByTime || []).map((d: { period: string; count: number; revenue: number }) => ({
    time: format(new Date(d.period), 'ha'),
    orders: Number(d.count),
    revenue: parseFloat(String(d.revenue)),
  }));

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Today's Revenue", value: `$${revenue.toFixed(2)}`, icon: DollarSign, color: 'text-success-600 bg-success-50' },
          { label: "Today's Orders", value: orders, icon: ShoppingCart, color: 'text-primary-600 bg-primary-50' },
          { label: 'Avg Order Value', value: orders > 0 ? `$${(revenue / orders).toFixed(2)}` : '$0', icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
          { label: "This Month", value: `$${parseFloat(monthSales?.summary?._sum?.totalAmount || '0').toFixed(2)}`, icon: Clock, color: 'text-orange-600 bg-orange-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p></div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Orders by hour chart */}
      {chartData.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Orders by Hour (Today)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v}`, '']} />
              <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Payment breakdown */}
      {sales?.paymentBreakdown?.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Payment Methods (Today)</h2>
          <div className="space-y-2">
            {sales.paymentBreakdown.map((p: { method: string; _sum: { amount: string }; _count: { id: number } }) => (
              <div key={p.method} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium text-gray-700">{p.method.replace(/_/g, ' ')}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">${parseFloat(p._sum.amount).toFixed(2)}</span>
                  <span className="text-xs text-gray-400 ml-2">({p._count.id} txns)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
