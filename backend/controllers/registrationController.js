const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const validateUUID = (value, label) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label} (must be a valid UUID)`, 400);
  }
};

/**
 * POST /events/:eventId/register
 * Registers the authenticated user for an upcoming/ongoing event.
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
        select: { status: true },
      }),
      tx.event.findFirst({
        where: { id: eventId, collegeId: req.collegeId },
        select: {
          id: true,
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

    if (eventStatusRow.status === 'CANCELLED') {
      throw new AppError('Cannot register for a cancelled event', 400);
    }
    if (eventStatusRow.status === 'COMPLETED') {
      throw new AppError('Cannot register for a past event', 400);
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
    if (event.customFormDefinition && Array.isArray(event.customFormDefinition.fields)) {
      const answers = body.formAnswers || body.answers || {};
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
      validatedAnswers = body.formAnswers || body.answers;
    }

    // 3. Check if user is already registered before trying to insert
    const existing = await tx.eventRegistration.findFirst({
      where: { eventId, userId: req.user.id, collegeId: req.collegeId },
    });
    if (existing) {
      throw new AppError('You are already registered for this event', 409);
    }

    // 4. Atomically insert registration. PostgreSQL trigger handle_registration_insert
    // row-locks the events table row FOR UPDATE, enforces capacity, and increments registered_count.
    try {
      return await tx.eventRegistration.create({
        data: {
          collegeId: req.collegeId,
          eventId,
          userId: req.user.id,
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
    // Check event exists under tenant
    const event = await tx.event.findFirst({
      where: { id: eventId, collegeId: req.collegeId },
    });
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const existing = await tx.eventRegistration.findFirst({
      where: { eventId, userId: req.user.id, collegeId: req.collegeId },
    });
    if (!existing) {
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
    });
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const registration = await tx.eventRegistration.findFirst({
      where: { eventId, userId: req.user.id, collegeId: req.collegeId },
    });

    return {
      isRegistered: Boolean(registration),
      registration: registration
        ? {
            id: registration.id,
            eventId: registration.eventId,
            userId: registration.userId,
            registeredAt: registration.registeredAt,
          }
        : null,
    };
  });

  res.status(200).json({
    success: true,
    isRegistered: status.isRegistered,
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
    const list = await tx.eventRegistration.findMany({
      where: { userId: req.user.id, collegeId: req.collegeId },
      orderBy: { registeredAt: 'desc' },
      include: {
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

    const [total, registrations] = await Promise.all([
      tx.eventRegistration.count({
        where: { eventId, collegeId: req.collegeId },
      }),
      tx.eventRegistration.findMany({
        where: { eventId, collegeId: req.collegeId },
        orderBy: { registeredAt: 'asc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
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
        user: r.user,
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

    // 3. Fetch all registrations with user and department info
    const registrations = await tx.eventRegistration.findMany({
      where: { eventId, collegeId: req.collegeId },
      orderBy: { registeredAt: 'asc' },
      include: {
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

    // 4. Build CSV
    const rows = [
      ['Registration ID', 'Roll Number', 'Student Name', 'Student Email', 'Department', 'Registered At', 'Form Answers']
    ];

    for (const r of registrations) {
      const answersStr = r.formAnswers ? JSON.stringify(r.formAnswers) : '';
      rows.push([
        r.id,
        r.user ? (r.user.rollNumber || '') : '',
        r.user ? r.user.name : '',
        r.user ? r.user.email : '',
        r.user && r.user.department ? (r.user.department.shortCode || r.user.department.name) : '',
        new Date(r.registeredAt).toISOString(),
        answersStr,
      ]);
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
