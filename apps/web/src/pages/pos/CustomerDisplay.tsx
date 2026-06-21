import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

interface CartItem { name: string; quantity: number; unitPrice: number; modifierTotal: number }
interface DisplayState { items: CartItem[]; subtotal: number; tax: number; total: number; tip: number; storeName?: string; logoUrl?: string; businessMode?: string }

export default function CustomerDisplayPage() {
  const [state, setState] = useState<DisplayState | null>(null);
  const storeId = new URLSearchParams(window.location.search).get('storeId');

  useEffect(() => {
    if (!storeId) return;
    const socket = io({ query: { storeId } });
    socket.on('customer-display:update', (data: DisplayState) => setState(data));
    return () => { socket.disconnect(); };
  }, [storeId]);

  if (!state) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 to-gray-900 flex flex-col items-center justify-center text-white">
        <div className="text-6xl mb-6">🛍️</div>
        <h1 className="text-3xl font-bold">Welcome</h1>
        <p className="text-gray-400 mt-2 text-lg">Scan or tap to start</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-primary-700 text-white px-8 py-5">
        <h1 className="text-2xl font-bold">{state.storeName || 'Your Order'}</h1>
      </div>

      {/* Order Items */}
      <div className="flex-1 p-6">
        <div className="max-w-lg mx-auto">
          <div className="card overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50"><th className="px-4 py-3 text-left font-semibold text-gray-600">Item</th><th className="px-4 py-3 text-center font-semibold text-gray-600">Qty</th><th className="px-4 py-3 text-right font-semibold text-gray-600">Price</th></tr></thead>
              <tbody>
                {state.items.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-bold">${((item.unitPrice + item.modifierTotal) * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
                {!state.items.length && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-300 text-lg">Add items to order</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="card p-5 space-y-2">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>${state.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Tax</span><span>${state.tax.toFixed(2)}</span></div>
            {state.tip > 0 && <div className="flex justify-between text-gray-600"><span>Tip</span><span>${state.tip.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-2xl pt-2 border-t border-gray-200 text-gray-900">
              <span>Total</span>
              <span className="text-primary-600">${state.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
