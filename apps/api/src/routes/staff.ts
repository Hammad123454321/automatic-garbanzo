import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, paginated, badRequest, notFound, conflict, serverError } from '../utils/response';
import { PERMISSION_DEFINITIONS } from '../utils/permissions';

const router = Router();
router.use(authenticate, loadPermissions);

// ── Permissions ────────────────────────────────────────────────────────────

router.get('/permissions', async (_req: Request, res: Response) => {
  return ok(res, PERMISSION_DEFINITIONS);
});

// ── Roles ──────────────────────────────────────────────────────────────────

router.get('/roles', async (req: Request, res: Response) => {
  try {
    const merchantId = req.user?.merchantId || req.query.merchantId as string;
    if (!merchantId) return badRequest(res, 'merchantId required');
    const roles = await prisma.role.findMany({
      where: { merchantId },
      include: { rolePermissions: { include: { permission: true } }, _count: { select: { staffRoles: true } } },
      orderBy: { name: 'asc' },
    });
    return ok(res, roles);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/roles', requirePermission('manage_roles'), async (req: Request, res: Response) => {
  try {
    const { merchantId, name, description, permissions } = req.body;
    const mid = merchantId || req.user?.merchantId;
    if (!mid || !name) return badRequest(res, 'merchantId and name required');

    const existing = await prisma.role.findUnique({ where: { merchantId_name: { merchantId: mid, name } } });
    if (existing) return conflict(res, 'Role name already exists');

    const role = await prisma.role.create({
      data: {
        merchantId: mid, name, description,
        rolePermissions: permissions ? {
          create: permissions.map((permKey: string) => ({
            permission: { connect: { key: permKey } },
            granted: true,
          })),
        } : undefined,
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return created(res, role, 'Role created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/roles/:id', requirePermission('manage_roles'), async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = req.body;
    // Update role and replace permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: req.params.id } });
    const role = await prisma.role.update({
      where: { id: req.params.id },
      data: {
        name, description,
        rolePermissions: permissions ? {
          create: permissions.map((permKey: string) => ({
            permission: { connect: { key: permKey } },
            granted: true,
          })),
        } : undefined,
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return ok(res, role, 'Role updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/roles/:id', requirePermission('manage_roles'), async (req: Request, res: Response) => {
  try {
    await prisma.role.delete({ where: { id: req.params.id } });
    return ok(res, null, 'Role deleted');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Staff ──────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const merchantId = req.user?.merchantId || req.query.merchantId as string;
    const storeId = req.query.storeId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const where: { merchantId?: string; stores?: { some: { storeId: string } } } = {};
    if (merchantId) where.merchantId = merchantId;
    if (storeId) where.stores = { some: { storeId } };

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where, skip, take: limit,
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, username: true, isActive: true, hourlyWage: true, hireDate: true, createdAt: true, roles: { include: { role: true } }, stores: { include: { store: { select: { id: true, name: true } } } } },
        orderBy: { firstName: 'asc' },
      }),
      prisma.staff.count({ where }),
    ]);
    return paginated(res, staff, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/', requirePermission('manage_staff'), async (req: Request, res: Response) => {
  try {
    const { merchantId, firstName, lastName, email, phone, username, password, pin, hourlyWage, hireDate, storeIds, roleIds } = req.body;
    const mid = merchantId || req.user?.merchantId;
    if (!mid || !firstName || !username || !password) return badRequest(res, 'Required: merchantId, firstName, username, password');

    const existing = await prisma.staff.findFirst({ where: { merchantId: mid, username } });
    if (existing) return conflict(res, 'Username already taken');

    const hashedPassword = await bcrypt.hash(password, 12);
    const hashedPin = pin ? await bcrypt.hash(pin, 10) : null;

    const staff = await prisma.staff.create({
      data: {
        merchantId: mid, firstName, lastName, email, phone, username,
        password: hashedPassword, pin: hashedPin,
        hourlyWage, hireDate,
        stores: storeIds ? { create: storeIds.map((sid: string) => ({ storeId: sid })) } : undefined,
        roles: roleIds ? { create: roleIds.map((rid: string) => ({ roleId: rid })) } : undefined,
      },
      include: { roles: { include: { role: true } }, stores: { include: { store: { select: { id: true, name: true } } } } },
    });

    const { password: _, ...staffSafe } = staff as typeof staff & { password: string };
    return created(res, staffSafe, 'Staff created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.params.id },
      include: {
        roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        stores: { include: { store: { select: { id: true, name: true } } } },
        permissions: { include: { permission: true } },
      },
    });
    if (!staff) return notFound(res, 'Staff not found');
    const { password: _, pin: __, ...safe } = staff as typeof staff & { password: string; pin: string };
    return ok(res, safe);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/:id', requirePermission('manage_staff'), async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, username, password, pin, hourlyWage, hireDate, isActive, storeIds, roleIds, permissionOverrides } = req.body;
    const updateData: Record<string, unknown> = { firstName, lastName, email, phone, username, hourlyWage, hireDate, isActive };
    if (password) updateData.password = await bcrypt.hash(password, 12);
    if (pin) updateData.pin = await bcrypt.hash(pin, 10);

    // Handle store/role assignments
    if (storeIds) {
      await prisma.staffStore.deleteMany({ where: { staffId: req.params.id } });
      updateData.stores = { create: storeIds.map((sid: string) => ({ storeId: sid })) };
    }
    if (roleIds) {
      await prisma.staffRole.deleteMany({ where: { staffId: req.params.id } });
      updateData.roles = { create: roleIds.map((rid: string) => ({ roleId: rid })) };
    }
    if (permissionOverrides) {
      await prisma.staffPermission.deleteMany({ where: { staffId: req.params.id } });
      const perms = await prisma.permission.findMany({ where: { key: { in: Object.keys(permissionOverrides) } } });
      for (const perm of perms) {
        await prisma.staffPermission.create({
          data: { staffId: req.params.id, permissionId: perm.id, granted: permissionOverrides[perm.key] },
        });
      }
    }

    const staff = await prisma.staff.update({ where: { id: req.params.id }, data: updateData as never });
    return ok(res, staff, 'Staff updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/:id', requirePermission('manage_staff'), async (req: Request, res: Response) => {
  try {
    await prisma.staff.update({ where: { id: req.params.id }, data: { isActive: false } });
    return ok(res, null, 'Staff deactivated');
  } catch (e) {
    return serverError(res, e);
  }
});

// Staff schedules
router.get('/:id/schedule', async (req: Request, res: Response) => {
  try {
    const schedules = await prisma.staffSchedule.findMany({ where: { staffId: req.params.id }, orderBy: { dayOfWeek: 'asc' } });
    return ok(res, schedules);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/:id/schedule', requirePermission('manage_staff'), async (req: Request, res: Response) => {
  try {
    const { schedules } = req.body;
    await prisma.staffSchedule.deleteMany({ where: { staffId: req.params.id } });
    if (schedules?.length) {
      await prisma.staffSchedule.createMany({
        data: schedules.map((s: { storeId: string; dayOfWeek: number; startTime: string; endTime: string }) => ({ ...s, staffId: req.params.id })),
      });
    }
    const result = await prisma.staffSchedule.findMany({ where: { staffId: req.params.id } });
    return ok(res, result, 'Schedule updated');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
