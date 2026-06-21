import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, Search, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface GiftCard { id: string; code: string; last4: string; initialBalance: number; currentBalance: number; status: string; isPhysical: boolean; createdAt: string; _count: { transactions: number } }

export default function GiftCardsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const merchantId = user?.merchantId!;
  const storeId = user?.storeId!;
  const [showCreate, setShowCreate] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [foundCard, setFoundCard] = useState<GiftCard & { transactions: { type: string; amount: number; createdAt: string }[] } | null>(null);
  const [form, setForm] = useState({ initialBalance: '', isPhysical: true });
  const [topupAmount, setTopupAmount] = useState('');

  const { data } = useQuery({ queryKey: ['gift-cards', merchantId], queryFn: () => api.get(`/customers/gift-cards?merchantId=${merchantId}`).then((r) => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/customers/gift-cards', { ...body, merchantId }),
    onSuccess: () => { toast.success('Gift card created'); qc.invalidateQueries({ queryKey: ['gift-cards'] }); setShowCreate(false); },
    onError: (e) => toast.error(extractError(e)),
  });

  const topupMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) => api.post(`/customers/gift-cards/${id}/topup`, { amount, storeId }),
    onSuccess: (res) => { toast.success('Gift card topped up'); setFoundCard(res.data.data); qc.invalidateQueries({ queryKey: ['gift-cards'] }); setTopupAmount(''); },
    onError: (e) => toast.error(extractError(e)),
  });

  async function lookup() {
    if (!lookupCode) return;
    try {
      const { data } = await api.get(`/customers/gift-cards/${lookupCode}`);
      setFoundCard(data.data);
    } catch (e) { toast.error(extractError(e)); setFoundCard(null); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gift Cards</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Issue Gift Card</button>
      </div>

      {/* Lookup */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-800 mb-3">Look Up Balance</h2>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Enter gift card code" value={lookupCode} onChange={(e) => setLookupCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup()} />
          <button className="btn-primary" onClick={lookup}><Search className="w-4 h-4" /> Look Up</button>
        </div>
        {foundCard && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-lg">{foundCard.code}</p>
                <p className="text-sm text-gray-500">Status: <span className={foundCard.status === 'ACTIVE' ? 'text-success-600 font-medium' : 'text-danger-600 font-medium'}>{foundCard.status}</span></p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">${parseFloat(String(foundCard.currentBalance)).toFixed(2)}</p>
                <p className="text-xs text-gray-400">of ${parseFloat(String(foundCard.initialBalance)).toFixed(2)} initial</p>
              </div>
            </div>
            {foundCard.status === 'ACTIVE' && (
              <div className="flex gap-2 mt-3">
                <input className="input w-32" type="number" step="0.01" placeholder="Amount" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
                <button className="btn-success btn-sm" onClick={() => topupMutation.mutate({ id: foundCard.id, amount: topupAmount })} disabled={!topupAmount}><TrendingUp className="w-3.5 h-3.5" /> Top Up</button>
              </div>
            )}
            {foundCard.transactions?.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase">Recent Transactions</p>
                {foundCard.transactions.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b last:border-0">
                    <span className="text-gray-600">{t.type} · {format(new Date(t.createdAt), 'MMM d')}</span>
                    <span className={t.type === 'REDEMPTION' ? 'text-danger-600 font-medium' : 'text-success-600 font-medium'}>{t.type === 'REDEMPTION' ? '-' : '+'}${parseFloat(String(t.amount)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="card mb-5 p-5">
          <h3 className="font-semibold mb-4">Issue New Gift Card</h3>
          <div className="flex gap-4 items-end">
            <div><label className="label">Initial Balance ($) *</label><input className="input" type="number" step="0.01" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} placeholder="50.00" /></div>
            <label className="flex items-center gap-2 pb-2 cursor-pointer"><input type="checkbox" checked={form.isPhysical} onChange={(e) => setForm({ ...form, isPhysical: e.target.checked })} className="w-4 h-4" /><span className="text-sm font-medium text-gray-700">Physical card</span></label>
            <button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={!form.initialBalance || createMutation.isPending}>{createMutation.isPending ? 'Issuing…' : 'Issue'}</button>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Code</th><th>Type</th><th className="text-right">Initial</th><th className="text-right">Current Balance</th><th>Status</th><th>Issued</th></tr></thead>
          <tbody>
            {(data || []).map((gc: GiftCard) => (
              <tr key={gc.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setLookupCode(gc.code); setFoundCard(null); }}>
                <td><div className="flex items-center gap-2"><Gift className="w-4 h-4 text-primary-400" /><span className="font-mono font-medium">{gc.code.slice(0, 4)}…{gc.last4}</span></div></td>
                <td>{gc.isPhysical ? 'Physical' : 'Digital'}</td>
                <td className="text-right text-gray-500">${parseFloat(String(gc.initialBalance)).toFixed(2)}</td>
                <td className="text-right font-bold text-lg">${parseFloat(String(gc.currentBalance)).toFixed(2)}</td>
                <td><span className={gc.status === 'ACTIVE' ? 'badge-green' : gc.status === 'DEPLETED' ? 'badge-gray' : 'badge-red'}>{gc.status}</span></td>
                <td className="text-xs text-gray-400">{format(new Date(gc.createdAt), 'MMM d, yyyy')}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={6} className="text-center py-10 text-gray-400"><Gift className="w-8 h-8 mx-auto mb-2 opacity-20" /><br />No gift cards yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
