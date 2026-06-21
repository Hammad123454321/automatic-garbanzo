import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Globe, Pause, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function StoreSettingsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const storeId = user?.storeId!;
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', country: 'US', timezone: 'America/New_York', currency: 'USD', taxRate: '', taxName: 'Tax', receiptHeader: '', receiptFooter: '', onlineEnabled: false, pickupEnabled: true, deliveryEnabled: false, pickupPrepTime: 15, deliveryPrepTime: 30 });

  const { data: store } = useQuery({ queryKey: ['store', storeId], queryFn: () => api.get(`/stores/${storeId}`).then((r) => r.data.data), enabled: !!storeId });

  useEffect(() => {
    if (store) setForm({ name: store.name || '', email: store.email || '', phone: store.phone || '', address: store.address || '', city: store.city || '', state: store.state || '', zipCode: store.zipCode || '', country: store.country || 'US', timezone: store.timezone || 'America/New_York', currency: store.currency || 'USD', taxRate: String(parseFloat(store.taxRate) * 100 || ''), taxName: store.taxName || 'Tax', receiptHeader: store.receiptHeader || '', receiptFooter: store.receiptFooter || '', onlineEnabled: store.onlineEnabled || false, pickupEnabled: store.pickupEnabled !== false, deliveryEnabled: store.deliveryEnabled || false, pickupPrepTime: store.pickupPrepTime || 15, deliveryPrepTime: store.deliveryPrepTime || 30 });
  }, [store]);

  const saveMutation = useMutation({
    mutationFn: (body: typeof form) => api.put(`/stores/${storeId}`, { ...body, taxRate: parseFloat(body.taxRate) / 100 }),
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['store'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  const pauseMutation = useMutation({
    mutationFn: (minutes: number | null) => api.post(`/stores/${storeId}/online/pause`, { minutes }),
    onSuccess: () => { toast.success('Online ordering paused'); qc.invalidateQueries({ queryKey: ['store'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.post(`/stores/${storeId}/online/resume`),
    onSuccess: () => { toast.success('Online ordering resumed'); qc.invalidateQueries({ queryKey: ['store'] }); },
    onError: (e) => toast.error(extractError(e)),
  });

  const f = form;
  const set = (k: string, v: unknown) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>

      {/* Basic Info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Store Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Address</label><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div><label className="label">City</label><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
          <div><label className="label">State</label><input className="input" value={f.state} onChange={(e) => set('state', e.target.value)} /></div>
          <div><label className="label">Zip Code</label><input className="input" value={f.zipCode} onChange={(e) => set('zipCode', e.target.value)} /></div>
          <div><label className="label">Timezone</label>
            <select className="select" value={f.timezone} onChange={(e) => set('timezone', e.target.value)}>
              {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tax & Currency */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Tax & Currency</h2>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="label">Tax Rate (%)</label><input className="input" type="number" step="0.01" value={f.taxRate} onChange={(e) => set('taxRate', e.target.value)} placeholder="8.5" /></div>
          <div><label className="label">Tax Label</label><input className="input" value={f.taxName} onChange={(e) => set('taxName', e.target.value)} /></div>
          <div><label className="label">Currency</label><select className="select" value={f.currency} onChange={(e) => set('currency', e.target.value)}><option value="USD">USD</option><option value="CAD">CAD</option><option value="EUR">EUR</option></select></div>
        </div>
      </div>

      {/* Receipt */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Receipt</h2>
        <div className="space-y-3">
          <div><label className="label">Header Message</label><textarea className="textarea" rows={2} value={f.receiptHeader} onChange={(e) => set('receiptHeader', e.target.value)} placeholder="Thank you for visiting!" /></div>
          <div><label className="label">Footer Message</label><textarea className="textarea" rows={2} value={f.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} placeholder="Come back soon!" /></div>
        </div>
      </div>

      {/* Online Ordering */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Globe className="w-4 h-4" /> Online Ordering</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={f.onlineEnabled} onChange={(e) => set('onlineEnabled', e.target.checked)} className="w-4 h-4 text-primary-600 rounded" /><span className="text-sm font-medium text-gray-700">Enable online ordering</span></label>
          {f.onlineEnabled && (
            <>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.pickupEnabled} onChange={(e) => set('pickupEnabled', e.target.checked)} className="w-4 h-4 text-primary-600 rounded" /><span className="text-sm">Pickup</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.deliveryEnabled} onChange={(e) => set('deliveryEnabled', e.target.checked)} className="w-4 h-4 text-primary-600 rounded" /><span className="text-sm">Delivery</span></label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Pickup Prep Time (min)</label><input className="input" type="number" value={f.pickupPrepTime} onChange={(e) => set('pickupPrepTime', +e.target.value)} /></div>
                <div><label className="label">Delivery Prep Time (min)</label><input className="input" type="number" value={f.deliveryPrepTime} onChange={(e) => set('deliveryPrepTime', +e.target.value)} /></div>
              </div>
              <div>
                <p className="label mb-2">Quick Pause {store?.onlinePaused && <span className="badge-yellow ml-2">Currently Paused</span>}</p>
                <div className="flex gap-2">
                  {[30, 60, 120].map((m) => <button key={m} onClick={() => pauseMutation.mutate(m)} className="btn-secondary btn-sm"><Pause className="w-3.5 h-3.5" />{m}m</button>)}
                  <button onClick={() => pauseMutation.mutate(null)} className="btn-secondary btn-sm">Rest of Day</button>
                  {store?.onlinePaused && <button onClick={() => resumeMutation.mutate()} className="btn-success btn-sm"><Play className="w-3.5 h-3.5" />Resume</button>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="btn-primary btn-lg">
        <Save className="w-5 h-5" />{saveMutation.isPending ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}
