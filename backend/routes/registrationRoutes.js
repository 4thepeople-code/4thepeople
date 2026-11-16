const express = require('express');
const router = express.Router();
const { authenticateToken, crossCollegeRegisterMiddleware } = require('../middleware/authMiddleware');
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
router.get('/:eventId/my-registration', validate({ params: eventParams }), crossCollegeRegisterMiddleware, getMyRegistrationStatus);
router.get('/:eventId/export', validate({ params: eventParams }), authenticateToken, exportEventRegistrations);
// Cross-college registration uses crossCollegeRegisterMiddleware (accepts cross-tenant JWTs)
router.post('/:eventId/register', validate({ params: eventParams }), crossCollegeRegisterMiddleware, registerForEvent);
router.delete('/:eventId/register', validate({ params: eventParams }), crossCollegeRegisterMiddleware, cancelRegistration);

module.exports = router;
