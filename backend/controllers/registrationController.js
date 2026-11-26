const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { assertNoDuplicateParticipants, findParticipantEventMembership } = require('../utils/teamUtils');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const validateUUID = (value, label) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label} (must be a valid UUID)`, 400);
  }
};

/**
 * POST /events/:eventId/register
 * Registers the authenticated user for an upcoming/ongoing event.
 * Supports both same-college and cross-college student registration.
 *
 * Uses crossCollegeRegisterMiddleware (not authenticateToken), which:
 *   - Accepts JWTs where decoded.collegeId !== req.collegeId (cross-college).
 *   - Has already re-loaded the student from their home college.
 *   - Has set req.user (with snapshot identity fields), req.homeCollegeId, req.isCrossCollege.
 *
 * Atomically checks capacity and increments registered_count via PostgreSQL trigger.
 */
exports.registerForEvent = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const registration = await withTenant(req.collegeId, async (tx) => {
    // 1. Check event existence and computed status
    const [eventStatusRow, event] = await Promise.all([
      tx.eventsWithStatus.findFirst({
        where: { id: eventId, collegeId: req.collegeId },
        select: { status: true, visibility: true },
      }),
      tx.event.findFirst({
        where: { id: eventId, collegeId: req.collegeId },
        select: {
          id: true,
          isPaid: true,
          fee: true,
          registrationMode: true,
          customFormDefinition: true,
          registrationDeadline: true,
          registrationUrl: true,
        },
      }),
    ]);
    if (!event || !eventStatusRow) {
      throw new AppError('Event not found', 404);
    }

    if (event.isPaid) {
      throw new AppError('This is a paid event. Registration requires completing payment checkout.', 400);
    }

    if (eventStatusRow.status === 'CANCELLED') {
      throw new AppError('Cannot register for a cancelled event', 400);
    }
    if (eventStatusRow.status === 'COMPLETED') {
      throw new AppError('Cannot register for a past event', 400);
    }

    // Cross-college students may only register for PUBLIC events
    if (req.isCrossCollege && eventStatusRow.visibility !== 'PUBLIC') {
      throw new AppError('Cross-college registration is only available for public events', 403);
    }

    // Check registration mode
    if (event.registrationMode === 'NONE') {
      throw new AppError('Registration is not open for this event', 400);
    }
    if (event.registrationMode === 'EXTERNAL') {
      throw new AppError(`This event requires external registration at: ${event.registrationUrl || 'external link'}`, 400);
    }

    // Check registration deadline
    if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
      throw new AppError('Registration deadline has passed', 400);
    }

    // 2. Validate custom form answers if form definition exists
    const body = req.body || {};
    let validatedAnswers = null;
    const answers = body.formAnswers || body.answers || {};

    if (event.customFormDefinition && Array.isArray(event.customFormDefinition.fields)) {
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
    } else if (body.formAnswers || body.answers) {
      validatedAnswers = { ...answers };
    }

    // Handle team registration validation & payload preservation
    const teamSettings = event.customFormDefinition?.teamSettings;
    if (teamSettings && teamSettings.enabled) {
      if (!answers.isTeamRegistration) {
        throw new AppError('This event requires team registration. Please provide your team details.', 400);
      }
      const teamName = typeof answers.teamName === 'string' ? answers.teamName.trim() : '';
      if (!teamName) {
        throw new AppError('Team name is required', 400);
      }
      const minSize = teamSettings.minTeamSize || 2;
      const maxSize = teamSettings.maxTeamSize || 10;
      const teamMembers = Array.isArray(answers.teamMembers) ? answers.teamMembers : [];
      const teamSize = Number(answers.teamSize || (teamMembers.length + 1));
      if (isNaN(teamSize) || teamSize < minSize || teamSize > maxSize) {
        throw new AppError(`Team size must be between ${minSize} and ${maxSize} members`, 400);
      }

      const memberEmails = new Set();
      const leaderEmail = (req.user?.email || '').toLowerCase().trim();
      if (leaderEmail) memberEmails.add(leaderEmail);

      for (let i = 0; i < teamMembers.length; i++) {
        const m = teamMembers[i];
        if (!m || !m.name || !m.name.trim()) {
          throw new AppError(`Teammate #${i + 2} name is required`, 400);
        }
        if (!m || !m.email || !m.email.trim()) {
          throw new AppError(`Teammate #${i + 2} email is required`, 400);
        }
        const mEmail = m.email.toLowerCase().trim();
        if (memberEmails.has(mEmail)) {
          throw new AppError(`Duplicate email "${mEmail}" found in team members`, 400);
        }
        memberEmails.add(mEmail);
      }

      if (!validatedAnswers) validatedAnswers = {};
      validatedAnswers.isTeamRegistration = true;
      validatedAnswers.teamName = teamName;
      validatedAnswers.teamSize = teamSize;
      validatedAnswers.teamLeader = {
        name: req.user?.name || '',
        email: req.user?.email || '',
        rollNumber: req.user?.rollNumber || null,
      };
      validatedAnswers.teamMembers = teamMembers;
    } else if (answers.isTeamRegistration) {
      if (!validatedAnswers) validatedAnswers = {};
      validatedAnswers.isTeamRegistration = true;
      validatedAnswers.teamName = answers.teamName;
      validatedAnswers.teamSize = answers.teamSize;
      validatedAnswers.teamLeader = {
        name: req.user?.name || answers.teamLeader?.name || '',
        email: req.user?.email || answers.teamLeader?.email || '',
        rollNumber: req.user?.rollNumber || answers.teamLeader?.rollNumber || null,
      };
      validatedAnswers.teamMembers = answers.teamMembers;
    }

    // 3. Check duplicate participant across both individual and team registrations
    await assertNoDuplicateParticipants(
      tx,
      req.collegeId,
      eventId,
      req.user.email,
      validatedAnswers?.teamMembers || []
    );

    // 4. Build snapshot identity fields — always from server-side user data,
    //    never from client-supplied values.
    //    For cross-college: req.user was loaded from home college by crossCollegeRegisterMiddleware.
    //    For same-college: req.user was loaded from host college by the same middleware.
    const homeCollegeId = req.homeCollegeId || req.collegeId;
    const participantName = req.user.name;
    const participantEmail = req.user.email;
    const participantRollNumber = req.user.rollNumber || body.rollNumber || answers.rollNumber || null;
    const participantCollegeName = req.user.college?.name || body.collegeName || body.institutionName || answers.collegeName || answers.institutionName || null;
    const participantDepartment = req.user.department?.name || body.department || body.participantDepartment || answers.department || null;
    const participantGender = req.user.gender || body.gender || body.participantGender || answers.gender || null;
    const participantYearOfStudy = req.user.yearOfStudy || body.yearOfStudy || body.participantYearOfStudy || answers.yearOfStudy || null;
    const participantPhone = req.user.phone || body.phone || body.participantPhone || answers.phone || null;

    if (!validatedAnswers) validatedAnswers = {};
    validatedAnswers.rollNumber = participantRollNumber;
    validatedAnswers.name = participantName;
    validatedAnswers.email = participantEmail;
    validatedAnswers.department = participantDepartment;
    validatedAnswers.gender = participantGender;
    validatedAnswers.yearOfStudy = participantYearOfStudy;
    validatedAnswers.collegeName = participantCollegeName;
    validatedAnswers.phone = participantPhone;

    // Ensure teamLeader in validatedAnswers has trusted snapshot roll number
    if (validatedAnswers.isTeamRegistration && validatedAnswers.teamLeader) {
      validatedAnswers.teamLeader.rollNumber = participantRollNumber;
      if (participantPhone && !validatedAnswers.teamLeader.phone) {
        validatedAnswers.teamLeader.phone = participantPhone;
      }
    }

    // 5. Atomically insert registration. PostgreSQL trigger handle_registration_insert
    // row-locks the events table row FOR UPDATE, enforces capacity, and increments registered_count.
    try {
      return await tx.eventRegistration.create({
        data: {
          collegeId: req.collegeId,
          eventId,
          userId: req.user.id,
          participantType: 'STUDENT',
          homeCollegeId,
          participantName,
          participantEmail,
          participantRollNumber,
          participantCollegeName,
          participantDepartment,
          participantGender,
          participantYearOfStudy,
          participantPhone,
          isUserDeleted: false,
          registeredByRole: 'SELF',
          formAnswers: validatedAnswers,
        },
      });
    } catch (err) {
      if (err.code === 'P2002' || (err.message && err.message.includes('uq_event_registrations_user_event'))) {
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

  res.status(201).json({
    success: true,
    message: 'Successfully registered for event',
    registration: {
      id: registration.id,
      eventId: registration.eventId,
      userId: registration.userId,
      registeredAt: registration.registeredAt,
    },
  });
});

/**
 * DELETE /events/:eventId/register
 * Cancels the authenticated user's registration for an event.
 * Atomically decrements registered_count via PostgreSQL maintain_event_registration_count trigger.
 */
exports.cancelRegistration = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  await withTenant(req.collegeId, async (tx) => {
    // Check event exists under tenant and is not already completed/cancelled
    const event = await tx.eventsWithStatus.findFirst({
      where: { id: eventId, collegeId: req.collegeId },
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

    const existing = await tx.eventRegistration.findFirst({
      where: { eventId, userId: req.user.id, collegeId: req.collegeId },
    });
    if (!existing) {
      const membership = await findParticipantEventMembership(
        tx,
        req.collegeId,
        eventId,
        req.user.id,
        req.user.email
      );
      if (membership.isTeamMember) {
        throw new AppError(
          `You are registered as a team member of "${membership.teamName}". Only the team leader (${membership.teamLeader?.name || 'Leader'}) can cancel the team registration.`,
          403
        );
      }
      throw new AppError('Registration not found', 404);
    }

    await tx.eventRegistration.delete({
      where: { id: existing.id },
    });
  });

  res.status(200).json({
    success: true,
    message: 'Registration cancelled successfully',
  });
});

/**
 * GET /events/:eventId/my-registration
 * Returns the current user's registration status for a specific event.
 */
exports.getMyRegistrationStatus = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const status = await withTenant(req.collegeId, async (tx) => {
    const event = await tx.eventsWithStatus.findFirst({
      where: { id: eventId, collegeId: req.collegeId },
      select: { id: true, visibility: true },
    });
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (req.isCrossCollege && event.visibility !== 'PUBLIC') {
      throw new AppError('Cross-college registration is only available for public events', 403);
    }

    const membership = await findParticipantEventMembership(
      tx,
      req.collegeId,
      eventId,
      req.user.id,
      req.user.email
    );

    return {
      isRegistered: membership.isRegistered,
      isLeader: membership.isLeader,
      isTeamMember: membership.isTeamMember,
      isTeamRegistration: membership.isTeamRegistration,
      teamName: membership.teamName,
      teamSize: membership.teamSize,
      teamLeader: membership.teamLeader,
      teamMembers: membership.teamMembers,
      myDetails: membership.myDetails || null,
      registration: membership.registration
        ? {
            id: membership.registration.id,
            eventId: membership.registration.eventId,
            userId: membership.registration.userId,
            registeredAt: membership.registration.registeredAt,
          }
        : null,
    };
  });

  res.status(200).json({
    success: true,
    isRegistered: status.isRegistered,
    isLeader: status.isLeader,
    isTeamMember: status.isTeamMember,
    isTeamRegistration: status.isTeamRegistration,
    teamName: status.teamName,
    teamSize: status.teamSize,
    teamLeader: status.teamLeader,
    teamMembers: status.teamMembers,
    myDetails: status.myDetails,
    registration: status.registration,
  });
});

/**
 * GET /events/my-registrations
 * Returns all event registrations for the authenticated user within the tenant.
 */
exports.listMyRegistrations = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const registrations = await withTenant(req.collegeId, async (tx) => {
    const isExternal = req.user.role === 'EXTERNAL';
    const list = await tx.eventRegistration.findMany({
      where: {
        collegeId: req.collegeId,
        ...(isExternal ? { externalParticipantId: req.user.id } : { userId: req.user.id }),
      },
      orderBy: { registeredAt: 'desc' },
      select: {
        id: true,
        eventId: true,
        registeredAt: true,
        formAnswers: true,
        event: {
          select: {
            id: true,
            clubId: true,
            title: true,
            description: true,
            location: true,
            startAt: true,
            endAt: true,
            capacity: true,
            registeredCount: true,
            cancelledAt: true,
            coverImageUrl: true,
            coverImagePublicId: true,
            registrationUrl: true,
            club: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    });

    // Also include registrations where user is listed as a teammate in an active team
    const userEmail = (req.user.email || '').toLowerCase().trim();
    if (userEmail) {
      const otherTeamRegs = await tx.eventRegistration.findMany({
        where: {
          collegeId: req.collegeId,
          ...(isExternal ? { externalParticipantId: { not: req.user.id } } : { userId: { not: req.user.id } }),
        },
        orderBy: { registeredAt: 'desc' },
        select: {
          id: true,
          eventId: true,
          registeredAt: true,
          formAnswers: true,
          event: {
            select: {
              id: true,
              clubId: true,
              title: true,
              description: true,
              location: true,
              startAt: true,
              endAt: true,
              capacity: true,
              registeredCount: true,
              cancelledAt: true,
              coverImageUrl: true,
              coverImagePublicId: true,
              registrationUrl: true,
              club: {
                select: { id: true, name: true, description: true },
              },
            },
          },
        },
      });

      for (const r of otherTeamRegs) {
        const answers = r.formAnswers;
        if (answers && answers.isTeamRegistration && Array.isArray(answers.teamMembers)) {
          const isMember = answers.teamMembers.some(
            (m) => (m?.email || '').toLowerCase().trim() === userEmail
          );
          if (isMember) {
            list.push(r);
          }
        }
      }
    }

    return list;
  });

  res.status(200).json({
    success: true,
    registrations: registrations.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      registeredAt: r.registeredAt,
      event: r.event,
    })),
  });
});

/**
 * GET /manager/clubs/:clubId/events/:eventId/registrations
 * Returns paginated attendee list for club managers or college admins.
 * Includes all participant types (students, cross-college students, external participants).
 * Supports ?participantType=STUDENT|EXTERNAL filter.
 */
exports.getEventAttendees = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId, eventId } = req.params;
  validateUUID(clubId, 'club ID');
  validateUUID(eventId, 'event ID');

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  // Optional participant type filter
  const participantTypeFilter = req.query.participantType;
  const validParticipantTypes = ['STUDENT', 'EXTERNAL'];
  if (participantTypeFilter && !validParticipantTypes.includes(participantTypeFilter)) {
    throw new AppError('participantType must be STUDENT or EXTERNAL', 400);
  }

  const result = await withTenant(req.collegeId, async (tx) => {
    const club = await tx.club.findFirst({
      where: { id: clubId, collegeId: req.collegeId },
      select: { id: true, name: true },
    });
    if (!club) {
      throw new AppError('Club not found', 404);
    }

    const event = await tx.event.findFirst({
      where: { id: eventId, clubId, collegeId: req.collegeId },
      select: { id: true, title: true, capacity: true, registeredCount: true },
    });
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const whereFilter = {
      eventId,
      collegeId: req.collegeId,
      ...(participantTypeFilter ? { participantType: participantTypeFilter } : {}),
    };

    const [total, registrations] = await Promise.all([
      tx.eventRegistration.count({ where: whereFilter }),
      tx.eventRegistration.findMany({
        where: whereFilter,
        orderBy: { registeredAt: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          eventId: true,
          registeredAt: true,
          participantType: true,
          participantName: true,
          participantEmail: true,
          participantRollNumber: true,
          participantCollegeName: true,
          participantDepartment: true,
          participantGender: true,
          participantYearOfStudy: true,
          participantPhone: true,
          homeCollegeId: true,
          isUserDeleted: true,
          formAnswers: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          paymentTransaction: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      club,
      event,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      registrations: registrations.map((r) => ({
        id: r.id,
        eventId: r.eventId,
        registeredAt: r.registeredAt,
        participantType: r.participantType,
        participantName: r.participantName,
        participantEmail: r.participantEmail,
        participantRollNumber: r.participantRollNumber || null,
        participantCollegeName: r.participantCollegeName || null,
        participantDepartment: r.participantDepartment || (r.formAnswers && r.formAnswers.department) || null,
        participantGender: r.participantGender || (r.formAnswers && r.formAnswers.gender) || null,
        participantYearOfStudy: r.participantYearOfStudy || (r.formAnswers && r.formAnswers.yearOfStudy) || null,
        participantPhone: r.participantPhone || (r.formAnswers && r.formAnswers.phone) || null,
        homeCollegeId: r.homeCollegeId || null,
        isUserDeleted: r.isUserDeleted,
        formAnswers: r.formAnswers || null,
        user: r.user || null,
        paymentTransaction: r.paymentTransaction || null,
      })),
    };
  });

  res.status(200).json({
    success: true,
    ...result,
  });
});

/**
 * GET /events/:eventId/export
 * Exports attendee roster as CSV.
 * Allowed for COLLEGE_ADMIN or club MANAGER.
 */
exports.exportEventRegistrations = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }
  if (!req.user || !req.user.id) {
    throw new AppError('Authentication required', 401);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const { csvContent, filename } = await withTenant(req.collegeId, async (tx) => {
    // 1. Fetch event and owning club
    const event = await tx.event.findFirst({
      where: { id: eventId, collegeId: req.collegeId },
      select: { id: true, title: true, clubId: true },
    });
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    // 2. Authorization check: College Admin or Club Manager
    if (req.user.role !== 'COLLEGE_ADMIN') {
      const membership = await tx.membership.findFirst({
        where: {
          collegeId: req.collegeId,
          clubId: event.clubId,
          userId: req.user.id,
          role: 'MANAGER',
        },
      });
      if (!membership) {
        throw new AppError('Forbidden: Only college administrators or club managers can export event registrations', 403);
      }
    }

    // 3. Fetch all registrations with snapshot identity and user/department info
    const registrations = await tx.eventRegistration.findMany({
      where: { eventId, collegeId: req.collegeId },
      orderBy: { registeredAt: 'asc' },
      select: {
        id: true,
        registeredAt: true,
        participantType: true,
        participantName: true,
        participantEmail: true,
        participantRollNumber: true,
        participantCollegeName: true,
        participantDepartment: true,
        participantGender: true,
        participantYearOfStudy: true,
        participantPhone: true,
        formAnswers: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            rollNumber: true,
            department: {
              select: { name: true, shortCode: true },
            },
          },
        },
      },
    });

    // 4. Build CSV — includes all participant types and structured team rosters
    const rows = [
      [
        'Registration ID',
        'Participant Type',
        'Registration Type',
        'Team Name',
        'Team Role',
        'Roll Number',
        'Name',
        'Email',
        'Phone Number',
        'Department',
        'Gender',
        'Year of Study',
        'College / Institution',
        'Registered At',
        'Additional Answers',
      ],
    ];

    for (const r of registrations) {
      const answers = r.formAnswers || {};
      const dept = r.participantDepartment || (answers && answers.department) || (r.user && r.user.department
        ? (r.user.department.shortCode || r.user.department.name)
        : '');
      const gender = r.participantGender || (answers && answers.gender) || '';
      const yearOfStudy = r.participantYearOfStudy || (answers && answers.yearOfStudy) || '';
      const phone = r.participantPhone || (answers && answers.phone) || '';
      const isTeam = Boolean(answers && answers.isTeamRegistration);

      if (isTeam) {
        const teamName = answers.teamName || 'Unnamed Team';
        const leader = answers.teamLeader || {};
        const members = Array.isArray(answers.teamMembers) ? answers.teamMembers : [];

        // Exclude standard registration fields and team metadata from additional answers
        const standardKeys = [
          'isTeamRegistration', 'teamName', 'teamSize', 'teamLeader', 'teamMembers',
          'rollNumber', 'name', 'email', 'phone', 'department', 'gender', 'yearOfStudy',
          'collegeName', 'institutionName'
        ];
        const otherKeys = Object.keys(answers).filter((k) => !standardKeys.includes(k));
        const otherAnswersStr = otherKeys.length > 0
          ? otherKeys.map((k) => `${k}: ${answers[k]}`).join('; ')
          : '';

        // Leader row
        rows.push([
          r.id,
          r.participantType || 'STUDENT',
          'TEAM',
          teamName,
          'LEADER',
          r.participantRollNumber || leader.rollNumber || '',
          r.participantName || leader.name || '',
          r.participantEmail || leader.email || '',
          phone || leader.phone || '',
          dept || leader.department || '',
          gender || leader.gender || '',
          yearOfStudy || leader.yearOfStudy || '',
          r.participantCollegeName || leader.collegeName || leader.institutionName || '',
          new Date(r.registeredAt).toISOString(),
          otherAnswersStr,
        ]);

        // Member rows
        for (const m of members) {
          rows.push([
            r.id,
            r.participantType || 'STUDENT',
            'TEAM',
            teamName,
            'MEMBER',
            m.rollNumber || '',
            m.name || '',
            m.email || '',
            m.phone || '',
            m.department || dept || '',
            m.gender || '',
            m.yearOfStudy || '',
            m.collegeName || m.institutionName || r.participantCollegeName || '',
            new Date(r.registeredAt).toISOString(),
            '',
          ]);
        }
      } else {
        const standardKeys = [
          'rollNumber', 'name', 'email', 'phone', 'department', 'gender', 'yearOfStudy',
          'collegeName', 'institutionName'
        ];
        const otherKeys = Object.keys(answers).filter((k) => !standardKeys.includes(k));
        const otherAnswersStr = otherKeys.length > 0
          ? otherKeys.map((k) => `${k}: ${answers[k]}`).join('; ')
          : '';

        rows.push([
          r.id,
          r.participantType || 'STUDENT',
          'INDIVIDUAL',
          '—',
          'INDIVIDUAL',
          r.participantRollNumber || '',
          r.participantName || '',
          r.participantEmail || '',
          phone,
          dept,
          gender,
          yearOfStudy,
          r.participantCollegeName || '',
          new Date(r.registeredAt).toISOString(),
          otherAnswersStr,
        ]);
      }
    }

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            const str = (cell === null || cell === undefined) ? '' : String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\r\n');

    const safeTitle = event.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `registrations_${safeTitle}_${eventId.slice(0, 8)}.csv`;

    return { csvContent, filename };
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
});
