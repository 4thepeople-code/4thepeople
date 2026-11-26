const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { deleteAssetsBestEffort } = require('../utils/cloudinaryUpload');
const { defaultPaymentConfigService } = require('../services/payment/paymentConfigService');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const eventStatuses = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];

const validateUUID = (value, label) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label} (must be a valid UUID)`, 400);
  }
};

const requiredText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${label} is required and cannot be empty`, 400);
  }
  return value.trim();
};

const validDate = (value, label) => {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new AppError(`${label} must be a valid date`, 400);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`${label} must be a valid date`, 400);
  return date;
};

const validDateRange = (startAt, endAt) => {
  if (endAt <= startAt) throw new AppError('endAt must be after startAt', 400);
};

const ensureClubExists = async (tx, tenantId, clubId) => {
  validateUUID(clubId, 'club ID');
  const club = await tx.club.findFirst({
    where: { id: clubId, collegeId: tenantId },
    select: { id: true, name: true, description: true },
  });
  if (!club) throw new AppError('Club not found', 404);
  return club;
};

/**
 * Serializes an event row (or EventsWithStatus view row) into the canonical frontend format.
 * Formats coverImage and gallery as { url, publicId } objects and exposes computed status.
 */
const serializeEvent = (event, gallery = null) => {
  if (!event) return null;

  const coverImage = (event.coverImageUrl || event.coverImagePublicId)
    ? { url: event.coverImageUrl || null, publicId: event.coverImagePublicId || null }
    : (event.coverImage || null);

  const formattedGallery = Array.isArray(gallery)
    ? gallery.map((img) => ({
        id: img.id,
        url: img.imageUrl || img.url,
        publicId: img.imagePublicId || img.publicId,
        position: img.position || 0,
      }))
    : (Array.isArray(event.gallery)
        ? event.gallery.map((img) => ({
            id: img.id,
            url: img.imageUrl || img.url,
            publicId: img.imagePublicId || img.publicId,
            position: img.position || 0,
          }))
        : []);

  const isPaid = Boolean(event.isPaid ?? event.is_paid ?? false);
  const fee = isPaid ? (Number(event.fee) || 0) : 0;
  const currency = event.currency || 'INR';

  return {
    id: event.id,
    collegeId: event.collegeId || null,
    clubId: event.clubId,
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt || null,
    cancelledAt: event.cancelledAt || null,
    capacity: event.capacity ?? null,
    registeredCount: event.registeredCount ?? 0,
    status: event.status, // Computed from events_with_status view
    visibility: event.visibility || 'COLLEGE',
    isPaid,
    fee,
    currency,
    coverImage,
    gallery: formattedGallery,
    registrationUrl: event.registrationUrl || null,
    registrationMode: event.registrationMode || 'INTERNAL',
    customFormDefinition: event.customFormDefinition || null,
    registrationDeadline: event.registrationDeadline || null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    ...(event.club ? { club: { id: event.club.id, name: event.club.name, description: event.club.description } } : {}),
  };
};

/**
 * POST /manager/clubs/:clubId/events
 * Creates an event for the specified club.
 */
exports.createEvent = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  validateUUID(clubId, 'club ID');

  const body = req.body;
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw new AppError('Event data must be an object', 400);
  }

  const startAt = validDate(body.startAt, 'startAt');
  const endAt = body.endAt == null ? null : validDate(body.endAt, 'endAt');
  if (endAt) validDateRange(startAt, endAt);

  let capacity = null;
  if (body.capacity !== undefined && body.capacity !== null) {
    if (typeof body.capacity !== 'number' || !Number.isInteger(body.capacity) || body.capacity <= 0) {
      throw new AppError('capacity must be a positive integer or null', 400);
    }
    capacity = body.capacity;
  }

  let visibility = 'COLLEGE';
  if (body.visibility !== undefined && body.visibility !== null) {
    if (!['COLLEGE', 'PUBLIC'].includes(body.visibility)) {
      throw new AppError('visibility must be COLLEGE or PUBLIC', 400);
    }
    visibility = body.visibility;
  }

  const isPaid = Boolean(body.isPaid ?? body.is_paid ?? false);
  let fee = 0;
  if (isPaid) {
    if (typeof body.fee !== 'number' || !Number.isInteger(body.fee) || body.fee <= 0) {
      throw new AppError('Paid events must specify a positive integer fee', 400);
    }
    fee = body.fee;

    // Verify college payment gateway readiness
    const config = await defaultPaymentConfigService.getConfig(req.collegeId);
    if (!config.configured || config.status !== 'ACTIVE' || !config.hasKeyId || !config.hasKeySecret) {
      throw new AppError('Cannot create a paid event: payment gateway is not active or configured for this college', 400);
    }
  }
  const currency = (body.currency ? String(body.currency).trim().toUpperCase() : 'INR') || 'INR';

  const eventWithStatus = await withTenant(req.collegeId, async (tx) => {
    await ensureClubExists(tx, req.collegeId, clubId);

    const created = await tx.event.create({
      data: {
        collegeId: req.collegeId,
        clubId,
        title: requiredText(body.title, 'title'),
        description: requiredText(body.description, 'description'),
        location: requiredText(body.location, 'location'),
        startAt,
        endAt,
        capacity,
        visibility,
        isPaid,
        fee,
        currency,
        registrationUrl: body.registrationUrl ? body.registrationUrl.trim() : null,
        registrationMode: ['INTERNAL', 'EXTERNAL', 'NONE'].includes(body.registrationMode)
          ? body.registrationMode
          : (body.registrationUrl ? 'EXTERNAL' : 'INTERNAL'),
        customFormDefinition: body.customFormDefinition || null,
        registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : null,
      },
    });

    // Read computed status from events_with_status view
    return await tx.eventsWithStatus.findUnique({
      where: { id: created.id },
    });
  });

  res.status(201).json({
    success: true,
    message: 'Event created successfully',
    event: serializeEvent(eventWithStatus),
  });
});

/**
 * PATCH /manager/clubs/:clubId/events/:eventId
 * Updates an event for the specified club.
 */
exports.updateEvent = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId, eventId } = req.params;
  validateUUID(clubId, 'club ID');
  validateUUID(eventId, 'event ID');

  const body = req.body;
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw new AppError('Update data must be an object', 400);
  }

  const allowedFields = [
    'title', 'description', 'location', 'startAt', 'endAt', 'status',
    'registrationUrl', 'capacity', 'registrationMode', 'customFormDefinition',
    'registrationDeadline', 'visibility', 'isPaid', 'is_paid', 'fee', 'currency'
  ];
  const fields = Object.keys(body);
  if (!fields.length) throw new AppError('At least one event field is required', 400);
  const unexpected = fields.find((field) => !allowedFields.includes(field));
  if (unexpected) throw new AppError(`Field '${unexpected}' cannot be updated`, 400);

  const data = {};
  ['title', 'description', 'location'].forEach((field) => {
    if (body[field] !== undefined) data[field] = requiredText(body[field], field);
  });
  if (body.visibility !== undefined) {
    if (!['COLLEGE', 'PUBLIC'].includes(body.visibility)) {
      throw new AppError('visibility must be COLLEGE or PUBLIC', 400);
    }
    data.visibility = body.visibility;
  }
  if (body.registrationUrl !== undefined) {
    data.registrationUrl = body.registrationUrl ? body.registrationUrl.trim() : null;
  }
  if (body.registrationMode !== undefined) {
    if (!['INTERNAL', 'EXTERNAL', 'NONE'].includes(body.registrationMode)) {
      throw new AppError('registrationMode must be INTERNAL, EXTERNAL, or NONE', 400);
    }
    data.registrationMode = body.registrationMode;
  }
  if (body.customFormDefinition !== undefined) {
    data.customFormDefinition = body.customFormDefinition;
  }
  if (body.registrationDeadline !== undefined) {
    data.registrationDeadline = body.registrationDeadline ? new Date(body.registrationDeadline) : null;
  }

  let targetIsPaid = undefined;
  if (body.isPaid !== undefined || body.is_paid !== undefined) {
    targetIsPaid = Boolean(body.isPaid ?? body.is_paid);
    data.isPaid = targetIsPaid;
    if (!targetIsPaid) {
      // Free events cannot accidentally retain stale paid-event fees
      data.fee = 0;
    }
  }

  if (body.fee !== undefined) {
    if (typeof body.fee !== 'number' || !Number.isInteger(body.fee) || body.fee < 0) {
      throw new AppError('fee must be a non-negative integer', 400);
    }
    if (targetIsPaid === false) {
      data.fee = 0;
    } else {
      data.fee = body.fee;
    }
  }

  if (body.currency !== undefined) {
    data.currency = (body.currency ? String(body.currency).trim().toUpperCase() : 'INR') || 'INR';
  }

  if (body.capacity !== undefined) {
    if (body.capacity !== null && (typeof body.capacity !== 'number' || !Number.isInteger(body.capacity) || body.capacity <= 0)) {
      throw new AppError('capacity must be a positive integer or null', 400);
    }
    data.capacity = body.capacity;
  }

  // Handle status update: if client cancels, set cancelledAt
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !eventStatuses.includes(body.status)) {
      throw new AppError(`status must be one of: ${eventStatuses.join(', ')}`, 400);
    }
    if (body.status === 'CANCELLED') {
      data.cancelledAt = new Date();
    }
    // Never write directly to an events.status column
  }

  const eventWithStatus = await withTenant(req.collegeId, async (tx) => {
    const existing = await tx.event.findFirst({
      where: { id: eventId, clubId, collegeId: req.collegeId },
    });
    if (!existing) throw new AppError('Event not found', 404);

    if (data.capacity !== undefined && data.capacity !== null && data.capacity < existing.registeredCount) {
      throw new AppError(`Capacity cannot be reduced below current registered count (${existing.registeredCount})`, 400);
    }

    const startAt = body.startAt === undefined ? existing.startAt : validDate(body.startAt, 'startAt');
    const endAt = body.endAt === undefined
      ? existing.endAt
      : body.endAt === null
        ? null
        : validDate(body.endAt, 'endAt');
    if (body.startAt !== undefined || body.endAt !== undefined) {
      if (endAt) validDateRange(startAt, endAt);
      data.startAt = startAt;
      data.endAt = endAt;
    }

    const willBePaid = data.isPaid !== undefined ? data.isPaid : existing.isPaid;
    if (willBePaid) {
      const effectiveFee = data.fee !== undefined ? data.fee : existing.fee;
      if (effectiveFee <= 0) {
        throw new AppError('Paid events must specify a positive integer fee', 400);
      }
      if (data.isPaid === true || (existing.isPaid && data.fee !== undefined)) {
        const config = await defaultPaymentConfigService.getConfig(req.collegeId);
        if (!config.configured || config.status !== 'ACTIVE' || !config.hasKeyId || !config.hasKeySecret) {
          throw new AppError('Cannot configure a paid event: payment gateway is not active or configured for this college', 400);
        }
      }
    }

    try {
      await tx.event.update({
        where: { id: eventId },
        data,
      });
    } catch (updateErr) {
      if (updateErr.message && (updateErr.message.includes('chk_events_capacity_limit') || updateErr.message.includes('check_violation'))) {
        throw new AppError(`Capacity cannot be reduced below current registered count (${existing.registeredCount})`, 400);
      }
      throw updateErr;
    }

    const gallery = await tx.eventGalleryImage.findMany({
      where: { eventId, collegeId: req.collegeId },
      orderBy: { position: 'asc' },
    });

    const viewRow = await tx.eventsWithStatus.findUnique({
      where: { id: eventId },
    });

    return { viewRow, gallery };
  });

  res.status(200).json({
    success: true,
    message: 'Event updated successfully',
    event: serializeEvent(eventWithStatus.viewRow, eventWithStatus.gallery),
  });
});

/**
 * PATCH /manager/clubs/:clubId/events/:eventId/cancel
 * Cancels an event by setting cancelledAt.
 */
exports.cancelEvent = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId, eventId } = req.params;
  validateUUID(clubId, 'club ID');
  validateUUID(eventId, 'event ID');

  const eventWithStatus = await withTenant(req.collegeId, async (tx) => {
    const existing = await tx.event.findFirst({
      where: { id: eventId, clubId, collegeId: req.collegeId },
    });
    if (!existing) throw new AppError('Event not found', 404);

    await tx.event.update({
      where: { id: eventId },
      data: { cancelledAt: new Date() },
    });

    const viewRow = await tx.eventsWithStatus.findUnique({
      where: { id: eventId },
    });

    const gallery = await tx.eventGalleryImage.findMany({
      where: { eventId, collegeId: req.collegeId },
      orderBy: { position: 'asc' },
    });

    return { viewRow, gallery };
  });

  res.status(200).json({
    success: true,
    message: 'Event cancelled successfully',
    event: serializeEvent(eventWithStatus.viewRow, eventWithStatus.gallery),
  });
});

/**
 * GET /manager/clubs/:clubId/events
 * Lists all events for a managed club.
 */
exports.listManagedClubEvents = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  validateUUID(clubId, 'club ID');

  const events = await withTenant(req.collegeId, async (tx) => {
    await ensureClubExists(tx, req.collegeId, clubId);

    return await tx.eventsWithStatus.findMany({
      where: { clubId, collegeId: req.collegeId },
      orderBy: { startAt: 'desc' },
    });
  });

  res.status(200).json({
    success: true,
    events: events.map((e) => serializeEvent(e)),
  });
});

/**
 * DELETE /admin/events/:eventId
 * Deletes an event and its assets.
 */
exports.deleteEvent = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  // 1. Fetch, validate past-event rule matching events_with_status, collect assets, and delete event inside transaction
  const { deletedEvent, assetPublicIds } = await withTenant(req.collegeId, async (tx) => {
    const event = await tx.event.findFirst({
      where: { id: eventId, collegeId: req.collegeId },
      include: {
        gallery: {
          select: { imagePublicId: true },
        },
      },
    });
    if (!event) throw new AppError('Event not found', 404);

    // Safeguard 1: Financial records protection (Payment Transactions)
    // Physical deletion of events with payment ledger records is blocked to prevent orphaned financial audit trails.
    const paymentCount = await tx.paymentTransaction.count({
      where: { eventId, collegeId: req.collegeId },
    });
    if (paymentCount > 0) {
      throw new AppError(
        `Cannot delete event: ${paymentCount} payment transaction(s) are recorded for this event. Events with financial records cannot be deleted; cancel the event instead.`,
        400
      );
    }

    // Safeguard 2: Student credential protection (Issued Certificates)
    // Physical deletion is blocked if certificates have been issued to students.
    const certificateCount = await tx.eventCertificate.count({
      where: { eventId, collegeId: req.collegeId },
    });
    if (certificateCount > 0) {
      throw new AppError(
        `Cannot delete event: ${certificateCount} certificate(s) have been issued for this event. Revoke them first or cancel the event instead.`,
        400
      );
    }

    const publicIds = [];
    if (event.coverImagePublicId) publicIds.push(event.coverImagePublicId);
    if (Array.isArray(event.gallery)) {
      event.gallery.forEach((img) => {
        if (img.imagePublicId) publicIds.push(img.imagePublicId);
      });
    }

    await tx.eventGalleryImage.deleteMany({
      where: { eventId, collegeId: req.collegeId },
    });

    const deleted = await tx.event.delete({
      where: { id: eventId },
    });

    return { deletedEvent: deleted, assetPublicIds: publicIds };
  });

  // 2. Perform Cloudinary asset deletions AFTER database commit (best-effort, logged)
  if (assetPublicIds.length > 0) {
    await deleteAssetsBestEffort(assetPublicIds, `event ${eventId}`);
  }

  res.status(200).json({
    success: true,
    message: 'Event deleted successfully',
    data: serializeEvent(deletedEvent),
  });
});

/**
 * GET /clubs/:clubId/events/upcoming
 * Public endpoint to list upcoming and ongoing events for a club.
 */
exports.listUpcomingEvents = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;

  const events = await withTenant(req.collegeId, async (tx) => {
    await ensureClubExists(tx, req.collegeId, clubId);

    return await tx.eventsWithStatus.findMany({
      where: {
        clubId,
        collegeId: req.collegeId,
        status: { in: ['UPCOMING', 'ONGOING'] },
      },
      orderBy: { startAt: 'asc' },
    });
  });

  res.status(200).json({
    success: true,
    events: events.map((e) => serializeEvent(e)),
  });
});

/**
 * GET /clubs/:clubId/events/past
 * Public endpoint to list completed events for a club.
 */
exports.listPastEvents = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;

  const events = await withTenant(req.collegeId, async (tx) => {
    await ensureClubExists(tx, req.collegeId, clubId);

    return await tx.eventsWithStatus.findMany({
      where: {
        clubId,
        collegeId: req.collegeId,
        status: 'COMPLETED',
      },
      orderBy: { startAt: 'desc' },
    });
  });

  res.status(200).json({
    success: true,
    events: events.map((e) => serializeEvent(e)),
  });
});

/**
 * GET /events
 * Platform-wide public event discovery endpoint.
 * Allows unauthenticated visitors to discover eligible public events across active colleges.
 */
exports.discoverPublicEvents = asyncHandler(async (req, res) => {
  const {
    search,
    collegeId,
    collegeSlug,
    startDate,
    endDate,
    isPaid,
    location,
    registrationMode,
    page = 1,
    limit = 12,
  } = req.query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const skip = (parsedPage - 1) * parsedLimit;

  // Use tenant if request came through college subdomain, or allow public-read
  const targetCollegeId = req.collegeId || (collegeId && UUID_REGEX.test(collegeId) ? collegeId : null);

  const result = await withTenant(targetCollegeId, async (tx) => {
    // If collegeSlug was supplied, resolve college ID
    let filterCollegeId = targetCollegeId;
    if (!filterCollegeId && collegeSlug && typeof collegeSlug === 'string') {
      const col = await tx.college.findFirst({
        where: { slug: collegeSlug.toLowerCase().trim(), isActive: true },
        select: { id: true },
      });
      if (col) {
        filterCollegeId = col.id;
      } else {
        // Unknown college slug -> return empty result
        return { events: [], total: 0, clubs: [], colleges: [] };
      }
    }

    // Build deterministic filter criteria for public discovery
    const where = {
      visibility: 'PUBLIC',
      cancelledAt: null,
      status: { in: ['UPCOMING', 'ONGOING'] },
      registrationMode: { in: ['INTERNAL', 'EXTERNAL'] },
    };

    if (filterCollegeId) {
      where.collegeId = filterCollegeId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      where.title = { contains: search.trim(), mode: 'insensitive' };
    }

    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!Number.isNaN(parsedStart.getTime())) {
        where.startAt = { ...(where.startAt || {}), gte: parsedStart };
      }
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!Number.isNaN(parsedEnd.getTime())) {
        where.startAt = { ...(where.startAt || {}), lte: parsedEnd };
      }
    }

    if (isPaid !== undefined && isPaid !== '') {
      where.isPaid = isPaid === 'true' || isPaid === true;
    }

    if (location && typeof location === 'string' && location.trim()) {
      where.location = { contains: location.trim(), mode: 'insensitive' };
    }

    if (registrationMode && typeof registrationMode === 'string') {
      const mode = registrationMode.toUpperCase().trim();
      if (mode === 'INTERNAL' || mode === 'EXTERNAL') {
        where.registrationMode = mode;
      }
    }

    const [eventsList, total] = await Promise.all([
      tx.eventsWithStatus.findMany({
        where,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        skip,
        take: parsedLimit,
      }),
      tx.eventsWithStatus.count({ where }),
    ]);

    const clubIds = [...new Set(eventsList.map((e) => e.clubId))];
    const collegeIds = [...new Set(eventsList.map((e) => e.collegeId))];

    const [clubs, colleges] = await Promise.all([
      clubIds.length > 0
        ? tx.club.findMany({
            where: { id: { in: clubIds } },
            select: {
              id: true,
              name: true,
              description: true,
              clubType: true,
              logoUrl: true,
              coverImageUrl: true,
            },
          })
        : [],
      collegeIds.length > 0
        ? tx.college.findMany({
            where: { id: { in: collegeIds }, isActive: true },
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
              state: true,
            },
          })
        : [],
    ]);

    return { events: eventsList, total, clubs, colleges };
  }, { isPublic: true });

  const clubMap = new Map(result.clubs.map((c) => [c.id, c]));
  const collegeMap = new Map(result.colleges.map((c) => [c.id, c]));

  // Safe field serialization: do not expose private or internal tenant records
  const formattedEvents = result.events.map((e) => {
    const club = clubMap.get(e.clubId) || null;
    const college = collegeMap.get(e.collegeId) || null;

    const coverImage = (e.coverImageUrl || e.coverImagePublicId)
      ? { url: e.coverImageUrl || null, publicId: e.coverImagePublicId || null }
      : null;

    return {
      id: e.id,
      collegeId: e.collegeId,
      clubId: e.clubId,
      title: e.title,
      description: e.description,
      location: e.location,
      startAt: e.startAt,
      endAt: e.endAt || null,
      capacity: e.capacity ?? null,
      registeredCount: e.registeredCount ?? 0,
      status: e.status,
      coverImage,
      registrationUrl: e.registrationUrl || null,
      registrationMode: e.registrationMode,
      registrationDeadline: e.registrationDeadline || null,
      visibility: e.visibility,
      isPaid: e.isPaid,
      fee: e.fee,
      currency: e.currency,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      club: club ? {
        id: club.id,
        name: club.name,
        description: club.description,
        clubType: club.clubType,
        logoUrl: club.logoUrl,
        coverImageUrl: club.coverImageUrl,
      } : null,
      college: college ? {
        id: college.id,
        name: college.name,
        slug: college.slug,
        city: college.city,
        state: college.state,
      } : null,
    };
  });

  res.status(200).json({
    success: true,
    events: formattedEvents,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: result.total,
      totalPages: Math.ceil(result.total / parsedLimit) || 1,
    },
  });
});

/**
 * GET /events/:eventId
 * Public endpoint to fetch details of a specific publicly discoverable event.
 */
exports.getPublicEventById = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  const result = await withTenant(req.collegeId || null, async (tx) => {
    const event = await tx.eventsWithStatus.findFirst({
      where: {
        id: eventId,
        ...(req.collegeId ? { collegeId: req.collegeId } : { visibility: 'PUBLIC', cancelledAt: null }),
      },
    });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const [club, college, gallery] = await Promise.all([
      tx.club.findFirst({
        where: { id: event.clubId },
        select: {
          id: true,
          name: true,
          description: true,
          clubType: true,
          logoUrl: true,
          coverImageUrl: true,
        },
      }),
      tx.college.findFirst({
        where: { id: event.collegeId, isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          state: true,
        },
      }),
      tx.eventGalleryImage.findMany({
        where: { eventId, collegeId: event.collegeId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          imageUrl: true,
          imagePublicId: true,
          position: true,
        },
      }),
    ]);

    return {
      event: serializeEvent(event, gallery),
      club,
      college,
    };
  }, { isPublic: true });

  res.status(200).json({
    success: true,
    event: {
      ...result.event,
      club: result.club,
      college: result.college,
    },
    club: result.club,
    college: result.college,
  });
});

/**
 * GET /events/upcoming
 * Public endpoint to list all upcoming and ongoing events for the current college,
 * or across active colleges if accessed from the public platform root.
 */
exports.listAllUpcomingEvents = asyncHandler(async (req, res) => {
  const events = await withTenant(req.collegeId || null, async (tx) => {
    const where = {
      status: { in: ['UPCOMING', 'ONGOING'] },
      ...(req.collegeId
        ? { collegeId: req.collegeId }
        : { visibility: 'PUBLIC', cancelledAt: null, registrationMode: { in: ['INTERNAL', 'EXTERNAL'] } }),
    };

    const list = await tx.eventsWithStatus.findMany({
      where,
      orderBy: { startAt: 'asc' },
    });

    const clubIds = [...new Set(list.map((e) => e.clubId))];
    const collegeIds = [...new Set(list.map((e) => e.collegeId))];

    const [clubs, colleges] = await Promise.all([
      clubIds.length > 0
        ? tx.club.findMany({
            where: { id: { in: clubIds } },
            select: { id: true, name: true, description: true, clubType: true, logoUrl: true, coverImageUrl: true },
          })
        : [],
      collegeIds.length > 0
        ? tx.college.findMany({
            where: { id: { in: collegeIds }, isActive: true },
            select: { id: true, name: true, slug: true, city: true, state: true },
          })
        : [],
    ]);

    const clubMap = new Map(clubs.map((c) => [c.id, c]));
    const collegeMap = new Map(colleges.map((c) => [c.id, c]));

    return list.map((e) => {
      const club = clubMap.get(e.clubId);
      const college = collegeMap.get(e.collegeId);
      return {
        ...serializeEvent({ ...e, club }),
        college: college ? { id: college.id, name: college.name, slug: college.slug, city: college.city, state: college.state } : null,
      };
    });
  }, { isPublic: true });

  res.status(200).json({ success: true, events });
});

/**
 * GET /clubs/:clubId/events/:eventId
 * Public endpoint to get details of a specific event.
 */
exports.getPublicEvent = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId, eventId } = req.params;
  validateUUID(clubId, 'club ID');
  validateUUID(eventId, 'event ID');

  const result = await withTenant(req.collegeId, async (tx) => {
    const club = await ensureClubExists(tx, req.collegeId, clubId);

    const event = await tx.eventsWithStatus.findFirst({
      where: { id: eventId, clubId, collegeId: req.collegeId },
    });
    if (!event) throw new AppError('Event not found', 404);

    const gallery = await tx.eventGalleryImage.findMany({
      where: { eventId, collegeId: req.collegeId },
      orderBy: { position: 'asc' },
    });

    return {
      event: serializeEvent(event, gallery),
      club: { id: club.id, name: club.name, description: club.description },
    };
  });

  res.status(200).json({
    success: true,
    event: result.event,
    club: result.club,
  });
});
