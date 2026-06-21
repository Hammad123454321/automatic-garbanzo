import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, paginated, badRequest, notFound, conflict, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// ── Customers ──────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { merchantId, storeId, search } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const mid = merchantId || req.user?.merchantId;
    if (!mid) return badRequest(res, 'merchantId required');

    const where: Record<string, unknown> = { merchantId: mid };
    if (storeId) where.stores = { some: { storeId } };
    if (search) where.OR = [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }];

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: { stores: { include: { store: { select: { id: true, name: true } } } }, _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);
    return paginated(res, customers, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/', requirePermission('manage_customers'), async (req: Request, res: Response) => {
  try {
    const { merchantId, firstName, lastName, email, phone, dateOfBirth, gender, notes } = req.body;
    const mid = merchantId || req.user?.merchantId;
    if (!mid || !firstName) return badRequest(res, 'merchantId and firstName required');

    if (email) {
      const existing = await prisma.customer.findFirst({ where: { merchantId: mid, email } });
      if (existing) return conflict(res, 'Email already registered');
    }

    const customer = await prisma.customer.create({ data: { merchantId: mid, firstName, lastName, email, phone, dateOfBirth, gender, notes } });
    return created(res, customer, 'Customer created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        stores: { include: { store: { select: { id: true, name: true } } } },
        giftCards: { include: { giftCard: true } },
        loyaltyEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { orders: true, appointments: true } },
      },
    });
    if (!customer) return notFound(res, 'Customer not found');
    return ok(res, customer);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/:id', requirePermission('manage_customers'), async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, dateOfBirth, gender, notes, memberLevel } = req.body;
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: { firstName, lastName, email, phone, dateOfBirth, gender, notes, memberLevel } });
    return ok(res, customer, 'Customer updated');
  } catch (e) {
    return serverError(res, e);
  }
});

// Adjust member balance
router.post('/:id/balance', requirePermission('manage_customers'), async (req: Request, res: Response) => {
  try {
    const { amount, type, notes } = req.body;
    const adj = type === 'deduct' ? -parseFloat(amount) : parseFloat(amount);
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: { memberBalance: { increment: adj } } });
    return ok(res, customer, `Balance ${type === 'deduct' ? 'deducted' : 'added'}`);
  } catch (e) {
    return serverError(res, e);
  }
});

// Adjust loyalty points
router.post('/:id/points', requirePermission('manage_customers'), async (req: Request, res: Response) => {
  try {
    const { points, type, description } = req.body;
    const adj = type === 'deduct' ? -parseInt(points) : parseInt(points);
    await prisma.customer.update({ where: { id: req.params.id }, data: { loyaltyPoints: { increment: adj } } });
    await prisma.loyaltyEvent.create({ data: { customerId: req.params.id, storeId: req.user!.storeId!, points: adj, type: type === 'deduct' ? 'REDEEMED' : 'MANUAL', description } });
    return ok(res, null, 'Points adjusted');
  } catch (e) {
    return serverError(res, e);
  }
});

// Customer orders
router.get('/:id/orders', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where: { customerId: req.params.id }, skip: (page - 1) * limit, take: limit, include: { payments: true, items: true }, orderBy: { createdAt: 'desc' } }),
      prisma.order.count({ where: { customerId: req.params.id } }),
    ]);
    return paginated(res, orders, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Gift Cards ─────────────────────────────────────────────────────────────

router.get('/gift-cards', async (req: Request, res: Response) => {
  try {
    const { merchantId, status } = req.query;
    const mid = merchantId || req.user?.merchantId;
    if (!mid) return badRequest(res, 'merchantId required');
    const where: Record<string, unknown> = { merchantId: mid };
    if (status) where.status = status;
    const cards = await prisma.giftCard.findMany({ where, include: { customers: { include: { customer: { select: { firstName: true, lastName: true } } } }, _count: { select: { transactions: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return ok(res, cards);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/gift-cards', requirePermission('manage_customers'), async (req: Request, res: Response) => {
  try {
    const { merchantId, initialBalance, isPhysical, expiresAt, customerId } = req.body;
    const mid = merchantId || req.user?.merchantId;
    if (!mid || !initialBalance) return badRequest(res, 'merchantId and initialBalance required');

    const code = `GC${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const last4 = code.slice(-4);

    const gc = await prisma.giftCard.create({
      data: {
        merchantId: mid, code, last4, initialBalance, currentBalance: initialBalance, isPhysical: isPhysical !== false, expiresAt,
        customers: customerId ? { create: { customerId } } : undefined,
      },
    });
    return created(res, gc, 'Gift card created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.get('/gift-cards/:code', async (req: Request, res: Response) => {
  try {
    const gc = await prisma.giftCard.findUnique({
      where: { code: req.params.code },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!gc) return notFound(res, 'Gift card not found');
    return ok(res, gc);
  } catch (e) {
    return serverError(res, e);
  }
});

// Top up gift card
router.post('/gift-cards/:id/topup', requirePermission('manage_customers'), async (req: Request, res: Response) => {
  try {
    const { amount, storeId, notes } = req.body;
    if (!amount || !storeId) return badRequest(res, 'amount and storeId required');

    const gc = await prisma.giftCard.findUnique({ where: { id: req.params.id } });
    if (!gc) return notFound(res, 'Gift card not found');

    const newBalance = parseFloat(gc.currentBalance.toString()) + parseFloat(amount);
    const updated = await prisma.giftCard.update({ where: { id: req.params.id }, data: { currentBalance: newBalance, status: 'ACTIVE' } });
    await prisma.giftCardTransaction.create({ data: { giftCardId: req.params.id, storeId, type: 'TOP_UP', amount, balance: newBalance, notes } });

    return ok(res, updated, 'Gift card topped up');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
