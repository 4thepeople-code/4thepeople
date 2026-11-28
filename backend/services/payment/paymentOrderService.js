'use strict';

const crypto = require('crypto');
const { withTenant } = require('../../config/db');
const { defaultPaymentConfigService } = require('./paymentConfigService');
const { getAdapter } = require('./paymentGatewayFactory');
const { assertNoDuplicateParticipants } = require('../../utils/teamUtils');

const HOLD_DURATION_MINUTES = 15;

/**
 * Validates custom form answers against custom form definition.
 */
function validateFormAnswers(formDefinition, submittedAnswers) {
  if (!formDefinition) {
    return submittedAnswers || null;
  }

  const answers = submittedAnswers || {};
  const validated = {};

  if (Array.isArray(formDefinition.fields)) {
    for (const field of formDefinition.fields) {
      const fieldKey = field.id || field.name;
      const val = answers[fieldKey];

      if (field.required && (val === undefined || val === null || val === '')) {
        const err = new Error(`Field "${field.label || fieldKey}" is required`);
        err.statusCode = 400;
        throw err;
      }

      if (val !== undefined && val !== null && val !== '') {
        if (field.type === 'NUMBER' && isNaN(Number(val))) {
          const err = new Error(`Field "${field.label || fieldKey}" must be a number`);
          err.statusCode = 400;
          throw err;
        }
        if (
          (field.type === 'SELECT' || field.type === 'RADIO') &&
          Array.isArray(field.options) &&
          !field.options.includes(val)
        ) {
          const err = new Error(`Invalid option selected for field "${field.label || fieldKey}"`);
          err.statusCode = 400;
          throw err;
        }
        validated[fieldKey] = val;
      }
    }
  }

  // Handle team registration validation & payload preservation
  const teamSettings = formDefinition.teamSettings;
  if (teamSettings && teamSettings.enabled) {
    if (!answers.isTeamRegistration) {
      const err = new Error('This event requires team registration. Please register with your team.');
      err.statusCode = 400;
      throw err;
    }
    const teamName = typeof answers.teamName === 'string' ? answers.teamName.trim() : '';
    if (!teamName) {
      const err = new Error('Team name is required');
      err.statusCode = 400;
      throw err;
    }
    const minSize = teamSettings.minTeamSize || 2;
    const maxSize = teamSettings.maxTeamSize || 10;
    const teamMembers = Array.isArray(answers.teamMembers) ? answers.teamMembers : [];
    const teamSize = Number(answers.teamSize || (teamMembers.length + 1));
    if (isNaN(teamSize) || teamSize < minSize || teamSize > maxSize) {
      const err = new Error(`Team size must be between ${minSize} and ${maxSize} members`);
      err.statusCode = 400;
      throw err;
    }
    validated.isTeamRegistration = true;
    validated.teamName = teamName;
    validated.teamSize = teamSize;
    validated.teamLeader = answers.teamLeader;
    validated.teamMembers = teamMembers;
  } else if (answers.isTeamRegistration) {
    validated.isTeamRegistration = true;
    validated.teamName = answers.teamName;
    validated.teamSize = answers.teamSize;
    validated.teamLeader = answers.teamLeader;
    validated.teamMembers = answers.teamMembers;
  }

  // Preserve standardized participant registration fields
  const standardFields = [
    'rollNumber', 'name', 'email', 'phone', 'department', 'gender',
    'yearOfStudy', 'collegeName', 'institutionName'
  ];
  for (const sf of standardFields) {
    if (answers[sf] !== undefined && answers[sf] !== null && answers[sf] !== '') {
      validated[sf] = answers[sf];
    }
  }

  return Object.keys(validated).length > 0 ? validated : (submittedAnswers || null);
}

/**
 * Payment Order & Checkout Service
 *
 * Coordinates event validation, seat hold reservation, gateway order creation,
 * and PENDING transaction persistence across tenants.
 */
class PaymentOrderService {
  constructor(options = {}) {
    this.configService = options.configService || defaultPaymentConfigService;
    this.withTenant = options.withTenant || withTenant;
    this.getAdapter = options.getAdapter || getAdapter;
  }

  /**
   * Creates a checkout session for a paid event.
   *
   * @param {Object} params
   * @param {string} params.collegeId - Host college UUID
   * @param {string} params.eventId - Event UUID
   * @param {Object} params.participant - Authenticated participant context
   * @param {string} params.participant.participantType - 'STUDENT' or 'EXTERNAL'
   * @param {string} [params.participant.userId] - Student user UUID
   * @param {string} [params.participant.externalParticipantId] - External participant UUID
   * @param {string} params.participant.name - Participant full name
   * @param {string} params.participant.email - Participant email address
   * @param {string} [params.participant.phone] - Participant phone
   * @param {boolean} [params.isCrossCollege=false] - Whether participant is cross-college student
   * @param {Object} [params.formAnswers] - Submitted custom form answers
   * @param {string} [params.returnUrl] - Optional redirect URL for Cashfree checkout
   * @returns {Promise<Object>} Checkout session details for the frontend
   */
  async createCheckoutSession(params) {
    const {
      collegeId,
      eventId,
      participant,
      isCrossCollege = false,
      formAnswers,
      returnUrl,
    } = params;

    if (!collegeId) throw new Error('collegeId is required');
    if (!eventId) throw new Error('eventId is required');
    if (!participant || !participant.participantType) {
      throw new Error('Valid participant context is required');
    }

    const isStudent = participant.participantType === 'STUDENT';
    const userId = isStudent ? participant.userId : null;

    if (isStudent && !userId) {
      throw new Error('userId is required for student checkout');
    }
    if (!isStudent && !participant.email) {
      throw new Error('email is required for external checkout');
    }

    // 1. Resolve Active College Payment Configuration & Decrypted Gateway Credentials
    const config = await this.configService.getDecryptedConfig(collegeId);
    if (config.status !== 'ACTIVE') {
      const err = new Error('Payments are not currently enabled or active for this college');
      err.statusCode = 400;
      throw err;
    }
    if (!config.keyId || !config.keySecret) {
      const err = new Error('Payment gateway credentials are not fully configured for this college');
      err.statusCode = 500;
      throw err;
    }

    // 2. Validate Event & Check for Existing Registrations / Active Holds (in withTenant)
    const setupData = await this.withTenant(collegeId, async (tx) => {
      // 2.1 Fetch event and computed status
      const [eventStatusRow, event] = await Promise.all([
        tx.eventsWithStatus.findFirst({
          where: { id: eventId, collegeId },
          select: { status: true, visibility: true },
        }),
        tx.event.findFirst({
          where: { id: eventId, collegeId },
          select: {
            id: true,
            title: true,
            isPaid: true,
            fee: true,
            currency: true,
            registrationMode: true,
            registrationDeadline: true,
            customFormDefinition: true,
            capacity: true,
            registeredCount: true,
          },
        }),
      ]);

      if (!event || !eventStatusRow) {
        const err = new Error('Event not found');
        err.statusCode = 404;
        throw err;
      }

      if (!event.isPaid || event.fee <= 0) {
        const err = new Error('This is a free event. Use standard registration instead of checkout.');
        err.statusCode = 400;
        throw err;
      }

      if (eventStatusRow.status === 'CANCELLED') {
        const err = new Error('Cannot checkout for a cancelled event');
        err.statusCode = 400;
        throw err;
      }
      if (eventStatusRow.status === 'COMPLETED') {
        const err = new Error('Cannot checkout for a past event');
        err.statusCode = 400;
        throw err;
      }

      if ((isCrossCollege || !isStudent) && eventStatusRow.visibility !== 'PUBLIC') {
        const err = new Error('Registration is only available for public events');
        err.statusCode = 403;
        throw err;
      }

      if (event.registrationMode !== 'INTERNAL') {
        const err = new Error('Registration is not currently open for this event');
        err.statusCode = 400;
        throw err;
      }

      if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
        const err = new Error('Registration deadline has passed');
        err.statusCode = 400;
        throw err;
      }

      // 2.2 Derive or verify external participant identity server-side
      let resolvedExternalParticipantId = null;
      if (!isStudent) {
        const normalizedEmail = (participant.email || '').toLowerCase().trim();
        let externalRecord = await tx.externalParticipant.findFirst({
          where: { collegeId, email: normalizedEmail },
        });

        if (!externalRecord) {
          externalRecord = await tx.externalParticipant.create({
            data: {
              collegeId,
              email: normalizedEmail,
              name: participant.name || 'Participant',
              phone: participant.phone || null,
              institutionName: participant.institutionName || null,
              isEmailVerified: true,
            },
          });
        }

        // Reject client if supplied externalParticipantId mismatches verified email record
        if (participant.externalParticipantId && participant.externalParticipantId !== externalRecord.id) {
          const err = new Error('Client externalParticipantId does not match verified external participant identity');
          err.statusCode = 403;
          throw err;
        }

        resolvedExternalParticipantId = externalRecord.id;
      }

      // 2.3 Check if user or any teammate is already registered for this event
      await assertNoDuplicateParticipants(
        tx,
        collegeId,
        eventId,
        participant.email,
        formAnswers?.teamMembers || []
      );

      const existingRegistration = await tx.eventRegistration.findFirst({
        where: isStudent
          ? { collegeId, eventId, userId }
          : { collegeId, eventId, externalParticipantId: resolvedExternalParticipantId },
        select: { id: true },
      });
      if (existingRegistration) {
        const err = new Error('You are already registered for this event');
        err.statusCode = 409;
        throw err;
      }

      // 2.4 Check if user already has an active, non-expired checkout session with an order
      const activeReservation = await tx.seatReservation.findFirst({
        where: {
          collegeId,
          eventId,
          status: 'HELD',
          expiresAt: { gt: new Date() },
          ...(isStudent ? { userId } : { externalParticipantId: resolvedExternalParticipantId }),
        },
        select: {
          id: true,
          collegeId: true,
          eventId: true,
          status: true,
          expiresAt: true,
          paymentTransaction: {
            select: {
              id: true,
              collegeId: true,
              eventId: true,
              reservationId: true,
              participantType: true,
              userId: true,
              externalParticipantId: true,
              amount: true,
              currency: true,
              status: true,
              gatewayProvider: true,
              paymentMode: true,
              gatewayOrderId: true,
              gatewayPaymentId: true,
              failureReason: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (
        activeReservation &&
        activeReservation.paymentTransaction &&
        activeReservation.paymentTransaction.status === 'PENDING' &&
        activeReservation.paymentTransaction.gatewayOrderId
      ) {
        // Return existing active checkout session details (Idempotent reuse)
        return {
          reused: true,
          event,
          transaction: activeReservation.paymentTransaction,
          reservation: activeReservation,
        };
      }

      // 2.5 Validate Custom Form Answers
      const validatedAnswers = validateFormAnswers(event.customFormDefinition, formAnswers);

      // 2.6 Capacity Check: sum of registered + currently active non-expired holds
      if (event.capacity) {
        const activeHeldCount = await tx.seatReservation.count({
          where: {
            collegeId,
            eventId,
            status: 'HELD',
            expiresAt: { gt: new Date() },
          },
        });

        if (event.registeredCount + activeHeldCount >= event.capacity) {
          const err = new Error('Event capacity has been reached. No seats available.');
          err.statusCode = 409;
          throw err;
        }
      }

      // 2.7 Create Ephemeral Seat Hold Reservation (15 minutes TTL)
      const expiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);
      const reservation = await tx.seatReservation.create({
        data: {
          collegeId,
          eventId,
          participantType: participant.participantType,
          userId,
          externalParticipantId: resolvedExternalParticipantId,
          status: 'HELD',
          expiresAt,
        },
      });

      return {
        reused: false,
        event,
        reservation,
        validatedAnswers,
        resolvedExternalParticipantId,
      };
    });

    // 3. Handle Reused Active Session
    if (setupData.reused) {
      return {
        reused: true,
        transactionId: setupData.transaction.id,
        reservationId: setupData.reservation.id,
        reservationExpiresAt: setupData.reservation.expiresAt,
        amount: setupData.transaction.amount,
        currency: setupData.transaction.currency,
        provider: setupData.transaction.gatewayProvider,
        gatewayOrderId: setupData.transaction.gatewayOrderId,
        keyId: config.keyId,
        isTestMode: config.isTestMode,
        displayMerchantName: config.displayMerchantName || setupData.event.title,
      };
    }

    const { event, reservation, validatedAnswers } = setupData;
    const adapter = this.getAdapter(config.provider);
    const transactionId = crypto.randomUUID();
    const idempotencyKey = crypto.randomUUID();

    // Determine final order amount (handles flat team fee vs per-member team fee vs individual registration)
    let orderAmount = event.fee;
    const teamSettings = event.customFormDefinition && event.customFormDefinition.teamSettings;
    const isTeam = Boolean(formAnswers && formAnswers.isTeamRegistration);
    if (isTeam && teamSettings && teamSettings.enabled && teamSettings.feeModel === 'PER_MEMBER') {
      const teamSize = Number(formAnswers && (formAnswers.teamSize || (Array.isArray(formAnswers.teamMembers) && (formAnswers.teamMembers.length + 1))));
      if (!isNaN(teamSize) && teamSize >= (teamSettings.minTeamSize || 2)) {
        orderAmount = event.fee * teamSize;
      }
    }

    // 4. Create Gateway Order (Executed OUTSIDE withTenant)
    let gatewayOrderResult;
    try {
      gatewayOrderResult = await adapter.createOrder(
        {
          orderId: transactionId,
          amount: orderAmount,
          currency: event.currency || 'INR',
          receipt: transactionId,
          idempotencyKey,
          customerDetails: {
            customerId: userId || setupData.resolvedExternalParticipantId,
            customerEmail: participant.email,
            customerName: participant.name,
            customerPhone: participant.phone,
          },
          returnUrl,
          notes: {
            collegeId,
            eventId,
            reservationId: reservation.id,
          },
        },
        config
      );
    } catch (gatewayErr) {
      // If gateway fails, release the seat hold immediately
      try {
        await this.withTenant(collegeId, async (tx) => {
          await tx.seatReservation.update({
            where: { id: reservation.id },
            data: { status: 'RELEASED' },
          });
        });
      } catch (cleanupErr) {
        // Log cleanup error if any
      }
      if (gatewayErr && gatewayErr.isOperational === undefined) {
        gatewayErr.isOperational = true;
      }
      throw gatewayErr;
    }

    // 5. Persist PENDING Payment Transaction (in withTenant)
    // Protected by database trigger `trg_verify_payment_transaction_creation`
    const transaction = await this.withTenant(collegeId, async (tx) => {
      return await tx.paymentTransaction.create({
        data: {
          id: transactionId,
          collegeId,
          eventId,
          reservationId: reservation.id,
          participantType: participant.participantType,
          userId,
          externalParticipantId: setupData.resolvedExternalParticipantId,
          amount: orderAmount,
          currency: event.currency || 'INR',
          status: 'PENDING',
          gatewayProvider: config.provider,
          paymentMode: config.mode,
          gatewayOrderId: gatewayOrderResult.gatewayOrderId,
          idempotencyKey,
          registrationPayload: validatedAnswers || null,
        },
        select: {
          id: true,
          collegeId: true,
          eventId: true,
          reservationId: true,
          participantType: true,
          userId: true,
          externalParticipantId: true,
          amount: true,
          currency: true,
          status: true,
          gatewayProvider: true,
          paymentMode: true,
          gatewayOrderId: true,
          gatewayPaymentId: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    // 6. Return Clean Checkout Session Payload
    return {
      reused: false,
      transactionId: transaction.id,
      reservationId: reservation.id,
      reservationExpiresAt: reservation.expiresAt,
      amount: transaction.amount,
      currency: transaction.currency,
      provider: transaction.gatewayProvider,
      gatewayOrderId: transaction.gatewayOrderId,
      paymentSessionId: gatewayOrderResult.paymentSessionId || null,
      keyId: config.keyId,
      isTestMode: config.isTestMode,
      displayMerchantName: config.displayMerchantName || event.title,
    };
  }
}

const defaultPaymentOrderService = new PaymentOrderService();

module.exports = {
  PaymentOrderService,
  defaultPaymentOrderService,
};
