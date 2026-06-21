import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, User, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Customer { id: string; firstName: string; lastName?: string; email?: string; phone?: string; loyaltyPoints: number; memberBalance: number; createdAt: string; _count: { orders: number } }

export default function CustomersPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const merchantId = user?.merchantId!;
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
  const [selected, setSelected] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['customers', merchantId, search], queryFn: () => api.get(`/customers?merchantId=${merchantId}&search=${search}&limit=50`).then((r) => r.data) });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/customers', { ...body, merchantId }),
    onSuccess: () => { toast.success('Customer created'); qc.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); },
    onError: (e) => toast.error(extractError(e)),
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: ({ id, amount, type }: { id: string; amount: string; type: string }) => api.post(`/customers/${id}/balance`, { amount, type }),
    onSuccess: () => { toast.success('Balance updated'); qc.invalidateQueries({ queryKey: ['customers'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Customer</button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Name, phone, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="card mb-5 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Customer</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">First Name *</label><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className="label">Last Name</label><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving…' : 'Create'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Points</th><th>Balance</th><th>Since</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>}
            {(data?.data || []).map((c: Customer) => (
              <tr key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(c)}>
                <td><div className="flex items-center gap-2"><div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-sm">{c.firstName[0]}</div><span className="font-medium">{c.firstName} {c.lastName || ''}</span></div></td>
                <td className="text-gray-500 text-sm">{c.phone || c.email || '—'}</td>
                <td>{c._count.orders}</td>
                <td><span className="font-medium text-primary-600">{c.loyaltyPoints} pts</span></td>
                <td className="font-semibold">${parseFloat(String(c.memberBalance)).toFixed(2)}</td>
                <td className="text-gray-400 text-xs">{format(new Date(c.createdAt), 'MMM d, yyyy')}</td>
              </tr>
            ))}
            {!isLoading && !data?.data?.length && <tr><td colSpan={6} className="text-center py-10 text-gray-400"><User className="w-8 h-8 mx-auto mb-2 opacity-30" /><br />No customers yet</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">{selected.firstName} {selected.lastName}</h3>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-400">Phone</dt><dd className="font-medium">{selected.phone || '—'}</dd></div>
                <div><dt className="text-gray-400">Email</dt><dd className="font-medium">{selected.email || '—'}</dd></div>
                <div><dt className="text-gray-400">Orders</dt><dd className="font-medium">{selected._count.orders}</dd></div>
                <div><dt className="text-gray-400">Points</dt><dd className="font-bold text-primary-600">{selected.loyaltyPoints}</dd></div>
              </dl>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Member Balance</p>
                <p className="text-3xl font-bold text-gray-900">${parseFloat(String(selected.memberBalance)).toFixed(2)}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { const a = prompt('Top-up amount:'); if (a) adjustBalanceMutation.mutate({ id: selected.id, amount: a, type: 'add' }); }} className="btn-success btn-sm flex-1">+ Add</button>
                  <button onClick={() => { const a = prompt('Deduct amount:'); if (a) adjustBalanceMutation.mutate({ id: selected.id, amount: a, type: 'deduct' }); }} className="btn-danger btn-sm flex-1">- Deduct</button>
                </div>
              </div>
            </div>
            <div className="px-5 pb-5"><button className="btn-secondary w-full" onClick={() => setSelected(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
