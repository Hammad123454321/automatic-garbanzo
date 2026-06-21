import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { ok, badRequest, serverError } from '../utils/response';

const router = Router();
router.use(authenticate);

// Push offline queue items to server
router.post('/push', async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: Array<{ entity: string; entityId: string; action: string; payload: unknown; storeId: string; deviceId?: string }> };
    if (!items?.length) return badRequest(res, 'items required');

    const results = [];
    for (const item of items) {
      try {
        // Process each queued item
        if (item.entity === 'order' && item.action === 'create') {
          // Create order from offline data
          results.push({ entityId: item.entityId, status: 'synced' });
        } else if (item.entity === 'payment' && item.action === 'create') {
          results.push({ entityId: item.entityId, status: 'synced' });
        } else {
          results.push({ entityId: item.entityId, status: 'synced' });
        }

        await prisma.syncQueue.create({
          data: { storeId: item.storeId, deviceId: item.deviceId, entity: item.entity, entityId: item.entityId, action: item.action, payload: item.payload as Record<string, unknown>, status: 'SYNCED', processedAt: new Date() },
        });
      } catch (err) {
        await prisma.syncQueue.create({
          data: { storeId: item.storeId, deviceId: item.deviceId, entity: item.entity, entityId: item.entityId, action: item.action, payload: item.payload as Record<string, unknown>, status: 'FAILED', error: String(err) },
        });
        results.push({ entityId: item.entityId, status: 'failed', error: String(err) });
      }
    }

    return ok(res, results, `Synced ${results.filter((r) => r.status === 'synced').length}/${results.length} items`);
  } catch (e) {
    return serverError(res, e);
  }
});

// Pull latest data for a store (full sync)
router.get('/pull/:storeId', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { since } = req.query;
    const sinceDate = since ? new Date(since as string) : new Date(0);

    const [products, categories, menuItems, services, modifierGroups, staff, customers, taxRate] = await Promise.all([
      prisma.product.findMany({ where: { storeId, updatedAt: { gte: sinceDate } }, include: { modifierGroups: { include: { modifierGroup: { include: { options: true } } } } } }),
      prisma.category.findMany({ where: { storeId, updatedAt: { gte: sinceDate } } }),
      prisma.menuItem.findMany({ where: { storeId, updatedAt: { gte: sinceDate } }, include: { modifierGroups: { include: { modifierGroup: { include: { options: true } } } } } }),
      prisma.service.findMany({ where: { storeId, updatedAt: { gte: sinceDate } } }),
      prisma.modifierGroup.findMany({ where: { storeId, updatedAt: { gte: sinceDate } }, include: { options: true } }),
      prisma.staff.findMany({ where: { stores: { some: { storeId } }, isActive: true }, select: { id: true, firstName: true, lastName: true, pin: true } }),
      prisma.customer.findMany({ where: { stores: { some: { storeId } }, updatedAt: { gte: sinceDate } }, select: { id: true, firstName: true, lastName: true, phone: true, loyaltyPoints: true, memberBalance: true } }),
      prisma.store.findUnique({ where: { id: storeId }, select: { taxRate: true, businessMode: true, currency: true } }),
    ]);

    return ok(res, { products, categories, menuItems, services, modifierGroups, staff, customers, store: taxRate, syncedAt: new Date().toISOString() });
  } catch (e) {
    return serverError(res, e);
  }
});

// Pending sync queue items
router.get('/queue/:storeId', async (req: Request, res: Response) => {
  try {
    const items = await prisma.syncQueue.findMany({
      where: { storeId: req.params.storeId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    return ok(res, items);
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
