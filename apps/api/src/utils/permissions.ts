// All system permissions
export const PERMISSIONS = {
  // Checkout
  CHECKOUT: 'checkout',
  PRICE_OVERRIDE: 'price_override',
  APPLY_DISCOUNT: 'apply_discount',
  APPLY_ORDER_DISCOUNT: 'apply_order_discount',
  VOID_ORDER: 'void_order',
  HOLD_ORDER: 'hold_order',

  // Refunds
  FULL_REFUND: 'full_refund',
  PARTIAL_REFUND: 'partial_refund',

  // Products
  VIEW_PRODUCTS: 'view_products',
  MANAGE_PRODUCTS: 'manage_products',
  VIEW_COST: 'view_cost',

  // Orders
  VIEW_ALL_ORDERS: 'view_all_orders',
  VIEW_OWN_ORDERS: 'view_own_orders',
  MANAGE_ORDERS: 'manage_orders',

  // Staff
  VIEW_STAFF: 'view_staff',
  MANAGE_STAFF: 'manage_staff',
  MANAGE_ROLES: 'manage_roles',

  // Reports
  VIEW_REPORTS: 'view_reports',
  VIEW_FINANCIAL_REPORTS: 'view_financial_reports',

  // Inventory
  VIEW_INVENTORY: 'view_inventory',
  MANAGE_INVENTORY: 'manage_inventory',

  // Customers
  VIEW_CUSTOMERS: 'view_customers',
  MANAGE_CUSTOMERS: 'manage_customers',

  // Settings
  MANAGE_STORE: 'manage_store',
  MANAGE_PRINTERS: 'manage_printers',
  MANAGE_DEVICES: 'manage_devices',
  MANAGE_PAYMENT_METHODS: 'manage_payment_methods',

  // Payroll
  VIEW_PAYROLL: 'view_payroll',
  MANAGE_PAYROLL: 'manage_payroll',

  // Tips
  ADD_TIP: 'add_tip',
  VIEW_TIP_REPORTS: 'view_tip_reports',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DEFINITIONS = [
  { key: PERMISSIONS.CHECKOUT, name: 'Checkout', description: 'Process sales', module: 'register' },
  { key: PERMISSIONS.PRICE_OVERRIDE, name: 'Price Override', description: 'Manually change item prices', module: 'register' },
  { key: PERMISSIONS.APPLY_DISCOUNT, name: 'Apply Item Discount', description: 'Apply discounts to individual items', module: 'register' },
  { key: PERMISSIONS.APPLY_ORDER_DISCOUNT, name: 'Apply Order Discount', description: 'Apply discounts to entire orders', module: 'register' },
  { key: PERMISSIONS.VOID_ORDER, name: 'Void Order', description: 'Cancel/void an order', module: 'register' },
  { key: PERMISSIONS.HOLD_ORDER, name: 'Hold Order', description: 'Place orders on hold', module: 'register' },
  { key: PERMISSIONS.FULL_REFUND, name: 'Full Refund', description: 'Process full refunds', module: 'payments' },
  { key: PERMISSIONS.PARTIAL_REFUND, name: 'Partial Refund', description: 'Process partial refunds', module: 'payments' },
  { key: PERMISSIONS.VIEW_PRODUCTS, name: 'View Products', description: 'View product catalog', module: 'products' },
  { key: PERMISSIONS.MANAGE_PRODUCTS, name: 'Manage Products', description: 'Create/edit/delete products', module: 'products' },
  { key: PERMISSIONS.VIEW_COST, name: 'View Cost Price', description: 'See cost/margin info', module: 'products' },
  { key: PERMISSIONS.VIEW_ALL_ORDERS, name: 'View All Orders', description: 'See all orders, not just own', module: 'orders' },
  { key: PERMISSIONS.VIEW_OWN_ORDERS, name: 'View Own Orders', description: 'See orders created by self', module: 'orders' },
  { key: PERMISSIONS.MANAGE_ORDERS, name: 'Manage Orders', description: 'Edit/split/merge orders', module: 'orders' },
  { key: PERMISSIONS.VIEW_STAFF, name: 'View Staff', description: 'See staff list', module: 'staff' },
  { key: PERMISSIONS.MANAGE_STAFF, name: 'Manage Staff', description: 'Create/edit staff accounts', module: 'staff' },
  { key: PERMISSIONS.MANAGE_ROLES, name: 'Manage Roles', description: 'Create/edit roles and permissions', module: 'staff' },
  { key: PERMISSIONS.VIEW_REPORTS, name: 'View Reports', description: 'Access sales reports', module: 'reports' },
  { key: PERMISSIONS.VIEW_FINANCIAL_REPORTS, name: 'Financial Reports', description: 'Access financial/accounting reports', module: 'reports' },
  { key: PERMISSIONS.VIEW_INVENTORY, name: 'View Inventory', description: 'See inventory levels', module: 'inventory' },
  { key: PERMISSIONS.MANAGE_INVENTORY, name: 'Manage Inventory', description: 'Adjust stock levels', module: 'inventory' },
  { key: PERMISSIONS.VIEW_CUSTOMERS, name: 'View Customers', description: 'Access customer list', module: 'customers' },
  { key: PERMISSIONS.MANAGE_CUSTOMERS, name: 'Manage Customers', description: 'Edit customer data', module: 'customers' },
  { key: PERMISSIONS.MANAGE_STORE, name: 'Store Settings', description: 'Configure store settings', module: 'settings' },
  { key: PERMISSIONS.MANAGE_PRINTERS, name: 'Manage Printers', description: 'Configure printers', module: 'settings' },
  { key: PERMISSIONS.MANAGE_DEVICES, name: 'Manage Devices', description: 'Register/configure terminals', module: 'settings' },
  { key: PERMISSIONS.MANAGE_PAYMENT_METHODS, name: 'Payment Methods', description: 'Configure payment methods', module: 'settings' },
  { key: PERMISSIONS.VIEW_PAYROLL, name: 'View Payroll', description: 'See payroll records', module: 'payroll' },
  { key: PERMISSIONS.MANAGE_PAYROLL, name: 'Manage Payroll', description: 'Process payroll', module: 'payroll' },
  { key: PERMISSIONS.ADD_TIP, name: 'Add Tip', description: 'Add tip to orders', module: 'payments' },
  { key: PERMISSIONS.VIEW_TIP_REPORTS, name: 'View Tip Reports', description: 'See tip reports', module: 'reports' },
];
