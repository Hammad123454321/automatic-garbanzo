import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Package, ChevronDown, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Product { id: string; name: string; sku?: string; barcode?: string; price: number; costPrice?: number; isActive: boolean; type: string; category?: { name: string }; inventory: { quantity: number }[] }
interface Category { id: string; name: string }

export default function ProductsPage() {
  const { user } = useAuthStore();
  const storeId = user?.storeId!;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [form, setForm] = useState({ name: '', nameZh: '', sku: '', barcode: '', price: '', costPrice: '', description: '', categoryId: '', type: 'STANDARD', trackInventory: true, lowStockAlert: 5 });

  const { data: productsData } = useQuery({ queryKey: ['products', storeId, search, categoryId], queryFn: () => api.get(`/products?storeId=${storeId}&search=${search}&categoryId=${categoryId}&limit=100`).then((r) => r.data) });
  const { data: cats } = useQuery({ queryKey: ['categories', storeId], queryFn: () => api.get(`/products/categories?storeId=${storeId}`).then((r) => r.data.data) });

  const saveMutation = useMutation({
    mutationFn: (body: typeof form) => editingId ? api.put(`/products/${editingId}`, { ...body, storeId }) : api.post('/products', { ...body, storeId }),
    onSuccess: () => { toast.success(editingId ? 'Product updated' : 'Product created'); qc.invalidateQueries({ queryKey: ['products'] }); setShowForm(false); setEditingId(null); resetForm(); },
    onError: (e) => toast.error(extractError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { toast.success('Product removed'); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  function resetForm() { setForm({ name: '', nameZh: '', sku: '', barcode: '', price: '', costPrice: '', description: '', categoryId: '', type: 'STANDARD', trackInventory: true, lowStockAlert: 5 }); }

  function editProduct(p: Product) {
    setEditingId(p.id);
    setForm({ name: p.name, nameZh: '', sku: p.sku || '', barcode: p.barcode || '', price: String(p.price), costPrice: String(p.costPrice || ''), description: '', categoryId: p.category ? cats?.find((c: Category) => c.name === p.category!.name)?.id || '' : '', type: p.type, trackInventory: true, lowStockAlert: 5 });
    setShowForm(true);
  }

  async function generateAiDescription() {
    if (!form.name) { toast.error('Enter a product name first'); return; }
    setGeneratingAi(true);
    try {
      const { data } = await api.post('/ai/product-description', { name: form.name, category: cats?.find((c: Category) => c.id === form.categoryId)?.name });
      setForm((f) => ({ ...f, description: data.data.description }));
      toast.success('AI description generated');
    } catch (e) { toast.error(extractError(e)); }
    finally { setGeneratingAi(false); }
  }

  const products: Product[] = productsData?.data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}><Plus className="w-4 h-4" /> Add Product</button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search name, SKU, barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-40" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All Categories</option>
          {cats?.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="card mb-5 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{editingId ? 'Edit Product' : 'New Product'}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-2 lg:col-span-1">
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" />
            </div>
            <div><label className="label">Name (Chinese)</label><input className="input" value={form.nameZh} onChange={(e) => setForm({ ...form, nameZh: e.target.value })} /></div>
            <div><label className="label">Category</label>
              <select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">No category</option>
                {cats?.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><label className="label">Barcode (UPC/EAN)</label><input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            <div><label className="label">Type</label>
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="STANDARD">Standard</option><option value="WEIGHTED">Weighted (by weight)</option>
                <option value="TIME_BASED">Time-Based</option><option value="PRICE_ON_DEMAND">Price on Demand</option>
              </select>
            </div>
            <div><label className="label">Price ($) *</label><input className="input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div><label className="label">Cost Price ($)</label><input className="input" type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></div>
            <div><label className="label">Low Stock Alert</label><input className="input" type="number" value={form.lowStockAlert} onChange={(e) => setForm({ ...form, lowStockAlert: +e.target.value })} /></div>
            <div className="col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Description</label>
                <button onClick={generateAiDescription} disabled={generatingAi} className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
                  <Wand2 className="w-3.5 h-3.5" />{generatingAi ? 'Generating…' : 'AI Generate'}
                </button>
              </div>
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : editingId ? 'Update' : 'Create'}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Type</th><th className="text-right">Price</th><th className="text-right">Cost</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {!products.length && <tr><td colSpan={9} className="text-center py-10 text-gray-400"><Package className="w-8 h-8 mx-auto mb-2 opacity-30" /><br />No products yet</td></tr>}
            {products.map((p) => (
              <tr key={p.id}>
                <td><div className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-300" /><span className="font-medium">{p.name}</span></div></td>
                <td className="text-gray-500 text-xs font-mono">{p.sku || '—'}</td>
                <td className="text-gray-500">{p.category?.name || '—'}</td>
                <td><span className="badge-gray">{p.type}</span></td>
                <td className="text-right font-semibold">${parseFloat(String(p.price)).toFixed(2)}</td>
                <td className="text-right text-gray-500">{p.costPrice ? `$${parseFloat(String(p.costPrice)).toFixed(2)}` : '—'}</td>
                <td>{p.inventory?.[0] ? <span className={parseFloat(String(p.inventory[0].quantity)) <= 5 ? 'text-danger-600 font-medium' : 'text-gray-700'}>{parseFloat(String(p.inventory[0].quantity))}</span> : '—'}</td>
                <td><span className={p.isActive ? 'badge-green' : 'badge-red'}>{p.isActive ? 'Active' : 'Off'}</span></td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => editProduct(p)} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
                    <button onClick={() => { if (confirm('Deactivate product?')) deleteMutation.mutate(p.id); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-danger-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
