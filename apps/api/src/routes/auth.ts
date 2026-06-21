import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { ok, badRequest, unauthorized, serverError } from '../utils/response';
import { authenticate } from '../middleware/auth';

const router = Router();

// Super admin login
router.post('/super-admin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return badRequest(res, 'Email and password required');

    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin) return unauthorized(res, 'Invalid credentials');

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return unauthorized(res, 'Invalid credentials');

    const payload = { id: admin.id, type: 'super_admin' as const, email: admin.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return ok(res, { accessToken, refreshToken, user: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (e) {
    return serverError(res, e);
  }
});

// Staff login (username/password)
router.post('/staff/login', async (req: Request, res: Response) => {
  try {
    const { username, password, storeId } = req.body;
    if (!username || !password || !storeId) return badRequest(res, 'Username, password, and storeId required');

    const store = await prisma.store.findUnique({ where: { id: storeId }, include: { merchant: true } });
    if (!store) return badRequest(res, 'Store not found');

    const staff = await prisma.staff.findFirst({
      where: { username, merchantId: store.merchantId, isActive: true },
      include: { roles: { include: { role: true } }, stores: true },
    });
    if (!staff) return unauthorized(res, 'Invalid credentials');

    const hasAccess = staff.stores.some((s) => s.storeId === storeId);
    if (!hasAccess) return unauthorized(res, 'No access to this store');

    const valid = await bcrypt.compare(password, staff.password);
    if (!valid) return unauthorized(res, 'Invalid credentials');

    const payload = { id: staff.id, type: 'staff' as const, merchantId: store.merchantId, storeId };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.auditLog.create({
      data: { storeId, staffId: staff.id, action: 'LOGIN', entity: 'staff', entityId: staff.id },
    });

    return ok(res, {
      accessToken,
      refreshToken,
      user: {
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        username: staff.username,
        merchantId: store.merchantId,
        storeId,
        businessMode: store.businessMode,
        roles: staff.roles.map((r) => r.role.name),
      },
    });
  } catch (e) {
    return serverError(res, e);
  }
});

// PIN login (fast register login)
router.post('/staff/pin-login', async (req: Request, res: Response) => {
  try {
    const { pin, storeId } = req.body;
    if (!pin || !storeId) return badRequest(res, 'PIN and storeId required');

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return badRequest(res, 'Store not found');

    const staff = await prisma.staff.findFirst({
      where: { pin, merchantId: store.merchantId, isActive: true, stores: { some: { storeId } } },
      include: { roles: { include: { role: true } } },
    });
    if (!staff) return unauthorized(res, 'Invalid PIN');

    const payload = { id: staff.id, type: 'staff' as const, merchantId: store.merchantId, storeId };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return ok(res, {
      accessToken,
      refreshToken,
      user: {
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        username: staff.username,
        merchantId: store.merchantId,
        storeId,
        businessMode: store.businessMode,
        roles: staff.roles.map((r) => r.role.name),
      },
    });
  } catch (e) {
    return serverError(res, e);
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return badRequest(res, 'Refresh token required');

    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({ id: payload.id, type: payload.type, merchantId: payload.merchantId, storeId: payload.storeId, email: payload.email });
    return ok(res, { accessToken });
  } catch {
    return unauthorized(res, 'Invalid refresh token');
  }
});

// Get current user
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.type === 'super_admin') {
      const admin = await prisma.superAdmin.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, name: true } });
      return ok(res, { ...admin, type: 'super_admin' });
    }
    const staff = await prisma.staff.findUnique({
      where: { id: req.user!.id },
      include: { roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });
    if (!staff) return unauthorized(res);
    return ok(res, {
      id: staff.id, firstName: staff.firstName, lastName: staff.lastName,
      username: staff.username, merchantId: staff.merchantId,
      storeId: req.user!.storeId, type: 'staff',
      roles: staff.roles.map((r) => r.role.name),
    });
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
