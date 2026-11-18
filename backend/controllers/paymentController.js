'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { defaultPaymentOrderService } = require('../services/payment/paymentOrderService');
const { defaultPaymentVerificationService } = require('../services/payment/paymentVerificationService');
const { defaultPaymentWebhookService } = require('../services/payment/paymentWebhookService');
const { defaultPaymentRefundService } = require('../services/payment/paymentRefundService');
const { defaultPaymentConfigService } = require('../services/payment/paymentConfigService');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const validateUUID = (value, label) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label} (must be a valid UUID)`, 400);
  }
};

/**
 * POST /api/events/:eventId/checkout
 * Initiates checkout session for an authenticated student (same or cross-college).
 */
exports.studentCheckout = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const checkoutSession = await defaultPaymentOrderService.createCheckoutSession({
    collegeId: req.collegeId,
    eventId,
    participant: {
      participantType: 'STUDENT',
      userId: req.user.id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone || null,
      homeCollegeId: req.homeCollegeId || req.collegeId,
    },
    isCrossCollege: Boolean(req.isCrossCollege),
    formAnswers: req.body && (req.body.formAnswers || req.body.answers),
    returnUrl: req.body && req.body.returnUrl,
  });

  res.status(200).json({
    success: true,
    message: checkoutSession.reused ? 'Active checkout session resumed' : 'Checkout session created successfully',
    data: checkoutSession,
  });
});

/**
 * POST /api/events/:eventId/verify-payment
 * Verifies client-side payment completion for an authenticated student.
 */
exports.studentVerifyPayment = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required', 400);
  }
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const { transactionId, paymentDetails } = req.body;
  validateUUID(transactionId, 'transaction ID');

  if (!paymentDetails || typeof paymentDetails !== 'object') {
    throw new AppError('paymentDetails object is required', 400);
  }

  const result = await defaultPaymentVerificationService.verifyPayment({
    collegeId: req.collegeId,
    transactionId,
    paymentDetails,
    expectedUserId: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
});

/**
 * POST /api/external/events/:eventId/checkout
 * Initiates checkout session for an authenticated external participant.
 */
exports.externalCheckout = asyncHandler(async (req, res) => {
  const effectiveCollegeId = req.collegeId || (req.externalUser && req.externalUser.hostCollegeId);
  if (!effectiveCollegeId) {
    throw new AppError('College context required', 400);
  }
  if (!req.externalUser || !req.externalUser.email) {
    throw new AppError('External authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const { externalParticipantId, name, phone, formAnswers, returnUrl } = req.body || {};
  if (externalParticipantId) {
    validateUUID(externalParticipantId, 'external participant ID');
  }

  const checkoutSession = await defaultPaymentOrderService.createCheckoutSession({
    collegeId: effectiveCollegeId,
    eventId,
    participant: {
      participantType: 'EXTERNAL',
      externalParticipantId: externalParticipantId || null,
      name: name || 'Participant',
      email: req.externalUser.email,
      phone: phone || null,
    },
    isCrossCollege: true,
    formAnswers,
    returnUrl,
  });

  res.status(200).json({
    success: true,
    message: checkoutSession.reused ? 'Active checkout session resumed' : 'Checkout session created successfully',
    data: checkoutSession,
  });
});

/**
 * POST /api/external/events/:eventId/verify-payment
 * Verifies payment for an external participant.
 */
exports.externalVerifyPayment = asyncHandler(async (req, res) => {
  const effectiveCollegeId = req.collegeId || (req.externalUser && req.externalUser.hostCollegeId);
  if (!effectiveCollegeId) {
    throw new AppError('College context required', 400);
  }
  if (!req.externalUser || !req.externalUser.email) {
    throw new AppError('External authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const { transactionId, paymentDetails } = req.body;
  validateUUID(transactionId, 'transaction ID');

  if (!paymentDetails || typeof paymentDetails !== 'object') {
    throw new AppError('paymentDetails object is required', 400);
  }

  const result = await defaultPaymentVerificationService.verifyPayment({
    collegeId: effectiveCollegeId,
    transactionId,
    paymentDetails,
    expectedExternalEmail: req.externalUser.email,
  });

  res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
});

/**
 * POST /api/payments/webhooks/razorpay
 * Inbound webhook listener for Razorpay payment and order events.
 */
exports.razorpayWebhook = asyncHandler(async (req, res) => {
  const result = await defaultPaymentWebhookService.processRazorpayWebhook(req);

  res.status(200).json({
    success: true,
    status: result.idempotent ? 'duplicate_acknowledged' : 'processed',
  });
});

/**
 * POST /api/payments/webhooks/cashfree
 * Inbound webhook listener for Cashfree payment and order events.
 */
exports.cashfreeWebhook = asyncHandler(async (req, res) => {
  const result = await defaultPaymentWebhookService.processCashfreeWebhook(req);

  res.status(200).json({
    success: true,
    status: result.idempotent ? 'duplicate_acknowledged' : 'processed',
  });
});

/**
 * POST /api/admin/payments/transactions/:transactionId/refund
 * Initiates a full or partial refund for a paid transaction (College Admin).
 */
exports.adminRefund = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('College context required', 400);
  }
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const { transactionId } = req.params;
  validateUUID(transactionId, 'transaction ID');

  const { amount, reason } = req.body;

  const result = await defaultPaymentRefundService.processRefund({
    collegeId: req.collegeId,
    transactionId,
    amount,
    reason,
    initiatedByAdminId: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: 'Refund initiated successfully',
    data: result,
  });
});

/**
 * POST /api/platform/payments/transactions/:transactionId/refund
 * Platform Super-Admin refund endpoint.
 */
exports.platformRefund = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  validateUUID(transactionId, 'transaction ID');

  const { collegeId, amount, reason } = req.body;
  if (!collegeId) {
    throw new AppError('collegeId is required in request body', 400);
  }
  validateUUID(collegeId, 'college ID');

  const result = await defaultPaymentRefundService.processRefund({
    collegeId,
    transactionId,
    amount,
    reason,
    initiatedByAdminId: req.platformAdmin && req.platformAdmin.id,
  });

  res.status(200).json({
    success: true,
    message: 'Platform refund processed successfully',
    data: result,
  });
});

/**
 * GET /api/payments/transactions/:transactionId
 * or GET /api/events/:eventId/payment-status (with query transactionId)
 *
 * Authoritative, tenant-safe payment transaction status endpoint.
 * Returns authoritative transaction and registration states.
 * Guarantees zero sensitive gateway credential or signature leakage.
 */
exports.getTransactionStatus = asyncHandler(async (req, res) => {
  const transactionId = req.params.transactionId || (req.query && req.query.transactionId);
  validateUUID(transactionId, 'transaction ID');

  const userId = req.user ? req.user.id : null;
  const userRole = req.user ? req.user.role : null;
  const externalEmail = req.externalUser ? req.externalUser.email : null;

  if (!userId && !externalEmail) {
    throw new AppError('Authentication required', 401);
  }

  const effectiveCollegeId = req.collegeId || (req.externalUser && req.externalUser.hostCollegeId);
  if (!effectiveCollegeId) {
    throw new AppError('College context required', 400);
  }

  const result = await defaultPaymentVerificationService.getTransactionStatus({
    collegeId: effectiveCollegeId,
    transactionId,
    caller: {
      userId,
      userRole,
      externalEmail,
    },
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/payments/readiness
 *
 * Read-only endpoint reporting whether the college has an active, usable payment gateway.
 * Returns only safe information: configured status, provider, environment and readiness.
 * Never returns credentials or secrets.
 */
exports.getGatewayReadiness = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const config = await defaultPaymentConfigService.getConfig(req.collegeId);

  const isReady = Boolean(
    config.configured &&
    config.status === 'ACTIVE' &&
    config.hasKeyId &&
    config.hasKeySecret
  );

  res.status(200).json({
    success: true,
    data: {
      collegeId: req.collegeId,
      configured: Boolean(config.configured),
      status: config.status || 'NOT_CONFIGURED',
      provider: config.provider || 'RAZORPAY',
      mode: config.mode || 'COLLEGE_OWNED_GATEWAY',
      isTestMode: Boolean(config.isTestMode),
      displayMerchantName: config.displayMerchantName || null,
      isReady,
    },
  });
});
