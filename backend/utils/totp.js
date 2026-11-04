const crypto = require('crypto');

/**
 * Standard RFC 4648 Base32 alphabet
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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
 *
 * @param {Buffer} secretBuf - Secret key buffer
 * @param {number} counter - Time counter step
 * @param {number} digits - Number of digits (default 6)
 * @returns {string} 6-digit TOTP code
 */
function generateHotp(secretBuf, counter, digits = 6) {
  const counterBuf = Buffer.alloc(8);
  // Write counter as 64-bit big-endian integer
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secretBuf);
  hmac.update(counterBuf);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226 section 5.4)
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
 *
 * @param {string} token - The 6-digit TOTP code provided by the user
 * @param {string} secret - Base32 encoded TOTP secret
 * @param {number} window - Time window drift (+/- steps of 30 seconds, default 1)
 * @returns {boolean} True if token matches
 */
function verifyTotp(token, secret, window = 1) {
  if (!token || !secret) return false;

  const sanitizedToken = String(token).trim();
  if (!/^\d{6}$/.test(sanitizedToken)) return false;

  try {
    const secretBuf = base32Decode(secret);
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
  base32Encode,
  base32Decode,
  generateHotp,
};
