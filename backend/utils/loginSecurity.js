const bcrypt = require('bcryptjs');

// Precomputed bcrypt hash used to normalize execution time for unknown accounts
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('dummy_timing_pad_4thepeople_constant_time', 10);

// In-memory sliding window tracker for failed login attempts
// 1. IP + Account tracker (locks out after MAX_FAILED_ATTEMPTS)
// Key: `${normalizedAccount}|${ip}` -> { count: number, lockedUntil: number, firstAttemptAt: number }
const loginAttemptTracker = new Map();

// 2. Per-Account progressive delay tracker (independent of client IP)
// Key: `${normalizedAccount}` -> { count: number, lastAttemptAt: number }
const accountProgressiveTracker = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout for IP+account combo
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const ACCOUNT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes window for progressive delay

/**
 * Calculates progressive delay (exponential backoff) based on consecutive failed attempts.
 * Independent of client IP.
 * - 1 to 2 failures: 0 seconds (no artificial delay)
 * - 3 failures: 2 seconds
 * - 4 failures: 4 seconds
 * - 5 failures: 8 seconds
 * - 6 failures: 16 seconds
 * - 7+ failures: 30 seconds (capped maximum)
 */
function getProgressiveDelayMs(failedCount) {
  if (!failedCount || failedCount <= 2) return 0;
  const seconds = Math.min(Math.pow(2, failedCount - 2), 30);
  return seconds * 1000;
}

/**
 * Normalizes email and IP into a tracker key.
 */
function getThrottlingKey(account, ip) {
  const normAccount = (account || '').toLowerCase().trim();
  const normIp = (ip || '127.0.0.1').trim();
  return `${normAccount}|${normIp}`;
}

/**
 * Normalizes account email string.
 */
function getAccountKey(account) {
  return (account || '').toLowerCase().trim();
}

/**
 * Extracts client IP derived exclusively via Express req.ip (using trust proxy).
 */
function getClientIp(req) {
  if (!req) return '127.0.0.1';
  return req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

/**
 * Checks if a login attempt is throttled by:
 * 1. Per-account progressive delay (independent of IP).
 * 2. Per-account + IP threshold lock.
 *
 * @param {string} account - Email address
 * @param {string} ip - Client IP
 * @returns {{ isThrottled: boolean, retryAfterSeconds?: number, reason?: string }}
 */
function checkLoginThrottled(account, ip) {
  const now = Date.now();
  const accKey = getAccountKey(account);

  // 1. Check per-account progressive delay (independent of IP)
  const accRecord = accountProgressiveTracker.get(accKey);
  if (accRecord && accRecord.count > 2) {
    if (now - accRecord.lastAttemptAt > ACCOUNT_WINDOW_MS) {
      accountProgressiveTracker.delete(accKey);
    } else {
      const requiredDelayMs = getProgressiveDelayMs(accRecord.count);
      const elapsedMs = now - accRecord.lastAttemptAt;
      if (elapsedMs < requiredDelayMs) {
        const retryAfterSeconds = Math.ceil((requiredDelayMs - elapsedMs) / 1000);
        return {
          isThrottled: true,
          retryAfterSeconds,
          reason: `Too many failed attempts for this account. Please wait ${retryAfterSeconds} seconds before trying again.`,
        };
      }
    }
  }

  // 2. Check per-account + IP limit
  const key = getThrottlingKey(account, ip);
  const record = loginAttemptTracker.get(key);

  if (!record) {
    return { isThrottled: false };
  }

  // If locked out, check if lockout duration has passed
  if (record.lockedUntil && now < record.lockedUntil) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      isThrottled: true,
      retryAfterSeconds,
      reason: `Too many failed login attempts. Please try again in ${retryAfterSeconds} seconds.`,
    };
  }

  // If window expired and not locked out, reset record
  if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS && (!record.lockedUntil || now >= record.lockedUntil)) {
    loginAttemptTracker.delete(key);
    return { isThrottled: false };
  }

  return { isThrottled: false };
}

/**
 * Records a failed login attempt for both the per-account tracker and IP+account tracker.
 *
 * @param {string} account - Email address
 * @param {string} ip - Client IP
 */
function recordFailedLogin(account, ip) {
  const now = Date.now();

  // 1. Record in per-account progressive delay tracker
  const accKey = getAccountKey(account);
  let accRecord = accountProgressiveTracker.get(accKey);
  if (!accRecord || now - accRecord.lastAttemptAt > ACCOUNT_WINDOW_MS) {
    accRecord = { count: 1, lastAttemptAt: now };
  } else {
    accRecord.count += 1;
    accRecord.lastAttemptAt = now;
  }
  accountProgressiveTracker.set(accKey, accRecord);

  // 2. Record in account + IP tracker
  const key = getThrottlingKey(account, ip);
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
  const accKey = getAccountKey(account);
  accountProgressiveTracker.delete(accKey);

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
  accountProgressiveTracker.clear();
}

module.exports = {
  checkLoginThrottled,
  recordFailedLogin,
  resetLoginThrottling,
  performDummyPasswordComparison,
  clearAllLoginThrottling,
  getClientIp,
  getProgressiveDelayMs,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
};
