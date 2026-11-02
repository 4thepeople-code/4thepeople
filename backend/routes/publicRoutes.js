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
} = require('../controllers/eventController');
const { validate } = require('../middleware/validate');
const { clubParams, departmentParams, clubEventParams } = require('../validators/schemas');

// These routes are intentionally public: do not add authentication middleware.
router.get('/clubs', listPublicClubs);
router.get('/departments', listDepartments);
router.get('/departments/:departmentId', validate({ params: departmentParams }), getDepartment);
router.get('/events/upcoming', listAllUpcomingEvents);
router.get('/clubs/:clubId/events/upcoming', validate({ params: clubParams }), listUpcomingEvents);
router.get('/clubs/:clubId/events/past', validate({ params: clubParams }), listPastEvents);
router.get('/clubs/:clubId/events/:eventId', validate({ params: clubEventParams }), getPublicEvent);
router.get('/clubs/:clubId', validate({ params: clubParams }), getPublicClub);

module.exports = router;
