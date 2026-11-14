const cloudinary = require('../config/cloudinary');

const isTestEnv = process.env.NODE_ENV === 'test';

/**
 * Validates that the provided buffer contains valid PDF magic bytes.
 * Valid PDF files start with "%PDF-" (0x25, 0x50, 0x44, 0x46, 0x2D).
 */
function isValidPdf(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 5) {
    return false;
  }
  return buffer.slice(0, 5).toString('ascii') === '%PDF-';
}

/**
 * Uploads a validated PDF buffer to Cloudinary under the raw resource type.
 * @param {Buffer} buffer - Validated PDF buffer
 * @param {string} collegeId - College UUID
 * @param {string} eventId - Event UUID
 * @param {string} [filename] - Optional descriptive filename
 * @returns {Promise<{ url: string, publicId: string }>}
 */
async function uploadCertificatePdf(buffer, collegeId, eventId, filename) {
  if (!isValidPdf(buffer)) {
    throw new Error('Invalid file format: must be a valid PDF document with %PDF- header');
  }

  if (isTestEnv) {
    const mockId = `mock_cert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return {
      url: `https://res.cloudinary.com/test-cloud/raw/upload/certificates/${collegeId}/${eventId}/${mockId}.pdf`,
      publicId: `certificates/${collegeId}/${eventId}/${mockId}`,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `certificates/${collegeId}/${eventId}`,
        resource_type: 'raw',
        format: 'pdf',
        public_id: filename ? `${Date.now()}_${filename.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')}` : undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Uploads a certificate template PDF buffer.
 */
async function uploadCertificateTemplatePdf(buffer, collegeId, eventId, templateName) {
  if (!isValidPdf(buffer)) {
    throw new Error('Invalid file format: must be a valid PDF document with %PDF- header');
  }

  if (isTestEnv) {
    const mockId = `mock_tmpl_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return {
      url: `https://res.cloudinary.com/test-cloud/raw/upload/certificate_templates/${collegeId}/${eventId}/${mockId}.pdf`,
      publicId: `certificate_templates/${collegeId}/${eventId}/${mockId}`,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `certificate_templates/${collegeId}/${eventId}`,
        resource_type: 'raw',
        format: 'pdf',
        public_id: `${Date.now()}_${templateName.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Best-effort deletion of an asset from Cloudinary (compensation on DB failure).
 */
async function deleteCertificateAsset(publicId) {
  if (!publicId) return { result: 'not_found' };

  if (isTestEnv) {
    return { result: 'ok' };
  }

  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
    });
  } catch (error) {
    console.warn('[CERTIFICATE_CLEANUP_FAILURE]', {
      timestamp: new Date().toISOString(),
      publicId,
      error: error.message,
    });
    return { result: 'error', error: error.message };
  }
}

module.exports = {
  isValidPdf,
  uploadCertificatePdf,
  uploadCertificateTemplatePdf,
  deleteCertificateAsset,
};
