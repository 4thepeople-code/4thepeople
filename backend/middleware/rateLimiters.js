const rateLimit = require('express-rate-limit');

const rateLimitHandler = (req, res) => res.status(429).json({
  success: false,
  message: 'Too many requests. Please try again later.',
  errors: {},
});

const createLimiter = (options) => rateLimit({
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  ...options,
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
});

const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

const inviteLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

const uploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

const destructiveLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 25,
});

module.exports = { authLimiter, loginLimiter, inviteLimiter, uploadLimiter, destructiveLimiter };
