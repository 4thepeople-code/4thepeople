const express = require('express');
const router = express.Router();
const {
  listPublicClubs,
  getPublicClub,
} = require('../controllers/clubController');
const {
  listDepartments,
  getDepartment,
} = require('../controllers/departmentController');
const {
  listUpcomingEvents,
  listPastEvents,
  listAllUpcomingEvents,
  getPublicEvent,
  discoverPublicEvents,
  getPublicEventById,
} = require('../controllers/eventController');
const { validate } = require('../middleware/validate');
const { clubParams, departmentParams, clubEventParams, eventParams } = require('../validators/schemas');

// These routes are intentionally public: do not add authentication middleware.
router.get('/events', discoverPublicEvents);
router.get('/events/upcoming', listAllUpcomingEvents);
router.get('/events/:eventId', validate({ params: eventParams }), getPublicEventById);
router.get('/clubs', listPublicClubs);
router.get('/departments', listDepartments);
router.get('/departments/:departmentId', validate({ params: departmentParams }), getDepartment);
router.get('/clubs/:clubId/events/upcoming', validate({ params: clubParams }), listUpcomingEvents);
router.get('/clubs/:clubId/events/past', validate({ params: clubParams }), listPastEvents);
router.get('/clubs/:clubId/events/:eventId', validate({ params: clubEventParams }), getPublicEvent);
router.get('/clubs/:clubId', validate({ params: clubParams }), getPublicClub);

module.exports = router;
