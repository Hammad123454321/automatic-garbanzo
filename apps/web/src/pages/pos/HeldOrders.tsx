import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePosStore } from '@/stores/posStore';

interface HeldOrder { id: string; orderNumber: string; items: { id: string; productId?: string; name: string; quantity: number; unitPrice: number; modifiers: { name: string; priceAdjustment: number; modifierOptionId: string }[] }[]; totalAmount: number; updatedAt: string; customer?: { firstName: string; lastName: string } }

export default function HeldOrdersPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const store = usePosStore();
  const storeId = user?.storeId!;

  const { data: orders } = useQuery<HeldOrder[]>({
    queryKey: ['held-orders', storeId],
    queryFn: () => api.get(`/orders/held?storeId=${storeId}`).then((r) => r.data.data),
  });

  const recallMutation = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/recall`),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ['held-orders'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  function recallOrder(order: HeldOrder) {
    store.clearCart();
    order.items.forEach((item) => {
      store.addItem({
        productId: item.productId, name: item.name, quantity: item.quantity,
        unitPrice: item.unitPrice, modifierTotal: item.modifiers.reduce((s, m) => s + m.priceAdjustment, 0),
        modifiers: item.modifiers.map((m) => ({ modifierOptionId: m.modifierOptionId, name: m.name, priceAdjustment: m.priceAdjustment })),
        taxRate: 0.085,
      });
    });
    recallMutation.mutate(order.id);
    navigate('/pos');
    toast.success('Order recalled');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><ClipboardList className="w-6 h-6 text-primary-500" /> Held Orders</h1>
      {!orders?.length ? (
        <div className="text-center py-16 text-gray-400"><ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No held orders</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-bold text-primary-600">#{order.orderNumber}</span>
                <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(order.updatedAt), { addSuffix: true })}</span>
              </div>
              {order.customer && <p className="text-sm text-gray-600 mb-2">{order.customer.firstName} {order.customer.lastName}</p>}
              <div className="space-y-1 mb-3">
                {order.items.slice(0, 3).map((item, i) => (
                  <div key={i} className="text-sm text-gray-600">{item.quantity}× {item.name}</div>
                ))}
                {order.items.length > 3 && <div className="text-xs text-gray-400">+{order.items.length - 3} more items</div>}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-bold text-gray-900">${parseFloat(String(order.totalAmount)).toFixed(2)}</span>
                <button onClick={() => recallOrder(order)} className="btn-primary btn-sm">
                  Recall <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
