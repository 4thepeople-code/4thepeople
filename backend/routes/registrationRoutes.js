const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { eventParams } = require('../validators/schemas');
const {
  registerForEvent,
  cancelRegistration,
  getMyRegistrationStatus,
  listMyRegistrations,
  exportEventRegistrations,
} = require('../controllers/registrationController');

// User Registration Endpoints
router.get('/my-registrations', authenticateToken, listMyRegistrations);
router.get('/:eventId/my-registration', validate({ params: eventParams }), authenticateToken, getMyRegistrationStatus);
router.get('/:eventId/export', validate({ params: eventParams }), authenticateToken, exportEventRegistrations);
router.post('/:eventId/register', validate({ params: eventParams }), authenticateToken, registerForEvent);
router.delete('/:eventId/register', validate({ params: eventParams }), authenticateToken, cancelRegistration);

module.exports = router;
