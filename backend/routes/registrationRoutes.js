const express = require('express');
const router = express.Router();
const { authenticateToken, crossCollegeRegisterMiddleware, authenticateAnyParticipant } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { eventParams } = require('../validators/schemas');
const {
  registerForEvent,
  cancelRegistration,
  getMyRegistrationStatus,
  listMyRegistrations,
  exportEventRegistrations,
} = require('../controllers/registrationController');
const {
  studentCheckout,
  studentVerifyPayment,
  getTransactionStatus,
} = require('../controllers/paymentController');

// User Registration Endpoints
router.get('/my-registrations', authenticateToken, listMyRegistrations);
router.get('/:eventId/my-registration', validate({ params: eventParams }), crossCollegeRegisterMiddleware, getMyRegistrationStatus);
router.get('/:eventId/export', validate({ params: eventParams }), authenticateToken, exportEventRegistrations);
// Cross-college registration uses crossCollegeRegisterMiddleware (accepts cross-tenant JWTs)
router.post('/:eventId/register', validate({ params: eventParams }), crossCollegeRegisterMiddleware, registerForEvent);
router.delete('/:eventId/register', validate({ params: eventParams }), crossCollegeRegisterMiddleware, cancelRegistration);

// Paid Event Payment & Checkout
router.post('/:eventId/checkout', validate({ params: eventParams }), crossCollegeRegisterMiddleware, studentCheckout);
router.post('/:eventId/verify-payment', validate({ params: eventParams }), crossCollegeRegisterMiddleware, studentVerifyPayment);
router.get('/:eventId/payment-status', validate({ params: eventParams }), authenticateAnyParticipant, getTransactionStatus);
router.get('/:eventId/payment-status/:transactionId', validate({ params: eventParams }), authenticateAnyParticipant, getTransactionStatus);

module.exports = router;
