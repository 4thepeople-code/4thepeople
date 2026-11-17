const express = require('express');
const router = express.Router();
const { externalOtpLimiter } = require('../middleware/rateLimiters');
const { authenticateExternalToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const {
  eventParams,
  externalOtpRequestBody,
  externalOtpVerifyBody,
  externalRegisterBody,
} = require('../validators/schemas');
const {
  requestExternalOtp,
  verifyExternalOtp,
  registerExternalParticipant,
  cancelExternalRegistration,
  getExternalRegistrationStatus,
} = require('../controllers/externalController');
const {
  externalCheckout,
  externalVerifyPayment,
} = require('../controllers/paymentController');

// ─── OTP routes ──────────────────────────────────────────────────────────────
// Resolved host college context (subdomain/path) or derived from eventId on root domain.
// withTenant(effectiveCollegeId) is used for OTP DB operations.

router.post(
  '/otp/request',
  externalOtpLimiter,
  validate({ body: externalOtpRequestBody }),
  requestExternalOtp
);

router.post(
  '/otp/verify',
  externalOtpLimiter,
  validate({ body: externalOtpVerifyBody }),
  verifyExternalOtp
);

// ─── Registration routes ─────────────────────────────────────────────────────
// All require external JWT authentication.
// Supports both tenant subdomain context and root-domain registration via verified JWT hostCollegeId.

router.post(
  '/events/:eventId/register',
  validate({ params: eventParams, body: externalRegisterBody }),
  authenticateExternalToken,
  registerExternalParticipant
);

router.delete(
  '/events/:eventId/register',
  validate({ params: eventParams }),
  authenticateExternalToken,
  cancelExternalRegistration
);

router.get(
  '/events/:eventId/my-registration',
  validate({ params: eventParams }),
  authenticateExternalToken,
  getExternalRegistrationStatus
);

// ─── Payment & Checkout routes ───────────────────────────────────────────────
router.post(
  '/events/:eventId/checkout',
  validate({ params: eventParams }),
  authenticateExternalToken,
  externalCheckout
);

router.post(
  '/events/:eventId/verify-payment',
  validate({ params: eventParams }),
  authenticateExternalToken,
  externalVerifyPayment
);

module.exports = router;
