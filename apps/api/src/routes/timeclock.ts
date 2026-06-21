import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, paginated, badRequest, notFound, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// Clock in
router.post('/clock-in', async (req: Request, res: Response) => {
  try {
    const { staffId, storeId } = req.body;
    const sid = staffId || req.user?.id;
    const stid = storeId || req.user?.storeId;
    if (!sid || !stid) return badRequest(res, 'staffId and storeId required');

    // Check if already clocked in
    const active = await prisma.timeEntry.findFirst({ where: { staffId: sid, storeId: stid, clockOut: null } });
    if (active) return badRequest(res, 'Already clocked in');

    const entry = await prisma.timeEntry.create({ data: { staffId: sid, storeId: stid } });
    return created(res, entry, 'Clocked in');
  } catch (e) {
    return serverError(res, e);
  }
});

// Clock out
router.post('/clock-out', async (req: Request, res: Response) => {
  try {
    const { staffId, storeId, breakMinutes } = req.body;
    const sid = staffId || req.user?.id;
    const stid = storeId || req.user?.storeId;
    if (!sid || !stid) return badRequest(res, 'staffId and storeId required');

    const entry = await prisma.timeEntry.findFirst({ where: { staffId: sid, storeId: stid, clockOut: null }, orderBy: { clockIn: 'desc' } });
    if (!entry) return notFound(res, 'No active clock-in found');

    const clockOut = new Date();
    const msWorked = clockOut.getTime() - entry.clockIn.getTime();
    const breakMs = (breakMinutes || 0) * 60000;
    const hoursWorked = Math.max(0, (msWorked - breakMs) / 3600000);

    const staff = await prisma.staff.findUnique({ where: { id: sid }, select: { hourlyWage: true } });
    const wageRate = parseFloat(staff?.hourlyWage?.toString() || '0');
    const totalPay = hoursWorked * wageRate;

    const updated = await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { clockOut, breakMinutes: breakMinutes || 0, hoursWorked, wageRate, totalPay },
    });
    return ok(res, updated, `Clocked out — ${hoursWorked.toFixed(2)} hours`);
  } catch (e) {
    return serverError(res, e);
  }
});

// Get time entries
router.get('/', async (req: Request, res: Response) => {
  try {
    const { staffId, storeId, dateFrom, dateTo } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const where: Record<string, unknown> = {};
    if (staffId) where.staffId = staffId;
    if (storeId) where.storeId = storeId;
    if (dateFrom || dateTo) where.clockIn = { ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}), ...(dateTo ? { lte: new Date(dateTo as string) } : {}) };

    const [entries, total] = await Promise.all([
      prisma.timeEntry.findMany({ where, skip: (page - 1) * limit, take: limit, include: { staff: { select: { firstName: true, lastName: true } } }, orderBy: { clockIn: 'desc' } }),
      prisma.timeEntry.count({ where }),
    ]);
    return paginated(res, entries, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

// Get active clocked-in staff
router.get('/active', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const active = await prisma.timeEntry.findMany({
      where: { storeId: storeId as string, clockOut: null },
      include: { staff: { select: { id: true, firstName: true, lastName: true } } },
    });
    return ok(res, active);
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Payroll ────────────────────────────────────────────────────────────────

router.get('/payroll', requirePermission('view_payroll'), async (req: Request, res: Response) => {
  try {
    const { merchantId, storeId, staffId, isPaid } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const where: Record<string, unknown> = {};
    if (merchantId) where.merchantId = merchantId;
    if (storeId) where.storeId = storeId;
    if (staffId) where.staffId = staffId;
    if (isPaid !== undefined) where.isPaid = isPaid === 'true';

    const [payrolls, total] = await Promise.all([
      prisma.payroll.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { periodStart: 'desc' } }),
      prisma.payroll.count({ where }),
    ]);
    return paginated(res, payrolls, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

// Generate payroll for a period
router.post('/payroll/generate', requirePermission('manage_payroll'), async (req: Request, res: Response) => {
  try {
    const { merchantId, storeId, periodStart, periodEnd } = req.body;
    if (!merchantId || !storeId || !periodStart || !periodEnd) return badRequest(res, 'merchantId, storeId, periodStart, periodEnd required');

    const staff = await prisma.staff.findMany({ where: { merchantId, stores: { some: { storeId } }, isActive: true }, select: { id: true, hourlyWage: true } });

    const payrolls = [];
    for (const s of staff) {
      const entries = await prisma.timeEntry.findMany({
        where: { staffId: s.id, storeId, clockIn: { gte: new Date(periodStart), lte: new Date(periodEnd) }, clockOut: { not: null } },
      });

      const regularHours = entries.reduce((sum, e) => sum + parseFloat((e.hoursWorked || 0).toString()), 0);
      const wageRate = parseFloat(s.hourlyWage?.toString() || '0');
      const baseWages = regularHours * wageRate;

      // Sum tips
      const tipsResult = await prisma.orderTip.aggregate({ _sum: { amount: true }, where: { staffId: s.id, order: { storeId, createdAt: { gte: new Date(periodStart), lte: new Date(periodEnd) } } } });
      const tips = parseFloat(tipsResult._sum.amount?.toString() || '0');

      // Sum commissions
      const commResult = await prisma.commission.aggregate({ _sum: { amount: true }, where: { staffId: s.id, isPaid: false, createdAt: { gte: new Date(periodStart), lte: new Date(periodEnd) } } });
      const commissions = parseFloat(commResult._sum.amount?.toString() || '0');

      const netPay = baseWages + tips + commissions;

      if (regularHours > 0 || tips > 0 || commissions > 0) {
        const payroll = await prisma.payroll.create({
          data: { merchantId, storeId, staffId: s.id, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd), regularHours, hourlyWage: wageRate, baseWages, tips, commissions, netPay },
        });
        payrolls.push(payroll);
      }
    }

    return created(res, payrolls, `Payroll generated for ${payrolls.length} staff`);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/payroll/:id/pay', requirePermission('manage_payroll'), async (req: Request, res: Response) => {
  try {
    const payroll = await prisma.payroll.update({ where: { id: req.params.id }, data: { isPaid: true, paidAt: new Date() } });
    return ok(res, payroll, 'Payroll marked as paid');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
