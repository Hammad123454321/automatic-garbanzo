import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Eye, RefreshCw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Order { id: string; orderNumber: string; type: string; status: string; totalAmount: number; paidAmount: number; createdAt: string; staff?: { firstName: string; lastName: string }; customer?: { firstName: string; lastName: string }; table?: { number: string }; items: { name: string; quantity: number }[] }

const STATUS_COLORS: Record<string, string> = { PENDING: 'badge-yellow', CONFIRMED: 'badge-blue', IN_PROGRESS: 'badge-blue', READY: 'badge-green', COMPLETED: 'badge-green', CANCELLED: 'badge-red', REFUNDED: 'badge-gray' };

export default function OrdersPage() {
  const { user } = useAuthStore();
  const storeId = user?.storeId!;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refundAmount, setRefundAmount] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', storeId, search, status],
    queryFn: () => api.get(`/orders?storeId=${storeId}&search=${search}&status=${status}&limit=50`).then((r) => r.data),
    refetchInterval: 15000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status: s }),
    onSuccess: () => { toast.success('Order updated'); qc.invalidateQueries({ queryKey: ['orders'] }); setSelectedOrder(null); },
    onError: (e) => toast.error(extractError(e)),
  });

  const orders: Order[] = data?.data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <button onClick={() => refetch()} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search order #, customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['PENDING','CONFIRMED','IN_PROGRESS','READY','COMPLETED','CANCELLED','REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>#</th><th>Type</th><th>Customer</th><th>Table</th><th>Items</th><th className="text-right">Total</th><th>Status</th><th>Time</th><th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="text-center py-8 text-gray-400"><Clock className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {!isLoading && !orders.length && <tr><td colSpan={9} className="text-center py-8 text-gray-400">No orders found</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-xs font-bold text-primary-600">{o.orderNumber}</td>
                <td><span className="badge-gray">{o.type}</span></td>
                <td className="text-sm">{o.customer ? `${o.customer.firstName} ${o.customer.lastName || ''}` : '—'}</td>
                <td>{o.table ? `T${o.table.number}` : '—'}</td>
                <td className="text-xs text-gray-500">{o.items.slice(0, 2).map((i) => `${i.quantity}x ${i.name}`).join(', ')}{o.items.length > 2 ? ` +${o.items.length - 2}` : ''}</td>
                <td className="text-right font-bold">${parseFloat(String(o.totalAmount)).toFixed(2)}</td>
                <td><span className={STATUS_COLORS[o.status] || 'badge-gray'}>{o.status}</span></td>
                <td className="text-xs text-gray-400">{format(new Date(o.createdAt), 'h:mm a')}</td>
                <td>
                  <button onClick={() => setSelectedOrder(o)} className="p-1.5 hover:bg-gray-100 rounded"><Eye className="w-3.5 h-3.5 text-gray-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-xl">Order #{selectedOrder.orderNumber}</h2>
                <span className={STATUS_COLORS[selectedOrder.status]}>{selectedOrder.status}</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm space-y-1 text-gray-600">
                <p>Type: <span className="font-medium text-gray-900">{selectedOrder.type}</span></p>
                {selectedOrder.customer && <p>Customer: <span className="font-medium text-gray-900">{selectedOrder.customer.firstName} {selectedOrder.customer.lastName}</span></p>}
                {selectedOrder.table && <p>Table: <span className="font-medium text-gray-900">#{selectedOrder.table.number}</span></p>}
                <p>Staff: <span className="font-medium text-gray-900">{selectedOrder.staff ? `${selectedOrder.staff.firstName} ${selectedOrder.staff.lastName}` : '—'}</span></p>
              </div>

              <div className="border rounded-xl overflow-hidden">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between px-4 py-2.5 text-sm border-b last:border-0">
                    <span>{item.quantity}x {item.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between font-bold text-lg border-t pt-3">
                <span>Total</span>
                <span>${parseFloat(String(selectedOrder.totalAmount)).toFixed(2)}</span>
              </div>

              {/* Status actions */}
              <div className="flex flex-wrap gap-2">
                {['CONFIRMED','IN_PROGRESS','READY','COMPLETED','CANCELLED'].map((s) => (
                  <button key={s} onClick={() => statusMutation.mutate({ id: selectedOrder.id, status: s })}
                    className={`btn-sm ${s === 'CANCELLED' ? 'btn-danger' : s === 'COMPLETED' ? 'btn-success' : 'btn-secondary'}`}>
                    → {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6">
              <button className="btn-secondary w-full" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
