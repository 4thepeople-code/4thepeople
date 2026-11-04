const express = require('express');
const router = express.Router();
const {
  adminLogin,
  managerLogin,
  requestManagerPasswordReset,
  resetManagerPassword,
  logout,
  getMe,
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { authLimiter, loginLimiter } = require('../middleware/rateLimiters');
const {
  loginBody,
  forgotPasswordBody,
  resetPasswordBody,
} = require('../validators/schemas');

// POST /auth/admin/login
router.post('/admin/login', loginLimiter, validate({ body: loginBody }), adminLogin);

// POST /auth/manager/login
router.post('/manager/login', loginLimiter, validate({ body: loginBody }), managerLogin);

// POST /auth/manager/forgot-password
router.post(
  '/manager/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordBody }),
  requestManagerPasswordReset
);

// POST /auth/manager/reset-password
router.post(
  '/manager/reset-password',
  authLimiter,
  validate({ body: resetPasswordBody }),
  resetManagerPassword
);

// POST /auth/logout
router.post('/logout', logout);

// GET /auth/me
router.get('/me', authenticateToken, getMe);

module.exports = router;
