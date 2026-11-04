const bcrypt = require('bcryptjs');

// Precomputed bcrypt hash used to normalize execution time for unknown accounts
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('dummy_timing_pad_4thepeople_constant_time', 10);

// In-memory sliding window tracker for failed login attempts
// Key: `${normalizedAccount}|${ip}` -> { count: number, lockedUntil: number, firstAttemptAt: number }
const loginAttemptTracker = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes sliding window

/**
 * Normalizes email and IP into a tracker key.
 */
function getThrottlingKey(account, ip) {
  const normAccount = (account || '').toLowerCase().trim();
  const normIp = (ip || '127.0.0.1').trim();
  return `${normAccount}|${normIp}`;
}

/**
 * Extracts client IP from request safely.
 */
function getClientIp(req) {
  if (!req) return '127.0.0.1';
  if (req.ip) return req.ip;
  if (req.headers && req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

/**
 * Checks if a login attempt is currently throttled / locked out.
 *
 * @param {string} account - Email address
 * @param {string} ip - Client IP
 * @returns {{ isThrottled: boolean, retryAfterSeconds?: number }}
 */
function checkLoginThrottled(account, ip) {
  const key = getThrottlingKey(account, ip);
  const record = loginAttemptTracker.get(key);

  if (!record) {
    return { isThrottled: false };
  }

  const now = Date.now();

  // If locked out, check if lockout duration has passed
  if (record.lockedUntil && now < record.lockedUntil) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isThrottled: true, retryAfterSeconds };
  }

  // If window expired and not locked out, reset record
  if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS && (!record.lockedUntil || now >= record.lockedUntil)) {
    loginAttemptTracker.delete(key);
    return { isThrottled: false };
  }

  return { isThrottled: false };
}

/**
 * Records a failed login attempt. Locks out the account+IP if threshold is reached.
 *
 * @param {string} account - Email address
 * @param {string} ip - Client IP
 */
function recordFailedLogin(account, ip) {
  const key = getThrottlingKey(account, ip);
  const now = Date.now();
  let record = loginAttemptTracker.get(key);

  if (!record || (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS && (!record.lockedUntil || now >= record.lockedUntil))) {
    record = { count: 1, firstAttemptAt: now, lockedUntil: null };
  } else {
    record.count += 1;
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  loginAttemptTracker.set(key, record);
}

/**
 * Clears failed login tracking upon successful login.
 *
 * @param {string} account - Email address
 * @param {string} ip - Client IP
 */
function resetLoginThrottling(account, ip) {
  const key = getThrottlingKey(account, ip);
  loginAttemptTracker.delete(key);
}

/**
 * Performs a dummy bcrypt comparison to ensure execution timing remains
 * identical when a user/email does not exist in the database.
 *
 * @param {string} password - The password string to compare
 */
async function performDummyPasswordComparison(password) {
  const pwd = password || '';
  await bcrypt.compare(pwd, DUMMY_BCRYPT_HASH);
}

/**
 * Clears all tracking records (for testing isolation).
 */
function clearAllLoginThrottling() {
  loginAttemptTracker.clear();
}

module.exports = {
  checkLoginThrottled,
  recordFailedLogin,
  resetLoginThrottling,
  performDummyPasswordComparison,
  clearAllLoginThrottling,
  getClientIp,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
};
