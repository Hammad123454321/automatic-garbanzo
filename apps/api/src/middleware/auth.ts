import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { unauthorized, forbidden } from '../utils/response';
import { prisma } from '../config/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      staffPermissions?: string[];
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorized(res);
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return unauthorized(res, 'Token expired or invalid');
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.type !== 'super_admin') {
    return forbidden(res, 'Super admin access required');
  }
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.type !== 'staff') {
    return forbidden(res, 'Staff login required');
  }
  next();
}

// Middleware that loads staff permissions into req.staffPermissions
export function loadPermissions(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.type !== 'staff') return next();
  const staffId = req.user.id;
  (async () => {
    const granted = new Set<string>();
    const denied = new Set<string>();

    // Role-based permissions
    const rolePerms = await prisma.rolePermission.findMany({
      where: { role: { staffRoles: { some: { staffId } } } },
      include: { permission: true },
    });
    for (const rp of rolePerms) {
      if (rp.granted) granted.add(rp.permission.key);
      else denied.add(rp.permission.key);
    }

    // Staff-level overrides
    const staffPerms = await prisma.staffPermission.findMany({
      where: { staffId },
      include: { permission: true },
    });
    for (const sp of staffPerms) {
      if (sp.granted) granted.add(sp.permission.key);
      else denied.delete(sp.permission.key), granted.delete(sp.permission.key), denied.add(sp.permission.key);
    }

    req.staffPermissions = Array.from(granted).filter((p) => !denied.has(p));
    next();
  })().catch(next);
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.type === 'super_admin') return next();
    if (!req.staffPermissions?.includes(permission)) {
      return forbidden(res, `Permission required: ${permission}`);
    }
    next();
  };
}
