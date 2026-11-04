const crypto = require('crypto');

/**
 * Standard RFC 4648 Base32 alphabet
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * In-memory replay cache to reject TOTP code reuse within its valid window.
 * Key: `${adminId}:${code}` -> expiresAt (timestamp)
 */
const usedTotpCache = new Map();

/**
 * Derives a 32-byte key from environment for AES-256-GCM.
 */
function getEncryptionKey() {
  const secret = process.env.TOTP_ENCRYPTION_KEY || 'dev_totp_encryption_key_do_not_use_in_prod_1234567890';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext Base32 TOTP secret at rest using AES-256-GCM.
 *
 * @param {string} plainSecret - Plain Base32 secret string
 * @returns {string} Formatted as `enc:<iv_hex>:<tag_hex>:<ciphertext_hex>`
 */
function encryptTotpSecret(plainSecret) {
  if (!plainSecret) return null;
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);

  let encrypted = cipher.update(plainSecret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `enc:${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts a stored TOTP secret. Supports backward compatibility with unencrypted secrets.
 *
 * @param {string} storedValue - The encrypted string from database
 * @returns {string} Plaintext Base32 secret
 */
function decryptTotpSecret(storedValue) {
  if (!storedValue) return null;
  if (!storedValue.startsWith('enc:')) {
    // Unencrypted legacy fallback
    return storedValue;
  }

  const parts = storedValue.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted TOTP secret format');
  }

  const [, ivHex, tagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Checks whether a TOTP code was already consumed for an administrator within its valid window.
 * Rejects code reuse to prevent replay attacks.
 *
 * @param {string} adminId - Platform admin UUID
 * @param {string} code - 6-digit TOTP code
 * @returns {boolean} True if code is fresh (not reused); false if already used.
 */
function recordAndCheckTotpUsage(adminId, code) {
  const key = `${adminId}:${code.trim()}`;
  const now = Date.now();

  // Prune expired entries
  for (const [k, exp] of usedTotpCache.entries()) {
    if (now > exp) {
      usedTotpCache.delete(k);
    }
  }

  if (usedTotpCache.has(key)) {
    return false; // Code was already consumed
  }

  // Mark code consumed for 90 seconds (covering current step +/- 1 drift window)
  usedTotpCache.set(key, now + 90 * 1000);
  return true;
}

/**
 * Clears TOTP replay cache (for test isolation).
 */
function clearUsedTotpCache() {
  usedTotpCache.clear();
}

/**
 * Generates an otpauth:// URL for QR code generation in authenticator apps.
 */
function generateOtpauthUrl(email, plainSecret, issuer = '4 THE PEOPLE Platform') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${plainSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Decodes a Base32 string into a Buffer.
 * Ignores whitespace, hyphens, and padding characters.
 */
function base32Decode(str) {
  if (!str || typeof str !== 'string') {
    throw new Error('Invalid Base32 input');
  }

  const cleaned = str.toUpperCase().replace(/[\s\-=]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Encodes a Buffer into a Base32 string.
 */
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Generates an RFC 6238 TOTP token for a given counter and secret buffer.
 */
function generateHotp(secretBuf, counter, digits = 6) {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secretBuf);
  hmac.update(counterBuf);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verifies a 6-digit TOTP token against a Base32 secret with drift window tolerance.
 */
function verifyTotp(token, secret, window = 1) {
  if (!token || !secret) return false;

  const sanitizedToken = String(token).trim();
  if (!/^\d{6}$/.test(sanitizedToken)) return false;

  try {
    const plainSecret = decryptTotpSecret(secret);
    const secretBuf = base32Decode(plainSecret);
    const step = 30; // 30-second time step
    const currentCounter = Math.floor(Date.now() / 1000 / step);

    for (let i = -window; i <= window; i++) {
      const expectedToken = generateHotp(secretBuf, currentCounter + i, 6);
      if (crypto.timingSafeEqual(Buffer.from(sanitizedToken), Buffer.from(expectedToken))) {
        return true;
      }
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Generates a new random Base32 TOTP secret (20 bytes = 160 bits).
 */
function generateTotpSecret() {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

module.exports = {
  verifyTotp,
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  recordAndCheckTotpUsage,
  clearUsedTotpCache,
  generateOtpauthUrl,
  base32Encode,
  base32Decode,
  generateHotp,
};
