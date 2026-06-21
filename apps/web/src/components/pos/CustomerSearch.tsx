import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, User, Plus } from 'lucide-react';
import api from '@/lib/api';

interface Customer { id: string; firstName: string; lastName?: string; phone?: string; loyaltyPoints: number; memberBalance: number }

interface Props { merchantId: string; onSelect: (c: Customer) => void; onClose: () => void }

export default function CustomerSearch({ merchantId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['customer-search', merchantId, search],
    queryFn: () => api.get(`/customers?merchantId=${merchantId}&search=${search}&limit=20`).then((r) => r.data.data),
    enabled: search.length > 1,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900">Find Customer</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Name, phone, or email…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto px-2 pb-2">
          {isLoading && <p className="text-center py-6 text-sm text-gray-400">Searching…</p>}
          {!isLoading && search.length > 1 && !data?.length && (
            <div className="text-center py-6">
              <User className="w-8 h-8 mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No customers found</p>
            </div>
          )}
          {data?.map((c: Customer) => (
            <button key={c.id} onClick={() => onSelect(c)} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-xl transition-all text-left">
              <div className="w-9 h-9 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{c.firstName[0]}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900">{c.firstName} {c.lastName}</p>
                <p className="text-xs text-gray-400">{c.phone || 'No phone'} · {c.loyaltyPoints} pts</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">Balance</p>
                <p className="text-sm font-bold text-gray-700">${parseFloat(String(c.memberBalance)).toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 pb-4 border-t pt-3">
          <button className="btn-secondary w-full text-sm flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add New Customer</button>
        </div>
      </div>
    </div>
  );
}
