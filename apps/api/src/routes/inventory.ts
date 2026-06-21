import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, paginated, badRequest, notFound, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// Get inventory levels
router.get('/', async (req: Request, res: Response) => {
  try {
    const { storeId, lowStock } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const where: Record<string, unknown> = { storeId };
    if (lowStock === 'true') where.product = { trackInventory: true };

    const inventory = await prisma.inventory.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true, lowStockAlert: true, isActive: true } }, variant: { select: { id: true, name: true, sku: true } } },
      orderBy: { product: { name: 'asc' } },
    });

    const items = inventory.map((inv) => ({
      ...inv,
      isLowStock: inv.product ? parseFloat(inv.quantity.toString()) <= (inv.product.lowStockAlert || 5) : false,
    }));

    const result = lowStock === 'true' ? items.filter((i) => i.isLowStock) : items;
    return ok(res, result);
  } catch (e) {
    return serverError(res, e);
  }
});

// Adjust stock
router.post('/adjust', requirePermission('manage_inventory'), async (req: Request, res: Response) => {
  try {
    const { storeId, productId, variantId, action, quantity, unitCost, notes, staffId, toStoreId } = req.body;
    if (!storeId || !action || quantity === undefined) return badRequest(res, 'storeId, action, and quantity required');

    const inv = await prisma.inventory.findFirst({ where: { storeId, productId: productId || null, variantId: variantId || null } });
    if (!inv && !productId) return badRequest(res, 'Inventory record not found');

    let inventoryId = inv?.id;
    if (!inv) {
      const newInv = await prisma.inventory.create({ data: { storeId, productId, variantId, quantity: 0 } });
      inventoryId = newInv.id;
    }

    const current = parseFloat((await prisma.inventory.findUnique({ where: { id: inventoryId } }))!.quantity.toString());
    let newQty = current;

    switch (action) {
      case 'STOCK_IN': newQty = current + parseFloat(quantity); break;
      case 'STOCK_OUT': newQty = current - parseFloat(quantity); break;
      case 'ADJUSTMENT': newQty = parseFloat(quantity); break;
      case 'TRANSFER_IN': newQty = current + parseFloat(quantity); break;
      case 'TRANSFER_OUT': newQty = current - parseFloat(quantity); break;
      case 'DAMAGE': newQty = current - parseFloat(quantity); break;
      case 'EXPIRY': newQty = current - parseFloat(quantity); break;
      default: return badRequest(res, 'Invalid action');
    }

    if (newQty < 0) return badRequest(res, 'Insufficient stock');

    await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: newQty } });
    const txn = await prisma.inventoryTransaction.create({
      data: { inventoryId: inventoryId!, action, quantity, balanceBefore: current, balanceAfter: newQty, unitCost, notes, staffId: staffId || req.user?.id, toStoreId },
    });

    // Handle transfer: add to destination store
    if (action === 'TRANSFER_OUT' && toStoreId) {
      const destInv = await prisma.inventory.findFirst({ where: { storeId: toStoreId, productId: productId || null, variantId: variantId || null } });
      if (destInv) {
        const destCurrent = parseFloat(destInv.quantity.toString());
        await prisma.inventory.update({ where: { id: destInv.id }, data: { quantity: destCurrent + parseFloat(quantity) } });
        await prisma.inventoryTransaction.create({
          data: { inventoryId: destInv.id, action: 'TRANSFER_IN', quantity, balanceBefore: destCurrent, balanceAfter: destCurrent + parseFloat(quantity), notes: `Transfer from ${storeId}` },
        });
      } else {
        const newDestInv = await prisma.inventory.create({ data: { storeId: toStoreId, productId, variantId, quantity: parseFloat(quantity) } });
        await prisma.inventoryTransaction.create({
          data: { inventoryId: newDestInv.id, action: 'TRANSFER_IN', quantity, balanceBefore: 0, balanceAfter: parseFloat(quantity), notes: `Transfer from ${storeId}` },
        });
      }
    }

    return ok(res, txn, 'Stock adjusted');
  } catch (e) {
    return serverError(res, e);
  }
});

// Transaction history
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const { storeId, productId, dateFrom, dateTo } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const where: Record<string, unknown> = {};
    if (productId) where.inventory = { productId };
    if (storeId) where.inventory = { ...(where.inventory as object), storeId };
    if (dateFrom || dateTo) where.createdAt = { ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}), ...(dateTo ? { lte: new Date(dateTo as string) } : {}) };

    const [txns, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({ where, skip: (page - 1) * limit, take: limit, include: { inventory: { include: { product: { select: { name: true, sku: true } } } } }, orderBy: { createdAt: 'desc' } }),
      prisma.inventoryTransaction.count({ where }),
    ]);
    return paginated(res, txns, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Suppliers ──────────────────────────────────────────────────────────────

router.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.query;
    const mid = merchantId || req.user?.merchantId;
    if (!mid) return badRequest(res, 'merchantId required');
    const suppliers = await prisma.supplier.findMany({ where: { merchantId: mid, isActive: true }, orderBy: { name: 'asc' } });
    return ok(res, suppliers);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/suppliers', requirePermission('manage_inventory'), async (req: Request, res: Response) => {
  try {
    const { merchantId, name, contactName, email, phone, address, notes } = req.body;
    const mid = merchantId || req.user?.merchantId;
    if (!mid || !name) return badRequest(res, 'merchantId and name required');
    const supplier = await prisma.supplier.create({ data: { merchantId: mid, name, contactName, email, phone, address, notes } });
    return created(res, supplier, 'Supplier created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/suppliers/:id', requirePermission('manage_inventory'), async (req: Request, res: Response) => {
  try {
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, supplier, 'Supplier updated');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Purchase Orders ────────────────────────────────────────────────────────

router.get('/purchase-orders', async (req: Request, res: Response) => {
  try {
    const { storeId, status } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const where: Record<string, unknown> = { storeId };
    if (status) where.status = status;
    const pos = await prisma.purchaseOrder.findMany({ where, include: { supplier: { select: { name: true } }, items: true }, orderBy: { createdAt: 'desc' } });
    return ok(res, pos);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/purchase-orders', requirePermission('manage_inventory'), async (req: Request, res: Response) => {
  try {
    const { storeId, supplierId, items, notes } = req.body;
    if (!storeId || !items?.length) return badRequest(res, 'storeId and items required');
    const totalAmount = items.reduce((sum: number, i: { totalCost: number }) => sum + i.totalCost, 0);
    const orderNumber = `PO${Date.now()}`;
    const po = await prisma.purchaseOrder.create({
      data: { storeId, supplierId, orderNumber, totalAmount, notes, orderedAt: new Date(), items: { create: items } },
      include: { supplier: true, items: true },
    });
    return created(res, po, 'Purchase order created');
  } catch (e) {
    return serverError(res, e);
  }
});

// Receive purchase order
router.post('/purchase-orders/:id/receive', requirePermission('manage_inventory'), async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: Array<{ id: string; receivedQty: number; productId: string }> };
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!po) return notFound(res, 'Purchase order not found');

    for (const item of items) {
      await prisma.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.receivedQty } });
      // Add to inventory
      const inv = await prisma.inventory.findFirst({ where: { storeId: po.storeId, productId: item.productId } });
      if (inv) {
        const before = parseFloat(inv.quantity.toString());
        const after = before + item.receivedQty;
        await prisma.inventory.update({ where: { id: inv.id }, data: { quantity: after } });
        await prisma.inventoryTransaction.create({ data: { inventoryId: inv.id, action: 'STOCK_IN', quantity: item.receivedQty, balanceBefore: before, balanceAfter: after, referenceId: po.id } });
      }
    }

    await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { status: 'received', receivedAt: new Date() } });
    return ok(res, null, 'Purchase order received');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
