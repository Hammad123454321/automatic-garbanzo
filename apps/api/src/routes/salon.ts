import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, paginated, badRequest, notFound, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// ── Appointments ───────────────────────────────────────────────────────────

router.get('/appointments', async (req: Request, res: Response) => {
  try {
    const { storeId, staffId, date, status } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const where: Record<string, unknown> = { storeId };
    if (status) where.status = status;
    if (date) {
      const start = new Date(date as string);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      where.startTime = { gte: start, lt: end };
    }
    if (staffId) where.services = { some: { staffId } };

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        services: { include: { service: { select: { id: true, name: true, duration: true, price: true } }, staff: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });
    return ok(res, appointments);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/appointments', async (req: Request, res: Response) => {
  try {
    const { storeId, customerId, customerName, customerPhone, startTime, services, notes } = req.body;
    if (!storeId || !customerName || !startTime || !services?.length) return badRequest(res, 'storeId, customerName, startTime, and services required');

    // Calculate end time from total duration
    const totalDuration = services.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0);
    const endTime = new Date(new Date(startTime).getTime() + totalDuration * 60000);

    const appointment = await prisma.appointment.create({
      data: {
        storeId, customerId, customerName, customerPhone, startTime: new Date(startTime), endTime, notes,
        services: { create: services.map((s: { serviceId: string; staffId?: string; duration: number; price: number }) => ({ serviceId: s.serviceId, staffId: s.staffId, duration: s.duration, price: s.price })) },
      },
      include: { services: { include: { service: true, staff: { select: { id: true, firstName: true, lastName: true } } } }, customer: true },
    });
    return created(res, appointment, 'Appointment booked');
  } catch (e) {
    return serverError(res, e);
  }
});

router.get('/appointments/:id', async (req: Request, res: Response) => {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { customer: true, services: { include: { service: true, staff: { select: { id: true, firstName: true, lastName: true } } } } },
    });
    if (!appt) return notFound(res, 'Appointment not found');
    return ok(res, appt);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/appointments/:id', async (req: Request, res: Response) => {
  try {
    const { startTime, services, status, notes, noShowFee } = req.body;
    const updateData: Record<string, unknown> = { status, notes, noShowFee };

    if (startTime && services) {
      const totalDuration = services.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0);
      updateData.startTime = new Date(startTime);
      updateData.endTime = new Date(new Date(startTime).getTime() + totalDuration * 60000);
      await prisma.appointmentService.deleteMany({ where: { appointmentId: req.params.id } });
      updateData.services = { create: services };
    }

    const appt = await prisma.appointment.update({ where: { id: req.params.id }, data: updateData as never });
    return ok(res, appt, 'Appointment updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/appointments/:id', async (req: Request, res: Response) => {
  try {
    await prisma.appointment.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    return ok(res, null, 'Appointment cancelled');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Commissions ────────────────────────────────────────────────────────────

router.get('/commissions', async (req: Request, res: Response) => {
  try {
    const { staffId, storeId, isPaid, dateFrom, dateTo } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const where: Record<string, unknown> = {};
    if (staffId) where.staffId = staffId;
    if (isPaid !== undefined) where.isPaid = isPaid === 'true';
    if (dateFrom || dateTo) where.createdAt = { ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}), ...(dateTo ? { lte: new Date(dateTo as string) } : {}) };

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({ where, skip: (page - 1) * limit, take: limit, include: { staff: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.commission.count({ where }),
    ]);
    return paginated(res, commissions, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/commissions/pay', requirePermission('manage_payroll'), async (req: Request, res: Response) => {
  try {
    const { commissionIds } = req.body;
    await prisma.commission.updateMany({ where: { id: { in: commissionIds } }, data: { isPaid: true, paidAt: new Date() } });
    return ok(res, null, 'Commissions marked as paid');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
