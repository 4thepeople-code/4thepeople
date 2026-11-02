const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid MongoDB ObjectId');
const email = z.string().trim().toLowerCase().email('Invalid email address').max(254);
const password = z.string().min(6, 'Password must be at least 6 characters').max(128);
const name = z.string().trim().min(1, 'Name is required').max(100);
const clubName = z.string().trim().min(1, 'Club name is required').max(150);
const description = z.string().trim().max(5000);
const departmentName = z.string().trim().min(1, 'Department name is required').max(150);
const departmentShortCode = z.string().trim().min(1, 'Department short code is required').max(30).transform((value) => value.toUpperCase());
const text = (label, max) => z.string().trim().min(1, `${label} is required`).max(max);
const inviteToken = z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid invitation token');

const idParams = (key) => z.object({ [key]: objectId });
const clubParams = idParams('clubId');
const departmentParams = idParams('departmentId');
const eventParams = idParams('eventId');
const clubEventParams = z.object({ clubId: objectId, eventId: objectId });

const loginBody = z.object({ email, password });
const forgotPasswordBody = z.object({ email });
const resetPasswordBody = z.object({ email, otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'), password });
const deletionVerificationBody = z.object({ code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits') });
const adminRegisterBody = z.object({ name, email, password });
const managerInviteBody = z.object({ name, email });
const createClubBody = z.object({ name: clubName, description: description.optional(), isCentral: z.boolean().optional() });
const updateClubBody = z.object({
  name: clubName.optional(),
  description: description.nullable().optional(),
  isCentral: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one club field is required');
const createDepartmentBody = z.object({
  name: departmentName,
  shortCode: departmentShortCode,
  description: description.optional(),
});
const updateDepartmentBody = z.object({
  name: departmentName.optional(),
  shortCode: departmentShortCode.optional(),
  description: description.nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one department field is required');
const clubIdsBody = z.object({
  clubIds: z.array(objectId).transform((ids) => [...new Set(ids)]),
});
const departmentIdsBody = z.object({
  departmentIds: z.array(objectId).transform((ids) => [...new Set(ids)]),
});
const membershipBody = z.object({ role: z.enum(['MANAGER', 'MEMBER', 'USER']) });
const existingManagerBody = z.object({ userId: objectId });
const acceptInviteBody = z.object({ password });
const createEventBody = z.object({
  title: text('title', 200),
  description: text('description', 5000),
  location: text('location', 255),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  registrationUrl: z.string().trim().nullable().optional(),
}).refine((value) => !value.endAt || value.endAt > value.startAt, {
  message: 'endAt must be after startAt', path: ['endAt'],
});
const updateEventBody = z.object({
  title: text('title', 200).optional(),
  description: text('description', 5000).optional(),
  location: text('location', 255).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullable().optional(),
  status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
  registrationUrl: z.string().trim().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one event field is required');

module.exports = {
  objectId, inviteToken, idParams, clubParams, departmentParams, eventParams, clubEventParams,
  loginBody, forgotPasswordBody, resetPasswordBody, deletionVerificationBody, adminRegisterBody, managerInviteBody,
  createClubBody, updateClubBody, createDepartmentBody, updateDepartmentBody, clubIdsBody, departmentIdsBody,
  membershipBody, existingManagerBody, acceptInviteBody, createEventBody, updateEventBody,
  publicIdParams: z.object({ eventId: objectId, publicId: z.string().min(1).max(500) }),
};
