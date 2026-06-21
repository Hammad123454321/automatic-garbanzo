import { useState } from 'react';
import { X, Percent, DollarSign } from 'lucide-react';

interface Discount { name: string; type: 'percentage' | 'fixed'; value: number }
interface Props { onAdd: (d: Discount) => void; onClose: () => void }

const QUICK_DISCOUNTS = [
  { name: '10% Off', type: 'percentage' as const, value: 10 },
  { name: '15% Off', type: 'percentage' as const, value: 15 },
  { name: '20% Off', type: 'percentage' as const, value: 20 },
  { name: '50% Off', type: 'percentage' as const, value: 50 },
];

export default function DiscountModal({ onAdd, onClose }: Props) {
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [name, setName] = useState('');

  function apply() {
    const val = parseFloat(value);
    if (!val || val <= 0) return;
    onAdd({ name: name || (type === 'percentage' ? `${val}% Off` : `$${val} Off`), type, value: val });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900">Apply Discount</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setType('percentage')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${type === 'percentage' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}><Percent className="w-4 h-4" /> Percent</button>
            <button onClick={() => setType('fixed')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${type === 'fixed' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}><DollarSign className="w-4 h-4" /> Fixed</button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {QUICK_DISCOUNTS.filter((d) => d.type === type).map((d) => (
              <button key={d.name} onClick={() => onAdd(d)} className="py-3 border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 rounded-xl text-sm font-medium text-gray-700 hover:text-primary-700 transition-all">{d.name}</button>
            ))}
          </div>

          <div>
            <label className="label">Custom Value {type === 'percentage' ? '(%)' : '($)'}</label>
            <input className="input text-xl font-bold" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'percentage' ? '0' : '0.00'} autoFocus />
          </div>
          <div>
            <label className="label">Label (optional)</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Staff discount" />
          </div>
          <button onClick={apply} disabled={!value} className="btn-primary w-full">Apply Discount</button>
        </div>
      </div>
    </div>
  );
}
