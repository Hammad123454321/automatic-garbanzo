import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface StaffMember { id: string; firstName: string; lastName: string; email?: string; phone?: string; username: string; isActive: boolean; hourlyWage?: number; roles: { role: { name: string } }[] }
interface Role { id: string; name: string }

export default function StaffPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const merchantId = user?.merchantId!;
  const storeId = user?.storeId!;
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', username: '', password: '', pin: '', hourlyWage: '', roleIds: [] as string[], storeIds: [storeId] });

  const { data } = useQuery({ queryKey: ['staff', merchantId], queryFn: () => api.get(`/staff?merchantId=${merchantId}&limit=100`).then((r) => r.data) });
  const { data: roles } = useQuery({ queryKey: ['roles', merchantId], queryFn: () => api.get(`/staff/roles?merchantId=${merchantId}`).then((r) => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/staff', { ...body, merchantId }),
    onSuccess: () => { toast.success('Staff created'); qc.invalidateQueries({ queryKey: ['staff'] }); setShowForm(false); },
    onError: (e) => toast.error(extractError(e)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/${id}`),
    onSuccess: () => { toast.success('Staff deactivated'); qc.invalidateQueries({ queryKey: ['staff'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  const staff: StaffMember[] = data?.data || [];
  const filtered = search ? staff.filter((s) => `${s.firstName} ${s.lastName} ${s.username}`.toLowerCase().includes(search.toLowerCase())) : staff;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Staff</button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="card mb-5 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Staff Member</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="label">First Name *</label><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className="label">Last Name</label><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div><label className="label">Username *</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="label">Password *</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><label className="label">PIN (4-6 digits)</label><input className="input" type="password" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Hourly Wage ($)</label><input className="input" type="number" step="0.01" value={form.hourlyWage} onChange={(e) => setForm({ ...form, hourlyWage: e.target.value })} /></div>
            <div><label className="label">Role</label>
              <select className="select" value={form.roleIds[0] || ''} onChange={(e) => setForm({ ...form, roleIds: e.target.value ? [e.target.value] : [] })}>
                <option value="">No role</option>
                {(roles || []).map((r: Role) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Create Staff'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Wage/hr</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td><div className="flex items-center gap-2"><div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">{s.firstName[0]}</div><span className="font-medium">{s.firstName} {s.lastName}</span></div></td>
                <td className="text-gray-500 font-mono text-sm">{s.username}</td>
                <td>{s.roles.length ? s.roles.map((r) => <span key={r.role.name} className="badge-blue mr-1">{r.role.name}</span>) : <span className="text-gray-400 text-xs">No role</span>}</td>
                <td>{s.hourlyWage ? `$${parseFloat(String(s.hourlyWage)).toFixed(2)}` : '—'}</td>
                <td><span className={s.isActive ? 'badge-green' : 'badge-red'}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button onClick={() => { if (confirm('Deactivate this staff member?')) deactivateMutation.mutate(s.id); }} className="p-1.5 hover:bg-red-50 rounded" title="Deactivate"><UserX className="w-4 h-4 text-danger-400" /></button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No staff found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
