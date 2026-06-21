import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, paginated, badRequest, notFound, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// ── Categories ─────────────────────────────────────────────────────────────

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const categories = await prisma.category.findMany({
      where: { storeId: storeId as string, isActive: true },
      include: { _count: { select: { products: true, menuItems: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return ok(res, categories);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/categories', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { storeId, name, nameZh, description, imageUrl, sortOrder, printerId } = req.body;
    if (!storeId || !name) return badRequest(res, 'storeId and name required');
    const category = await prisma.category.create({ data: { storeId, name, nameZh, description, imageUrl, sortOrder: sortOrder || 0, printerId } });
    return created(res, category, 'Category created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/categories/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { name, nameZh, description, imageUrl, sortOrder, isActive, printerId } = req.body;
    const category = await prisma.category.update({ where: { id: req.params.id }, data: { name, nameZh, description, imageUrl, sortOrder, isActive, printerId } });
    return ok(res, category, 'Category updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/categories/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    return ok(res, null, 'Category deactivated');
  } catch (e) {
    return serverError(res, e);
  }
});

// Reorder categories
router.post('/categories/reorder', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: Array<{ id: string; sortOrder: number }> };
    await Promise.all(items.map((item) => prisma.category.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })));
    return ok(res, null, 'Order saved');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Modifier Groups ────────────────────────────────────────────────────────

router.get('/modifier-groups', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const groups = await prisma.modifierGroup.findMany({
      where: { storeId: storeId as string, isActive: true },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return ok(res, groups);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/modifier-groups', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { storeId, name, nameZh, required, minSelect, maxSelect, options } = req.body;
    if (!storeId || !name) return badRequest(res, 'storeId and name required');
    const group = await prisma.modifierGroup.create({
      data: {
        storeId, name, nameZh, required: required || false,
        minSelect: minSelect || 0, maxSelect: maxSelect || 1,
        options: options ? { create: options } : undefined,
      },
      include: { options: true },
    });
    return created(res, group, 'Modifier group created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/modifier-groups/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { name, nameZh, required, minSelect, maxSelect, options } = req.body;
    if (options) {
      await prisma.modifierOption.deleteMany({ where: { modifierGroupId: req.params.id } });
    }
    const group = await prisma.modifierGroup.update({
      where: { id: req.params.id },
      data: {
        name, nameZh, required, minSelect, maxSelect,
        options: options ? { create: options } : undefined,
      },
      include: { options: true },
    });
    return ok(res, group, 'Modifier group updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/modifier-groups/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    await prisma.modifierGroup.update({ where: { id: req.params.id }, data: { isActive: false } });
    return ok(res, null, 'Modifier group deactivated');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Products (Retail) ──────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { storeId, categoryId, search, active } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    if (!storeId) return badRequest(res, 'storeId required');

    const where: Record<string, unknown> = { storeId };
    if (categoryId) where.categoryId = categoryId;
    if (active !== undefined) where.isActive = active === 'true';
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search } }, { barcode: { contains: search } }];

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: { category: { select: { id: true, name: true } }, variants: true, inventory: { select: { quantity: true } }, _count: { select: { modifierGroups: true } } },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      }),
      prisma.product.count({ where }),
    ]);
    return paginated(res, products, total, page, limit);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { storeId, categoryId, sku, barcode, name, nameZh, description, imageUrl, type, price, costPrice, taxRate, isTaxInclusive, weightUnit, timeUnit, isActive, trackInventory, lowStockAlert, printerId, sortOrder, tags, modifierGroupIds, variants } = req.body;
    if (!storeId || !name) return badRequest(res, 'storeId and name required');

    const product = await prisma.product.create({
      data: {
        storeId, categoryId, sku, barcode, name, nameZh, description, imageUrl,
        type: type || 'STANDARD', price, costPrice, taxRate, isTaxInclusive: isTaxInclusive || false,
        weightUnit, timeUnit, isActive: isActive !== false, trackInventory: trackInventory !== false,
        lowStockAlert: lowStockAlert || 5, printerId, sortOrder: sortOrder || 0, tags: tags || [],
        modifierGroups: modifierGroupIds ? { create: modifierGroupIds.map((mgid: string) => ({ modifierGroupId: mgid })) } : undefined,
        variants: variants ? { create: variants } : undefined,
      },
      include: { category: { select: { id: true, name: true } }, variants: true, modifierGroups: { include: { modifierGroup: { include: { options: true } } } } },
    });

    // Initialize inventory if tracking
    if (product.trackInventory) {
      await prisma.inventory.create({ data: { storeId, productId: product.id, quantity: 0 } });
    }

    return created(res, product, 'Product created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true, variants: true,
        modifierGroups: { include: { modifierGroup: { include: { options: true } } } },
        inventory: true,
      },
    });
    if (!product) return notFound(res, 'Product not found');
    return ok(res, product);
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { categoryId, sku, barcode, name, nameZh, description, imageUrl, type, price, costPrice, taxRate, isTaxInclusive, weightUnit, timeUnit, isActive, trackInventory, lowStockAlert, printerId, sortOrder, tags, modifierGroupIds } = req.body;

    if (modifierGroupIds) {
      await prisma.productModifierGroup.deleteMany({ where: { productId: req.params.id } });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        categoryId, sku, barcode, name, nameZh, description, imageUrl, type, price, costPrice, taxRate, isTaxInclusive, weightUnit, timeUnit, isActive, trackInventory, lowStockAlert, printerId, sortOrder, tags,
        modifierGroups: modifierGroupIds ? { create: modifierGroupIds.map((mgid: string) => ({ modifierGroupId: mgid })) } : undefined,
      },
      include: { category: true, variants: true, modifierGroups: { include: { modifierGroup: { include: { options: true } } } } },
    });
    return ok(res, product, 'Product updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    return ok(res, null, 'Product deactivated');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Menu Items (Restaurant) ────────────────────────────────────────────────

router.get('/menu-items', async (req: Request, res: Response) => {
  try {
    const { storeId, categoryId, available } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const where: Record<string, unknown> = { storeId };
    if (categoryId) where.categoryId = categoryId;
    if (available === 'true') where.isAvailable = true;
    const items = await prisma.menuItem.findMany({
      where, include: { category: { select: { id: true, name: true } }, modifierGroups: { include: { modifierGroup: { include: { options: true } } } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
    return ok(res, items);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/menu-items', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { storeId, categoryId, name, nameZh, description, imageUrl, price, taxRate, isActive, isAvailable, printerId, sortOrder, tags, modifierGroupIds } = req.body;
    if (!storeId || !name || price === undefined) return badRequest(res, 'storeId, name, and price required');
    const item = await prisma.menuItem.create({
      data: {
        storeId, categoryId, name, nameZh, description, imageUrl, price, taxRate,
        isActive: isActive !== false, isAvailable: isAvailable !== false,
        printerId, sortOrder: sortOrder || 0, tags: tags || [],
        modifierGroups: modifierGroupIds ? { create: modifierGroupIds.map((mgid: string) => ({ modifierGroupId: mgid })) } : undefined,
      },
      include: { modifierGroups: { include: { modifierGroup: { include: { options: true } } } } },
    });
    return created(res, item, 'Menu item created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/menu-items/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { categoryId, name, nameZh, description, imageUrl, price, taxRate, isActive, isAvailable, printerId, sortOrder, tags, modifierGroupIds } = req.body;
    if (modifierGroupIds) await prisma.menuItemModifierGroup.deleteMany({ where: { menuItemId: req.params.id } });
    const item = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: {
        categoryId, name, nameZh, description, imageUrl, price, taxRate, isActive, isAvailable, printerId, sortOrder, tags,
        modifierGroups: modifierGroupIds ? { create: modifierGroupIds.map((mgid: string) => ({ modifierGroupId: mgid })) } : undefined,
      },
      include: { modifierGroups: { include: { modifierGroup: { include: { options: true } } } } },
    });
    return ok(res, item, 'Menu item updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/menu-items/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    await prisma.menuItem.update({ where: { id: req.params.id }, data: { isActive: false } });
    return ok(res, null, 'Menu item deactivated');
  } catch (e) {
    return serverError(res, e);
  }
});

// ── Services (Salon) ───────────────────────────────────────────────────────

router.get('/services', async (req: Request, res: Response) => {
  try {
    const { storeId, categoryId } = req.query;
    if (!storeId) return badRequest(res, 'storeId required');
    const where: Record<string, unknown> = { storeId, isActive: true };
    if (categoryId) where.categoryId = categoryId;
    const services = await prisma.service.findMany({ where, orderBy: [{ sortOrder: 'asc' }] });
    return ok(res, services);
  } catch (e) {
    return serverError(res, e);
  }
});

router.post('/services', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const { storeId, categoryId, name, nameZh, description, price, duration, commissionType, commissionRate, sortOrder } = req.body;
    if (!storeId || !name || price === undefined) return badRequest(res, 'storeId, name, and price required');
    const service = await prisma.service.create({
      data: { storeId, categoryId, name, nameZh, description, price, duration: duration || 60, commissionType, commissionRate, sortOrder: sortOrder || 0 },
    });
    return created(res, service, 'Service created');
  } catch (e) {
    return serverError(res, e);
  }
});

router.put('/services/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    const service = await prisma.service.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, service, 'Service updated');
  } catch (e) {
    return serverError(res, e);
  }
});

router.delete('/services/:id', requirePermission('manage_products'), async (req: Request, res: Response) => {
  try {
    await prisma.service.update({ where: { id: req.params.id }, data: { isActive: false } });
    return ok(res, null, 'Service deactivated');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
