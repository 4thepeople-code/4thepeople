const { withTenant } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { uploadBuffer, deleteAsset } = require('../utils/cloudinaryUpload');
const { clubDepartmentsSelect, serializeClub } = require('../utils/clubDepartments');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const validateUUID = (value, label) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label} (must be a valid UUID)`, 400);
  }
};

const requireFile = (file, fieldName) => {
  if (!file) throw new AppError(`An image file is required in the '${fieldName}' field`, 400);
};

const decodePublicId = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new AppError('Invalid Cloudinary public ID', 400);
  }
};

/**
 * Serializes an event row (or EventsWithStatus view row) into the canonical frontend format.
 */
const serializeEvent = (event, gallery = []) => {
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
    : [];

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
    status: event.status,
    coverImage,
    gallery: formattedGallery,
    registrationUrl: event.registrationUrl || null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
};

/**
 * POST /admin/clubs/:clubId/logo
 */
exports.uploadClubLogo = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  requireFile(req.file, 'logo');
  const { clubId } = req.params;
  validateUUID(clubId, 'club ID');

  // 1. Upload new image to Cloudinary first
  const uploadResult = await uploadBuffer(req.file.buffer, `clubs/${clubId}/logo`);

  // 2. Commit to database first (with compensation if DB write fails)
  let updatedClub;
  let oldLogoPublicId = null;
  try {
    const result = await withTenant(req.collegeId, async (tx) => {
      const club = await tx.club.findFirst({
        where: { id: clubId, collegeId: req.collegeId },
        select: { id: true, logoPublicId: true },
      });
      if (!club) throw new AppError('Club not found', 404);

      const updated = await tx.club.update({
        where: { id: clubId },
        data: {
          logoUrl: uploadResult.url,
          logoPublicId: uploadResult.publicId,
        },
        include: {
          departments: clubDepartmentsSelect,
        },
      });
      return { updated, oldLogo: club.logoPublicId };
    });
    updatedClub = result.updated;
    oldLogoPublicId = result.oldLogo;
  } catch (dbError) {
    try {
      await deleteAsset(uploadResult.publicId);
    } catch (cleanupErr) {
      console.error('Failed to compensate newly uploaded club logo after DB failure:', cleanupErr.message);
    }
    throw dbError;
  }

  // 3. Remote deletion AFTER successful DB commit (best-effort, logged)
  if (oldLogoPublicId) {
    try {
      await deleteAsset(oldLogoPublicId);
    } catch (e) {
      console.warn('Failed to delete old club logo asset:', e.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Club logo uploaded successfully',
    club: serializeClub(updatedClub),
  });
});

/**
 * DELETE /admin/clubs/:clubId/logo
 */
exports.deleteClubLogo = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  validateUUID(clubId, 'club ID');

  // 1. Commit database changes first
  const { updatedClub, oldLogoPublicId } = await withTenant(req.collegeId, async (tx) => {
    const club = await tx.club.findFirst({
      where: { id: clubId, collegeId: req.collegeId },
      select: { id: true, logoPublicId: true },
    });
    if (!club) throw new AppError('Club not found', 404);

    const updated = await tx.club.update({
      where: { id: clubId },
      data: {
        logoUrl: null,
        logoPublicId: null,
      },
      include: {
        departments: clubDepartmentsSelect,
      },
    });
    return { updatedClub: updated, oldLogoPublicId: club.logoPublicId };
  });

  // 2. Remote deletion AFTER successful DB commit (best-effort, logged)
  if (oldLogoPublicId) {
    try {
      await deleteAsset(oldLogoPublicId);
    } catch (e) {
      console.warn('Failed to delete club logo asset:', e.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Club logo deleted successfully',
    club: serializeClub(updatedClub),
  });
});

/**
 * POST /admin/clubs/:clubId/cover
 */
exports.uploadClubCover = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  requireFile(req.file, 'cover');
  const { clubId } = req.params;
  validateUUID(clubId, 'club ID');

  // 1. Upload new image to Cloudinary first
  const uploadResult = await uploadBuffer(req.file.buffer, `clubs/${clubId}/cover`);

  // 2. Commit to database first (with compensation if DB write fails)
  let updatedClub;
  let oldCoverPublicId = null;
  try {
    const result = await withTenant(req.collegeId, async (tx) => {
      const club = await tx.club.findFirst({
        where: { id: clubId, collegeId: req.collegeId },
        select: { id: true, coverImagePublicId: true },
      });
      if (!club) throw new AppError('Club not found', 404);

      const updated = await tx.club.update({
        where: { id: clubId },
        data: {
          coverImageUrl: uploadResult.url,
          coverImagePublicId: uploadResult.publicId,
        },
        include: {
          departments: clubDepartmentsSelect,
        },
      });
      return { updated, oldCover: club.coverImagePublicId };
    });
    updatedClub = result.updated;
    oldCoverPublicId = result.oldCover;
  } catch (dbError) {
    try {
      await deleteAsset(uploadResult.publicId);
    } catch (cleanupErr) {
      console.error('Failed to compensate newly uploaded club cover after DB failure:', cleanupErr.message);
    }
    throw dbError;
  }

  // 3. Remote deletion AFTER successful DB commit (best-effort, logged)
  if (oldCoverPublicId) {
    try {
      await deleteAsset(oldCoverPublicId);
    } catch (e) {
      console.warn('Failed to delete old club cover asset:', e.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Club cover uploaded successfully',
    club: serializeClub(updatedClub),
  });
});

/**
 * DELETE /admin/clubs/:clubId/cover
 */
exports.deleteClubCover = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { clubId } = req.params;
  validateUUID(clubId, 'club ID');

  // 1. Commit database changes first
  const { updatedClub, oldCoverPublicId } = await withTenant(req.collegeId, async (tx) => {
    const club = await tx.club.findFirst({
      where: { id: clubId, collegeId: req.collegeId },
      select: { id: true, coverImagePublicId: true },
    });
    if (!club) throw new AppError('Club not found', 404);

    const updated = await tx.club.update({
      where: { id: clubId },
      data: {
        coverImageUrl: null,
        coverImagePublicId: null,
      },
      include: {
        departments: clubDepartmentsSelect,
      },
    });
    return { updatedClub: updated, oldCoverPublicId: club.coverImagePublicId };
  });

  // 2. Remote deletion AFTER successful DB commit (best-effort, logged)
  if (oldCoverPublicId) {
    try {
      await deleteAsset(oldCoverPublicId);
    } catch (e) {
      console.warn('Failed to delete club cover asset:', e.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Club cover deleted successfully',
    club: serializeClub(updatedClub),
  });
});

/**
 * POST /admin/events/:eventId/cover
 */
exports.uploadEventCover = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  requireFile(req.file, 'cover');
  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  // 1. Upload new image to Cloudinary first
  const uploadResult = await uploadBuffer(req.file.buffer, `events/${eventId}/cover`);

  // 2. Commit to database first (with compensation if DB write fails)
  let eventView;
  let gallery;
  let oldCoverPublicId = null;
  try {
    const result = await withTenant(req.collegeId, async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, collegeId: req.collegeId },
        select: { id: true, coverImagePublicId: true },
      });
      if (!event) throw new AppError('Event not found', 404);

      await tx.event.update({
        where: { id: eventId },
        data: {
          coverImageUrl: uploadResult.url,
          coverImagePublicId: uploadResult.publicId,
        },
      });

      const viewRow = await tx.eventsWithStatus.findUnique({ where: { id: eventId } });
      const galleryRows = await tx.eventGalleryImage.findMany({
        where: { eventId, collegeId: req.collegeId },
        orderBy: { position: 'asc' },
      });
      return { eventView: viewRow, gallery: galleryRows, oldCover: event.coverImagePublicId };
    });
    eventView = result.eventView;
    gallery = result.gallery;
    oldCoverPublicId = result.oldCover;
  } catch (dbError) {
    try {
      await deleteAsset(uploadResult.publicId);
    } catch (cleanupErr) {
      console.error('Failed to compensate newly uploaded event cover after DB failure:', cleanupErr.message);
    }
    throw dbError;
  }

  // 3. Remote deletion AFTER successful DB commit (best-effort, logged)
  if (oldCoverPublicId) {
    try {
      await deleteAsset(oldCoverPublicId);
    } catch (e) {
      console.warn('Failed to delete old event cover asset:', e.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Event cover uploaded successfully',
    event: serializeEvent(eventView, gallery),
  });
});

/**
 * DELETE /admin/events/:eventId/cover
 */
exports.deleteEventCover = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  // 1. Commit database changes first
  const { eventView, gallery, oldCoverPublicId } = await withTenant(req.collegeId, async (tx) => {
    const event = await tx.event.findFirst({
      where: { id: eventId, collegeId: req.collegeId },
      select: { id: true, coverImagePublicId: true },
    });
    if (!event) throw new AppError('Event not found', 404);

    await tx.event.update({
      where: { id: eventId },
      data: {
        coverImageUrl: null,
        coverImagePublicId: null,
      },
    });

    const viewRow = await tx.eventsWithStatus.findUnique({ where: { id: eventId } });
    const galleryRows = await tx.eventGalleryImage.findMany({
      where: { eventId, collegeId: req.collegeId },
      orderBy: { position: 'asc' },
    });
    return { eventView: viewRow, gallery: galleryRows, oldCoverPublicId: event.coverImagePublicId };
  });

  // 2. Remote deletion AFTER successful DB commit (best-effort, logged)
  if (oldCoverPublicId) {
    try {
      await deleteAsset(oldCoverPublicId);
    } catch (e) {
      console.warn('Failed to delete event cover asset:', e.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Event cover deleted successfully',
    event: serializeEvent(eventView, gallery),
  });
});

/**
 * POST /admin/events/:eventId/gallery
 */
exports.uploadEventGallery = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  if (!req.files || !req.files.length) {
    throw new AppError("At least one image is required in the 'images' field", 400);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');

  // 1. Verify event exists and determine next position inside transaction
  const nextPosition = await withTenant(req.collegeId, async (tx) => {
    const event = await tx.event.findFirst({
      where: { id: eventId, collegeId: req.collegeId },
      select: { id: true },
    });
    if (!event) throw new AppError('Event not found', 404);

    const maxPos = await tx.eventGalleryImage.aggregate({
      where: { eventId, collegeId: req.collegeId },
      _max: { position: true },
    });
    return (maxPos._max.position ?? -1) + 1;
  });

  // 2. Upload images to Cloudinary OUTSIDE transaction
  const uploadedImages = await Promise.all(
    req.files.map((file) => uploadBuffer(file.buffer, `events/${eventId}/gallery`))
  );

  // 3. Insert gallery rows inside transaction (with compensation if DB fails)
  let eventView;
  let gallery;
  try {
    const result = await withTenant(req.collegeId, async (tx) => {
      for (let i = 0; i < uploadedImages.length; i++) {
        await tx.eventGalleryImage.create({
          data: {
            collegeId: req.collegeId,
            eventId,
            imageUrl: uploadedImages[i].url,
            imagePublicId: uploadedImages[i].publicId,
            position: nextPosition + i,
          },
        });
      }

      const viewRow = await tx.eventsWithStatus.findUnique({ where: { id: eventId } });
      const galleryRows = await tx.eventGalleryImage.findMany({
        where: { eventId, collegeId: req.collegeId },
        orderBy: { position: 'asc' },
      });
      return { eventView: viewRow, gallery: galleryRows };
    });
    eventView = result.eventView;
    gallery = result.gallery;
  } catch (dbError) {
    await Promise.allSettled(uploadedImages.map((img) => deleteAsset(img.publicId)));
    throw dbError;
  }

  res.status(200).json({
    success: true,
    message: 'Event gallery images uploaded successfully',
    event: serializeEvent(eventView, gallery),
  });
});

/**
 * DELETE /admin/events/:eventId/gallery/:publicId
 */
exports.deleteEventGalleryImage = asyncHandler(async (req, res) => {
  if (!req.collegeId) {
    throw new AppError('Tenant context required: request must be routed through a college subdomain', 400);
  }

  const { eventId } = req.params;
  validateUUID(eventId, 'event ID');
  const publicId = decodePublicId(req.params.publicId);

  // 1. Commit DB deletion first
  const { eventView, gallery } = await withTenant(req.collegeId, async (tx) => {
    const row = await tx.eventGalleryImage.findFirst({
      where: {
        eventId,
        collegeId: req.collegeId,
        imagePublicId: publicId,
      },
    });
    if (!row) throw new AppError('Gallery image not found', 404);

    await tx.eventGalleryImage.delete({
      where: { id: row.id },
    });

    const viewRow = await tx.eventsWithStatus.findUnique({ where: { id: eventId } });
    const galleryRows = await tx.eventGalleryImage.findMany({
      where: { eventId, collegeId: req.collegeId },
      orderBy: { position: 'asc' },
    });
    return { eventView: viewRow, gallery: galleryRows };
  });

  // 2. Remote deletion AFTER successful DB commit (best-effort, logged)
  try {
    await deleteAsset(publicId);
  } catch (e) {
    console.warn('Failed to delete gallery image asset:', e.message);
  }

  res.status(200).json({
    success: true,
    message: 'Event gallery image deleted successfully',
    event: serializeEvent(eventView, gallery),
  });
});
