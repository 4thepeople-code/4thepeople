const crypto = require('crypto');

/**
 * Returns the activation code pepper secret.
 * In production, refuses to start if missing or under 32 bytes.
 */
function getActivationPepper() {
  const pepper = process.env.ACTIVATION_CODE_PEPPER || 'local_activation_pepper_must_be_32_bytes_long_secret!';
  if (process.env.NODE_ENV === 'production' && (!pepper || Buffer.from(pepper, 'utf8').length < 32)) {
    throw new Error('FATAL SECURITY ERROR: ACTIVATION_CODE_PEPPER must be at least 32 bytes in production');
  }
  return pepper;
}

/**
 * Returns the external OTP pepper secret.
 * This is a dedicated secret, independent from ACTIVATION_CODE_PEPPER.
 * Never falls back to a hardcoded value. Throws if the variable is absent.
 * In production, throws if the value is under 32 bytes.
 */
function getExternalOtpPepper() {
  const pepper = process.env.EXTERNAL_OTP_PEPPER;
  if (!pepper) {
    throw new Error('FATAL SECURITY ERROR: EXTERNAL_OTP_PEPPER is not configured');
  }
  if (process.env.NODE_ENV === 'production' && Buffer.from(pepper, 'utf8').length < 32) {
    throw new Error(
      'FATAL SECURITY ERROR: EXTERNAL_OTP_PEPPER must be at least 32 bytes in production'
    );
  }
  return pepper;
}

/**
 * Hashes an external participant OTP using HMAC-SHA-256 with the external OTP pepper.
 * Input: salt (32-char hex, unique per OTP) concatenated with the 6-digit code.
 * Never logs the pepper, salt, or raw code.
 *
 * @param {string} salt - 32-character hex string unique per OTP record
 * @param {string} code - 6-digit numeric string
 * @returns {string} 64-character hex hash
 */
function hashExternalOtp(salt, code) {
  if (!salt || typeof salt !== 'string') {
    throw new Error('Salt is required for external OTP hashing');
  }
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required for external OTP hashing');
  }
  const pepper = getExternalOtpPepper();
  return crypto.createHmac('sha256', pepper).update(salt + code).digest('hex');
}

/**
 * Verifies a submitted external OTP code against a stored hash in constant time.
 *
 * @param {string} salt - Salt from the stored OTP record
 * @param {string} submittedCode - Code submitted by the user
 * @param {string} storedHash - Hash stored in external_auth_otps
 * @returns {boolean}
 */
function verifyExternalOtpCode(salt, submittedCode, storedHash) {
  if (!salt || !submittedCode || !storedHash) return false;
  try {
    const candidate = hashExternalOtp(salt, submittedCode);
    const bufA = Buffer.from(candidate, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Returns the outbox AES-256-GCM encryption key.
 * In production, refuses to start if missing or under 32 bytes.
 */
function getOutboxKey() {
  const rawKey = process.env.OUTBOX_ENCRYPTION_KEY || 'local_outbox_key_must_be_32_bytes_long_secret!!';
  if (process.env.NODE_ENV === 'production' && (!rawKey || Buffer.from(rawKey, 'utf8').length < 32)) {
    throw new Error('FATAL SECURITY ERROR: OUTBOX_ENCRYPTION_KEY must be at least 32 bytes in production');
  }
  // If provided as 64-char hex string, convert; otherwise take sha256 or slice 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  const buf = Buffer.from(rawKey, 'utf8');
  if (buf.length === 32) return buf;
  return crypto.createHash('sha256').update(buf).digest();
}

/**
 * Generates a secure random 6-digit numeric activation code.
 */
function generateActivationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Computes HMAC-SHA-256 hash of an activation code using server pepper.
 */
function hashActivationCode(code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Activation code is required for hashing');
  }
  const pepper = getActivationPepper();
  return crypto.createHmac('sha256', pepper).update(code.trim()).digest('hex');
}

/**
 * Compares a candidate code against a stored HMAC hash in constant time.
 */
function verifyActivationCode(candidateCode, storedHash) {
  if (!candidateCode || !storedHash) return false;
  const candidateHash = hashActivationCode(candidateCode);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Encrypts an outbox payload object using AES-256-GCM with Associated Authenticated Data (AAD).
 */
function encryptPayload(payloadObject, { jobId, collegeId, recipientEmail, templateType }) {
  if (!jobId || !collegeId || !recipientEmail || !templateType) {
    throw new Error('AAD parameters (jobId, collegeId, recipientEmail, templateType) are required for outbox encryption');
  }
  const key = getOutboxKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const aadString = `${jobId}:${collegeId}:${recipientEmail}:${templateType}`;
  cipher.setAAD(Buffer.from(aadString, 'utf8'));

  const plaintext = JSON.stringify(payloadObject);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

/**
 * Decrypts an outbox payload envelope using AES-256-GCM and verifies AAD.
 */
function decryptPayload(envelope, { jobId, collegeId, recipientEmail, templateType }) {
  if (!envelope || envelope.v !== 1 || !envelope.iv || !envelope.tag || !envelope.data) {
    throw new Error('Invalid or corrupted outbox encryption envelope');
  }
  if (!jobId || !collegeId || !recipientEmail || !templateType) {
    throw new Error('AAD parameters are required for outbox decryption');
  }
  const key = getOutboxKey();
  const iv = Buffer.from(envelope.iv, 'hex');
  const tag = Buffer.from(envelope.tag, 'hex');
  const ciphertext = Buffer.from(envelope.data, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  const aadString = `${jobId}:${collegeId}:${recipientEmail}:${templateType}`;
  decipher.setAAD(Buffer.from(aadString, 'utf8'));
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = {
  generateActivationCode,
  hashActivationCode,
  verifyActivationCode,
  encryptPayload,
  decryptPayload,
  getActivationPepper,
  getOutboxKey,
  getExternalOtpPepper,
  hashExternalOtp,
  verifyExternalOtpCode,
};

