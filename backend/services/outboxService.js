const crypto = require('crypto');
const { encryptPayload } = require('../utils/cryptoUtils');

/**
 * Calculates template-specific expiry timestamp.
 */
function calculateTemplateExpiry(templateType, options = {}) {
  const now = new Date();
  switch (templateType) {
    case 'STUDENT_ACTIVATION':
      return new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    case 'PASSWORD_RESET':
      return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    case 'CLUB_INVITE':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    case 'EVENT_TICKET':
      if (options.eventStartTime && new Date(options.eventStartTime) > now) {
        return new Date(options.eventStartTime);
      }
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours default
  }
}

/**
 * Enqueues a transactional email into email_outbox.
 * Can be called inside an existing Prisma interactive transaction (tx) or standalone.
 *
 * @param {Object} tx - Prisma transaction or client
 * @param {Object} params
 * @param {string} params.collegeId - Tenant UUID
 * @param {string} params.recipientEmail - Recipient email
 * @param {string} params.recipientName - Recipient full name
 * @param {string} params.templateType - 'STUDENT_ACTIVATION', 'PASSWORD_RESET', etc.
 * @param {Object} params.payload - Plain object containing template parameters
 * @param {Object} [options] - Optional overrides (e.g. eventStartTime)
 * @returns {Promise<string>} jobId - Generated UUID
 */
async function enqueueEmail(tx, { collegeId, recipientEmail, recipientName, templateType, payload }, options = {}) {
  if (!collegeId || !recipientEmail || !templateType || !payload) {
    throw new Error('Missing required arguments to enqueueEmail');
  }

  const jobId = crypto.randomUUID();
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  const safeName = (recipientName || recipientEmail).trim();

  // 1. Encrypt payload with AES-256-GCM + AAD
  const encryptedEnvelope = encryptPayload(payload, {
    jobId,
    collegeId,
    recipientEmail: normalizedEmail,
    templateType,
  });

  // 2. Compute template-specific expiry
  const expiresAt = calculateTemplateExpiry(templateType, options);

  // 3. Insert into email_outbox
  // Note: app_user has INSERT privilege on email_outbox and SELECT on metadata columns (id, college_id, etc.)
  // We must explicitly select `id` so Prisma does not request RETURNING * (which includes the payload column)
  await tx.emailOutbox.create({
    data: {
      id: jobId,
      collegeId,
      recipientEmail: normalizedEmail,
      recipientName: safeName,
      templateType,
      payload: encryptedEnvelope,
      status: 'PENDING',
      expiresAt,
    },
    select: {
      id: true,
    },
  });

  return jobId;
}

module.exports = {
  enqueueEmail,
  calculateTemplateExpiry,
};
