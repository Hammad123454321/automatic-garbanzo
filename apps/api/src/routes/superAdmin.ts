import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import { ok, created, paginated, badRequest, notFound, serverError, conflict } from '../utils/response';

const router = Router();
router.use(authenticate, requireSuperAdmin);

// ── Merchants ──────────────────────────────────────────────────────────────

router.get('/merchants', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {};

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({ where, skip, take: limit, include: { _count: { select: { stores: true, staff: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.merchant.count({ where }),
    ]);
    return paginated(res, merchants, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/merchants', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, maxStores, maxDevices, billingPlan, baseFee, perStoreFee, perDeviceFee } = req.body;
    if (!name || !email) return badRequest(res, 'Name and email required');

    const existing = await prisma.merchant.findUnique({ where: { email } });
    if (existing) return conflict(res, 'Email already registered');

    const merchant = await prisma.merchant.create({
      data: { name, email, phone, address, maxStores: maxStores || 1, maxDevices: maxDevices || 3, billingPlan: billingPlan || 'basic', baseFee: baseFee || 0, perStoreFee: perStoreFee || 0, perDeviceFee: perDeviceFee || 0 },
    });
    return created(res, merchant, 'Merchant created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.get('/merchants/:id', async (req: Request, res: Response) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.params.id },
      include: { stores: { include: { _count: { select: { devices: true } } } }, _count: { select: { staff: true } }, featureFlags: true },
    });
    if (!merchant) return notFound(res);
    return ok(res, merchant);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/merchants/:id', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, maxStores, maxDevices, billingPlan, baseFee, perStoreFee, perDeviceFee, isActive } = req.body;
    const merchant = await prisma.merchant.update({
      where: { id: req.params.id },
      data: { name, email, phone, address, maxStores, maxDevices, billingPlan, baseFee, perStoreFee, perDeviceFee, isActive },
    });
    return ok(res, merchant, 'Merchant updated');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Feature Flags ──────────────────────────────────────────────────────────

router.get('/merchants/:id/features', async (req: Request, res: Response) => {
  try {
    const flags = await prisma.merchantFeatureFlag.findMany({ where: { merchantId: req.params.id } });
    return ok(res, flags);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/merchants/:id/features/:key', async (req: Request, res: Response) => {
  try {
    const { enabled, storeId } = req.body;
    const sid: string | null = storeId || null;
    const existing = await prisma.merchantFeatureFlag.findFirst({
      where: { merchantId: req.params.id, featureKey: req.params.key, storeId: sid },
    });
    const flag = existing
      ? await prisma.merchantFeatureFlag.update({ where: { id: existing.id }, data: { enabled } })
      : await prisma.merchantFeatureFlag.create({ data: { merchantId: req.params.id, featureKey: req.params.key, enabled, storeId: sid } });
    return ok(res, flag);
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Billing ────────────────────────────────────────────────────────────────

router.get('/billing', async (req: Request, res: Response) => {
  try {
    const events = await prisma.billingEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { merchant: { select: { name: true } } } });
    return ok(res, events);
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Platform Stats ─────────────────────────────────────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [merchants, stores, devices, staff, ordersToday] = await Promise.all([
      prisma.merchant.count({ where: { isActive: true } }),
      prisma.store.count({ where: { isActive: true } }),
      prisma.device.count({ where: { isActive: true } }),
      prisma.staff.count({ where: { isActive: true } }),
      prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    return ok(res, { merchants, stores, devices, staff, ordersToday });
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Super Admin account management ────────────────────────────────────────

router.put('/profile', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const updateData: { name?: string; email?: string; password?: string } = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 12);
    const admin = await prisma.superAdmin.update({ where: { id: req.user!.id }, data: updateData, select: { id: true, email: true, name: true } });
    return ok(res, admin);
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
