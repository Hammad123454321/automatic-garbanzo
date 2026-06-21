import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, badRequest, notFound, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// List stores for merchant
router.get('/', async (req: Request, res: Response) => {
  try {
    const merchantId = req.user?.merchantId || req.query.merchantId as string;
    if (!merchantId) return badRequest(res, 'merchantId required');
    const stores = await prisma.store.findMany({
      where: { merchantId },
      include: { _count: { select: { devices: true, staff: true } } },
      orderBy: { name: 'asc' },
    });
    return ok(res, stores);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/', requirePermission('manage_store'), async (req: Request, res: Response) => {
  try {
    const { merchantId, name, businessMode, email, phone, address, city, state, zipCode, country, timezone, currency, taxRate, taxName, businessHours, receiptHeader, receiptFooter } = req.body;
    const mid = merchantId || req.user?.merchantId;
    if (!mid || !name) return badRequest(res, 'merchantId and name required');

    // Check limit
    const merchant = await prisma.merchant.findUnique({ where: { id: mid }, include: { _count: { select: { stores: true } } } });
    if (merchant && merchant._count.stores >= merchant.maxStores) {
      return badRequest(res, `Store limit reached (max ${merchant.maxStores})`);
    }

    const store = await prisma.store.create({
      data: { merchantId: mid, name, businessMode: businessMode || 'RETAIL', email, phone, address, city, state, zipCode, country, timezone, currency, taxRate, taxName, businessHours, receiptHeader, receiptFooter },
    });
    return created(res, store, 'Store created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const store = await prisma.store.findUnique({
      where: { id: req.params.id },
      include: { devices: true, printers: true, _count: { select: { orders: true, products: true } } },
    });
    if (!store) return notFound(res, 'Store not found');
    return ok(res, store);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/:id', requirePermission('manage_store'), async (req: Request, res: Response) => {
  try {
    const { name, businessMode, email, phone, address, city, state, zipCode, country, timezone, currency, taxRate, taxName, businessHours, onlineHours, onlineEnabled, onlinePaused, onlinePauseUntil, pickupEnabled, deliveryEnabled, pickupPrepTime, deliveryPrepTime, deliveryRadius, deliveryFee, minOrderAmount, receiptHeader, receiptFooter } = req.body;
    const store = await prisma.store.update({
      where: { id: req.params.id },
      data: { name, businessMode, email, phone, address, city, state, zipCode, country, timezone, currency, taxRate, taxName, businessHours, onlineHours, onlineEnabled, onlinePaused, onlinePauseUntil, pickupEnabled, deliveryEnabled, pickupPrepTime, deliveryPrepTime, deliveryRadius, deliveryFee, minOrderAmount, receiptHeader, receiptFooter },
    });
    return ok(res, store, 'Store updated');
  } catch (e) {
    return serverError(res, e);
  }
});

// Online ordering controls
router.post('/:id/online/pause', requirePermission('manage_store'), async (req: Request, res: Response) => {
  try {
    const { minutes } = req.body; // null = rest of day
    const pauseUntil = minutes ? new Date(Date.now() + minutes * 60000) : new Date(new Date().setHours(23, 59, 59, 999));
    const store = await prisma.store.update({
      where: { id: req.params.id },
      data: { onlinePaused: true, onlinePauseUntil: pauseUntil },
    });
    return ok(res, store);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/:id/online/resume', requirePermission('manage_store'), async (req: Request, res: Response) => {
  try {
    const store = await prisma.store.update({ where: { id: req.params.id }, data: { onlinePaused: false, onlinePauseUntil: null } });
    return ok(res, store);
  } catch (e) {
    return serverError(res, e);
  }
});

// Devices
router.get('/:id/devices', async (req: Request, res: Response) => {
  try {
    const devices = await prisma.device.findMany({ where: { storeId: req.params.id }, orderBy: { name: 'asc' } });
    return ok(res, devices);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/:id/devices', requirePermission('manage_devices'), async (req: Request, res: Response) => {
  try {
    const { name, terminalId, serialNumber, ipAddress, port, merchantId: mid, terminalKey, config } = req.body;
    if (!name) return badRequest(res, 'Device name required');

    // Check device limit
    const store = await prisma.store.findUnique({ where: { id: req.params.id }, include: { merchant: true, _count: { select: { devices: true } } } });
    if (store && store._count.devices >= store.merchant.maxDevices) {
      return badRequest(res, `Device limit reached (max ${store.merchant.maxDevices})`);
    }

    const device = await prisma.device.create({
      data: { storeId: req.params.id, name, terminalId, serialNumber, ipAddress, port, merchantId: mid, terminalKey, config },
    });
    return created(res, device);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/:id/devices/:deviceId', requirePermission('manage_devices'), async (req: Request, res: Response) => {
  try {
    const device = await prisma.device.update({ where: { id: req.params.deviceId }, data: req.body });
    return ok(res, device);
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/:id/devices/:deviceId', requirePermission('manage_devices'), async (req: Request, res: Response) => {
  try {
    await prisma.device.delete({ where: { id: req.params.deviceId } });
    return ok(res, null, 'Device removed');
  } catch (e) {
    return serverError(res, e);
  }
});

// Printers
router.get('/:id/printers', async (req: Request, res: Response) => {
  try {
    const printers = await prisma.printer.findMany({ where: { storeId: req.params.id }, include: { routingRules: true }, orderBy: { name: 'asc' } });
    return ok(res, printers);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/:id/printers', requirePermission('manage_printers'), async (req: Request, res: Response) => {
  try {
    const { name, connection, ipAddress, port, usbPort, purpose, paperWidth } = req.body;
    if (!name) return badRequest(res, 'Printer name required');
    const printer = await prisma.printer.create({
      data: { storeId: req.params.id, name, connection: connection || 'NETWORK', ipAddress, port: port || 9100, usbPort, purpose: purpose || 'ALL', paperWidth: paperWidth || 80 },
    });
    return created(res, printer);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/:id/printers/:printerId', requirePermission('manage_printers'), async (req: Request, res: Response) => {
  try {
    const printer = await prisma.printer.update({ where: { id: req.params.printerId }, data: req.body });
    return ok(res, printer);
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/:id/printers/:printerId', requirePermission('manage_printers'), async (req: Request, res: Response) => {
  try {
    await prisma.printer.delete({ where: { id: req.params.printerId } });
    return ok(res, null, 'Printer removed');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
