import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface Merchant { id: string; name: string; email: string; phone?: string; billingPlan: string; maxStores: number; maxDevices: number; isActive: boolean; _count: { stores: number; staff: number } }

export default function MerchantsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', maxStores: 1, maxDevices: 3, billingPlan: 'basic', baseFee: 0, perStoreFee: 0, perDeviceFee: 0 });

  const { data, isLoading } = useQuery({ queryKey: ['merchants', search], queryFn: () => api.get(`/super-admin/merchants?search=${search}&limit=50`).then((r) => r.data) });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/super-admin/merchants', body),
    onSuccess: () => { toast.success('Merchant created'); qc.invalidateQueries({ queryKey: ['merchants'] }); setShowForm(false); },
    onError: (e) => toast.error(extractError(e)),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Merchants</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Merchant</button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Search merchants…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="card mb-6 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Merchant</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Plan</label>
              <select className="select" value={form.billingPlan} onChange={(e) => setForm({ ...form, billingPlan: e.target.value })}>
                <option value="basic">Basic</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div><label className="label">Max Stores</label><input className="input" type="number" value={form.maxStores} onChange={(e) => setForm({ ...form, maxStores: +e.target.value })} /></div>
            <div><label className="label">Max Devices</label><input className="input" type="number" value={form.maxDevices} onChange={(e) => setForm({ ...form, maxDevices: +e.target.value })} /></div>
            <div><label className="label">Base Fee ($)</label><input className="input" type="number" step="0.01" value={form.baseFee} onChange={(e) => setForm({ ...form, baseFee: +e.target.value })} /></div>
            <div><label className="label">Per Store Fee ($)</label><input className="input" type="number" step="0.01" value={form.perStoreFee} onChange={(e) => setForm({ ...form, perStoreFee: +e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Merchant'}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Merchant</th><th>Email</th><th>Plan</th><th>Stores</th><th>Devices</th><th>Staff</th><th>Status</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>}
            {data?.data?.map((m: Merchant) => (
              <tr key={m.id} className="cursor-pointer" onClick={() => navigate(`/super-admin/merchants/${m.id}`)}>
                <td><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary-500" /><span className="font-medium">{m.name}</span></div></td>
                <td className="text-gray-500">{m.email}</td>
                <td><span className="badge-blue">{m.billingPlan}</span></td>
                <td>{m._count.stores}/{m.maxStores}</td>
                <td>{m.maxDevices}</td>
                <td>{m._count.staff}</td>
                <td><span className={m.isActive ? 'badge-green' : 'badge-red'}>{m.isActive ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
