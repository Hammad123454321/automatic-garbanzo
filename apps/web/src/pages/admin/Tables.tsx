import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Table { id?: string; number: string; name?: string; capacity: number; status?: string; posX: number; posY: number; width: number; height: number; shape: string; section?: string; orders?: { id: string }[] }

const STATUS_COLORS: Record<string, string> = { AVAILABLE: '#22c55e', OCCUPIED: '#ef4444', RESERVED: '#f59e0b', CLEANING: '#6b7280' };

export default function TablesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const storeId = user?.storeId!;
  const [dragging, setDragging] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [tables, setTables] = useState<Table[]>([]);
  const [dirty, setDirty] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useQuery({
    queryKey: ['tables', storeId],
    queryFn: () => api.get(`/restaurant/tables?storeId=${storeId}`).then((r) => r.data.data),
    enabled: !!storeId,
    onSuccess: (data: Table[]) => setTables(data || []),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post('/restaurant/tables/layout', { storeId, tables }),
    onSuccess: () => { toast.success('Layout saved'); qc.invalidateQueries({ queryKey: ['tables'] }); setDirty(false); },
    onError: (e) => toast.error(extractError(e)),
  });

  function addTable() {
    setTables((t) => [...t, { number: String(t.length + 1), capacity: 4, posX: 50 + t.length * 120, posY: 50, width: 100, height: 80, shape: 'rect', status: 'AVAILABLE' }]);
    setDirty(true);
  }

  function startDrag(e: React.MouseEvent, tableNumber: string) {
    const table = tables.find((t) => t.number === tableNumber);
    if (!table) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(tableNumber);
    setOffset({ x: e.clientX - rect.left - table.posX, y: e.clientY - rect.top - table.posY });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - offset.x);
    const y = Math.max(0, e.clientY - rect.top - offset.y);
    setTables((t) => t.map((table) => table.number === dragging ? { ...table, posX: x, posY: y } : table));
    setDirty(true);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Table Map</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={addTable}><Plus className="w-4 h-4" /> Add Table</button>
          {dirty && <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save className="w-4 h-4" />{saveMutation.isPending ? 'Saving…' : 'Save Layout'}</button>}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} /> {s}
          </div>
        ))}
      </div>

      {/* Floor map */}
      <div ref={canvasRef} className="relative bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden select-none" style={{ height: 500 }} onMouseMove={onMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)}>
        {tables.map((table) => (
          <div key={table.number} className="absolute cursor-grab active:cursor-grabbing flex flex-col items-center justify-center text-white font-bold rounded-xl shadow-md transition-shadow hover:shadow-lg"
            style={{ left: table.posX, top: table.posY, width: table.width, height: table.height, backgroundColor: STATUS_COLORS[table.status || 'AVAILABLE'], borderRadius: table.shape === 'circle' ? '50%' : '12px' }}
            onMouseDown={(e) => startDrag(e, table.number)}>
            <span className="text-lg">{table.number}</span>
            <span className="text-xs opacity-80">{table.capacity} seats</span>
            {(table.orders?.length || 0) > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{table.orders?.length}</span>}
          </div>
        ))}
        {!tables.length && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
            <p className="text-lg font-medium">No tables yet</p>
            <p className="text-sm mt-1">Click "Add Table" to start building your floor map</p>
          </div>
        )}
      </div>

      {/* Table list */}
      <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {tables.map((t) => (
          <div key={t.number} className="card p-3 text-center">
            <div className="text-lg font-bold text-gray-800">T{t.number}</div>
            <div className="text-xs text-gray-400">{t.capacity} seats</div>
            <div className="w-2 h-2 rounded-full mx-auto mt-1.5" style={{ backgroundColor: STATUS_COLORS[t.status || 'AVAILABLE'] }} />
          </div>
        ))}
      </div>
    </div>
  );
}
