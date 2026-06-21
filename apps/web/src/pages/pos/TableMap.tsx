import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePosStore } from '@/stores/posStore';

interface Table { id: string; number: string; capacity: number; status: string; posX: number; posY: number; width: number; height: number; shape: string; section?: string; orders: { id: string; orderNumber: string; totalAmount: number }[] }

const STATUS_COLORS: Record<string, string> = { AVAILABLE: '#22c55e', OCCUPIED: '#ef4444', RESERVED: '#f59e0b', CLEANING: '#6b7280' };
const STATUS_TEXT: Record<string, string> = { AVAILABLE: 'text-success-700', OCCUPIED: 'text-danger-700', RESERVED: 'text-warning-700', CLEANING: 'text-gray-700' };

export default function TableMapPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const pos = usePosStore();
  const storeId = user?.storeId!;

  const { data: tables } = useQuery<Table[]>({
    queryKey: ['tables-pos', storeId],
    queryFn: () => api.get(`/restaurant/tables?storeId=${storeId}`).then((r) => r.data.data),
    refetchInterval: 15000,
  });

  function selectTable(table: Table) {
    pos.setTable(table.id, table.number);
    pos.setOrderType('DINE_IN');
    navigate('/pos');
  }

  const sections = [...new Set((tables || []).map((t) => t.section || ''))];

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <h1 className="font-bold text-gray-900">Table Map</h1>
        <div className="flex gap-3 ml-2">
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />{s}
            </div>
          ))}
        </div>
      </div>

      {/* Floor map */}
      <div className="flex-1 relative overflow-auto bg-gray-50 border border-dashed border-gray-300 m-3 rounded-xl">
        {(tables || []).map((table) => (
          <button key={table.id} onClick={() => selectTable(table)}
            className="absolute flex flex-col items-center justify-center text-white font-bold rounded-xl shadow cursor-pointer hover:opacity-90 hover:shadow-lg transition-all active:scale-95"
            style={{ left: table.posX, top: table.posY, width: table.width, height: table.height, backgroundColor: STATUS_COLORS[table.status] || '#6b7280', borderRadius: table.shape === 'circle' ? '50%' : '12px' }}>
            <span className="text-lg leading-none">{table.number}</span>
            <div className="flex items-center gap-0.5 text-xs opacity-90 mt-0.5"><Users className="w-2.5 h-2.5" />{table.capacity}</div>
            {table.orders?.length > 0 && (
              <div className="mt-1 text-xs font-medium opacity-90">${parseFloat(String(table.orders[0].totalAmount)).toFixed(0)}</div>
            )}
          </button>
        ))}
        {!tables?.length && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center"><Users className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No tables set up — configure in Admin → Tables</p></div>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="bg-white border-t px-4 py-2 flex gap-6 text-sm">
        <span className="text-gray-500">Total: <strong className="text-gray-900">{tables?.length || 0}</strong></span>
        {Object.entries(STATUS_COLORS).map(([s]) => {
          const count = (tables || []).filter((t) => t.status === s).length;
          return count > 0 ? <span key={s} className={`${STATUS_TEXT[s] || 'text-gray-500'} font-medium`}>{s}: {count}</span> : null;
        })}
      </div>
    </div>
  );
}
