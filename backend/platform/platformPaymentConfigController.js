'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { defaultPaymentConfigService } = require('../services/payment/paymentConfigService');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const validateUUID = (value, label) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label} (must be a valid UUID)`, 400);
  }
};

/**
 * GET /api/platform/colleges/:collegeId/payment-config
 * Retrieves payment configuration for a specific college.
 * Never exposes secret credentials or raw decryption keys.
 */
exports.getPaymentConfig = asyncHandler(async (req, res) => {
  const { collegeId } = req.params;
  validateUUID(collegeId, 'college ID');

  const config = await defaultPaymentConfigService.getConfig(collegeId);

  res.status(200).json({
    success: true,
    data: config,
  });
});

/**
 * PUT /api/platform/colleges/:collegeId/payment-config
 * Updates payment gateway provider, mode, credentials, and active status.
 */
exports.updatePaymentConfig = asyncHandler(async (req, res) => {
  const { collegeId } = req.params;
  validateUUID(collegeId, 'college ID');

  const adminContext = {
    adminId: req.platformAdmin && req.platformAdmin.id,
    ipAddress: req.ip,
  };

  const updatedConfig = await defaultPaymentConfigService.updateConfig(
    collegeId,
    req.body,
    adminContext
  );

  res.status(200).json({
    success: true,
    message: 'College payment gateway configuration updated successfully',
    data: updatedConfig,
  });
});

/**
 * POST /api/platform/colleges/:collegeId/payment-config/test-connection
 * Tests credentials connectivity with the target gateway API.
 */
exports.testPaymentConnection = asyncHandler(async (req, res) => {
  const { collegeId } = req.params;
  validateUUID(collegeId, 'college ID');

  const result = await defaultPaymentConfigService.testConnection(collegeId);

  res.status(200).json({
    success: result.success,
    message: result.message,
    data: result,
  });
});

/**
 * GET /api/platform/colleges/:collegeId/payment-config/audits
 * Retrieves audit trail of configuration and credential rotations.
 */
exports.getPaymentConfigAudits = asyncHandler(async (req, res) => {
  const { collegeId } = req.params;
  validateUUID(collegeId, 'college ID');

  const audits = await defaultPaymentConfigService.getAudits(collegeId);

  res.status(200).json({
    success: true,
    data: audits,
  });
});
