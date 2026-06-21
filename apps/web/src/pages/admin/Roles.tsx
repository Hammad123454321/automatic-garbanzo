import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Permission { key: string; name: string; description: string; module: string }
interface Role { id: string; name: string; description?: string; _count?: { staffRoles: number }; rolePermissions: { permission: { key: string; name: string } }[] }

export default function RolesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const merchantId = user?.merchantId!;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', permissions: [] as string[] });

  const { data: roles } = useQuery({ queryKey: ['roles', merchantId], queryFn: () => api.get(`/staff/roles?merchantId=${merchantId}`).then((r) => r.data.data) });
  const { data: allPerms } = useQuery({ queryKey: ['permissions'], queryFn: () => api.get('/staff/permissions').then((r) => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/staff/roles', { ...body, merchantId }),
    onSuccess: () => { toast.success('Role created'); qc.invalidateQueries({ queryKey: ['roles'] }); setShowForm(false); setForm({ name: '', description: '', permissions: [] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/roles/${id}`),
    onSuccess: () => { toast.success('Role deleted'); qc.invalidateQueries({ queryKey: ['roles'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  const modules = [...new Set((allPerms || []).map((p: Permission) => p.module))];

  function togglePerm(key: string) {
    setForm((f) => ({ ...f, permissions: f.permissions.includes(key) ? f.permissions.filter((k) => k !== key) : [...f.permissions, key] }));
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Role</button>
      </div>

      {showForm && (
        <div className="card mb-5 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Create Role</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Role Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cashier, Manager" /></div>
            <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="space-y-4">
            {modules.map((mod) => (
              <div key={String(mod)}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{String(mod)}</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {(allPerms || []).filter((p: Permission) => p.module === mod).map((p: Permission) => (
                    <label key={p.key} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePerm(p.key)} className="w-4 h-4 text-primary-600 rounded" />
                      <div><p className="text-sm font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.description}</p></div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-5">
            <button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Create Role'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(roles || []).map((role: Role) => (
          <div key={role.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-primary-500" />
                <div>
                  <h3 className="font-semibold text-gray-900">{role.name}</h3>
                  {role.description && <p className="text-sm text-gray-400">{role.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{role._count?.staffRoles || 0} staff</span>
                <button onClick={() => { if (confirm('Delete this role?')) deleteMutation.mutate(role.id); }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-danger-400" /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {role.rolePermissions.slice(0, 8).map((rp) => <span key={rp.permission.key} className="badge-blue">{rp.permission.name}</span>)}
              {role.rolePermissions.length > 8 && <span className="badge-gray">+{role.rolePermissions.length - 8} more</span>}
              {!role.rolePermissions.length && <span className="text-xs text-gray-400">No permissions assigned</span>}
            </div>
          </div>
        ))}
        {!roles?.length && <div className="text-center py-10 text-gray-400"><ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No roles yet</p></div>}
      </div>
    </div>
  );
}
