import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, paginated, badRequest, notFound, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// Generate order number
async function generateOrderNumber(storeId: string): Promise<string> {
  const today = new Date();
  const prefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const count = await prisma.order.count({ where: { storeId, createdAt: { gte: new Date(today.setHours(0, 0, 0, 0)) } } });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

// List orders
router.get('/', async (req: Request, res: Response) => {
  try {
    const { storeId, status, type, staffId, dateFrom, dateTo, search } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    if (!storeId) return badRequest(res, 'storeId required');

    const where: Record<string, unknown> = { storeId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (staffId) where.staffId = staffId;
    if (dateFrom || dateTo) where.createdAt = { ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}), ...(dateTo ? { lte: new Date(dateTo as string) } : {}) };
    if (search) where.OR = [{ orderNumber: { contains: search } }, { customer: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } }];

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: { staff: { select: { firstName: true, lastName: true } }, customer: { select: { id: true, firstName: true, lastName: true, phone: true } }, items: { include: { modifiers: { include: { modifierOption: true } } } }, payments: true, table: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);
    return paginated(res, orders, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

// Create order
router.post('/', async (req: Request, res: Response) => {
  try {
    const { storeId, deviceId, type, tableId, tableNumber, partySize, customerId, notes, items, discounts } = req.body;
    if (!storeId || !items?.length) return badRequest(res, 'storeId and items required');

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return notFound(res, 'Store not found');

    // Calculate totals
    let subtotal = 0;
    const lineItems = [];

    for (const item of items) {
      const unitPrice = parseFloat(item.unitPrice);
      const quantity = parseFloat(item.quantity);
      let modifierTotal = 0;

      const modifiers = [];
      if (item.modifiers?.length) {
        for (const mod of item.modifiers) {
          const option = await prisma.modifierOption.findUnique({ where: { id: mod.modifierOptionId } });
          if (option) {
            modifierTotal += parseFloat(option.priceAdjustment.toString());
            modifiers.push({ modifierOptionId: option.id, name: option.name, priceAdjustment: option.priceAdjustment });
          }
        }
      }

      const taxRate = parseFloat(item.taxRate ?? store.taxRate.toString());
      const lineSubtotal = (unitPrice + modifierTotal) * quantity;
      const taxAmount = lineSubtotal * taxRate;
      const totalAmount = lineSubtotal + taxAmount;
      subtotal += lineSubtotal;

      lineItems.push({
        productId: item.productId || null,
        menuItemId: item.menuItemId || null,
        serviceId: item.serviceId || null,
        name: item.name, nameZh: item.nameZh,
        quantity, unitPrice, modifierTotal, taxAmount, totalAmount,
        notes: item.notes, printerId: item.printerId, staffId: item.staffId,
        modifiers: { create: modifiers },
      });
    }

    let discountAmount = 0;
    const orderDiscounts = [];
    if (discounts?.length) {
      for (const d of discounts) {
        const amt = d.type === 'percentage' ? subtotal * (parseFloat(d.value) / 100) : parseFloat(d.value);
        discountAmount += amt;
        orderDiscounts.push({ name: d.name, type: d.type, value: d.value, amount: amt });
      }
    }

    const taxableSubtotal = subtotal - discountAmount;
    const taxAmount = taxableSubtotal * parseFloat(store.taxRate.toString());
    const totalAmount = taxableSubtotal + taxAmount;

    const orderNumber = await generateOrderNumber(storeId);

    const order = await prisma.order.create({
      data: {
        storeId, deviceId, staffId: req.user?.id, customerId, type: type || 'COUNTER',
        tableId, tableNumber, partySize, notes, orderNumber,
        subtotal, taxAmount, discountAmount, totalAmount,
        items: { create: lineItems },
        discounts: { create: orderDiscounts },
      },
      include: { items: { include: { modifiers: { include: { modifierOption: true } } } }, payments: true, discounts: true, customer: { select: { id: true, firstName: true, lastName: true } } },
    });

    // If table, mark as occupied
    if (tableId) {
      await prisma.restaurantTable.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } });
    }

    await prisma.auditLog.create({ data: { storeId, staffId: req.user?.id, action: 'CREATE', entity: 'order', entityId: order.id, after: { orderNumber, totalAmount } } });

    return created(res, order, 'Order created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        staff: { select: { firstName: true, lastName: true } },
        customer: true, table: true,
        items: { include: { modifiers: { include: { modifierOption: true } }, product: { select: { name: true } }, menuItem: { select: { name: true } }, service: { select: { name: true } } } },
        payments: { include: { refunds: true } },
        tips: true, discounts: true, splits: true,
      },
    });
    if (!order) return notFound(res, 'Order not found');
    return ok(res, order);
  } catch (e) {
    return serverError(res, e);
  }
});

// Update order status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status, ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}), ...(status === 'REFUNDED' ? { refundedAt: new Date() } : {}) },
    });

    // Free table if order completed/cancelled
    if (['COMPLETED', 'CANCELLED'].includes(status) && order.tableId) {
      await prisma.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } });
    }

    return ok(res, order, `Order ${status.toLowerCase()}`);
  } catch (e) {
    return serverError(res, e);
  }
});

// Void order
router.post('/:id/void', requirePermission('void_order'), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    await prisma.auditLog.create({ data: { storeId: order.storeId, staffId: req.user?.id, action: 'VOID', entity: 'order', entityId: order.id, after: { reason } } });
    return ok(res, order, 'Order voided');
  } catch (e) {
    return serverError(res, e);
  }
});

// Hold/recall
router.post('/:id/hold', requirePermission('hold_order'), async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: { isHeld: true } });
    return ok(res, order, 'Order held');
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/:id/recall', async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: { isHeld: false } });
    return ok(res, order, 'Order recalled');
  } catch (e) {
    return serverError(res, e);
  }
});

// Add tip
router.post('/:id/tip', requirePermission('add_tip'), async (req: Request, res: Response) => {
  try {
    const { amount, staffId, method } = req.body;
    if (!amount) return badRequest(res, 'amount required');
    const tip = await prisma.orderTip.create({ data: { orderId: req.params.id, staffId, amount, method } });
    await prisma.order.update({ where: { id: req.params.id }, data: { tipAmount: { increment: parseFloat(amount) }, totalAmount: { increment: parseFloat(amount) } } });
    return ok(res, tip, 'Tip added');
  } catch (e) {
    return serverError(res, e);
  }
});

// Split order
router.post('/:id/split', requirePermission('manage_orders'), async (req: Request, res: Response) => {
  try {
    const { splits } = req.body as { splits: Array<{ label: string; amount: number }> };
    await prisma.orderSplit.deleteMany({ where: { orderId: req.params.id } });
    const created2 = await prisma.orderSplit.createMany({
      data: splits.map((s) => ({ orderId: req.params.id, label: s.label, amount: s.amount })),
    });
    return ok(res, created2, 'Order split created');
  } catch (e) {
    return serverError(res, e);
  }
});

// Held orders
router.get('/held', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const orders = await prisma.order.findMany({
      where: { storeId: storeId as string, isHeld: true, status: 'PENDING' },
      include: { items: true, customer: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return ok(res, orders);
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
