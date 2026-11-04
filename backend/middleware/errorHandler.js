/**
 * Custom Error Class for operational HTTP errors
 */
class AppError extends Error {
  constructor(message, statusCode, errors = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Central Error-Handling Middleware for Express
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'Internal Server Error';
  let errors = err.errors || {};

  // Handle Prisma Known Request Errors
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON request body.';
  } else if (err.code === 'P2002') {
    statusCode = 409;
    const targetField = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
    message = `A record with this ${targetField} already exists.`;
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found.';
  } else if (err.code === 'P2003' || err.code === 'P2011' || err.code === 'P2023') {
    statusCode = 400;
    message = 'Invalid database input.';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired.';
  }

  // Log non-operational error details for debugging
  if (statusCode === 500) {
    console.error('Unhandled Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { AppError, errorHandler };
