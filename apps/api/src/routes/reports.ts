import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, badRequest, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions, requirePermission('view_reports'));

function dateRange(period: string, from?: string, to?: string) {
  const now = new Date();
  let start: Date, end: Date;
  if (from && to) {
    start = new Date(from);
    end = new Date(to);
  } else if (period === 'today') {
    start = new Date(now.setHours(0, 0, 0, 0));
    end = new Date();
  } else if (period === 'week') {
    const day = now.getDay();
    start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0);
    end = new Date();
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date();
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date();
  } else {
    start = new Date(now.setHours(0, 0, 0, 0));
    end = new Date();
  }
  return { start, end };
}

// Sales summary
router.get('/sales', async (req: Request, res: Response) => {
  try {
    const { storeId, period, from, to } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const { start, end } = dateRange(period as string || 'today', from as string, to as string);

    const [orders, paymentBreakdown, topProducts] = await Promise.all([
      prisma.order.aggregate({
        _sum: { subtotal: true, taxAmount: true, discountAmount: true, tipAmount: true, totalAmount: true },
        _count: { id: true },
        where: { storeId: storeId as string, status: { in: ['COMPLETED'] }, createdAt: { gte: start, lte: end } },
      }),
      prisma.payment.groupBy({
        by: ['method'],
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'CAPTURED', order: { storeId: storeId as string, createdAt: { gte: start, lte: end } } },
      }),
      prisma.orderItem.groupBy({
        by: ['name'],
        _sum: { quantity: true, totalAmount: true },
        _count: { id: true },
        where: { order: { storeId: storeId as string, status: 'COMPLETED', createdAt: { gte: start, lte: end } } },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
    ]);

    // Orders by hour (today) or by day (other periods)
    const ordersByTime = await prisma.$queryRaw`
      SELECT DATE_TRUNC(${period === 'today' ? 'hour' : 'day'}, "createdAt") as period,
             COUNT(*) as count, SUM("totalAmount") as revenue
      FROM "Order"
      WHERE "storeId" = ${storeId}
        AND status = 'COMPLETED'
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
      GROUP BY 1
      ORDER BY 1
    `;

    return ok(res, {
      summary: orders,
      paymentBreakdown,
      topProducts,
      ordersByTime,
      period: { start, end },
    });
  } catch (e) {
    return serverError(res, e);
  }
});

// Staff report
router.get('/staff', async (req: Request, res: Response) => {
  try {
    const { storeId, period, from, to } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const { start, end } = dateRange(period as string || 'today', from as string, to as string);

    const staffStats = await prisma.order.groupBy({
      by: ['staffId'],
      _sum: { totalAmount: true, tipAmount: true },
      _count: { id: true },
      where: { storeId: storeId as string, status: 'COMPLETED', createdAt: { gte: start, lte: end }, staffId: { not: null } },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });

    const staffIds = staffStats.map((s) => s.staffId!);
    const staffNames = await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true } });
    const nameMap = Object.fromEntries(staffNames.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

    return ok(res, staffStats.map((s) => ({ ...s, staffName: nameMap[s.staffId!] || 'Unknown' })));
  } catch (e) {
    return serverError(res, e);
  }
});

// Tax report
router.get('/tax', async (req: Request, res: Response) => {
  try {
    const { storeId, period, from, to } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const { start, end } = dateRange(period as string || 'month', from as string, to as string);

    const result = await prisma.order.aggregate({
      _sum: { subtotal: true, taxAmount: true, discountAmount: true, totalAmount: true },
      _count: { id: true },
      where: { storeId: storeId as string, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
    });
    return ok(res, { ...result, period: { start, end } });
  } catch (e) {
    return serverError(res, e);
  }
});

// Inventory valuation
router.get('/inventory-value', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');

    const inventory = await prisma.inventory.findMany({
      where: { storeId: storeId as string },
      include: { product: { select: { name: true, costPrice: true, price: true, isActive: true } } },
    });

    const items = inventory.map((inv) => {
      const qty = parseFloat(inv.quantity.toString());
      const cost = parseFloat(inv.product?.costPrice?.toString() || '0');
      const retail = parseFloat(inv.product?.price?.toString() || '0');
      return {
        productId: inv.productId, productName: inv.product?.name,
        quantity: qty, costValue: qty * cost, retailValue: qty * retail,
        margin: cost > 0 ? ((retail - cost) / retail) * 100 : null,
      };
    });

    const totals = items.reduce((acc, i) => ({ costValue: acc.costValue + i.costValue, retailValue: acc.retailValue + i.retailValue }), { costValue: 0, retailValue: 0 });
    return ok(res, { items, totals });
  } catch (e) {
    return serverError(res, e);
  }
});

// Tip report
router.get('/tips', requirePermission('view_tip_reports'), async (req: Request, res: Response) => {
  try {
    const { storeId, staffId, period, from, to } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const { start, end } = dateRange(period as string || 'today', from as string, to as string);

    const where: Record<string, unknown> = { order: { storeId, createdAt: { gte: start, lte: end } } };
    if (staffId) where.staffId = staffId;

    const tips = await prisma.orderTip.groupBy({
      by: ['staffId'],
      _sum: { amount: true },
      _count: { id: true },
      where,
    });

    const staffIds = tips.map((t) => t.staffId!).filter(Boolean);
    const staffNames = await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true } });
    const nameMap = Object.fromEntries(staffNames.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

    return ok(res, tips.map((t) => ({ ...t, staffName: nameMap[t.staffId!] || 'Unassigned' })));
  } catch (e) {
    return serverError(res, e);
  }
});

// Audit log
router.get('/audit', requirePermission('view_financial_reports'), async (req: Request, res: Response) => {
  try {
    const { storeId, staffId, action, dateFrom, dateTo } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const where: Record<string, unknown> = { storeId };
    if (staffId) where.staffId = staffId;
    if (action) where.action = action;
    if (dateFrom || dateTo) where.createdAt = { ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}), ...(dateTo ? { lte: new Date(dateTo as string) } : {}) };

    const logs = await prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, include: { staff: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } });
    return ok(res, logs);
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
