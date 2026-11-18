'use strict';

const express = require('express');
const router = express.Router();
const {
  razorpayWebhook,
  cashfreeWebhook,
  getGatewayReadiness,
  getTransactionStatus,
} = require('../controllers/paymentController');
const { authenticateAnyParticipant } = require('../middleware/authMiddleware');

// Inbound Gateway Webhook Endpoints
// Webhook signature verification operates inside the controllers / services.
// Raw body is preserved by raw-body middleware in index.js.
router.post('/webhooks/razorpay', razorpayWebhook);
router.post('/webhooks/cashfree', cashfreeWebhook);

// Read-only College Gateway Readiness
router.get('/readiness', getGatewayReadiness);
router.get('/gateway-readiness', getGatewayReadiness);

// Authoritative Payment Transaction Status
router.get('/transactions/:transactionId', authenticateAnyParticipant, getTransactionStatus);

module.exports = router;
