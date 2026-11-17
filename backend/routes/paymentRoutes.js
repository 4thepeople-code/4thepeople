'use strict';

const express = require('express');
const router = express.Router();
const {
  razorpayWebhook,
  cashfreeWebhook,
} = require('../controllers/paymentController');

// Inbound Gateway Webhook Endpoints
// Webhook signature verification operates inside the controllers / services.
// Raw body is preserved by raw-body middleware in index.js.
router.post('/webhooks/razorpay', razorpayWebhook);
router.post('/webhooks/cashfree', cashfreeWebhook);

module.exports = router;
