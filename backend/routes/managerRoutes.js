const express = require('express');
const router = express.Router();
const { authenticateToken, requireClubManager, requireAdminOrClubManager } = require('../middleware/authMiddleware');
const {
  getMyClubs,
  updateManagedClub,
  getManagerProfile,
  updateManagerProfile,
  uploadManagerAvatar,
  deleteManagerAvatar,
} = require('../controllers/managerController');
const { createEvent, updateEvent, cancelEvent, listManagedClubEvents } = require('../controllers/eventController');
const { getEventAttendees } = require('../controllers/registrationController');
const { singleImage } = require('../middleware/uploadMiddleware');
const { validate } = require('../middleware/validate');
const { clubParams, clubEventParams, updateClubBody, createEventBody, updateEventBody, attendeeQuery } = require('../validators/schemas');
const { uploadLimiter } = require('../middleware/rateLimiters');

// Profile routes
router.get('/profile', authenticateToken, getManagerProfile);
router.patch('/profile', authenticateToken, updateManagerProfile);
router.post('/profile/avatar', uploadLimiter, authenticateToken, singleImage('avatar'), uploadManagerAvatar);
router.delete('/profile/avatar', uploadLimiter, authenticateToken, deleteManagerAvatar);

// GET /manager/my-clubs
router.get('/my-clubs', authenticateToken, getMyClubs);

// PATCH /manager/clubs/:clubId
router.patch('/clubs/:clubId', validate({ params: clubParams, body: updateClubBody }), authenticateToken, requireClubManager('clubId'), updateManagedClub);

// Event routes
router.get('/clubs/:clubId/events', validate({ params: clubParams }), requireAdminOrClubManager('clubId'), listManagedClubEvents);
router.post('/clubs/:clubId/events', validate({ params: clubParams, body: createEventBody }), authenticateToken, requireClubManager('clubId'), createEvent);
router.patch('/clubs/:clubId/events/:eventId', validate({ params: clubEventParams, body: updateEventBody }), authenticateToken, requireClubManager('clubId'), updateEvent);
router.patch('/clubs/:clubId/events/:eventId/cancel', validate({ params: clubEventParams }), authenticateToken, requireClubManager('clubId'), cancelEvent);
router.get('/clubs/:clubId/events/:eventId/registrations', validate({ params: clubEventParams, query: attendeeQuery }), requireAdminOrClubManager('clubId'), getEventAttendees);

module.exports = router;
