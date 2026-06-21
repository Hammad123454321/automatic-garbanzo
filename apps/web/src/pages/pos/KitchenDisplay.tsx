import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, Flame } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { io } from 'socket.io-client';

interface KDSOrder { id: string; orderNumber: string; type: string; tableNumber?: string; status: string; notes?: string; createdAt: string; items: { id: string; name: string; quantity: number; status: string; notes?: string; modifiers: { modifierOption: { name: string } }[] }[] }

const STATUS_PRIORITY: Record<string, number> = { CONFIRMED: 0, IN_PROGRESS: 1, READY: 2 };

export default function KitchenDisplayPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const storeId = user?.storeId!;

  const { data: orders } = useQuery<KDSOrder[]>({
    queryKey: ['kds-orders', storeId],
    queryFn: () => api.get(`/orders?storeId=${storeId}&status=CONFIRMED,IN_PROGRESS&limit=50`).then((r) => r.data.data),
    refetchInterval: 10000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds-orders'] }),
    onError: (e) => toast.error(extractError(e)),
  });

  // Real-time via socket
  useEffect(() => {
    if (!storeId) return;
    const socket = io({ query: { storeId } });
    socket.on('kds:order', () => qc.invalidateQueries({ queryKey: ['kds-orders'] }));
    return () => { socket.disconnect(); };
  }, [storeId, qc]);

  const sorted = [...(orders || [])].sort((a, b) => {
    const ap = STATUS_PRIORITY[a.status] ?? 99;
    const bp = STATUS_PRIORITY[b.status] ?? 99;
    if (ap !== bp) return ap - bp;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  function minutesSince(date: string) {
    return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-4 text-white">
        <div className="flex items-center gap-3"><Flame className="w-6 h-6 text-orange-400" /><h1 className="text-xl font-bold">Kitchen Display</h1></div>
        <div className="text-sm text-gray-400">{sorted.length} active orders</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {sorted.map((order) => {
          const mins = minutesSince(order.createdAt);
          const urgency = mins >= 20 ? 'border-red-500 bg-red-950' : mins >= 12 ? 'border-yellow-500 bg-yellow-950' : 'border-gray-600 bg-gray-800';
          return (
            <div key={order.id} className={`rounded-xl border-2 p-4 text-white ${urgency}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-lg font-bold">#{order.orderNumber.slice(-4)}</span>
                  {order.tableNumber && <span className="ml-2 text-xs text-gray-400">T{order.tableNumber}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock className={`w-3.5 h-3.5 ${mins >= 15 ? 'text-red-400' : 'text-gray-400'}`} />
                  <span className={mins >= 15 ? 'text-red-400 font-bold' : 'text-gray-400'}>{mins}m</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {order.items.map((item, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex gap-2"><span className="font-bold text-white">{item.quantity}×</span><span className="text-gray-200">{item.name}</span></div>
                    {item.modifiers.map((m, j) => <div key={j} className="text-xs text-gray-400 ml-5">+ {m.modifierOption.name}</div>)}
                    {item.notes && <div className="text-xs text-yellow-300 ml-5 font-medium">⚠ {item.notes}</div>}
                  </div>
                ))}
              </div>

              {order.notes && <p className="text-xs text-yellow-300 border-t border-gray-600 pt-2 mb-3">Note: {order.notes}</p>}

              <div className="flex gap-2">
                {order.status === 'CONFIRMED' && (
                  <button onClick={() => updateMutation.mutate({ id: order.id, status: 'IN_PROGRESS' })} className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-xs transition-all">
                    Start
                  </button>
                )}
                {order.status === 'IN_PROGRESS' && (
                  <button onClick={() => updateMutation.mutate({ id: order.id, status: 'READY' })} className="flex-1 py-2 bg-success-500 hover:bg-success-400 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Ready
                  </button>
                )}
                {order.status === 'READY' && (
                  <button onClick={() => updateMutation.mutate({ id: order.id, status: 'COMPLETED' })} className="flex-1 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-lg text-xs transition-all">
                    Done
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!sorted.length && (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-500">
            <CheckCircle className="w-16 h-16 mb-4 text-success-600 opacity-50" />
            <p className="text-xl font-medium">All caught up!</p>
            <p className="text-sm mt-1">No active orders in the kitchen</p>
          </div>
        )}
      </div>
    </div>
  );
}
