const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { withTenant } = require('../config/db');
const certificateService = require('../services/certificateService');
const { fetchCertificateAssetBuffer } = require('../utils/certificateStorage');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const validateUUID = (value, label) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label} (must be a valid UUID)`, 400);
  }
};

/**
 * Helper to stream certificate PDF to HTTP response.
 */
async function streamCertificateResponse(certificate, res) {
  if (!certificate || (!certificate.certificateUrl && !certificate.certificatePublicId)) {
    throw new AppError('Certificate document file is not available', 404);
  }

  try {
    const buffer = await fetchCertificateAssetBuffer(certificate.certificatePublicId, certificate.certificateUrl);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${certificate.certificateNumber}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    throw new AppError(`Failed to stream certificate: ${err.message}`, 502);
  }
}

// ============================================================================
// Manager / College Admin Controllers
// ============================================================================

/**
 * GET /manager/events/:eventId/certificates
 */
exports.getEventCertificates = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const result = await certificateService.getEventCertificates({
    collegeId: req.collegeId,
    eventId,
    query: req.query,
  });

  res.status(200).json({
    success: true,
    data: {
      certificates: result.certificates,
      pagination: result.pagination,
    },
  });
});

/**
 * GET /manager/events/:eventId/certificates/eligible-students
 */
exports.getEligibleStudents = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const students = await certificateService.getEligibleStudents({
    collegeId: req.collegeId,
    eventId,
  });

  res.status(200).json({
    success: true,
    data: students,
  });
});

/**
 * POST /manager/events/:eventId/certificates/individual (Method A)
 */
exports.issueIndividualCertificate = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const { userId } = req.body;
  validateUUID(userId, 'student user ID');

  if (!req.file || !req.file.buffer) {
    throw new AppError('A valid PDF certificate file is required in the "file" field', 400);
  }

  const certificate = await certificateService.issueIndividualCertificate({
    collegeId: req.collegeId,
    eventId,
    userId,
    pdfBuffer: req.file.buffer,
    filename: req.file.originalname,
    issuerId: req.user.id || req.user.userId,
  });

  res.status(201).json({
    success: true,
    message: 'Certificate issued successfully',
    data: certificate,
  });
});

/**
 * POST /manager/events/:eventId/certificates/bulk (Method B)
 */
exports.processBulkUpload = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  if (!req.file || !req.file.buffer) {
    throw new AppError('A valid ZIP archive file is required in the "archive" field', 400);
  }

  const batchResult = await certificateService.processBulkCertificates({
    collegeId: req.collegeId,
    eventId,
    zipBuffer: req.file.buffer,
    issuerId: req.user.id || req.user.userId,
  });

  res.status(200).json({
    success: true,
    message: `Bulk certificates processed: ${batchResult.successCount} issued, ${batchResult.failedCount} failed`,
    data: batchResult,
  });
});

/**
 * POST /manager/events/:eventId/certificates/template
 */
exports.saveCertificateTemplate = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  if (!req.file || !req.file.buffer) {
    throw new AppError('A valid PDF template file is required in the "template" field', 400);
  }

  let placeholderConfig = [];
  if (req.body.placeholderConfig) {
    try {
      placeholderConfig = typeof req.body.placeholderConfig === 'string'
        ? JSON.parse(req.body.placeholderConfig)
        : req.body.placeholderConfig;
    } catch {
      throw new AppError('Invalid JSON format for placeholderConfig', 400);
    }
  }

  const template = await certificateService.saveCertificateTemplate({
    collegeId: req.collegeId,
    eventId,
    templateBuffer: req.file.buffer,
    templateName: req.body.templateName || 'Certificate Template',
    placeholderConfig,
    issuerId: req.user.id || req.user.userId,
  });

  res.status(201).json({
    success: true,
    message: 'Certificate template uploaded successfully',
    data: template,
  });
});

/**
 * POST /manager/events/:eventId/certificates/template/preview
 */
exports.previewCertificateTemplate = asyncHandler(async (req, res) => {
  let templateBuffer = null;

  if (req.file && req.file.buffer) {
    templateBuffer = req.file.buffer;
  } else if (req.body.templateId) {
    validateUUID(req.body.templateId, 'template ID');
    const { eventId } = req.params;
    validateUUID(eventId, 'event ID');

    const template = await withTenant(req.collegeId, async (tx) => {
      return tx.eventCertificateTemplate.findFirst({
        where: { id: req.body.templateId, eventId, collegeId: req.collegeId },
      });
    });

    if (!template) {
      throw new AppError('Certificate template not found', 404);
    }

    try {
      templateBuffer = await fetchCertificateAssetBuffer(template.templatePublicId, template.templateUrl);
    } catch (err) {
      throw new AppError('Failed to fetch certificate template asset from storage: ' + err.message, 500);
    }
  } else {
    throw new AppError('Either a template PDF file or an existing templateId is required', 400);
  }

  let placeholderConfig = [];
  if (req.body.placeholderConfig) {
    try {
      placeholderConfig = typeof req.body.placeholderConfig === 'string'
        ? JSON.parse(req.body.placeholderConfig)
        : req.body.placeholderConfig;
    } catch {
      throw new AppError('Invalid JSON in placeholderConfig', 400);
    }
  }

  let sampleData = {};
  if (req.body.sampleData) {
    try {
      sampleData = typeof req.body.sampleData === 'string'
        ? JSON.parse(req.body.sampleData)
        : req.body.sampleData;
    } catch {}
  }

  const previewPdf = await certificateService.previewCertificateTemplate({
    templateBuffer,
    placeholderConfig,
    sampleData,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="certificate_preview.pdf"');
  res.send(previewPdf);
});

/**
 * POST /manager/events/:eventId/certificates/generate (Method C)
 */
exports.generateCertificatesFromTemplate = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const { templateId, studentUserIds } = req.body;
  validateUUID(templateId, 'template ID');

  const batchResult = await certificateService.generateCertificatesFromTemplate({
    collegeId: req.collegeId,
    eventId,
    templateId,
    studentUserIds: Array.isArray(studentUserIds) ? studentUserIds : null,
    issuerId: req.user.id || req.user.userId,
  });

  res.status(200).json({
    success: true,
    message: `Certificate generation completed: ${batchResult.successCount} generated, ${batchResult.skippedCount} skipped, ${batchResult.failedCount} failed`,
    data: batchResult,
  });
});

/**
 * POST /manager/events/:eventId/certificates/:certificateId/revoke
 */
exports.revokeCertificate = asyncHandler(async (req, res) => {
  const { eventId, certificateId } = req.params;
  validateUUID(eventId, 'event ID');
  validateUUID(certificateId, 'certificate ID');

  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    throw new AppError('A valid revocation reason (at least 3 characters) is required', 400);
  }

  const revoked = await certificateService.revokeCertificate({
    collegeId: req.collegeId,
    eventId,
    certificateId,
    reason,
    revokerId: req.user.id || req.user.userId,
  });

  res.status(200).json({
    success: true,
    message: 'Certificate revoked successfully',
    data: revoked,
  });
});

/**
 * POST /manager/events/:eventId/certificates/:certificateId/reissue
 */
exports.reissueCertificate = asyncHandler(async (req, res) => {
  const { eventId, certificateId } = req.params;
  validateUUID(eventId, 'event ID');
  validateUUID(certificateId, 'certificate ID');

  if (!req.file || !req.file.buffer) {
    throw new AppError('A replacement PDF certificate file is required in the "file" field', 400);
  }

  const newCert = await certificateService.reissueCertificate({
    collegeId: req.collegeId,
    eventId,
    certificateId,
    newPdfBuffer: req.file.buffer,
    issuerId: req.user.id || req.user.userId,
  });

  res.status(200).json({
    success: true,
    message: 'Certificate reissued successfully',
    data: newCert,
  });
});

/**
 * GET /manager/events/:eventId/certificates/:certificateId/download
 */
exports.downloadManagerCertificate = asyncHandler(async (req, res) => {
  const { eventId, certificateId } = req.params;
  validateUUID(eventId, 'event ID');
  validateUUID(certificateId, 'certificate ID');

  const cert = await withTenant(req.collegeId, async (tx) => {
    return tx.eventCertificate.findFirst({
      where: { id: certificateId, eventId, collegeId: req.collegeId },
    });
  });

  if (!cert) {
    throw new AppError('Certificate not found', 404);
  }

  return streamCertificateResponse(cert, res);
});

// ============================================================================
// Student Self-Service Controllers
// ============================================================================

/**
 * GET /certificates/my
 */
exports.getMyCertificates = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const certs = await certificateService.getStudentCertificates({
    collegeId: req.collegeId,
    userId: req.user.id,
  });

  res.status(200).json({
    success: true,
    data: certs,
  });
});

/**
 * GET /certificates/:certificateId/download
 */
exports.downloadStudentCertificate = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const { certificateId } = req.params;
  validateUUID(certificateId, 'certificate ID');

  const cert = await withTenant(req.collegeId, async (tx) => {
    return tx.eventCertificate.findFirst({
      where: {
        id: certificateId,
        userId: req.user.id,
        collegeId: req.collegeId,
      },
    });
  });

  if (!cert) {
    throw new AppError('Certificate not found', 404);
  }

  if (cert.status === 'REVOKED') {
    throw new AppError('This certificate has been revoked and is no longer available for download', 403);
  }

  return streamCertificateResponse(cert, res);
});

// ============================================================================
// Public Verification Controller
// ============================================================================

/**
 * GET /certificates/verify/:certificateNumber
 */
exports.verifyCertificate = asyncHandler(async (req, res) => {
  const { certificateNumber } = req.params;
  if (!certificateNumber) {
    throw new AppError('Certificate number is required', 400);
  }

  const verification = await certificateService.verifyCertificatePublic({
    certificateNumber,
  });

  res.status(200).json({
    success: true,
    data: verification,
  });
});
