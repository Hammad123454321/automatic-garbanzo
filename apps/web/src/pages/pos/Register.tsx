import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, X, Plus, Minus, Trash2, User, Tag, CreditCard, DollarSign, ChevronRight, Percent, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePosStore } from '@/stores/posStore';
import PaymentModal from '@/components/pos/PaymentModal';
import CustomerSearch from '@/components/pos/CustomerSearch';
import DiscountModal from '@/components/pos/DiscountModal';

interface Category { id: string; name: string; nameZh?: string }
interface Product { id: string; name: string; nameZh?: string; price: number; type: string; isActive: boolean; categoryId?: string; modifierGroups?: ModifierGroupWithOptions[] }
interface ModifierGroupWithOptions { modifierGroupId: string; modifierGroup: { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; options: ModifierOption[] } }
interface ModifierOption { id: string; name: string; priceAdjustment: number }

export default function RegisterPage() {
  const { user } = useAuthStore();
  const storeId = user?.storeId!;
  const store2 = usePosStore();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('');
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [taxRate, setTaxRate] = useState(0.085);

  // Fetch store tax rate
  useQuery({ queryKey: ['store', storeId], queryFn: () => api.get(`/stores/${storeId}`).then((r) => r.data.data), enabled: !!storeId, onSuccess: (d: { taxRate: number }) => setTaxRate(parseFloat(String(d.taxRate))) });

  const { data: cats } = useQuery<Category[]>({ queryKey: ['categories', storeId], queryFn: () => api.get(`/products/categories?storeId=${storeId}`).then((r) => r.data.data), enabled: !!storeId });

  const { data: productsData } = useQuery({
    queryKey: ['pos-products', storeId, activeCat, search],
    queryFn: () => api.get(`/products?storeId=${storeId}&categoryId=${activeCat}&search=${search}&active=true&limit=200`).then((r) => r.data.data),
    enabled: !!storeId,
  });

  const orderMutation = useMutation({
    mutationFn: (body: unknown) => api.post('/orders', body),
    onError: (e) => toast.error(extractError(e)),
  });

  const products: Product[] = productsData || [];
  const filteredProducts = search ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) : products;

  function addToCart(product: Product) {
    if (product.modifierGroups?.some((mg) => mg.modifierGroup.required)) {
      setSelectedProduct(product);
      return;
    }
    store2.addItem({ productId: product.id, name: product.name, nameZh: product.nameZh, quantity: 1, unitPrice: parseFloat(String(product.price)), modifiers: [], modifierTotal: 0, taxRate });
    toast.success(`Added ${product.name}`, { duration: 800, icon: '✓' });
  }

  function addWithModifiers(product: Product, mods: { modifierOptionId: string; name: string; priceAdjustment: number }[]) {
    const modTotal = mods.reduce((s, m) => s + m.priceAdjustment, 0);
    store2.addItem({ productId: product.id, name: product.name, nameZh: product.nameZh, quantity: 1, unitPrice: parseFloat(String(product.price)), modifiers: mods, modifierTotal: modTotal, taxRate });
    setSelectedProduct(null);
  }

  async function placeOrder() {
    if (!store2.items.length) { toast.error('Cart is empty'); return; }
    const orderData = {
      storeId, deviceId: store2.deviceId,
      type: store2.orderType,
      tableId: store2.tableId, tableNumber: store2.tableNumber,
      customerId: store2.customerId,
      notes: store2.notes,
      items: store2.items.map((i) => ({
        productId: i.productId, menuItemId: i.menuItemId, serviceId: i.serviceId,
        name: i.name, nameZh: i.nameZh,
        quantity: i.quantity, unitPrice: i.unitPrice, taxRate,
        modifiers: i.modifiers,
        notes: i.notes,
      })),
      discounts: store2.discounts,
    };
    const res = await orderMutation.mutateAsync(orderData);
    if (res?.data?.data) {
      setShowPayment(true);
    }
  }

  const subtotal = store2.subtotal();
  const discountAmt = store2.discountAmount();
  const taxAmt = store2.taxAmount(taxRate);
  const total = store2.total(taxRate);

  return (
    <div className="flex h-full overflow-hidden bg-gray-100">
      {/* Left: Catalog */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Search */}
        <div className="bg-white border-b px-3 py-2 flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400 bg-gray-50" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Category tabs */}
        <div className="bg-white border-b overflow-x-auto scrollbar-thin shrink-0">
          <div className="flex px-3 py-1.5 gap-1">
            <button onClick={() => setActiveCat('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCat === '' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>All</button>
            {cats?.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCat === c.id ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>{c.name}</button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {!filteredProducts.length ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <ShoppingBag className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredProducts.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)} className="pos-key p-3 h-20 text-center gap-1 hover:shadow-md">
                  <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{p.name}</span>
                  <span className="text-primary-600 font-bold text-sm">${parseFloat(String(p.price)).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 xl:w-96 flex flex-col bg-white border-l shadow-sm shrink-0">
        {/* Cart header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold text-gray-800">Cart {store2.items.length > 0 && <span className="ml-1 w-5 h-5 bg-primary-500 text-white text-xs rounded-full inline-flex items-center justify-center">{store2.items.reduce((s, i) => s + i.quantity, 0)}</span>}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowCustomer(true)} className={`p-1.5 rounded-lg transition-all ${store2.customerId ? 'text-primary-600 bg-primary-50' : 'text-gray-400 hover:bg-gray-100'}`} title="Set customer">
              <User className="w-4 h-4" />
            </button>
            <button onClick={() => setShowDiscount(true)} className={`p-1.5 rounded-lg transition-all ${store2.discounts.length > 0 ? 'text-warning-600 bg-warning-50' : 'text-gray-400 hover:bg-gray-100'}`} title="Add discount">
              <Percent className="w-4 h-4" />
            </button>
            {store2.items.length > 0 && (
              <button onClick={() => { if (confirm('Clear cart?')) store2.clearCart(); }} className="p-1.5 rounded-lg text-danger-400 hover:bg-danger-50">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Customer banner */}
        {store2.customerName && (
          <div className="mx-3 mt-2 flex items-center gap-2 bg-primary-50 rounded-lg px-3 py-2 text-sm">
            <User className="w-3.5 h-3.5 text-primary-500" />
            <span className="font-medium text-primary-700">{store2.customerName}</span>
            <button onClick={() => store2.setCustomer(null, null)} className="ml-auto text-primary-400 hover:text-primary-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {store2.items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-300">
              <ShoppingBag className="w-10 h-10 mb-2" />
              <p className="text-sm">Cart is empty</p>
            </div>
          )}
          {store2.items.map((item) => (
            <div key={item.id} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {item.modifiers.map((m, mi) => (
                    <p key={mi} className="text-xs text-gray-500">+ {m.name}{m.priceAdjustment > 0 ? ` ($${m.priceAdjustment.toFixed(2)})` : ''}</p>
                  ))}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">${((item.unitPrice + item.modifierTotal) * item.quantity).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">${(item.unitPrice + item.modifierTotal).toFixed(2)} each</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => store2.updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center hover:bg-gray-300"><Minus className="w-3 h-3" /></button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                  <button onClick={() => store2.updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center hover:bg-primary-200"><Plus className="w-3 h-3" /></button>
                </div>
                <button onClick={() => store2.removeItem(item.id)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-danger-500"><X className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Discounts */}
        {store2.discounts.length > 0 && (
          <div className="px-3 py-2 border-t space-y-1">
            {store2.discounts.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-warning-600">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{d.name} {d.type === 'percentage' ? `(${d.value}%)` : `($${d.value})`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-danger-600 font-medium">-${(d.type === 'percentage' ? subtotal * d.value / 100 : d.value).toFixed(2)}</span>
                  <button onClick={() => store2.removeDiscount(i)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="px-4 py-3 border-t space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {discountAmt > 0 && <div className="flex justify-between text-sm text-danger-600"><span>Discount</span><span>-${discountAmt.toFixed(2)}</span></div>}
          <div className="flex justify-between text-sm text-gray-600"><span>Tax ({(taxRate * 100).toFixed(1)}%)</span><span>${taxAmt.toFixed(2)}</span></div>
          {store2.tipAmount > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Tip</span><span>${store2.tipAmount.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold text-lg border-t pt-2 mt-1"><span>Total</span><span className="text-primary-600">${total.toFixed(2)}</span></div>
        </div>

        {/* Actions */}
        <div className="px-3 pb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => store2.items.length && orderMutation.mutateAsync({ storeId, type: store2.orderType, items: store2.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, taxRate, modifiers: i.modifiers })), discounts: store2.discounts, customerId: store2.customerId }).then(() => store2.clearCart())}
              className="btn-secondary text-sm flex items-center justify-center gap-1.5" disabled={!store2.items.length}>
              Hold Order
            </button>
            <button className="btn-secondary text-sm" onClick={() => { setShowDiscount(true); }}>
              <Tag className="w-3.5 h-3.5" /> Discount
            </button>
          </div>
          <button onClick={placeOrder} disabled={!store2.items.length || orderMutation.isPending} className="btn-primary w-full btn-lg">
            {orderMutation.isPending ? 'Processing…' : (
              <><CreditCard className="w-5 h-5" /> Charge ${total.toFixed(2)}</>
            )}
          </button>
        </div>
      </div>

      {/* Modals */}
      {showPayment && (
        <PaymentModal total={total} orderId={orderMutation.data?.data?.data?.id} storeId={storeId} onClose={() => { setShowPayment(false); store2.clearCart(); }} />
      )}
      {showCustomer && (
        <CustomerSearch merchantId={user?.merchantId!} onSelect={(c) => { store2.setCustomer(c.id, `${c.firstName} ${c.lastName || ''}`); setShowCustomer(false); }} onClose={() => setShowCustomer(false)} />
      )}
      {showDiscount && (
        <DiscountModal onAdd={(d) => { store2.addDiscount(d); setShowDiscount(false); }} onClose={() => setShowDiscount(false)} />
      )}

      {/* Modifier Modal */}
      {selectedProduct && (
        <ModifierModal product={selectedProduct} onAdd={addWithModifiers} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}

function ModifierModal({ product, onAdd, onClose }: { product: Product; onAdd: (p: Product, m: { modifierOptionId: string; name: string; priceAdjustment: number }[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  function toggleOption(groupId: string, optionId: string, maxSelect: number) {
    setSelected((prev) => {
      const current = prev[groupId] || [];
      if (current.includes(optionId)) return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      if (maxSelect === 1) return { ...prev, [groupId]: [optionId] };
      if (current.length < maxSelect) return { ...prev, [groupId]: [...current, optionId] };
      return prev;
    });
  }

  function handleAdd() {
    const mods: { modifierOptionId: string; name: string; priceAdjustment: number }[] = [];
    for (const mg of product.modifierGroups || []) {
      const group = mg.modifierGroup;
      if (group.required && !(selected[group.id]?.length)) { toast.error(`Please select ${group.name}`); return; }
      for (const optId of selected[group.id] || []) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) mods.push({ modifierOptionId: opt.id, name: opt.name, priceAdjustment: parseFloat(String(opt.priceAdjustment)) });
      }
    }
    onAdd(product, mods);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h3 className="font-bold text-lg">{product.name}</h3><p className="text-primary-600 font-semibold">${parseFloat(String(product.price)).toFixed(2)}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {(product.modifierGroups || []).map((mg) => (
            <div key={mg.modifierGroupId}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-gray-900">{mg.modifierGroup.name}</h4>
                {mg.modifierGroup.required && <span className="badge-red text-xs">Required</span>}
                {mg.modifierGroup.maxSelect > 1 && <span className="text-xs text-gray-400">Pick up to {mg.modifierGroup.maxSelect}</span>}
              </div>
              <div className="space-y-1">
                {mg.modifierGroup.options.map((opt) => {
                  const isSelected = (selected[mg.modifierGroup.id] || []).includes(opt.id);
                  return (
                    <button key={opt.id} onClick={() => toggleOption(mg.modifierGroup.id, opt.id, mg.modifierGroup.maxSelect)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all ${isSelected ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-sm font-medium">{opt.name}</span>
                      {parseFloat(String(opt.priceAdjustment)) > 0 && <span className="text-sm text-primary-600 font-medium">+${parseFloat(String(opt.priceAdjustment)).toFixed(2)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 border-t">
          <button onClick={handleAdd} className="btn-primary w-full btn-lg">Add to Cart <ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}
