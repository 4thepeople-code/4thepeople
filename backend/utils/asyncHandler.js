/**
 * Async handler wrapper to catch errors in async express routes and pass them to next()
 * @param {Function} fn - Async route handler
 * @returns {Function} Express middleware handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
