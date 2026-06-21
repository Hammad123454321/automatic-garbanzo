import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
type Period = 'today' | 'week' | 'month' | 'year';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const storeId = user?.storeId!;
  const [period, setPeriod] = useState<Period>('today');

  const { data: sales } = useQuery({
    queryKey: ['report-sales', storeId, period],
    queryFn: () => api.get(`/reports/sales?storeId=${storeId}&period=${period}`).then((r) => r.data.data),
    enabled: !!storeId,
  });

  const { data: staffData } = useQuery({
    queryKey: ['report-staff', storeId, period],
    queryFn: () => api.get(`/reports/staff?storeId=${storeId}&period=${period}`).then((r) => r.data.data),
    enabled: !!storeId,
  });

  const { data: tips } = useQuery({
    queryKey: ['report-tips', storeId, period],
    queryFn: () => api.get(`/reports/tips?storeId=${storeId}&period=${period}`).then((r) => r.data.data),
    enabled: !!storeId,
  });

  const { data: tax } = useQuery({
    queryKey: ['report-tax', storeId, period],
    queryFn: () => api.get(`/reports/tax?storeId=${storeId}&period=${period}`).then((r) => r.data.data),
    enabled: !!storeId,
  });

  const summary = sales?.summary;
  const revenue = parseFloat(summary?._sum?.totalAmount || '0');
  const orders = summary?._count?.id || 0;
  const avgOrder = orders > 0 ? revenue / orders : 0;
  const totalDiscount = parseFloat(summary?._sum?.discountAmount || '0');
  const totalTax = parseFloat(summary?._sum?.taxAmount || '0');

  const chartData = (sales?.ordersByTime || []).map((d: { period: string; count: number; revenue: number }) => ({
    time: period === 'today' ? format(new Date(d.period), 'ha') : format(new Date(d.period), 'MMM d'),
    orders: Number(d.count), revenue: parseFloat(String(d.revenue)),
  }));

  const paymentData = (sales?.paymentBreakdown || []).map((p: { method: string; _sum: { amount: string } }) => ({
    name: p.method.replace(/_/g, ' '), value: parseFloat(p._sum.amount || '0'),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          {(['today', 'week', 'month', 'year'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${period === p ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', value: `$${revenue.toFixed(2)}`, color: 'text-success-600' },
          { label: 'Orders', value: orders, color: 'text-primary-600' },
          { label: 'Avg Order', value: `$${avgOrder.toFixed(2)}`, color: 'text-purple-600' },
          { label: 'Discounts', value: `-$${totalDiscount.toFixed(2)}`, color: 'text-warning-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        {chartData.length > 0 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Revenue Over Time</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Payment breakdown */}
        {paymentData.length > 0 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Payment Methods</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {paymentData.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        {sales?.topProducts?.length > 0 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Top Products</h2>
            <div className="space-y-2">
              {sales.topProducts.map((p: { name: string; _sum: { quantity: string; totalAmount: string }; _count: { id: number } }) => (
                <div key={p.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-700">{p.name}</span>
                  <div className="text-right text-sm"><span className="font-bold text-gray-900">${parseFloat(p._sum.totalAmount || '0').toFixed(2)}</span><span className="text-gray-400 ml-2">×{parseFloat(p._sum.quantity || '0').toFixed(0)}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff performance */}
        {staffData?.length > 0 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Staff Performance</h2>
            <div className="space-y-2">
              {staffData.map((s: { staffName: string; _sum: { totalAmount: string; tipAmount: string }; _count: { id: number } }) => (
                <div key={s.staffName} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-700">{s.staffName}</span>
                  <div className="text-right text-sm">
                    <span className="font-bold text-gray-900">${parseFloat(s._sum.totalAmount || '0').toFixed(2)}</span>
                    <span className="text-gray-400 ml-2">{s._count.id} orders</span>
                    {parseFloat(s._sum.tipAmount || '0') > 0 && <span className="text-success-600 ml-2">+${parseFloat(s._sum.tipAmount).toFixed(2)} tips</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tax summary */}
      {tax && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Tax Summary</h2>
          <dl className="grid grid-cols-3 gap-4">
            <div><dt className="text-sm text-gray-500">Taxable Sales</dt><dd className="text-xl font-bold mt-1">${parseFloat(String(tax._sum?.subtotal || 0)).toFixed(2)}</dd></div>
            <div><dt className="text-sm text-gray-500">Tax Collected</dt><dd className="text-xl font-bold mt-1 text-warning-600">${parseFloat(String(tax._sum?.taxAmount || 0)).toFixed(2)}</dd></div>
            <div><dt className="text-sm text-gray-500">Discounts</dt><dd className="text-xl font-bold mt-1 text-danger-500">-${parseFloat(String(tax._sum?.discountAmount || 0)).toFixed(2)}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
