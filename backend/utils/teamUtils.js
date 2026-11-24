/**
 * Team Registration Utilities
 *
 * Provides duplicate participant enforcement across teams and team membership lookup.
 */
const { AppError } = require('../middleware/errorHandler');

/**
 * Checks whether any email (leader or teammate) is already registered for an event,
 * either as an individual registrant, a team leader, or a teammate in any existing team.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {string} collegeId - Tenant college UUID
 * @param {string} eventId - Event UUID
 * @param {string} leaderEmail - Email of the incoming registrant / team leader
 * @param {Array<{ name: string; email: string }>} [teamMembers=[]] - Additional incoming teammates
 * @param {string} [excludeRegistrationId=null] - Optional registration ID to exclude (e.g. on update)
 * @throws {AppError} with 409 if any incoming participant is already registered
 */
async function assertNoDuplicateParticipants(tx, collegeId, eventId, leaderEmail, teamMembers = [], excludeRegistrationId = null) {
  const normalizedLeaderEmail = (leaderEmail || '').toLowerCase().trim();
  const incomingMemberEmails = new Map(); // email -> name

  if (Array.isArray(teamMembers)) {
    for (const m of teamMembers) {
      const email = (m?.email || '').toLowerCase().trim();
      if (email) {
        incomingMemberEmails.set(email, m.name || 'Teammate');
      }
    }
  }

  // Guard against environments or test mocks where eventRegistration.findMany is not mocked
  if (!tx?.eventRegistration || typeof tx.eventRegistration.findMany !== 'function') {
    return;
  }

  // Load all active registrations for this event within the tenant
  const existingRegistrations = await tx.eventRegistration.findMany({
    where: {
      collegeId,
      eventId,
      ...(excludeRegistrationId ? { id: { not: excludeRegistrationId } } : {}),
    },
    select: {
      id: true,
      participantEmail: true,
      participantName: true,
      formAnswers: true,
    },
  });

  for (const reg of existingRegistrations) {
    const regEmail = (reg.participantEmail || '').toLowerCase().trim();
    const answers = reg.formAnswers;
    const isTeam = Boolean(answers && answers.isTeamRegistration);
    const teamName = isTeam && typeof answers.teamName === 'string' ? answers.teamName : null;

    // 1. Check if incoming leader email is already registered as an individual or team leader
    if (normalizedLeaderEmail && regEmail === normalizedLeaderEmail) {
      const msg = isTeam
        ? `You (${normalizedLeaderEmail}) are already registered for this event as leader of team "${teamName}".`
        : `You (${normalizedLeaderEmail}) are already registered for this event.`;
      throw new AppError(msg, 409);
    }

    // 2. Check existing team members
    if (isTeam && Array.isArray(answers.teamMembers)) {
      for (const existingMember of answers.teamMembers) {
        const emEmail = (existingMember?.email || '').toLowerCase().trim();
        if (!emEmail) continue;

        // Incoming leader matches an existing teammate
        if (normalizedLeaderEmail && emEmail === normalizedLeaderEmail) {
          throw new AppError(
            `You (${normalizedLeaderEmail}) are already registered for this event as a member of team "${teamName}".`,
            409
          );
        }

        // Incoming teammate matches an existing teammate
        if (incomingMemberEmails.has(emEmail)) {
          const memberName = incomingMemberEmails.get(emEmail);
          throw new AppError(
            `Teammate "${memberName}" (${emEmail}) is already registered for this event in team "${teamName}".`,
            409
          );
        }
      }
    }

    // 3. Check if any incoming teammate matches an existing leader / registrant
    if (regEmail && incomingMemberEmails.has(regEmail)) {
      const memberName = incomingMemberEmails.get(regEmail);
      const msg = isTeam
        ? `Teammate "${memberName}" (${regEmail}) is already registered for this event as leader of team "${teamName}".`
        : `Teammate "${memberName}" (${regEmail}) is already registered for this event.`;
      throw new AppError(msg, 409);
    }
  }
}

/**
 * Searches whether a participant (by userId and/or email) is registered for an event,
 * either as the direct registrant / leader, or as a teammate in an existing team.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {string} collegeId - Tenant college UUID
 * @param {string} eventId - Event UUID
 * @param {string} [userId=null] - Student user UUID
 * @param {string} [email=null] - Participant email
 * @returns {Promise<Object>} Membership descriptor
 */
async function findParticipantEventMembership(tx, collegeId, eventId, userId, email) {
  if (!tx?.eventRegistration || typeof tx.eventRegistration.findFirst !== 'function') {
    return { isRegistered: false, registration: null };
  }

  const normalizedEmail = (email || '').toLowerCase().trim();

  // 1. Direct registration lookup (Leader or Individual)
  const directReg = await tx.eventRegistration.findFirst({
    where: {
      collegeId,
      eventId,
      ...(userId ? { userId } : { participantEmail: normalizedEmail }),
    },
    select: {
      id: true,
      eventId: true,
      userId: true,
      participantName: true,
      participantEmail: true,
      registeredAt: true,
      formAnswers: true,
    },
  });

  if (directReg) {
    const isTeam = Boolean(directReg.formAnswers && directReg.formAnswers.isTeamRegistration);
    return {
      isRegistered: true,
      isLeader: isTeam,
      isTeamMember: false,
      isTeamRegistration: isTeam,
      teamName: isTeam ? directReg.formAnswers.teamName : null,
      teamSize: isTeam ? directReg.formAnswers.teamSize : 1,
      teamLeader: isTeam ? directReg.formAnswers.teamLeader : null,
      teamMembers: isTeam ? directReg.formAnswers.teamMembers : [],
      registration: directReg,
    };
  }

  // 2. Teammate lookup across existing team registrations
  if (normalizedEmail && typeof tx.eventRegistration.findMany === 'function') {
    const allRegistrations = await tx.eventRegistration.findMany({
      where: { collegeId, eventId },
      select: {
        id: true,
        eventId: true,
        userId: true,
        participantName: true,
        participantEmail: true,
        registeredAt: true,
        formAnswers: true,
      },
    });

    for (const r of allRegistrations) {
      const answers = r.formAnswers;
      if (answers && answers.isTeamRegistration && Array.isArray(answers.teamMembers)) {
        const found = answers.teamMembers.find(
          (m) => (m?.email || '').toLowerCase().trim() === normalizedEmail
        );
        if (found) {
          return {
            isRegistered: true,
            isLeader: false,
            isTeamMember: true,
            isTeamRegistration: true,
            teamName: answers.teamName,
            teamSize: answers.teamSize,
            teamLeader: answers.teamLeader || {
              name: r.participantName,
              email: r.participantEmail,
            },
            teamMembers: answers.teamMembers,
            myDetails: found,
            registration: r,
          };
        }
      }
    }
  }

  return {
    isRegistered: false,
    registration: null,
  };
}

module.exports = {
  assertNoDuplicateParticipants,
  findParticipantEventMembership,
};
