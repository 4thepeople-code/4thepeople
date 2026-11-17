'use strict';

const { platformPrisma } = require('../../config/platformDb');
const {
  encryptCredential,
  decryptCredential,
  maskCredential,
} = require('./paymentCredentialService');
const { getAdapter } = require('./paymentGatewayFactory');

const VALID_PROVIDERS = ['RAZORPAY', 'CASHFREE'];
const VALID_MODES = ['COLLEGE_OWNED_GATEWAY', 'PLATFORM_MANAGED_GATEWAY'];
const VALID_STATUSES = ['NOT_CONFIGURED', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'];

/**
 * Super Admin Payment Configuration Service
 *
 * Exclusively executes under the privileged `platform_ops` database connection.
 * Manages tenant gateway configuration, credential rotation, auditing, and connectivity tests.
 */
class PaymentConfigService {
  constructor(options = {}) {
    this.prisma = options.prisma || platformPrisma;
  }

  /**
   * Retrieves sanitized payment configuration for a college.
   * Never exposes ciphertext or plaintext credentials.
   *
   * @param {string} collegeId - College UUID
   * @returns {Promise<Object>} Sanitized configuration summary
   */
  async getConfig(collegeId) {
    if (!collegeId) throw new Error('collegeId is required');

    const config = await this.prisma.collegePaymentConfig.findUnique({
      where: { collegeId },
    });

    if (!config) {
      return {
        configured: false,
        collegeId,
        provider: 'RAZORPAY',
        mode: 'COLLEGE_OWNED_GATEWAY',
        status: 'NOT_CONFIGURED',
        isTestMode: true,
        displayMerchantName: null,
        credentialsRotatedAt: null,
        hasKeyId: false,
        keyIdPreview: null,
        hasKeySecret: false,
        hasWebhookSecret: false,
        hasMerchantAccountId: false,
      };
    }

    let keyIdPreview = null;
    if (config.keyIdEncrypted) {
      try {
        const decryptedKeyId = decryptCredential(config.keyIdEncrypted, {
          collegeId,
          fieldName: 'key_id',
        });
        keyIdPreview = maskCredential(decryptedKeyId);
      } catch {
        keyIdPreview = '****';
      }
    }

    return {
      configured: true,
      id: config.id,
      collegeId: config.collegeId,
      provider: config.provider,
      mode: config.mode,
      status: config.status,
      isTestMode: config.isTestMode,
      displayMerchantName: config.displayMerchantName,
      credentialsRotatedAt: config.credentialsRotatedAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      hasKeyId: Boolean(config.keyIdEncrypted),
      keyIdPreview,
      hasKeySecret: Boolean(config.keySecretEncrypted),
      hasWebhookSecret: Boolean(config.webhookSecretEncrypted),
      hasMerchantAccountId: Boolean(config.merchantAccountIdEncrypted),
    };
  }

  /**
   * Updates or provisions a college's payment configuration and records an audit log.
   *
   * @param {string} collegeId - College UUID
   * @param {Object} updateData - Updated parameters
   * @param {Object} adminContext - Admin executing the change
   * @returns {Promise<Object>} Updated sanitized configuration
   */
  async updateConfig(collegeId, updateData = {}, adminContext = {}) {
    if (!collegeId) throw new Error('collegeId is required');

    // 1. Verify college exists
    const college = await this.prisma.college.findUnique({
      where: { id: collegeId },
      select: { id: true, name: true },
    });
    if (!college) {
      const err = new Error('College not found');
      err.statusCode = 404;
      throw err;
    }

    // 2. Load existing configuration
    const existing = await this.prisma.collegePaymentConfig.findUnique({
      where: { collegeId },
    });

    const targetProvider = updateData.provider !== undefined ? updateData.provider : (existing ? existing.provider : 'RAZORPAY');
    if (!VALID_PROVIDERS.includes(targetProvider)) {
      const err = new Error(`Invalid payment gateway provider: ${targetProvider}`);
      err.statusCode = 400;
      throw err;
    }

    const targetMode = updateData.mode !== undefined ? updateData.mode : (existing ? existing.mode : 'COLLEGE_OWNED_GATEWAY');
    if (!VALID_MODES.includes(targetMode)) {
      const err = new Error(`Invalid college payment mode: ${targetMode}`);
      err.statusCode = 400;
      throw err;
    }

    const targetStatus = updateData.status !== undefined ? updateData.status : (existing ? existing.status : 'NOT_CONFIGURED');
    if (!VALID_STATUSES.includes(targetStatus)) {
      const err = new Error(`Invalid payment config status: ${targetStatus}`);
      err.statusCode = 400;
      throw err;
    }

    const targetIsTestMode = updateData.isTestMode !== undefined ? Boolean(updateData.isTestMode) : (existing ? existing.isTestMode : true);

    // 3. Process credentials if provided
    let newKeyIdEncrypted = existing ? existing.keyIdEncrypted : null;
    let newKeySecretEncrypted = existing ? existing.keySecretEncrypted : null;
    let newWebhookSecretEncrypted = existing ? existing.webhookSecretEncrypted : null;
    let newMerchantAccountIdEncrypted = existing ? existing.merchantAccountIdEncrypted : null;
    let credentialsRotated = false;
    let keyIdPreview = null;

    if (updateData.keyId !== undefined && updateData.keyId !== null && String(updateData.keyId).trim() !== '') {
      newKeyIdEncrypted = encryptCredential(String(updateData.keyId).trim(), {
        collegeId,
        fieldName: 'key_id',
      });
      credentialsRotated = true;
      keyIdPreview = maskCredential(String(updateData.keyId).trim());
    }

    if (updateData.keySecret !== undefined && updateData.keySecret !== null && String(updateData.keySecret).trim() !== '') {
      newKeySecretEncrypted = encryptCredential(String(updateData.keySecret).trim(), {
        collegeId,
        fieldName: 'key_secret',
      });
      credentialsRotated = true;
    }

    if (updateData.webhookSecret !== undefined && updateData.webhookSecret !== null && String(updateData.webhookSecret).trim() !== '') {
      newWebhookSecretEncrypted = encryptCredential(String(updateData.webhookSecret).trim(), {
        collegeId,
        fieldName: 'webhook_secret',
      });
      credentialsRotated = true;
    }

    if (updateData.merchantAccountId !== undefined && updateData.merchantAccountId !== null && String(updateData.merchantAccountId).trim() !== '') {
      newMerchantAccountIdEncrypted = encryptCredential(String(updateData.merchantAccountId).trim(), {
        collegeId,
        fieldName: 'merchant_account_id',
      });
      credentialsRotated = true;
    }

    // 4. Validate activation prerequisites
    if (targetStatus === 'ACTIVE') {
      if (!newKeyIdEncrypted || !newKeySecretEncrypted) {
        const err = new Error('Cannot set status to ACTIVE: Both Gateway Key ID and Key Secret must be configured.');
        err.statusCode = 400;
        throw err;
      }
    }

    const now = new Date();
    const credentialsRotatedAt = credentialsRotated ? now : (existing ? existing.credentialsRotatedAt : null);

    // 5. Execute transactional update & audit creation
    await this.prisma.$transaction(async (tx) => {
      let savedConfig;
      if (existing) {
        savedConfig = await tx.collegePaymentConfig.update({
          where: { collegeId },
          data: {
            provider: targetProvider,
            mode: targetMode,
            status: targetStatus,
            isTestMode: targetIsTestMode,
            displayMerchantName: updateData.displayMerchantName !== undefined ? updateData.displayMerchantName : existing.displayMerchantName,
            keyIdEncrypted: newKeyIdEncrypted,
            keySecretEncrypted: newKeySecretEncrypted,
            webhookSecretEncrypted: newWebhookSecretEncrypted,
            merchantAccountIdEncrypted: newMerchantAccountIdEncrypted,
            credentialsRotatedAt,
            updatedAt: now,
          },
        });
      } else {
        savedConfig = await tx.collegePaymentConfig.create({
          data: {
            collegeId,
            provider: targetProvider,
            mode: targetMode,
            status: targetStatus,
            isTestMode: targetIsTestMode,
            displayMerchantName: updateData.displayMerchantName || null,
            keyIdEncrypted: newKeyIdEncrypted,
            keySecretEncrypted: newKeySecretEncrypted,
            webhookSecretEncrypted: newWebhookSecretEncrypted,
            merchantAccountIdEncrypted: newMerchantAccountIdEncrypted,
            credentialsRotatedAt,
          },
        });
      }

      // Record audit history
      await tx.collegePaymentConfigAudit.create({
        data: {
          collegeId,
          configId: savedConfig.id,
          changedByAdminId: adminContext.adminId || null,
          previousStatus: existing ? existing.status : null,
          newStatus: targetStatus,
          previousMode: existing ? existing.mode : null,
          newMode: targetMode,
          previousProvider: existing ? existing.provider : null,
          newProvider: targetProvider,
          previousIsTestMode: existing ? existing.isTestMode : null,
          newIsTestMode: targetIsTestMode,
          credentialsRotated,
          keyIdPreview,
          changeReason: updateData.changeReason || 'Super Admin configuration update',
          ipAddress: adminContext.ipAddress || null,
        },
      });
    });

    return await this.getConfig(collegeId);
  }

  /**
   * Tests connectivity against the payment gateway with currently stored or newly provided credentials.
   *
   * @param {string} collegeId - College UUID
   * @param {Object} [overrideCredentials] - Optional test credentials
   * @returns {Promise<Object>}
   */
  async testConnection(collegeId, overrideCredentials = null) {
    let credentials = overrideCredentials;

    if (!credentials) {
      const config = await this.prisma.collegePaymentConfig.findUnique({
        where: { collegeId },
      });

      if (!config || !config.keyIdEncrypted || !config.keySecretEncrypted) {
        return {
          success: false,
          message: 'No credentials configured for this college.',
        };
      }

      const keyId = decryptCredential(config.keyIdEncrypted, { collegeId, fieldName: 'key_id' });
      const keySecret = decryptCredential(config.keySecretEncrypted, { collegeId, fieldName: 'key_secret' });
      const webhookSecret = config.webhookSecretEncrypted
        ? decryptCredential(config.webhookSecretEncrypted, { collegeId, fieldName: 'webhook_secret' })
        : null;

      credentials = {
        provider: config.provider,
        isTestMode: config.isTestMode,
        keyId,
        keySecret,
        webhookSecret,
      };
    }

    const adapter = getAdapter(credentials.provider);
    return await adapter.testConnection(credentials);
  }

  /**
   * Retrieves audit logs for a college's payment configuration.
   *
   * @param {string} collegeId
   * @returns {Promise<Array>}
   */
  async getAudits(collegeId) {
    if (!collegeId) throw new Error('collegeId is required');

    return await this.prisma.collegePaymentConfigAudit.findMany({
      where: { collegeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        collegeId: true,
        changedByAdminId: true,
        previousStatus: true,
        newStatus: true,
        previousMode: true,
        newMode: true,
        previousProvider: true,
        newProvider: true,
        previousIsTestMode: true,
        newIsTestMode: true,
        credentialsRotated: true,
        keyIdPreview: true,
        changeReason: true,
        ipAddress: true,
        createdAt: true,
      },
    });
  }

  /**
   * Retrieves decrypted credentials strictly for internal server-side payment processing.
   * NEVER expose return value to API responses or logs!
   *
   * @param {string} collegeId
   * @returns {Promise<Object>} Decrypted credentials and config
   */
  async getDecryptedConfig(collegeId) {
    if (!collegeId) throw new Error('collegeId is required');

    const config = await this.prisma.collegePaymentConfig.findUnique({
      where: { collegeId },
    });

    if (!config) {
      const err = new Error(`Payment gateway configuration not found for college ${collegeId}`);
      err.statusCode = 404;
      throw err;
    }

    let keyId = null;
    let keySecret = null;
    let webhookSecret = null;
    let merchantAccountId = null;

    if (config.keyIdEncrypted) {
      keyId = decryptCredential(config.keyIdEncrypted, { collegeId, fieldName: 'key_id' });
    }
    if (config.keySecretEncrypted) {
      keySecret = decryptCredential(config.keySecretEncrypted, { collegeId, fieldName: 'key_secret' });
    }
    if (config.webhookSecretEncrypted) {
      webhookSecret = decryptCredential(config.webhookSecretEncrypted, { collegeId, fieldName: 'webhook_secret' });
    }
    if (config.merchantAccountIdEncrypted) {
      merchantAccountId = decryptCredential(config.merchantAccountIdEncrypted, { collegeId, fieldName: 'merchant_account_id' });
    }

    return {
      id: config.id,
      collegeId: config.collegeId,
      provider: config.provider,
      mode: config.mode,
      status: config.status,
      isTestMode: config.isTestMode,
      displayMerchantName: config.displayMerchantName,
      keyId,
      keySecret,
      webhookSecret,
      merchantAccountId,
    };
  }
}

const defaultPaymentConfigService = new PaymentConfigService();

module.exports = {
  PaymentConfigService,
  defaultPaymentConfigService,
};
