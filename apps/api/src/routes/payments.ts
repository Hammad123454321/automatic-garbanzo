import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { authenticate, loadPermissions, requirePermission } from '../middleware/auth';
import { ok, created, badRequest, notFound, serverError } from '../utils/response';

const router = Router();
router.use(authenticate, loadPermissions);

// Process payment
router.post('/', async (req: Request, res: Response) => {
  try {
    const { orderId, method, amount, tipAmount, cardBrand, cardLast4, authCode, transactionId, giftCardId, referenceNumber, terminalResponse } = req.body;
    if (!orderId || !method || !amount) return badRequest(res, 'orderId, method, and amount required');

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    if (!order) return notFound(res, 'Order not found');

    // Gift card payment deduction
    if (method === 'GIFT_CARD' && giftCardId) {
      const gc = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
      if (!gc || gc.status !== 'ACTIVE') return badRequest(res, 'Invalid or inactive gift card');
      if (parseFloat(gc.currentBalance.toString()) < parseFloat(amount)) return badRequest(res, 'Insufficient gift card balance');
      await prisma.giftCard.update({ where: { id: giftCardId }, data: { currentBalance: { decrement: parseFloat(amount) } } });
      await prisma.giftCardTransaction.create({ data: { giftCardId, storeId: order.storeId, orderId, type: 'REDEMPTION', amount, balance: parseFloat(gc.currentBalance.toString()) - parseFloat(amount) } });
    }

    // Member balance payment
    if (method === 'MEMBERSHIP_BALANCE' && order.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: order.customerId } });
      if (!customer || parseFloat(customer.memberBalance.toString()) < parseFloat(amount)) return badRequest(res, 'Insufficient member balance');
      await prisma.customer.update({ where: { id: order.customerId }, data: { memberBalance: { decrement: parseFloat(amount) } } });
    }

    const payment = await prisma.payment.create({
      data: {
        orderId, method, amount, tipAmount: tipAmount || 0,
        cardBrand, cardLast4, cardHolderName: req.body.cardHolderName,
        authCode, transactionId, terminalResponse, giftCardId,
        giftCardLast4: req.body.giftCardLast4, referenceNumber,
        status: 'CAPTURED', processedAt: new Date(),
      },
    });

    // Update order paid amount
    const newPaidAmount = parseFloat(order.paidAmount.toString()) + parseFloat(amount);
    const change = Math.max(0, newPaidAmount - parseFloat(order.totalAmount.toString()));

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        paidAmount: newPaidAmount, changeAmount: change,
        status: newPaidAmount >= parseFloat(order.totalAmount.toString()) ? 'COMPLETED' : 'PENDING',
        completedAt: newPaidAmount >= parseFloat(order.totalAmount.toString()) ? new Date() : null,
      },
    });

    // Award loyalty points if customer
    if (order.customerId && newPaidAmount >= parseFloat(order.totalAmount.toString())) {
      const points = Math.floor(parseFloat(order.totalAmount.toString()));
      await prisma.customer.update({ where: { id: order.customerId }, data: { loyaltyPoints: { increment: points } } });
      await prisma.loyaltyEvent.create({ data: { customerId: order.customerId, storeId: order.storeId, orderId, points, type: 'EARNED', description: `Order ${order.orderNumber}` } });
      await prisma.storeCustomer.upsert({
        where: { customerId_storeId: { customerId: order.customerId, storeId: order.storeId } },
        update: { visitCount: { increment: 1 }, lastVisit: new Date() },
        create: { customerId: order.customerId, storeId: order.storeId, visitCount: 1, lastVisit: new Date() },
      });
    }

    await prisma.auditLog.create({ data: { storeId: order.storeId, staffId: req.user?.id, action: 'PAYMENT', entity: 'payment', entityId: payment.id, after: { method, amount } } });

    return created(res, { payment, order: updatedOrder }, 'Payment processed');
  } catch (e) {
    return serverError(res, e);
  }
});

// Process refund
router.post('/:paymentId/refund', requirePermission('full_refund'), async (req: Request, res: Response) => {
  try {
    const { amount, reason } = req.body;
    if (!amount) return badRequest(res, 'amount required');

    const payment = await prisma.payment.findUnique({ where: { id: req.params.paymentId }, include: { order: true } });
    if (!payment) return notFound(res, 'Payment not found');

    const refundAmount = parseFloat(amount);
    const alreadyRefunded = parseFloat(payment.refundedAmount.toString());
    const paymentAmount = parseFloat(payment.amount.toString());

    if (refundAmount > paymentAmount - alreadyRefunded) return badRequest(res, 'Refund amount exceeds available');

    const refund = await prisma.refund.create({
      data: { paymentId: req.params.paymentId, amount: refundAmount, reason, staffId: req.user?.id },
    });

    const newRefunded = alreadyRefunded + refundAmount;
    await prisma.payment.update({
      where: { id: req.params.paymentId },
      data: {
        refundedAmount: newRefunded,
        status: newRefunded >= paymentAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAt: new Date(),
      },
    });

    await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: newRefunded >= paymentAmount ? 'REFUNDED' : 'COMPLETED', refundedAt: newRefunded >= paymentAmount ? new Date() : null },
    });

    await prisma.auditLog.create({
      data: { storeId: payment.order.storeId, staffId: req.user?.id, action: 'REFUND', entity: 'payment', entityId: payment.id, after: { refundAmount, reason } },
    });

    return ok(res, refund, `Refund of $${refundAmount.toFixed(2)} processed`);
  } catch (e) {
    return serverError(res, e);
  }
});

// PAX terminal integration (semi-integrated)
router.post('/terminal/charge', async (req: Request, res: Response) => {
  try {
    const { deviceId, amount, tipAmount } = req.body;
    if (!deviceId || !amount) return badRequest(res, 'deviceId and amount required');

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return notFound(res, 'Device not found');

    // In production, this calls the PAX/CodePay SDK
    // For now, return a mock terminal response
    const mockResponse = {
      approved: true,
      authCode: `AUTH${Date.now()}`,
      transactionId: `TXN${Date.now()}`,
      cardBrand: 'VISA',
      cardLast4: '4242',
      amount,
      tipAmount: tipAmount || 0,
      message: 'APPROVED',
    };

    return ok(res, mockResponse, 'Terminal transaction initiated');
  } catch (e) {
    return serverError(res, e);
  }
});

export default router;
