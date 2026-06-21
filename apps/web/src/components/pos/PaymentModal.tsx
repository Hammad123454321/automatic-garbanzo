import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, DollarSign, CreditCard, Smartphone, Gift, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';

interface PaymentModalProps { total: number; orderId?: string; storeId: string; onClose: () => void }

const QUICK_TIPS = [5, 10, 15, 18, 20];
const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', icon: DollarSign },
  { key: 'CREDIT_CARD', label: 'Card', icon: CreditCard },
  { key: 'DEBIT_CARD', label: 'Debit', icon: CreditCard },
  { key: 'APPLE_PAY', label: 'Apple Pay', icon: Smartphone },
  { key: 'GOOGLE_PAY', label: 'Google Pay', icon: Smartphone },
  { key: 'GIFT_CARD', label: 'Gift Card', icon: Gift },
];

export default function PaymentModal({ total, orderId, storeId, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [tipPct, setTipPct] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [success, setSuccess] = useState(false);
  const [change, setChange] = useState(0);

  const tipAmount = customTip ? parseFloat(customTip) : total * (tipPct / 100);
  const grandTotal = total + tipAmount;
  const cashChange = parseFloat(cashGiven || '0') - grandTotal;

  const paymentMutation = useMutation({
    mutationFn: (body: unknown) => api.post('/payments', body),
    onSuccess: (res) => {
      setChange(parseFloat(String(res.data.data?.order?.changeAmount || 0)));
      setSuccess(true);
      toast.success('Payment processed!');
    },
    onError: (e) => toast.error(extractError(e)),
  });

  const quickCash = [Math.ceil(grandTotal), Math.ceil(grandTotal / 5) * 5, Math.ceil(grandTotal / 10) * 10, Math.ceil(grandTotal / 20) * 20].filter((v, i, a) => a.indexOf(v) === i);

  function processPayment() {
    if (!orderId) { toast.error('No order ID — place order first'); return; }
    if (method === 'CASH' && parseFloat(cashGiven || '0') < grandTotal) { toast.error('Insufficient cash amount'); return; }
    paymentMutation.mutate({ orderId, method, amount: grandTotal, tipAmount: tipAmount > 0 ? tipAmount : 0 });
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-10 text-center max-w-sm w-full mx-4">
          <CheckCircle className="w-20 h-20 text-success-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Payment Complete</h2>
          <p className="text-gray-500 mb-4">{method.replace(/_/g, ' ')}</p>
          <p className="text-3xl font-bold text-success-600 mb-2">${grandTotal.toFixed(2)}</p>
          {method === 'CASH' && change >= 0 && (
            <div className="bg-success-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-success-600 mb-1">Change due</p>
              <p className="text-3xl font-bold text-success-700">${change.toFixed(2)}</p>
            </div>
          )}
          <button onClick={onClose} className="btn-primary w-full btn-lg">Done — New Sale</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Payment — ${grandTotal.toFixed(2)}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Tips */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Tip</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setTipPct(0); setCustomTip(''); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${tipPct === 0 && !customTip ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200'}`}>No Tip</button>
              {QUICK_TIPS.map((p) => (
                <button key={p} onClick={() => { setTipPct(p); setCustomTip(''); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${tipPct === p && !customTip ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200'}`}>{p}%</button>
              ))}
              <input className="w-24 px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:border-primary-400 focus:outline-none" type="number" step="0.01" placeholder="Custom $" value={customTip} onChange={(e) => { setCustomTip(e.target.value); setTipPct(0); }} />
            </div>
            {tipAmount > 0 && <p className="text-sm text-gray-500 mt-1.5">Tip: ${tipAmount.toFixed(2)}</p>}
          </div>

          {/* Payment method */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setMethod(key)} className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-medium text-xs transition-all ${method === key ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <Icon className="w-5 h-5" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash given */}
          {method === 'CASH' && (
            <div>
              <label className="label">Cash Given</label>
              <input className="input text-lg font-bold" type="number" step="0.01" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} placeholder="0.00" autoFocus />
              <div className="flex gap-2 mt-2">
                {quickCash.map((a) => (
                  <button key={a} onClick={() => setCashGiven(String(a))} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">${a}</button>
                ))}
              </div>
              {cashGiven && parseFloat(cashGiven) >= grandTotal && (
                <div className="mt-2 p-3 bg-success-50 rounded-xl text-center">
                  <p className="text-sm text-success-600">Change: <span className="text-lg font-bold">${cashChange.toFixed(2)}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Gift card */}
          {method === 'GIFT_CARD' && (
            <div>
              <label className="label">Gift Card Code</label>
              <input className="input" value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} placeholder="Enter code or scan" />
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button onClick={processPayment} disabled={paymentMutation.isPending} className="btn-success w-full btn-lg text-base">
            {paymentMutation.isPending ? 'Processing…' : `Charge $${grandTotal.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
