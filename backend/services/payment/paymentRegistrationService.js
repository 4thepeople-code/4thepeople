'use strict';

const { platformPrisma } = require('../../config/platformDb');
const { enqueueEmail } = require('../outboxService');

/**
 * Payment Registration Service
 *
 * Atomically completes event registrations for successfully verified payment transactions.
 * Enforces seat hold status checks, capacity increment triggers, and outbox email confirmations.
 */
class PaymentRegistrationService {
  constructor(options = {}) {
    this.prisma = options.prisma || platformPrisma;
  }

  /**
   * Completes registration for a verified PAID transaction.
   *
   * @param {Object} params
   * @param {string} params.collegeId - Host college UUID
   * @param {string} params.transactionId - Payment transaction UUID
   * @returns {Promise<Object>} Completed registration result
   */
  async completePaidRegistration(params) {
    const { collegeId, transactionId } = params;

    if (!collegeId) throw new Error('collegeId is required');
    if (!transactionId) throw new Error('transactionId is required');

    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch transaction and event
      const txn = await tx.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              location: true,
              collegeId: true,
            },
          },
        },
      });

      if (!txn || txn.collegeId !== collegeId) {
        const err = new Error(`Transaction ${transactionId} not found for college ${collegeId}`);
        err.statusCode = 404;
        throw err;
      }

      if (txn.status !== 'PAID') {
        if (txn.status === 'LATE_PAYMENT') {
          return {
            success: false,
            status: 'LATE_PAYMENT',
            message: 'Payment was received after the seat reservation expired. A refund will be initiated.',
            transactionId: txn.id,
          };
        }
        const err = new Error(`Cannot register: Transaction status is ${txn.status} (expected PAID)`);
        err.statusCode = 400;
        throw err;
      }

      // 2. Check if registration already exists for this payment transaction (Idempotency)
      const existingRegistration = await tx.eventRegistration.findFirst({
        where: {
          collegeId,
          paymentTransactionId: txn.id,
        },
      });

      if (existingRegistration) {
        return {
          success: true,
          idempotent: true,
          registration: existingRegistration,
        };
      }

      // 3. Atomically Confirm Seat Hold Reservation
      const now = new Date();
      let reservationConfirmed = false;

      if (txn.reservationId) {
        // Atomic conditional transition: HELD -> CONFIRMED only when unexpired
        const updateResult = await tx.seatReservation.updateMany({
          where: {
            id: txn.reservationId,
            collegeId,
            status: 'HELD',
            expiresAt: { gt: now },
          },
          data: {
            status: 'CONFIRMED',
          },
        });

        if (updateResult.count > 0) {
          reservationConfirmed = true;
        } else {
          // Atomic transition failed: inspect database state to differentiate retry vs late payment
          const currentRes = await tx.seatReservation.findUnique({
            where: { id: txn.reservationId },
          });

          if (!currentRes || currentRes.collegeId !== collegeId) {
            await tx.paymentTransaction.update({
              where: { id: txn.id },
              data: {
                status: 'LATE_PAYMENT',
                failureReason: 'Missing or deleted seat reservation for transaction. Cannot confirm registration.',
              },
            });
            return {
              success: false,
              status: 'LATE_PAYMENT',
              message: 'No valid seat reservation found for this payment. A refund will be initiated.',
              transactionId: txn.id,
            };
          }

          if (currentRes.status === 'CONFIRMED') {
            // Already confirmed by a prior attempt of this transaction (Idempotency / Retry)
            reservationConfirmed = true;
          } else if (currentRes.status === 'HELD' && txn.status === 'PAID' && txn.updatedAt <= currentRes.expiresAt) {
            // Recovery: Payment was verified before reservation expired, but registration creation failed transiently
            await tx.seatReservation.update({
              where: { id: currentRes.id },
              data: { status: 'CONFIRMED' },
            });
            reservationConfirmed = true;
          } else {
            const failureReason =
              currentRes.status === 'RELEASED'
                ? 'Seat reservation was released prior to payment confirmation.'
                : currentRes.status === 'EXPIRED' || currentRes.expiresAt <= now
                  ? 'Payment captured after seat reservation expired.'
                  : `Invalid seat reservation status (${currentRes.status}) for registration completion.`;

            await tx.paymentTransaction.update({
              where: { id: txn.id },
              data: {
                status: 'LATE_PAYMENT',
                failureReason,
              },
            });

            if (currentRes.status !== 'EXPIRED' && currentRes.status !== 'RELEASED') {
              await tx.seatReservation.update({
                where: { id: currentRes.id },
                data: { status: 'EXPIRED' },
              });
            }

            return {
              success: false,
              status: 'LATE_PAYMENT',
              message: 'Seat reservation hold expired or was released before confirmation. A refund will be initiated.',
              transactionId: txn.id,
            };
          }
        }
      } else {
        await tx.paymentTransaction.update({
          where: { id: txn.id },
          data: {
            status: 'LATE_PAYMENT',
            failureReason: 'Missing or deleted seat reservation for transaction. Cannot confirm registration.',
          },
        });
        return {
          success: false,
          status: 'LATE_PAYMENT',
          message: 'No valid seat reservation found for this payment. A refund will be initiated.',
          transactionId: txn.id,
        };
      }

      if (!reservationConfirmed) {
        const err = new Error('Reservation confirmation failed; registration halted.');
        err.statusCode = 400;
        throw err;
      }

      // 5. Populate Participant Snapshot Data
      let participantName = 'Participant';
      let participantEmail = '';
      let participantRollNumber = null;
      let participantCollegeName = null;
      let homeCollegeId = collegeId;

      if (txn.participantType === 'STUDENT' && txn.userId) {
        const user = await tx.user.findUnique({
          where: { id: txn.userId },
          include: { college: { select: { name: true } } },
        });
        if (user) {
          participantName = user.name;
          participantEmail = user.email;
          participantRollNumber = user.rollNumber || null;
          participantCollegeName = user.college ? user.college.name : null;
          homeCollegeId = user.collegeId;
        }
      } else if (txn.participantType === 'EXTERNAL' && txn.externalParticipantId) {
        const participant = await tx.externalParticipant.findUnique({
          where: { id: txn.externalParticipantId },
        });
        if (participant) {
          participantName = participant.name;
          participantEmail = participant.email;
          participantCollegeName = participant.institutionName || null;
          homeCollegeId = null;
        }
      }

      // 6. Create EventRegistration
      // Trigger `handle_registration_insert` atomically checks capacity and increments registered_count
      let finalFormAnswers = txn.registrationPayload || null;
      if (finalFormAnswers && finalFormAnswers.isTeamRegistration) {
        finalFormAnswers = {
          ...finalFormAnswers,
          teamLeader: {
            ...(finalFormAnswers.teamLeader || {}),
            name: participantName,
            email: participantEmail,
            rollNumber: participantRollNumber || (finalFormAnswers.teamLeader && finalFormAnswers.teamLeader.rollNumber) || null,
          },
        };
      }

      let registration;
      try {
        registration = await tx.eventRegistration.create({
          data: {
            collegeId,
            eventId: txn.eventId,
            userId: txn.userId,
            externalParticipantId: txn.externalParticipantId,
            participantType: txn.participantType,
            paymentTransactionId: txn.id,
            homeCollegeId,
            participantName,
            participantEmail,
            participantRollNumber,
            participantCollegeName,
            isUserDeleted: false,
            registeredByRole: 'SELF',
            formAnswers: finalFormAnswers,
          },
        });
      } catch (createErr) {
        // Idempotency recovery: check if registration was already created concurrently
        const existingReg = await tx.eventRegistration.findFirst({
          where: {
            collegeId,
            eventId: txn.eventId,
            ...(txn.participantType === 'STUDENT'
              ? { userId: txn.userId }
              : { externalParticipantId: txn.externalParticipantId }),
          },
        });
        if (existingReg) {
          return {
            success: true,
            idempotent: true,
            registration: existingReg,
          };
        }
        // Save failure reason on transaction so it can be reconciled/retried
        await tx.paymentTransaction.update({
          where: { id: txn.id },
          data: {
            failureReason: `Registration creation failed: ${createErr.message}`,
          },
        });
        throw createErr;
      }

      // 7. Enqueue Email Outbox Confirmation
      if (participantEmail) {
        try {
          await enqueueEmail(tx, {
            collegeId,
            recipientEmail: participantEmail,
            recipientName: participantName,
            templateType: 'EVENT_TICKET',
            payload: {
              participantName,
              eventTitle: txn.event.title,
              venue: txn.event.location || 'Campus',
              startDate: txn.event.startAt,
              amountPaid: txn.amount,
              currency: txn.currency,
              transactionId: txn.id,
              registrationId: registration.id,
            },
          });
        } catch (emailErr) {
          // Outbox enqueue failure should not rollback the financial registration
          console.error('[PaymentRegistrationService] Failed to enqueue registration email:', emailErr.message);
        }
      }

      return {
        success: true,
        idempotent: false,
        registration,
      };
    });
  }
}

const defaultPaymentRegistrationService = new PaymentRegistrationService();

module.exports = {
  PaymentRegistrationService,
  defaultPaymentRegistrationService,
};
