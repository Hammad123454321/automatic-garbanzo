import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, badRequest, notFound, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// ── Tables ─────────────────────────────────────────────────────────────────

router.get('/tables', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const tables = await prisma.restaurantTable.findMany({
      where: { storeId: storeId as string },
      include: { orders: { where: { status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }, include: { items: true, payments: true } } },
      orderBy: { number: 'asc' },
    });
    return ok(res, tables);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/tables', requirePermission('manage_store'), async (req: Request, res: Response) => {
  try {
    const { storeId, number, name, capacity, posX, posY, width, height, shape, section } = req.body;
    if (!storeId || !number) return badRequest(res, 'storeId and number required');
    const table = await prisma.restaurantTable.create({ data: { storeId, number, name, capacity: capacity || 4, posX, posY, width, height, shape, section } });
    return created(res, table, 'Table created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/tables/:id', requirePermission('manage_store'), async (req: Request, res: Response) => {
  try {
    const table = await prisma.restaurantTable.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, table, 'Table updated');
  } catch (e) {
    return serverError(res, e);
  }
});

// Batch save table layout (floor map)
router.post('/tables/layout', requirePermission('manage_store'), async (req: Request, res: Response) => {
  try {
    const { storeId, tables } = req.body as { storeId: string; tables: Array<{ id?: string; number: string; posX: number; posY: number; width: number; height: number; shape: string; capacity: number; section?: string }> };
    for (const t of tables) {
      if (t.id) {
        await prisma.restaurantTable.update({ where: { id: t.id }, data: { posX: t.posX, posY: t.posY, width: t.width, height: t.height, shape: t.shape } });
      } else {
        await prisma.restaurantTable.create({ data: { storeId, number: t.number, capacity: t.capacity, posX: t.posX, posY: t.posY, width: t.width, height: t.height, shape: t.shape, section: t.section } });
      }
    }
    return ok(res, null, 'Layout saved');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/tables/:id', requirePermission('manage_store'), async (req: Request, res: Response) => {
  try {
    await prisma.restaurantTable.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Table deleted');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Reservations ───────────────────────────────────────────────────────────

router.get('/reservations', async (req: Request, res: Response) => {
  try {
    const { storeId, date } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const where: Record<string, unknown> = { storeId };
    if (date) {
      const start = new Date(date as string);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      where.reservedAt = { gte: start, lt: end };
    }
    const reservations = await prisma.reservation.findMany({ where, include: { table: { select: { number: true, section: true } } }, orderBy: { reservedAt: 'asc' } });
    return ok(res, reservations);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/reservations', async (req: Request, res: Response) => {
  try {
    const { storeId, tableId, customerId, customerName, customerPhone, partySize, reservedAt, duration, notes } = req.body;
    if (!storeId || !customerName || !partySize || !reservedAt) return badRequest(res, 'storeId, customerName, partySize, reservedAt required');
    const reservation = await prisma.reservation.create({ data: { storeId, tableId, customerId, customerName, customerPhone, partySize, reservedAt: new Date(reservedAt), duration: duration || 90, notes } });
    if (tableId) await prisma.restaurantTable.update({ where: { id: tableId }, data: { status: 'RESERVED' } });
    return created(res, reservation, 'Reservation created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/reservations/:id', async (req: Request, res: Response) => {
  try {
    const reservation = await prisma.reservation.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, reservation, 'Reservation updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/reservations/:id', async (req: Request, res: Response) => {
  try {
    const reservation = await prisma.reservation.findUnique({ where: { id: req.params.id } });
    await prisma.reservation.delete({ where: { id: req.params.id } });
    if (reservation?.tableId) {
      const activeOrders = await prisma.order.count({ where: { tableId: reservation.tableId, status: { in: ['PENDING', 'IN_PROGRESS'] } } });
      if (!activeOrders) await prisma.restaurantTable.update({ where: { id: reservation.tableId }, data: { status: 'AVAILABLE' } });
    }
    return ok(res, null, 'Reservation cancelled');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
