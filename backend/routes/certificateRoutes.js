const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdminOrEventManager } = require('../middleware/mediaAccessMiddleware');
const {
  singlePdf,
  zipArchive,
  templatePdf,
  templateAsset,
} = require('../middleware/certificateUploadMiddleware');
const certificateController = require('../controllers/certificateController');

// Router for student self-service & public verification
const certificateRouter = express.Router({ mergeParams: true });

// Router for manager / admin event certificates
const managerCertificateRouter = express.Router({ mergeParams: true });

// ============================================================================
// Public & Student Endpoints (/certificates, /api/certificates)
// ============================================================================

// Public certificate verification (no auth, no tenant subdomain strictly required)
certificateRouter.get('/verify/:certificateNumber', certificateController.verifyCertificate);

// Student self-service: list my certificates for current college
certificateRouter.get('/my', authenticateToken, certificateController.getMyCertificates);

// Student self-service: download certificate PDF
certificateRouter.get('/:certificateId/download', authenticateToken, certificateController.downloadStudentCertificate);

// ============================================================================
// Manager / Admin Endpoints (/manager/events/:eventId/certificates)
// ============================================================================

// List certificates for event
managerCertificateRouter.get(
  '/events/:eventId/certificates',
  requireAdminOrEventManager,
  certificateController.getEventCertificates
);

// List eligible students for event
managerCertificateRouter.get(
  '/events/:eventId/certificates/eligible-students',
  requireAdminOrEventManager,
  certificateController.getEligibleStudents
);

// Method A: Individual PDF upload
managerCertificateRouter.post(
  '/events/:eventId/certificates/individual',
  requireAdminOrEventManager,
  singlePdf('file', 10),
  certificateController.issueIndividualCertificate
);

// Method B: Bulk ZIP upload
managerCertificateRouter.post(
  '/events/:eventId/certificates/bulk',
  requireAdminOrEventManager,
  zipArchive('archive', 25),
  certificateController.processBulkUpload
);

// Method C: Predefined templates list
managerCertificateRouter.get(
  '/events/:eventId/certificates/templates/predefined',
  requireAdminOrEventManager,
  certificateController.listPredefinedTemplates
);

// Method C: Upload certificate template (PDF, PNG, JPEG)
managerCertificateRouter.post(
  '/events/:eventId/certificates/template',
  requireAdminOrEventManager,
  templateAsset('template', 15),
  certificateController.saveCertificateTemplate
);

// Method C: Preview template overlay
managerCertificateRouter.post(
  '/events/:eventId/certificates/template/preview',
  requireAdminOrEventManager,
  templateAsset('template', 15),
  certificateController.previewCertificateTemplate
);

// Method C: Batch generate certificates from template
managerCertificateRouter.post(
  '/events/:eventId/certificates/generate',
  requireAdminOrEventManager,
  certificateController.generateCertificatesFromTemplate
);

// Revoke certificate
managerCertificateRouter.post(
  '/events/:eventId/certificates/:certificateId/revoke',
  requireAdminOrEventManager,
  certificateController.revokeCertificate
);

// Reissue certificate
managerCertificateRouter.post(
  '/events/:eventId/certificates/:certificateId/reissue',
  requireAdminOrEventManager,
  singlePdf('file', 10),
  certificateController.reissueCertificate
);

// Manager download certificate
managerCertificateRouter.get(
  '/events/:eventId/certificates/:certificateId/download',
  requireAdminOrEventManager,
  certificateController.downloadManagerCertificate
);

// Support nested route: /manager/clubs/:clubId/events/:eventId/certificates/*
managerCertificateRouter.get(
  '/clubs/:clubId/events/:eventId/certificates',
  requireAdminOrEventManager,
  certificateController.getEventCertificates
);
managerCertificateRouter.get(
  '/clubs/:clubId/events/:eventId/certificates/eligible-students',
  requireAdminOrEventManager,
  certificateController.getEligibleStudents
);
managerCertificateRouter.post(
  '/clubs/:clubId/events/:eventId/certificates/individual',
  requireAdminOrEventManager,
  singlePdf('file', 10),
  certificateController.issueIndividualCertificate
);
managerCertificateRouter.post(
  '/clubs/:clubId/events/:eventId/certificates/bulk',
  requireAdminOrEventManager,
  zipArchive('archive', 25),
  certificateController.processBulkUpload
);
managerCertificateRouter.post(
  '/clubs/:clubId/events/:eventId/certificates/template',
  requireAdminOrEventManager,
  templatePdf('template', 10),
  certificateController.saveCertificateTemplate
);
managerCertificateRouter.post(
  '/clubs/:clubId/events/:eventId/certificates/template/preview',
  requireAdminOrEventManager,
  templatePdf('template', 10),
  certificateController.previewCertificateTemplate
);
managerCertificateRouter.post(
  '/clubs/:clubId/events/:eventId/certificates/generate',
  requireAdminOrEventManager,
  certificateController.generateCertificatesFromTemplate
);
managerCertificateRouter.post(
  '/clubs/:clubId/events/:eventId/certificates/:certificateId/revoke',
  requireAdminOrEventManager,
  certificateController.revokeCertificate
);
managerCertificateRouter.post(
  '/clubs/:clubId/events/:eventId/certificates/:certificateId/reissue',
  requireAdminOrEventManager,
  singlePdf('file', 10),
  certificateController.reissueCertificate
);
managerCertificateRouter.get(
  '/clubs/:clubId/events/:eventId/certificates/:certificateId/download',
  requireAdminOrEventManager,
  certificateController.downloadManagerCertificate
);

module.exports = {
  certificateRouter,
  managerCertificateRouter,
};
