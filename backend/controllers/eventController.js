const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { deleteAssetsBestEffort } = require('../utils/cloudinaryUpload');

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

  return {
    id: event.id,
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
    coverImage,
    gallery: formattedGallery,
    registrationUrl: event.registrationUrl || null,
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
        registrationUrl: body.registrationUrl ? body.registrationUrl.trim() : null,
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

  const allowedFields = ['title', 'description', 'location', 'startAt', 'endAt', 'status', 'registrationUrl', 'capacity'];
  const fields = Object.keys(body);
  if (!fields.length) throw new AppError('At least one event field is required', 400);
  const unexpected = fields.find((field) => !allowedFields.includes(field));
  if (unexpected) throw new AppError(`Field '${unexpected}' cannot be updated`, 400);

  const data = {};
  ['title', 'description', 'location'].forEach((field) => {
    if (body[field] !== undefined) data[field] = requiredText(body[field], field);
  });
  if (body.registrationUrl !== undefined) {
    data.registrationUrl = body.registrationUrl ? body.registrationUrl.trim() : null;
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

    // Enforce past-event safeguard matching events_with_status view:
    // If endAt is present: completed if now >= endAt
    // If endAt is NULL: completed if startAt < (now - 24 hours) (24-hour fallback)
    const now = new Date();
    const isCompleted = event.endAt
      ? new Date(event.endAt) <= now
      : (new Date(event.startAt).getTime() + 24 * 60 * 60 * 1000) <= now.getTime();

    if (isCompleted) {
      throw new AppError('Cannot delete past events. Event has already occurred or completed.', 400);
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
 * GET /events/upcoming
 * Public endpoint to list all upcoming and ongoing events for the current college.
 */
exports.listAllUpcomingEvents = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const events = await withTenant(req.collegeId, async (tx) => {
    const list = await tx.eventsWithStatus.findMany({
      where: {
        collegeId: req.collegeId,
        status: { in: ['UPCOMING', 'ONGOING'] },
      },
      orderBy: { startAt: 'asc' },
    });

    const clubIds = [...new Set(list.map((e) => e.clubId))];
    const clubs = await tx.club.findMany({
      where: { id: { in: clubIds }, collegeId: req.collegeId },
      select: { id: true, name: true, description: true },
    });
    const clubMap = new Map(clubs.map((c) => [c.id, c]));

    return list.map((e) => {
      const club = clubMap.get(e.clubId);
      return serializeEvent({ ...e, club });
    });
  });

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
