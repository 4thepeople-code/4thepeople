const express = require('express');
const router = express.Router();
const {
  getColleges,
  getCollegeById,
  createCollege,
  updateCollege,
  toggleCollegeStatus,
  provisionCollegeAdmin,
  resendCollegeAdminInvitation,
  toggleCollegeAdminStatus,
} = require('./platformCollegeManagementController');
const {
  getPaymentConfig,
  updatePaymentConfig,
  testPaymentConnection,
  getPaymentConfigAudits,
} = require('./platformPaymentConfigController');
const { platformRefund } = require('../controllers/paymentController');
const { authenticatePlatformToken } = require('./platformAuthMiddleware');

// All endpoints strictly require Platform Super-Administrator authorization
router.use(authenticatePlatformToken);

// College CRUD & Management
router.get('/colleges', getColleges);
router.post('/colleges', createCollege);
router.get('/colleges/:id', getCollegeById);
router.put('/colleges/:id', updateCollege);
router.patch('/colleges/:id/status', toggleCollegeStatus);

// College Payment Gateway Configuration
router.get('/colleges/:collegeId/payment-config', getPaymentConfig);
router.put('/colleges/:collegeId/payment-config', updatePaymentConfig);
router.post('/colleges/:collegeId/payment-config/test-connection', testPaymentConnection);
router.get('/colleges/:collegeId/payment-config/audits', getPaymentConfigAudits);

// Platform Payment Refund
router.post('/payments/transactions/:transactionId/refund', platformRefund);

// College Admin Provisioning under college
router.post('/colleges/:id/admins', provisionCollegeAdmin);

// Standalone College Admin Operations
router.post('/college-admins/:id/resend-invitation', resendCollegeAdminInvitation);
router.patch('/college-admins/:id/status', toggleCollegeAdminStatus);

module.exports = router;

