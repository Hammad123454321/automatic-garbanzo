import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: 'orders.create',             name: 'Create Orders',             module: 'Orders' },
  { key: 'orders.view',               name: 'View Orders',               module: 'Orders' },
  { key: 'orders.void',               name: 'Void Orders',               module: 'Orders' },
  { key: 'orders.refund',             name: 'Process Refunds',           module: 'Orders' },
  { key: 'orders.discount',           name: 'Apply Discounts',           module: 'Orders' },
  { key: 'products.create',           name: 'Create Products',           module: 'Products' },
  { key: 'products.edit',             name: 'Edit Products',             module: 'Products' },
  { key: 'products.delete',           name: 'Delete Products',           module: 'Products' },
  { key: 'products.view',             name: 'View Products',             module: 'Products' },
  { key: 'customers.view',            name: 'View Customers',            module: 'Customers' },
  { key: 'customers.edit',            name: 'Edit Customers',            module: 'Customers' },
  { key: 'customers.delete',          name: 'Delete Customers',          module: 'Customers' },
  { key: 'inventory.view',            name: 'View Inventory',            module: 'Inventory' },
  { key: 'inventory.adjust',          name: 'Adjust Inventory',          module: 'Inventory' },
  { key: 'inventory.purchase_orders', name: 'Manage Purchase Orders',    module: 'Inventory' },
  { key: 'staff.view',                name: 'View Staff',                module: 'Staff' },
  { key: 'staff.create',              name: 'Create Staff',              module: 'Staff' },
  { key: 'staff.edit',                name: 'Edit Staff',                module: 'Staff' },
  { key: 'staff.delete',              name: 'Delete Staff',              module: 'Staff' },
  { key: 'roles.manage',              name: 'Manage Roles',              module: 'Staff' },
  { key: 'reports.view',              name: 'View Reports',              module: 'Reports' },
  { key: 'reports.export',            name: 'Export Reports',            module: 'Reports' },
  { key: 'timeclock.view',            name: 'View Time Clock',           module: 'Payroll' },
  { key: 'timeclock.manage',          name: 'Manage Time Clock',         module: 'Payroll' },
  { key: 'payroll.view',              name: 'View Payroll',              module: 'Payroll' },
  { key: 'payroll.manage',            name: 'Manage Payroll',            module: 'Payroll' },
  { key: 'settings.view',             name: 'View Settings',             module: 'Settings' },
  { key: 'settings.edit',             name: 'Edit Settings',             module: 'Settings' },
  { key: 'tables.manage',             name: 'Manage Tables',             module: 'Restaurant' },
  { key: 'appointments.manage',       name: 'Manage Appointments',       module: 'Salon' },
  { key: 'gift_cards.manage',         name: 'Manage Gift Cards',         module: 'Customers' },
];

async function upsertFlag(merchantId: string, featureKey: string) {
  const existing = await prisma.merchantFeatureFlag.findFirst({ where: { merchantId, featureKey, storeId: null } });
  if (!existing) await prisma.merchantFeatureFlag.create({ data: { merchantId, featureKey, enabled: true, storeId: null } });
  else await prisma.merchantFeatureFlag.update({ where: { id: existing.id }, data: { enabled: true } });
}

async function main() {
  console.log('🌱  Seeding database…');

  // ── 1. Permissions ───────────────────────────────────────────────────────
  console.log('  [1/9] Creating permissions…');
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { name: p.name, module: p.module },
      create: { key: p.key, name: p.name, module: p.module },
    });
  }

  // ── 2. Super Admin ────────────────────────────────────────────────────────
  console.log('  [2/9] Creating super admin…');
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@pos.local';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin1234!';
  await prisma.superAdmin.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      password: await bcrypt.hash(superAdminPassword, 12),
      name: 'Super Admin',
    },
  });

  // ── 3. Retail Merchant + Store ────────────────────────────────────────────
  console.log('  [3/9] Creating retail merchant…');
  let retailMerchant = await prisma.merchant.findFirst({ where: { email: 'owner@demo-retail.com' } });
  if (!retailMerchant) {
    retailMerchant = await prisma.merchant.create({
      data: { name: 'Demo Retail Store', email: 'owner@demo-retail.com', phone: '555-0100', isActive: true, billingPlan: 'pro' },
    });
  }

  for (const key of ['loyalty', 'gift_cards', 'online_ordering', 'ai_features', 'advanced_reports', 'multi_location', 'payroll', 'kds']) {
    await upsertFlag(retailMerchant.id, key);
  }

  let retailStore = await prisma.store.findFirst({ where: { merchantId: retailMerchant.id, name: 'Main Store' } });
  if (!retailStore) {
    retailStore = await prisma.store.create({
      data: {
        merchantId: retailMerchant.id,
        name: 'Main Store',
        businessMode: 'RETAIL',
        address: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        timezone: 'America/New_York',
        currency: 'USD',
        taxRate: 0.0875,
        taxName: 'Sales Tax',
        receiptHeader: 'Welcome to Demo Retail Store!',
        receiptFooter: 'Thank you for shopping with us. Come back soon!',
        onlineEnabled: true,
        isActive: true,
      },
    });
  }

  // ── 4. Roles ──────────────────────────────────────────────────────────────
  console.log('  [4/9] Creating roles and permissions…');
  const allPerms = await prisma.permission.findMany();

  const managerRole = await prisma.role.upsert({
    where: { merchantId_name: { merchantId: retailMerchant.id, name: 'Manager' } },
    update: {},
    create: { merchantId: retailMerchant.id, name: 'Manager', isDefault: false },
  });

  const cashierRole = await prisma.role.upsert({
    where: { merchantId_name: { merchantId: retailMerchant.id, name: 'Cashier' } },
    update: {},
    create: { merchantId: retailMerchant.id, name: 'Cashier', isDefault: true },
  });

  const existingMgrPerms = await prisma.rolePermission.findMany({ where: { roleId: managerRole.id } });
  if (existingMgrPerms.length === 0) {
    await prisma.rolePermission.createMany({
      data: allPerms.map((p) => ({ roleId: managerRole.id, permissionId: p.id, granted: true })),
    });
  }

  const cashierPermKeys = ['orders.create', 'orders.view', 'orders.discount', 'products.view', 'customers.view', 'customers.edit', 'timeclock.view', 'gift_cards.manage'];
  const cashierPerms = allPerms.filter((p) => cashierPermKeys.includes(p.key));
  const existingCashPerms = await prisma.rolePermission.findMany({ where: { roleId: cashierRole.id } });
  if (existingCashPerms.length === 0) {
    await prisma.rolePermission.createMany({
      data: cashierPerms.map((p) => ({ roleId: cashierRole.id, permissionId: p.id, granted: true })),
    });
  }

  // ── 5. Staff ──────────────────────────────────────────────────────────────
  console.log('  [5/9] Creating staff…');
  let managerStaff = await prisma.staff.findFirst({ where: { merchantId: retailMerchant.id, username: 'manager' } });
  if (!managerStaff) {
    managerStaff = await prisma.staff.create({
      data: {
        merchantId: retailMerchant.id,
        firstName: 'Alex',
        lastName: 'Manager',
        email: 'manager@demo-retail.com',
        phone: '555-0101',
        username: 'manager',
        password: await bcrypt.hash('Manager123!', 12),
        pin: '1234',
        hourlyWage: 25.00,
        isActive: true,
      },
    });
  }

  let cashierStaff = await prisma.staff.findFirst({ where: { merchantId: retailMerchant.id, username: 'cashier' } });
  if (!cashierStaff) {
    cashierStaff = await prisma.staff.create({
      data: {
        merchantId: retailMerchant.id,
        firstName: 'Sam',
        lastName: 'Cashier',
        email: 'cashier@demo-retail.com',
        phone: '555-0102',
        username: 'cashier',
        password: await bcrypt.hash('Cashier123!', 12),
        pin: '5678',
        hourlyWage: 18.00,
        isActive: true,
      },
    });
  }

  for (const [staff, role] of [[managerStaff, managerRole], [cashierStaff, cashierRole]] as const) {
    const existingStore = await prisma.staffStore.findUnique({ where: { staffId_storeId: { staffId: staff.id, storeId: retailStore.id } } });
    if (!existingStore) await prisma.staffStore.create({ data: { staffId: staff.id, storeId: retailStore.id, isPrimary: true } });

    const existingRole = await prisma.staffRole.findUnique({ where: { staffId_roleId: { staffId: staff.id, roleId: role.id } } });
    if (!existingRole) await prisma.staffRole.create({ data: { staffId: staff.id, roleId: role.id } });
  }

  // ── 6. Retail Products ────────────────────────────────────────────────────
  console.log('  [6/9] Creating products…');
  let electronicsCategory = await prisma.category.findFirst({ where: { storeId: retailStore.id, name: 'Electronics' } });
  if (!electronicsCategory) electronicsCategory = await prisma.category.create({ data: { storeId: retailStore.id, name: 'Electronics', sortOrder: 1, isActive: true } });

  let clothingCategory = await prisma.category.findFirst({ where: { storeId: retailStore.id, name: 'Clothing' } });
  if (!clothingCategory) clothingCategory = await prisma.category.create({ data: { storeId: retailStore.id, name: 'Clothing', sortOrder: 2, isActive: true } });

  let foodCategory = await prisma.category.findFirst({ where: { storeId: retailStore.id, name: 'Food & Beverages' } });
  if (!foodCategory) foodCategory = await prisma.category.create({ data: { storeId: retailStore.id, name: 'Food & Beverages', sortOrder: 3, isActive: true } });

  const retailProducts = [
    { categoryId: electronicsCategory.id, name: 'Wireless Earbuds',  sku: 'ELEC-001', price: 79.99, costPrice: 35.00 },
    { categoryId: electronicsCategory.id, name: 'USB-C Cable',        sku: 'ELEC-002', price: 14.99, costPrice:  3.00 },
    { categoryId: electronicsCategory.id, name: 'Phone Case',         sku: 'ELEC-003', price: 24.99, costPrice:  5.00 },
    { categoryId: clothingCategory.id,    name: 'Classic T-Shirt',    sku: 'CLO-001',  price: 29.99, costPrice:  8.00 },
    { categoryId: clothingCategory.id,    name: 'Denim Jeans',        sku: 'CLO-002',  price: 69.99, costPrice: 25.00 },
    { categoryId: foodCategory.id,        name: 'Bottled Water',      sku: 'FOOD-001', price:  2.99, costPrice:  0.50 },
    { categoryId: foodCategory.id,        name: 'Energy Bar',         sku: 'FOOD-002', price:  3.99, costPrice:  1.00 },
    { categoryId: foodCategory.id,        name: 'Coffee Mug',         sku: 'FOOD-003', price: 12.99, costPrice:  4.00 },
  ];

  for (const p of retailProducts) {
    const existing = await prisma.product.findFirst({ where: { storeId: retailStore.id, sku: p.sku } });
    if (!existing) {
      const product = await prisma.product.create({
        data: { storeId: retailStore.id, categoryId: p.categoryId, name: p.name, sku: p.sku, price: p.price, costPrice: p.costPrice, trackInventory: true, isActive: true, lowStockAlert: 10 },
      });
      const existingInv = await prisma.inventory.findFirst({ where: { storeId: retailStore.id, productId: product.id, variantId: null } });
      if (!existingInv) await prisma.inventory.create({ data: { storeId: retailStore.id, productId: product.id, quantity: 50 } });
    }
  }

  // ── 7. Sample Customer + Gift Card ────────────────────────────────────────
  console.log('  [7/9] Creating sample customer…');
  let customer = await prisma.customer.findFirst({ where: { merchantId: retailMerchant.id, email: 'jane.doe@example.com' } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { merchantId: retailMerchant.id, firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@example.com', phone: '555-9001', loyaltyPoints: 150, memberBalance: 25.00 },
    });
  }
  const existingSC = await prisma.storeCustomer.findUnique({ where: { customerId_storeId: { customerId: customer.id, storeId: retailStore.id } } });
  if (!existingSC) await prisma.storeCustomer.create({ data: { customerId: customer.id, storeId: retailStore.id } });

  const existingGC = await prisma.giftCard.findUnique({ where: { code: 'DEMO-GC-001' } });
  if (!existingGC) {
    const giftCard = await prisma.giftCard.create({
      data: { merchantId: retailMerchant.id, code: 'DEMO-GC-001', last4: 'GC01', initialBalance: 50.00, currentBalance: 50.00, isPhysical: false },
    });
    const existingCGC = await prisma.customerGiftCard.findUnique({ where: { customerId_giftCardId: { customerId: customer.id, giftCardId: giftCard.id } } });
    if (!existingCGC) await prisma.customerGiftCard.create({ data: { customerId: customer.id, giftCardId: giftCard.id } });
  }

  // ── 8. Restaurant Demo ────────────────────────────────────────────────────
  console.log('  [8/9] Creating restaurant demo…');
  let restaurantMerchant = await prisma.merchant.findFirst({ where: { email: 'owner@demo-restaurant.com' } });
  if (!restaurantMerchant) {
    restaurantMerchant = await prisma.merchant.create({
      data: { name: 'Demo Restaurant', email: 'owner@demo-restaurant.com', phone: '555-0200', isActive: true, billingPlan: 'pro' },
    });
  }

  let restaurantStore = await prisma.store.findFirst({ where: { merchantId: restaurantMerchant.id, name: 'Demo Restaurant - Main' } });
  if (!restaurantStore) {
    restaurantStore = await prisma.store.create({
      data: { merchantId: restaurantMerchant.id, name: 'Demo Restaurant - Main', businessMode: 'RESTAURANT', address: '456 Oak Avenue', city: 'New York', state: 'NY', zipCode: '10002', country: 'US', timezone: 'America/New_York', currency: 'USD', taxRate: 0.0875, taxName: 'Sales Tax', isActive: true },
    });
  }

  // Tables
  const tables = [
    { number: '1', capacity: 4, shape: 'rect', posX: 50,  posY: 50,  width: 100, height: 80 },
    { number: '2', capacity: 2, shape: 'rect', posX: 200, posY: 50,  width: 80,  height: 80 },
    { number: '3', capacity: 6, shape: 'rect', posX: 50,  posY: 180, width: 120, height: 90 },
    { number: '4', capacity: 4, shape: 'circle', posX: 250, posY: 180, width: 90, height: 90 },
    { number: '5', capacity: 8, shape: 'rect', posX: 400, posY: 50,  width: 150, height: 100 },
    { number: 'B1', capacity: 10, shape: 'rect', posX: 400, posY: 200, width: 180, height: 80, section: 'Bar' },
  ];
  for (const t of tables) {
    const existing = await prisma.restaurantTable.findFirst({ where: { storeId: restaurantStore.id, number: t.number } });
    if (!existing) await prisma.restaurantTable.create({ data: { storeId: restaurantStore.id, ...t } });
  }

  // Menu categories
  let appetizers = await prisma.category.findFirst({ where: { storeId: restaurantStore.id, name: 'Appetizers' } });
  if (!appetizers) appetizers = await prisma.category.create({ data: { storeId: restaurantStore.id, name: 'Appetizers', sortOrder: 1, isActive: true } });

  let mains = await prisma.category.findFirst({ where: { storeId: restaurantStore.id, name: 'Main Course' } });
  if (!mains) mains = await prisma.category.create({ data: { storeId: restaurantStore.id, name: 'Main Course', sortOrder: 2, isActive: true } });

  let drinks = await prisma.category.findFirst({ where: { storeId: restaurantStore.id, name: 'Drinks' } });
  if (!drinks) drinks = await prisma.category.create({ data: { storeId: restaurantStore.id, name: 'Drinks', sortOrder: 3, isActive: true } });

  // Modifier group: Spice Level
  let spiceGroup = await prisma.modifierGroup.findFirst({ where: { storeId: restaurantStore.id, name: 'Spice Level' } });
  if (!spiceGroup) {
    spiceGroup = await prisma.modifierGroup.create({ data: { storeId: restaurantStore.id, name: 'Spice Level', required: false, minSelect: 0, maxSelect: 1, isActive: true } });
    await prisma.modifierOption.createMany({
      data: [
        { modifierGroupId: spiceGroup.id, name: 'Mild',       priceAdjustment: 0,    sortOrder: 1, isActive: true },
        { modifierGroupId: spiceGroup.id, name: 'Medium',     priceAdjustment: 0,    sortOrder: 2, isActive: true },
        { modifierGroupId: spiceGroup.id, name: 'Hot',        priceAdjustment: 0,    sortOrder: 3, isActive: true },
        { modifierGroupId: spiceGroup.id, name: 'Extra Hot',  priceAdjustment: 0.50, sortOrder: 4, isActive: true },
      ],
    });
  }

  const menuItems = [
    { categoryId: appetizers.id, name: 'Spring Rolls',     price: 8.99  },
    { categoryId: appetizers.id, name: 'Soup of the Day',  price: 6.99  },
    { categoryId: mains.id,      name: 'Grilled Salmon',   price: 24.99 },
    { categoryId: mains.id,      name: 'Ribeye Steak',     price: 34.99 },
    { categoryId: mains.id,      name: 'Pasta Primavera',  price: 16.99 },
    { categoryId: mains.id,      name: 'Chicken Burger',   price: 14.99 },
    { categoryId: drinks.id,     name: 'Fresh Lemonade',   price: 4.99  },
    { categoryId: drinks.id,     name: 'Craft Beer',       price: 6.99  },
    { categoryId: drinks.id,     name: 'House Wine',       price: 8.99  },
  ];
  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({ where: { storeId: restaurantStore.id, name: item.name } });
    if (!existing) await prisma.menuItem.create({ data: { storeId: restaurantStore.id, ...item, isActive: true, isAvailable: true } });
  }

  // Restaurant manager role
  const restManagerRole = await prisma.role.upsert({
    where: { merchantId_name: { merchantId: restaurantMerchant.id, name: 'Manager' } },
    update: {},
    create: { merchantId: restaurantMerchant.id, name: 'Manager', isDefault: false },
  });
  const existingRestMgrPerms = await prisma.rolePermission.findMany({ where: { roleId: restManagerRole.id } });
  if (existingRestMgrPerms.length === 0) {
    await prisma.rolePermission.createMany({ data: allPerms.map((p) => ({ roleId: restManagerRole.id, permissionId: p.id, granted: true })) });
  }

  let restManager = await prisma.staff.findFirst({ where: { merchantId: restaurantMerchant.id, username: 'rest.manager' } });
  if (!restManager) {
    restManager = await prisma.staff.create({
      data: { merchantId: restaurantMerchant.id, firstName: 'Jordan', lastName: 'Chef', username: 'rest.manager', password: await bcrypt.hash('Manager123!', 12), pin: '2468', hourlyWage: 28.00, isActive: true },
    });
  }
  const existingRestStore = await prisma.staffStore.findUnique({ where: { staffId_storeId: { staffId: restManager.id, storeId: restaurantStore.id } } });
  if (!existingRestStore) await prisma.staffStore.create({ data: { staffId: restManager.id, storeId: restaurantStore.id, isPrimary: true } });
  const existingRestRole = await prisma.staffRole.findUnique({ where: { staffId_roleId: { staffId: restManager.id, roleId: restManagerRole.id } } });
  if (!existingRestRole) await prisma.staffRole.create({ data: { staffId: restManager.id, roleId: restManagerRole.id } });

  // ── 9. Salon Demo ─────────────────────────────────────────────────────────
  console.log('  [9/9] Creating salon demo…');
  let salonMerchant = await prisma.merchant.findFirst({ where: { email: 'owner@demo-salon.com' } });
  if (!salonMerchant) {
    salonMerchant = await prisma.merchant.create({
      data: { name: 'Demo Beauty Salon', email: 'owner@demo-salon.com', phone: '555-0300', isActive: true, billingPlan: 'starter' },
    });
  }

  let salonStore = await prisma.store.findFirst({ where: { merchantId: salonMerchant.id, name: 'Demo Beauty Salon - Main' } });
  if (!salonStore) {
    salonStore = await prisma.store.create({
      data: { merchantId: salonMerchant.id, name: 'Demo Beauty Salon - Main', businessMode: 'BEAUTY', address: '789 Beauty Blvd', city: 'New York', state: 'NY', zipCode: '10003', country: 'US', timezone: 'America/New_York', currency: 'USD', taxRate: 0.08, taxName: 'Sales Tax', isActive: true },
    });
  }

  let salonNailCategory = await prisma.category.findFirst({ where: { storeId: salonStore.id, name: 'Nail Services' } });
  if (!salonNailCategory) salonNailCategory = await prisma.category.create({ data: { storeId: salonStore.id, name: 'Nail Services', sortOrder: 1, isActive: true } });

  let salonHairCategory = await prisma.category.findFirst({ where: { storeId: salonStore.id, name: 'Hair Services' } });
  if (!salonHairCategory) salonHairCategory = await prisma.category.create({ data: { storeId: salonStore.id, name: 'Hair Services', sortOrder: 2, isActive: true } });

  const services = [
    { categoryId: salonNailCategory.id, name: 'Basic Manicure',     price: 25.00, duration: 30,  commissionType: 'PERCENTAGE' as const, commissionRate: 0.45 },
    { categoryId: salonNailCategory.id, name: 'Gel Manicure',       price: 45.00, duration: 45,  commissionType: 'PERCENTAGE' as const, commissionRate: 0.45 },
    { categoryId: salonNailCategory.id, name: 'Pedicure',           price: 40.00, duration: 60,  commissionType: 'PERCENTAGE' as const, commissionRate: 0.45 },
    { categoryId: salonNailCategory.id, name: 'Full Set Acrylic',   price: 65.00, duration: 90,  commissionType: 'PERCENTAGE' as const, commissionRate: 0.45 },
    { categoryId: salonHairCategory.id, name: 'Haircut',            price: 35.00, duration: 30,  commissionType: 'PERCENTAGE' as const, commissionRate: 0.50 },
    { categoryId: salonHairCategory.id, name: 'Color & Highlight',  price: 120.00, duration: 120, commissionType: 'PERCENTAGE' as const, commissionRate: 0.50 },
    { categoryId: salonHairCategory.id, name: 'Blowout',            price: 45.00, duration: 45,  commissionType: 'PERCENTAGE' as const, commissionRate: 0.50 },
  ];
  for (const svc of services) {
    const existing = await prisma.service.findFirst({ where: { storeId: salonStore.id, name: svc.name } });
    if (!existing) await prisma.service.create({ data: { storeId: salonStore.id, ...svc, isActive: true } });
  }

  // Salon manager role + staff
  const salonManagerRole = await prisma.role.upsert({
    where: { merchantId_name: { merchantId: salonMerchant.id, name: 'Manager' } },
    update: {},
    create: { merchantId: salonMerchant.id, name: 'Manager', isDefault: false },
  });
  const existingSalonMgrPerms = await prisma.rolePermission.findMany({ where: { roleId: salonManagerRole.id } });
  if (existingSalonMgrPerms.length === 0) {
    await prisma.rolePermission.createMany({ data: allPerms.map((p) => ({ roleId: salonManagerRole.id, permissionId: p.id, granted: true })) });
  }

  let salonManager = await prisma.staff.findFirst({ where: { merchantId: salonMerchant.id, username: 'salon.manager' } });
  if (!salonManager) {
    salonManager = await prisma.staff.create({
      data: { merchantId: salonMerchant.id, firstName: 'Taylor', lastName: 'Nguyen', username: 'salon.manager', password: await bcrypt.hash('Manager123!', 12), pin: '1357', hourlyWage: 22.00, isActive: true },
    });
  }
  const existingSalonStore = await prisma.staffStore.findUnique({ where: { staffId_storeId: { staffId: salonManager.id, storeId: salonStore.id } } });
  if (!existingSalonStore) await prisma.staffStore.create({ data: { staffId: salonManager.id, storeId: salonStore.id, isPrimary: true } });
  const existingSalonRole = await prisma.staffRole.findUnique({ where: { staffId_roleId: { staffId: salonManager.id, roleId: salonManagerRole.id } } });
  if (!existingSalonRole) await prisma.staffRole.create({ data: { staffId: salonManager.id, roleId: salonManagerRole.id } });

  // Done
  console.log('\n✅  Seed complete!\n');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║               LOGIN CREDENTIALS                  ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  Super Admin  : ${superAdminEmail.padEnd(33)}║`);
  console.log(`║  Password     : ${superAdminPassword.padEnd(33)}║`);
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  RETAIL  Manager  username: manager  PIN: 1234   ║');
  console.log('║  RETAIL  Cashier  username: cashier  PIN: 5678   ║');
  console.log('║  RESTAURANT  Mgr  username: rest.manager PIN:2468║');
  console.log('║  SALON   Manager  username: salon.manager PIN:1357║');
  console.log('║  All staff passwords: Manager123! / Cashier123!  ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
}

main()
  .catch((e) => { console.error('❌  Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
