import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface InventoryItem { id: string; quantity: number; isLowStock?: boolean; product?: { id: string; name: string; sku?: string; lowStockAlert: number; isActive: boolean }; inventoryId?: string }

export default function InventoryPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const storeId = user?.storeId!;
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({ action: 'ADJUSTMENT', quantity: '', notes: '' });

  const { data, isLoading } = useQuery({ queryKey: ['inventory', storeId, showLowOnly], queryFn: () => api.get(`/inventory?storeId=${storeId}${showLowOnly ? '&lowStock=true' : ''}`).then((r) => r.data.data) });

  const adjustMutation = useMutation({
    mutationFn: (body: { storeId: string; productId?: string; action: string; quantity: string; notes: string }) => api.post('/inventory/adjust', body),
    onSuccess: () => { toast.success('Stock updated'); qc.invalidateQueries({ queryKey: ['inventory'] }); setAdjusting(null); },
    onError: (e) => toast.error(extractError(e)),
  });

  const items: InventoryItem[] = data || [];
  const filtered = search ? items.filter((i) => i.product?.name.toLowerCase().includes(search.toLowerCase()) || i.product?.sku?.includes(search)) : items;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showLowOnly} onChange={(e) => setShowLowOnly(e.target.checked)} className="w-4 h-4 text-warning-500 rounded" />
            <span className="text-sm font-medium text-warning-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Low Stock Only</span>
          </label>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Search product or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Product</th><th>SKU</th><th className="text-right">In Stock</th><th>Alert Level</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>}
            {filtered.map((item) => (
              <tr key={item.id} className={item.isLowStock ? 'bg-warning-50' : ''}>
                <td><div className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-300" /><span className="font-medium">{item.product?.name}</span></div></td>
                <td className="font-mono text-xs text-gray-500">{item.product?.sku || '—'}</td>
                <td className="text-right"><span className={`text-lg font-bold ${item.isLowStock ? 'text-warning-600' : 'text-gray-900'}`}>{parseFloat(String(item.quantity))}</span></td>
                <td className="text-gray-500">{item.product?.lowStockAlert}</td>
                <td>{item.isLowStock ? <span className="badge-yellow flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Low</span> : <span className="badge-green">OK</span>}</td>
                <td>
                  <button onClick={() => { setAdjusting(item); setAdjustForm({ action: 'ADJUSTMENT', quantity: '', notes: '' }); }} className="btn-secondary btn-sm">
                    <RefreshCw className="w-3.5 h-3.5" /> Adjust
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !filtered.length && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No inventory records</td></tr>}
          </tbody>
        </table>
      </div>

      {adjusting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-1">{adjusting.product?.name}</h3>
            <p className="text-sm text-gray-500 mb-4">Current stock: <strong>{parseFloat(String(adjusting.quantity))}</strong></p>
            <div className="space-y-3">
              <div><label className="label">Action</label>
                <select className="select" value={adjustForm.action} onChange={(e) => setAdjustForm({ ...adjustForm, action: e.target.value })}>
                  {['STOCK_IN','STOCK_OUT','ADJUSTMENT','DAMAGE','EXPIRY'].map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Quantity {adjustForm.action === 'ADJUSTMENT' ? '(set to)' : ''}</label><input className="input" type="number" step="0.001" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} placeholder="0" autoFocus /></div>
              <div><label className="label">Notes</label><input className="input" value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} placeholder="Reason for adjustment" /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-primary flex-1" onClick={() => adjustMutation.mutate({ storeId, productId: adjusting.product?.id, ...adjustForm })} disabled={!adjustForm.quantity || adjustMutation.isPending}>{adjustMutation.isPending ? 'Saving…' : 'Apply'}</button>
              <button className="btn-secondary" onClick={() => setAdjusting(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
