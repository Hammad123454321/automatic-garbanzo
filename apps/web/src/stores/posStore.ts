import { create } from 'zustand';

export interface CartItem {
  id: string;
  productId?: string;
  menuItemId?: string;
  serviceId?: string;
  name: string;
  nameZh?: string;
  quantity: number;
  unitPrice: number;
  modifiers: CartModifier[];
  modifierTotal: number;
  taxRate: number;
  notes?: string;
  staffId?: string;
  printerId?: string;
}

export interface CartModifier {
  modifierOptionId: string;
  name: string;
  priceAdjustment: number;
}

export interface CartDiscount {
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
}

interface PosState {
  storeId: string | null;
  deviceId: string | null;
  businessMode: 'RETAIL' | 'RESTAURANT' | 'BEAUTY';
  tableId: string | null;
  tableNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  orderType: string;
  items: CartItem[];
  discounts: CartDiscount[];
  notes: string;
  tipAmount: number;
  heldOrderId: string | null;

  setStore: (storeId: string, deviceId?: string) => void;
  setBusinessMode: (mode: 'RETAIL' | 'RESTAURANT' | 'BEAUTY') => void;
  setTable: (tableId: string | null, tableNumber: string | null) => void;
  setCustomer: (customerId: string | null, customerName: string | null) => void;
  setOrderType: (type: string) => void;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateItem: (id: string, updates: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  addDiscount: (discount: CartDiscount) => void;
  removeDiscount: (index: number) => void;
  setTip: (amount: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
  loadHeldOrder: (orderId: string, items: CartItem[]) => void;

  // Computed
  subtotal: () => number;
  taxAmount: (taxRate: number) => number;
  discountAmount: () => number;
  total: (taxRate: number) => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  storeId: null,
  deviceId: null,
  businessMode: 'RETAIL',
  tableId: null,
  tableNumber: null,
  customerId: null,
  customerName: null,
  orderType: 'COUNTER',
  items: [],
  discounts: [],
  notes: '',
  tipAmount: 0,
  heldOrderId: null,

  setStore: (storeId, deviceId) => set({ storeId, deviceId }),
  setBusinessMode: (businessMode) => set({ businessMode }),
  setTable: (tableId, tableNumber) => set({ tableId, tableNumber }),
  setCustomer: (customerId, customerName) => set({ customerId, customerName }),
  setOrderType: (orderType) => set({ orderType }),
  setNotes: (notes) => set({ notes }),
  setTip: (tipAmount) => set({ tipAmount }),

  addItem: (item) =>
    set((state) => {
      // Merge same item without modifiers
      if (!item.modifiers.length) {
        const existing = state.items.find((i) => (i.productId && i.productId === item.productId) || (i.menuItemId && i.menuItemId === item.menuItemId) || (i.serviceId && i.serviceId === item.serviceId));
        if (existing) {
          return { items: state.items.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i) };
        }
      }
      return { items: [...state.items, { ...item, id: crypto.randomUUID() }] };
    }),

  updateItem: (id, updates) =>
    set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),

  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

  updateQuantity: (id, quantity) =>
    set((state) => ({
      items: quantity <= 0 ? state.items.filter((i) => i.id !== id) : state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
    })),

  addDiscount: (discount) => set((state) => ({ discounts: [...state.discounts, discount] })),
  removeDiscount: (index) => set((state) => ({ discounts: state.discounts.filter((_, i) => i !== index) })),

  clearCart: () => set({ items: [], discounts: [], notes: '', tipAmount: 0, tableId: null, tableNumber: null, customerId: null, customerName: null, heldOrderId: null, orderType: 'COUNTER' }),

  loadHeldOrder: (orderId, items) => set({ items, heldOrderId: orderId }),

  subtotal: () => get().items.reduce((sum, item) => sum + (item.unitPrice + item.modifierTotal) * item.quantity, 0),

  discountAmount: () => {
    const sub = get().subtotal();
    return get().discounts.reduce((sum, d) => sum + (d.type === 'percentage' ? sub * (d.value / 100) : d.value), 0);
  },

  taxAmount: (taxRate) => {
    const sub = get().subtotal() - get().discountAmount();
    return sub * taxRate;
  },

  total: (taxRate) => {
    const sub = get().subtotal();
    const disc = get().discountAmount();
    const tax = (sub - disc) * taxRate;
    return sub - disc + tax + get().tipAmount;
  },
}));
