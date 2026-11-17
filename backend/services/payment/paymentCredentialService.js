'use strict';

const crypto = require('crypto');

/**
 * Dedicated Gateway Credential Encryption Service
 *
 * Implements AES-256-GCM authenticated symmetric encryption for payment gateway
 * API keys, secrets, and merchant identifiers stored in `college_payment_configs`.
 *
 * Cryptographic Properties:
 * - Cipher: aes-256-gcm (Authenticated Encryption with Associated Data - AEAD).
 * - Key: Exactly 32 bytes (256 bits) sourced from `GATEWAY_ENCRYPTION_KEY`.
 *   Supports 64-character hexadecimal or raw 32-byte UTF-8 string.
 * - Initialization Vector (IV): Cryptographically secure random 12-byte (96-bit) buffer per encryption.
 * - Authentication Tag: 16 bytes (128 bits) verified on decipher finalization.
 * - AAD (Associated Authenticated Data): Binds `${collegeId}:${fieldName}` to the ciphertext.
 *   Prevents cross-tenant ciphertext transplantation and field-swapping attacks.
 * - Envelope Format: JSON string `{ v: 1, iv: "<hex>", tag: "<hex>", data: "<hex>" }`.
 */

const CURRENT_ENCRYPTION_VERSION = 1;
const IV_LENGTH_BYTES = 12; // 96 bits standard for GCM
const EXPECTED_KEY_BYTES = 32; // 256 bits

/**
 * Validates and retrieves the 32-byte master encryption key from the environment.
 * Fails securely if the key is missing or invalid.
 *
 * @returns {Buffer} 32-byte key buffer
 */
function getGatewayEncryptionKey() {
  const rawKey = process.env.GATEWAY_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      'FATAL SECURITY CONFIGURATION: GATEWAY_ENCRYPTION_KEY environment variable is missing. ' +
      'A dedicated 32-byte secret (or 64-character hex string) is required for payment gateway credential operations.'
    );
  }

  // Support 64-character hex strings
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  const buf = Buffer.from(rawKey, 'utf8');
  if (buf.length !== EXPECTED_KEY_BYTES) {
    throw new Error(
      `FATAL SECURITY CONFIGURATION: GATEWAY_ENCRYPTION_KEY must be exactly 32 bytes (got ${buf.length} bytes). ` +
      'Provide a 32-character UTF-8 string or a 64-character hex string.'
    );
  }

  return buf;
}

/**
 * Constructs the Associated Authenticated Data (AAD) string.
 *
 * @param {string} collegeId - Tenant college UUID
 * @param {string} fieldName - Field identifier (e.g. 'key_id', 'key_secret', 'webhook_secret')
 * @returns {string} Formatted AAD string
 */
function buildAadString(collegeId, fieldName) {
  if (!collegeId || typeof collegeId !== 'string') {
    throw new Error('collegeId is required to construct encryption AAD');
  }
  if (!fieldName || typeof fieldName !== 'string') {
    throw new Error('fieldName is required to construct encryption AAD');
  }
  return `${collegeId.toLowerCase()}:${fieldName.toLowerCase()}`;
}

/**
 * Encrypts a plaintext credential string using AES-256-GCM.
 *
 * @param {string} plaintext - Sensitive credential (e.g. key secret, webhook secret)
 * @param {Object} context - Cryptographic context
 * @param {string} context.collegeId - Tenant UUID
 * @param {string} context.fieldName - Credential field name
 * @param {Buffer} [context.keyOverride] - Optional key buffer for testing
 * @returns {string} Serialized JSON envelope
 */
function encryptCredential(plaintext, { collegeId, fieldName, keyOverride } = {}) {
  if (plaintext === null || plaintext === undefined || typeof plaintext !== 'string') {
    throw new Error('plaintext must be a non-null string');
  }

  const key = keyOverride || getGatewayEncryptionKey();
  if (!Buffer.isBuffer(key) || key.length !== EXPECTED_KEY_BYTES) {
    throw new Error(`Encryption key must be a 32-byte Buffer`);
  }

  const aad = buildAadString(collegeId, fieldName);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  cipher.setAAD(Buffer.from(aad, 'utf8'));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  const envelope = {
    v: CURRENT_ENCRYPTION_VERSION,
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    data: ciphertext.toString('hex'),
  };

  return JSON.stringify(envelope);
}

/**
 * Decrypts a serialized JSON credential envelope using AES-256-GCM.
 *
 * @param {string} serializedEnvelope - JSON envelope containing v, iv, tag, and data
 * @param {Object} context - Cryptographic context
 * @param {string} context.collegeId - Tenant UUID
 * @param {string} context.fieldName - Credential field name
 * @param {Buffer} [context.keyOverride] - Optional key buffer for testing
 * @returns {string} Decrypted plaintext credential
 */
function decryptCredential(serializedEnvelope, { collegeId, fieldName, keyOverride } = {}) {
  if (!serializedEnvelope || typeof serializedEnvelope !== 'string') {
    throw new Error('serializedEnvelope must be a non-empty JSON string');
  }

  let envelope;
  try {
    envelope = JSON.parse(serializedEnvelope);
  } catch (err) {
    throw new Error('Invalid credential envelope format: failed to parse JSON');
  }

  if (
    !envelope ||
    typeof envelope !== 'object' ||
    envelope.v !== CURRENT_ENCRYPTION_VERSION ||
    !envelope.iv ||
    !envelope.tag ||
    !envelope.data
  ) {
    throw new Error('Invalid or corrupted credential envelope structure');
  }

  const key = keyOverride || getGatewayEncryptionKey();
  if (!Buffer.isBuffer(key) || key.length !== EXPECTED_KEY_BYTES) {
    throw new Error(`Decryption key must be a 32-byte Buffer`);
  }

  const aad = buildAadString(collegeId, fieldName);
  const iv = Buffer.from(envelope.iv, 'hex');
  const tag = Buffer.from(envelope.tag, 'hex');
  const ciphertext = Buffer.from(envelope.data, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error(
      'Decryption failed: integrity authentication check failed. Data may have been tampered with or AAD mismatched.'
    );
  }
}

/**
 * Returns a masked preview of a credential string for admin auditing/display.
 * Never displays secrets in full.
 *
 * @param {string} plaintext - Plaintext credential
 * @param {number} [unmaskedEndChars=4] - Number of trailing characters to keep visible
 * @returns {string} Masked string (e.g. "rzp_test_...9a2f")
 */
function maskCredential(plaintext, unmaskedEndChars = 4) {
  if (!plaintext || typeof plaintext !== 'string') {
    return '';
  }

  const trimmed = plaintext.trim();
  if (trimmed.length <= unmaskedEndChars) {
    return '****';
  }

  // Preserve prefix if conventional (e.g. rzp_test_, rzp_live_)
  let prefix = '';
  if (trimmed.startsWith('rzp_test_')) {
    prefix = 'rzp_test_...';
  } else if (trimmed.startsWith('rzp_live_')) {
    prefix = 'rzp_live_...';
  } else if (trimmed.startsWith('CF_')) {
    prefix = 'CF_...';
  } else {
    prefix = '...';
  }

  const tail = trimmed.slice(-unmaskedEndChars);
  return `${prefix}${tail}`;
}

module.exports = {
  CURRENT_ENCRYPTION_VERSION,
  getGatewayEncryptionKey,
  encryptCredential,
  decryptCredential,
  maskCredential,
  buildAadString,
};
