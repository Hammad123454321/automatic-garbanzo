import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Store, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';

const FEATURE_FLAGS = [
  { key: 'qr_payments', label: 'QR / Scan Payments (Venmo, Zelle)' },
  { key: 'online_ordering', label: 'Online Ordering' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'loyalty', label: 'Loyalty & Points' },
  { key: 'gift_cards', label: 'Gift Cards' },
  { key: 'ai_features', label: 'AI Features' },
  { key: 'customer_display', label: 'Customer-Facing Display' },
  { key: 'automated_reports', label: 'Automated Email Reports' },
];

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: merchant } = useQuery({ queryKey: ['merchant', id], queryFn: () => api.get(`/super-admin/merchants/${id}`).then((r) => r.data.data) });
  const { data: flags } = useQuery({ queryKey: ['merchant-flags', id], queryFn: () => api.get(`/super-admin/merchants/${id}/features`).then((r) => r.data.data) });

  const toggleFlag = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => api.put(`/super-admin/merchants/${id}/features/${key}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-flags', id] }),
    onError: (e) => toast.error(extractError(e)),
  });

  const getFlagEnabled = (key: string) => (flags || []).find((f: { featureKey: string; enabled: boolean }) => f.featureKey === key && !f.storeId)?.enabled ?? false;

  if (!merchant) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Merchants
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-primary-600">{merchant.name[0]}</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{merchant.name}</h1>
          <p className="text-gray-500">{merchant.email} · <span className="badge-blue">{merchant.billingPlan}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Limits</h3>
          <dl className="space-y-2">
            <div className="flex justify-between text-sm"><dt className="text-gray-500">Max Stores</dt><dd className="font-medium">{merchant.maxStores}</dd></div>
            <div className="flex justify-between text-sm"><dt className="text-gray-500">Max Devices</dt><dd className="font-medium">{merchant.maxDevices}</dd></div>
            <div className="flex justify-between text-sm"><dt className="text-gray-500">Current Stores</dt><dd className="font-medium">{merchant.stores?.length}</dd></div>
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Billing</h3>
          <dl className="space-y-2">
            <div className="flex justify-between text-sm"><dt className="text-gray-500">Base Fee</dt><dd className="font-medium">${merchant.baseFee}/mo</dd></div>
            <div className="flex justify-between text-sm"><dt className="text-gray-500">Per Store</dt><dd className="font-medium">${merchant.perStoreFee}/mo</dd></div>
            <div className="flex justify-between text-sm"><dt className="text-gray-500">Per Device</dt><dd className="font-medium">${merchant.perDeviceFee}/mo</dd></div>
          </dl>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="card">
        <div className="card-header"><h2 className="font-semibold">Feature Gates</h2></div>
        <div className="divide-y">
          {FEATURE_FLAGS.map(({ key, label }) => {
            const enabled = getFlagEnabled(key);
            return (
              <div key={key} className="flex items-center justify-between px-6 py-3.5">
                <span className="text-sm text-gray-700">{label}</span>
                <button onClick={() => toggleFlag.mutate({ key, enabled: !enabled })} className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${enabled ? 'text-success-600' : 'text-gray-400'}`}>
                  {enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  {enabled ? 'On' : 'Off'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stores */}
      <div className="card mt-6">
        <div className="card-header"><h2 className="font-semibold">Stores ({merchant.stores?.length})</h2></div>
        <div className="divide-y">
          {merchant.stores?.map((s: { id: string; name: string; businessMode: string; isActive: boolean; _count: { devices: number } }) => (
            <div key={s.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3"><Store className="w-4 h-4 text-gray-400" /><span className="font-medium text-sm">{s.name}</span><span className="badge-blue text-xs">{s.businessMode}</span></div>
              <div className="flex items-center gap-3 text-sm text-gray-500">{s._count.devices} devices<span className={s.isActive ? 'badge-green' : 'badge-red'}>{s.isActive ? 'Active' : 'Off'}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
