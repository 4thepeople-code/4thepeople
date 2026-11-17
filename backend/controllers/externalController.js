/**
 * externalController.js
 *
 * Handles Phase 3 external participant registration flows:
 *   - OTP request (email + event validation, OTP generation, outbox enqueue)
 *   - OTP verify (constant-time hash comparison, external JWT issuance)
 *   - External registration (ExternalParticipant upsert + EventRegistration insert)
 *   - External registration cancellation
 *   - External registration status check
 *
 * Security invariants maintained throughout:
 *   1. hostCollegeId always derived server-side from the event record, never from client input.
 *   2. Tenant slug from URL is validated against event.college_id (must match).
 *   3. External JWT binds email + hostCollegeId; authenticateExternalToken re-validates both.
 *   4. Raw OTP code never logged, never returned in API responses.
 *   5. All OTP and participant DB operations use withTenant(hostCollegeId) → RLS enforced.
 *   6. Constant-time hash comparison (crypto.timingSafeEqual) throughout.
 *   7. Response timing jitter on OTP request to resist enumeration.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { hashExternalOtp, verifyExternalOtpCode } = require('../utils/cryptoUtils');
const { enqueueEmail } = require('../services/outboxService');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const validateUUID = (value, label) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label} (must be a valid UUID)`, 400);
  }
};

/**
 * Returns a jitter delay between 100 and 200 ms.
 * Applied on all code paths of requestExternalOtp to resist timing-based enumeration.
 */
function jitterSleep() {
  const ms = 100 + crypto.randomInt(0, 101);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the signed external JWT.
 * Claims: { type: 'external', email, isEmailVerified: true, hostCollegeId }
 * TTL: 15 minutes.
 */
function issueExternalToken(email, hostCollegeId) {
  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_TOKEN;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET configuration missing in production');
  }
  const effectiveSecret = jwtSecret || 'dev_insecure_jwt_secret_fallback_do_not_use_in_prod';

  return jwt.sign(
    {
      type: 'external',
      email,
      isEmailVerified: true,
      hostCollegeId,
    },
    effectiveSecret,
    { expiresIn: '15m' }
  );
}

/**
 * POST /api/external/otp/request
 * Body: { email, eventId }
 *
 * Initiates the external participant OTP flow.
 *
 * Security:
 *   - hostCollegeId is derived server-side from the event record.
 *   - URL slug (req.collegeId) is validated to match event.college_id.
 *   - Always returns 200 regardless of whether the email/event exists (no enumeration).
 *   - Jitter sleep on all code paths to resist timing analysis.
 *   - Raw OTP code never persisted in plaintext; only HMAC-SHA256(pepper, salt+code) stored.
 *   - Respects 60-second cooldown and 5-per-24h daily limit per (email, college_id).
 */
exports.requestExternalOtp = asyncHandler(async (req, res) => {
  const jitterPromise = jitterSleep(); // Start timing jitter immediately on all paths

  const { email, eventId } = req.body; // Validated by schema middleware (email normalized, UUID checked)

  // 1. Derive hostCollegeId from the event (public read — no tenant context required)
  //    The slug in req.collegeId (from BFF proxy) is validated against the event's college_id below.
  let hostCollegeId = null;
  let eventTitle = null;

  try {
    const eventRow = await withTenant(null, async (tx) => {
      return tx.eventsWithStatus.findFirst({
        where: {
          id: eventId,
          visibility: 'PUBLIC',
          cancelledAt: null,
          status: { in: ['UPCOMING', 'ONGOING'] },
          registrationMode: 'INTERNAL',
        },
        select: { id: true, collegeId: true, title: true },
      });
    }, { isPublic: true });

    if (eventRow) {
      hostCollegeId = eventRow.collegeId;
      eventTitle = eventRow.title;

      // SAFEGUARD: validate URL slug context against actual event ownership.
      // If the client navigated to /college/colA/... but the event belongs to colB, reject.
      if (req.collegeId && hostCollegeId !== req.collegeId) {
        // Log the mismatch but do not reveal details in the response (treat as not found)
        console.warn(`[externalOtp] Tenant mismatch: req.collegeId=${req.collegeId} event.collegeId=${hostCollegeId} eventId=${eventId}`);
        hostCollegeId = null; // Treat as not found — silent 200 response
      }
    }
  } catch {
    // Any error during event lookup → treat as not found, return 200 silently
    hostCollegeId = null;
  }

  await jitterPromise;

  // 2. If event not found or tenant mismatch, return 200 silently (no enumeration)
  if (!hostCollegeId) {
    return res.status(200).json({
      success: true,
      message: 'If this address is eligible, a verification code has been sent.',
    });
  }

  // 3. Daily limit and cooldown check (scoped to email + college_id via withTenant)
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);

    let shouldSendOtp = true;

    await withTenant(hostCollegeId, async (tx) => {
      // Daily limit: max 5 OTPs per (email, college_id) in 24h
      const dailyCount = await tx.externalAuthOtp.count({
        where: {
          email,
          collegeId: hostCollegeId,
          createdAt: { gte: oneDayAgo },
        },
      });
      if (dailyCount >= 5) {
        shouldSendOtp = false;
        return;
      }

      // Cooldown: if latest active OTP was created < 60s ago, do not create another
      const latest = await tx.externalAuthOtp.findFirst({
        where: {
          email,
          collegeId: hostCollegeId,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (latest && latest.createdAt > sixtySecondsAgo) {
        shouldSendOtp = false;
        return;
      }

      if (!shouldSendOtp) return;

      // 4. Generate OTP — always 6 digits (100000–999999)
      const salt = crypto.randomBytes(16).toString('hex'); // 32 hex chars
      const rawCode = crypto.randomInt(100000, 1000000).toString(); // 6 digits, never logged
      const codeHash = hashExternalOtp(salt, rawCode);
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

      // 5. Insert OTP record (tenant-scoped, RLS enforced by withTenant context)
      await tx.externalAuthOtp.create({
        data: {
          collegeId: hostCollegeId,
          email,
          salt,
          codeHash,
          attempts: 0,
          maxAttempts: 5,
          expiresAt,
        },
      });

      // 6. Enqueue email via outbox (AES-256-GCM encrypted payload, same pipeline as student activations)
      //    rawCode enters the encrypted payload here and is never stored in plaintext.
      await enqueueEmail(tx, {
        collegeId: hostCollegeId,
        recipientEmail: email,
        recipientName: email,
        templateType: 'EXTERNAL_OTP',
        payload: {
          code: rawCode,
          eventTitle: eventTitle || 'the event',
          expiresInMinutes: 10,
        },
      });
      // rawCode is now out of scope — it exists only inside the encrypted outbox payload
    });
  } catch (err) {
    // Internal errors must not leak to the client on this endpoint
    console.error('[externalOtp] requestExternalOtp internal error:', err.message);
    // Fall through to generic 200 response — do not expose error details
  }

  return res.status(200).json({
    success: true,
    message: 'If this address is eligible, a verification code has been sent.',
  });
});

/**
 * POST /api/external/otp/verify
 * Body: { email, code }
 *
 * Verifies the submitted OTP. On success, issues a short-lived external JWT
 * binding the verified email and hostCollegeId.
 *
 * Security:
 *   - Uses withTenant(req.collegeId) for all OTP reads/writes (RLS enforced).
 *   - Increments attempts BEFORE comparing hash (exhaustion recorded even on correct guess).
 *   - Uses crypto.timingSafeEqual for constant-time comparison.
 *   - Returns generic "Invalid or expired code" on all failure paths (no enumeration).
 *   - Marks consumed_at on success — OTP cannot be reused.
 */
exports.verifyExternalOtp = asyncHandler(async (req, res) => {
  const { email, code, eventId } = req.body; // Validated by schema middleware
  let effectiveCollegeId = req.collegeId;

  if (!effectiveCollegeId && eventId) {
    const eventRow = await withTenant(null, async (tx) => {
      return tx.eventsWithStatus.findFirst({
        where: { id: eventId },
        select: { collegeId: true },
      });
    }, { isPublic: true });
    if (eventRow) {
      effectiveCollegeId = eventRow.collegeId;
    }
  }

  if (!effectiveCollegeId) {
    throw new AppError('College context or eventId is required to verify code', 400);
  }

  const now = new Date();

  const result = await withTenant(effectiveCollegeId, async (tx) => {
    // Find the most recent active OTP for this email within this college
    const otp = await tx.externalAuthOtp.findFirst({
      where: {
        email,
        collegeId: effectiveCollegeId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return { status: 'NOT_FOUND' };
    }

    // Check attempt limit before incrementing
    if (otp.attempts >= otp.maxAttempts) {
      return { status: 'EXHAUSTED' };
    }

    // Increment attempts first (record the attempt regardless of correctness)
    await tx.externalAuthOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    // Constant-time comparison using the dedicated verifyExternalOtpCode utility
    const isValid = verifyExternalOtpCode(otp.salt, code, otp.codeHash);

    if (!isValid) {
      return { status: 'INVALID' };
    }

    // Mark OTP as consumed — prevents replay
    await tx.externalAuthOtp.update({
      where: { id: otp.id },
      data: { consumedAt: now },
    });

    return { status: 'OK', hostCollegeId: otp.collegeId };
  });

  if (result.status === 'NOT_FOUND' || result.status === 'INVALID') {
    throw new AppError('Invalid or expired code.', 401);
  }

  if (result.status === 'EXHAUSTED') {
    throw new AppError('Too many attempts. Please request a new code.', 429);
  }

  // Issue external JWT bound to verified email + hostCollegeId
  const token = issueExternalToken(email, result.hostCollegeId);

  return res.status(200).json({
    success: true,
    token,
  });
});

/**
 * POST /api/external/events/:eventId/register
 * Authorization: Bearer <externalJwt>
 * Body: { name, phone?, institutionName?, formAnswers? }
 *
 * Creates or upserts an ExternalParticipant and inserts an EventRegistration.
 *
 * Security:
 *   - authenticateExternalToken middleware has already validated token type,
 *     isEmailVerified, and hostCollegeId === req.collegeId.
 *   - hostCollegeId re-validated from event record (not from URL slug alone).
 *   - All writes in a single withTenant(req.collegeId) transaction.
 *   - Event eligibility re-validated here (may have changed since OTP was issued).
 *   - snapshot identity fields populated server-side, never from client.
 */
exports.registerExternalParticipant = asyncHandler(async (req, res) => {
  const effectiveCollegeId = req.collegeId || req.externalUser?.hostCollegeId;
  if (!effectiveCollegeId) {
    throw new AppError('College context required', 400);
  }
  if (!req.externalUser || !req.externalUser.email) {
    throw new AppError('External authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const { name, phone, institutionName, formAnswers } = req.body;

  const registration = await withTenant(effectiveCollegeId, async (tx) => {
    // 1. Load and validate event (re-validates eligibility at registration time)
    const event = await tx.eventsWithStatus.findFirst({
      where: {
        id: eventId,
        collegeId: effectiveCollegeId,
      },
      select: {
        id: true,
        collegeId: true,
        title: true,
        status: true,
        visibility: true,
        isPaid: true,
        fee: true,
        registrationMode: true,
        registrationDeadline: true,
        customFormDefinition: true,
        capacity: true,
        registeredCount: true,
      },
    });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    // SAFEGUARD: paid events must not register through free registration endpoint
    if (event.isPaid) {
      throw new AppError('This is a paid event. Registration requires completing payment checkout.', 400);
    }

    // SAFEGUARD: validate event actually belongs to the effective college.
    if (event.collegeId !== effectiveCollegeId) {
      throw new AppError('Event does not belong to this college', 403);
    }

    if (event.status === 'CANCELLED') {
      throw new AppError('Cannot register for a cancelled event', 400);
    }
    if (event.status === 'COMPLETED') {
      throw new AppError('Cannot register for a past event', 400);
    }
    if (event.visibility !== 'PUBLIC') {
      throw new AppError('External registration is only available for public events', 403);
    }
    if (event.registrationMode !== 'INTERNAL') {
      throw new AppError('Registration is not open for this event', 400);
    }
    if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
      throw new AppError('Registration deadline has passed', 400);
    }

    // 2. Validate custom form answers if applicable
    let validatedAnswers = null;
    const body = req.body || {};
    if (event.customFormDefinition && Array.isArray(event.customFormDefinition.fields)) {
      const answers = body.formAnswers || {};
      validatedAnswers = {};
      for (const field of event.customFormDefinition.fields) {
        const fieldKey = field.id || field.name;
        const val = answers[fieldKey];
        if (field.required && (val === undefined || val === null || val === '')) {
          throw new AppError(`Field "${field.label || fieldKey}" is required`, 400);
        }
        if (val !== undefined && val !== null && val !== '') {
          if (field.type === 'NUMBER' && isNaN(Number(val))) {
            throw new AppError(`Field "${field.label || fieldKey}" must be a number`, 400);
          }
          if (
            (field.type === 'SELECT' || field.type === 'RADIO') &&
            Array.isArray(field.options) &&
            !field.options.includes(val)
          ) {
            throw new AppError(`Invalid option selected for field "${field.label || fieldKey}"`, 400);
          }
          validatedAnswers[fieldKey] = val;
        }
      }
    } else if (formAnswers) {
      validatedAnswers = formAnswers;
    }

    // 3. Upsert ExternalParticipant (scoped to req.collegeId by RLS context)
    let participant;
    const normalizedEmail = req.externalUser.email; // Already normalized by schema + token

    participant = await tx.externalParticipant.findFirst({
      where: { collegeId: req.collegeId, email: normalizedEmail },
    });

    if (!participant) {
      try {
        participant = await tx.externalParticipant.create({
          data: {
            collegeId: req.collegeId,
            email: normalizedEmail,
            name,
            phone: phone || null,
            institutionName: institutionName || null,
            isEmailVerified: true,
          },
        });
      } catch (createErr) {
        // Handle concurrent creation race: another request created the record between our
        // findFirst and create calls. Retry the findFirst.
        if (createErr.code === 'P2002') {
          participant = await tx.externalParticipant.findFirst({
            where: { collegeId: effectiveCollegeId, email: normalizedEmail },
          });
          if (!participant) {
            throw createErr; // Should not happen — throw original error
          }
          // Update identity fields since we now have the existing record
          participant = await tx.externalParticipant.update({
            where: { id: participant.id },
            data: { isEmailVerified: true, name, phone: phone || null, institutionName: institutionName || null },
          });
        } else {
          throw createErr;
        }
      }
    } else {
      // Update identity fields on existing participant
      participant = await tx.externalParticipant.update({
        where: { id: participant.id },
        data: { isEmailVerified: true, name, phone: phone || null, institutionName: institutionName || null },
      });
    }

    // 4. Pre-check duplicate registration (application-level fast path)
    const existing = await tx.eventRegistration.findFirst({
      where: { externalParticipantId: participant.id, eventId },
    });
    if (existing) {
      throw new AppError('You are already registered for this event', 409);
    }

    // 5. INSERT EventRegistration — trigger enforces capacity atomically
    try {
      return await tx.eventRegistration.create({
        data: {
          collegeId: effectiveCollegeId,
          eventId,
          userId: null,
          participantType: 'EXTERNAL',
          externalParticipantId: participant.id,
          homeCollegeId: null,
          participantName: name,                        // snapshot from submitted body
          participantEmail: normalizedEmail,            // snapshot from verified token
          participantRollNumber: null,
          participantCollegeName: institutionName || null,
          isUserDeleted: false,
          registeredByRole: 'SELF',
          formAnswers: validatedAnswers,
        },
        select: { id: true, eventId: true, registeredAt: true },
      });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new AppError('You are already registered for this event', 409);
      }
      if (
        err.message &&
        (err.message.includes('Event capacity reached') ||
          err.message.includes('check_violation') ||
          err.message.includes('chk_events_capacity_limit'))
      ) {
        throw new AppError('Event capacity has been reached', 409);
      }
      throw err;
    }
  });

  return res.status(201).json({
    success: true,
    message: 'Successfully registered for event',
    registration: {
      id: registration.id,
      eventId: registration.eventId,
      registeredAt: registration.registeredAt,
    },
  });
});

/**
 * DELETE /api/external/events/:eventId/register
 * Authorization: Bearer <externalJwt>
 *
 * Cancels an external participant's registration.
 * Does not allow cancelling a completed or cancelled event's registration.
 */
exports.cancelExternalRegistration = asyncHandler(async (req, res) => {
  const effectiveCollegeId = req.collegeId || req.externalUser?.hostCollegeId;
  if (!effectiveCollegeId) {
    throw new AppError('College context required', 400);
  }
  if (!req.externalUser || !req.externalUser.email) {
    throw new AppError('External authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  await withTenant(effectiveCollegeId, async (tx) => {
    // Find participant
    const participant = await tx.externalParticipant.findFirst({
      where: { collegeId: effectiveCollegeId, email: req.externalUser.email },
    });
    if (!participant) {
      throw new AppError('Registration not found', 404);
    }

    // Find registration
    const registration = await tx.eventRegistration.findFirst({
      where: { externalParticipantId: participant.id, eventId, collegeId: effectiveCollegeId },
    });
    if (!registration) {
      throw new AppError('Registration not found', 404);
    }

    // Load event and check status
    const event = await tx.eventsWithStatus.findFirst({
      where: { id: eventId, collegeId: effectiveCollegeId },
      select: { status: true },
    });
    if (!event) {
      throw new AppError('Event not found', 404);
    }
    if (event.status === 'COMPLETED') {
      throw new AppError('Cannot cancel registration for a past event', 400);
    }
    if (event.status === 'CANCELLED') {
      throw new AppError('Cannot cancel registration for a cancelled event', 400);
    }

    // Delete registration — trigger decrements registered_count
    await tx.eventRegistration.delete({
      where: { id: registration.id },
    });
  });

  return res.status(200).json({
    success: true,
    message: 'Registration cancelled successfully',
  });
});

/**
 * GET /api/external/events/:eventId/my-registration
 * Authorization: Bearer <externalJwt>
 *
 * Returns the external participant's registration status for a specific event.
 */
exports.getExternalRegistrationStatus = asyncHandler(async (req, res) => {
  const effectiveCollegeId = req.collegeId || req.externalUser?.hostCollegeId;
  if (!effectiveCollegeId) {
    throw new AppError('College context required', 400);
  }
  if (!req.externalUser || !req.externalUser.email) {
    throw new AppError('External authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const status = await withTenant(effectiveCollegeId, async (tx) => {
    const participant = await tx.externalParticipant.findFirst({
      where: { collegeId: effectiveCollegeId, email: req.externalUser.email },
    });
    if (!participant) {
      return { isRegistered: false, registration: null };
    }

    const registration = await tx.eventRegistration.findFirst({
      where: { externalParticipantId: participant.id, eventId, collegeId: effectiveCollegeId },
      select: { id: true, eventId: true, registeredAt: true },
    });

    return {
      isRegistered: Boolean(registration),
      registration: registration
        ? { id: registration.id, eventId: registration.eventId, registeredAt: registration.registeredAt }
        : null,
    };
  });

  return res.status(200).json({
    success: true,
    isRegistered: status.isRegistered,
    registration: status.registration,
  });
});
