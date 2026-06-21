// Shared types and constants across API and Web packages

export type BusinessMode = 'RETAIL' | 'RESTAURANT' | 'BEAUTY';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'VOIDED' | 'REFUNDED';
export type OrderType = 'COUNTER' | 'DINE_IN' | 'TAKEOUT' | 'DELIVERY' | 'ONLINE';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'GIFT_CARD' | 'MEMBER_BALANCE' | 'LOYALTY_POINTS' | 'EXTERNAL';
export type InventoryAction = 'RESTOCK' | 'SALE' | 'ADJUSTMENT' | 'WASTE' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'DAMAGE';
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export const PERMISSION_KEYS = [
  'orders.create', 'orders.view', 'orders.void', 'orders.refund', 'orders.discount',
  'products.create', 'products.edit', 'products.delete', 'products.view',
  'customers.view', 'customers.edit', 'customers.delete',
  'inventory.view', 'inventory.adjust', 'inventory.purchase_orders',
  'staff.view', 'staff.create', 'staff.edit', 'staff.delete',
  'roles.manage', 'reports.view', 'reports.export',
  'timeclock.view', 'timeclock.manage', 'payroll.view', 'payroll.manage',
  'settings.view', 'settings.edit',
  'tables.manage', 'appointments.manage', 'gift_cards.manage',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

export const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
};

export const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', options).format(new Date(date));
}

export function calcTax(subtotal: number, rate: number): number {
  return Math.round(subtotal * rate * 100) / 100;
}
