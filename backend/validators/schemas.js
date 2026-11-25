const { z } = require('zod');

const uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Invalid UUID');
const email = z.string().trim().toLowerCase().email('Invalid email address').max(254);
const password = z.string().min(6, 'Password must be at least 6 characters').max(128);
const name = z.string().trim().min(1, 'Name is required').max(100);
const clubName = z.string().trim().min(1, 'Club name is required').max(150);
const description = z.string().trim().max(5000);
const departmentName = z.string().trim().min(1, 'Department name is required').max(150);
const departmentShortCode = z.string().trim().min(1, 'Department short code is required').max(30).transform((value) => value.toUpperCase());
const text = (label, max) => z.string().trim().min(1, `${label} is required`).max(max);
const inviteToken = z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid invitation token');

const idParam = z.object({ id: uuid });
const userParams = z.object({ userId: uuid });
const membershipParams = z.object({ membershipId: uuid });
const idParams = (key) => z.object({ [key]: uuid });
const clubParams = z.object({ clubId: uuid });
const departmentParams = z.object({ departmentId: uuid });
const eventParams = z.object({ eventId: uuid });
const clubEventParams = z.object({ clubId: uuid, eventId: uuid });

const loginBody = z.object({ email, password });
const forgotPasswordBody = z.object({ email });
const resetPasswordBody = z.object({ email, otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'), password });
const deletionVerificationBody = z.object({ code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits') });
const adminRegisterBody = z.object({ name, email, password });
const managerInviteBody = z.object({ name, email });
const createClubBody = z.object({
  name: clubName,
  description: description.nullable().optional(),
  isCentral: z.boolean().optional(),
  departmentId: uuid.nullable().optional(),
  departments: z.array(uuid).optional(),
});
const updateClubBody = z.object({
  name: clubName.optional(),
  description: description.nullable().optional(),
  isCentral: z.boolean().optional(),
  departmentId: uuid.nullable().optional(),
  departments: z.array(uuid).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one club field is required');

const createDepartmentBody = z.object({
  name: departmentName,
  shortCode: departmentShortCode,
  description: description.nullable().optional(),
});
const updateDepartmentBody = z.object({
  name: departmentName.optional(),
  shortCode: departmentShortCode.optional(),
  description: description.nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one department field is required');

const clubIdsBody = z.object({
  clubIds: z.array(uuid),
});
const departmentIdsBody = z.object({
  departmentIds: z.array(uuid),
});

const membershipBody = z.object({
  role: z.enum(['MANAGER', 'MEMBER']).optional(),
  department: z.string().trim().max(100).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one membership field is required');

const existingManagerBody = z.object({
  userId: uuid,
  department: z.string().trim().max(100).optional(),
});

const acceptInviteBody = z.object({ password });
const createEventBody = z.object({
  title: text('title', 200),
  description: text('description', 5000),
  location: text('location', 255),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  registrationUrl: z.string().trim().nullable().optional(),
  capacity: z.number().int().positive('Capacity must be a positive integer').nullable().optional(),
  visibility: z.enum(['COLLEGE', 'PUBLIC']).default('COLLEGE').optional(),
  isPaid: z.boolean().default(false).optional(),
  is_paid: z.boolean().optional(),
  fee: z.number().int().min(0, 'Fee must be a non-negative integer').default(0).optional(),
  currency: z.string().trim().toUpperCase().default('INR').optional(),
  registrationDeadline: z.coerce.date().nullable().optional(),
  customFormDefinition: z.any().nullable().optional(),
}).refine((value) => !value.endAt || value.endAt > value.startAt, {
  message: 'endAt must be after startAt', path: ['endAt'],
}).refine((value) => {
  if (value.registrationDeadline && value.startAt && value.registrationDeadline > value.startAt) {
    return false;
  }
  return true;
}, {
  message: 'registrationDeadline cannot be after startAt', path: ['registrationDeadline'],
}).refine((value) => {
  const isPaid = Boolean(value.isPaid || value.is_paid);
  if (isPaid) {
    return typeof value.fee === 'number' && value.fee > 0;
  }
  return true;
}, {
  message: 'Paid events must specify a positive fee', path: ['fee'],
});
const updateEventBody = z.object({
  title: text('title', 200).optional(),
  description: text('description', 5000).optional(),
  location: text('location', 255).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullable().optional(),
  status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
  registrationUrl: z.string().trim().nullable().optional(),
  capacity: z.number().int().positive('Capacity must be a positive integer').nullable().optional(),
  visibility: z.enum(['COLLEGE', 'PUBLIC']).optional(),
  isPaid: z.boolean().optional(),
  is_paid: z.boolean().optional(),
  fee: z.number().int().min(0, 'Fee must be a non-negative integer').optional(),
  currency: z.string().trim().toUpperCase().optional(),
  registrationDeadline: z.coerce.date().nullable().optional(),
  customFormDefinition: z.any().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one event field is required')
  .refine((value) => {
    if (value.registrationDeadline && value.startAt && value.registrationDeadline > value.startAt) {
      return false;
    }
    return true;
  }, {
    message: 'registrationDeadline cannot be after startAt', path: ['registrationDeadline'],
  })
  .refine((value) => {
    const isPaid = value.isPaid !== undefined ? value.isPaid : value.is_paid;
    if (isPaid === true && value.fee !== undefined) {
      return value.fee > 0;
    }
    return true;
  }, {
    message: 'Paid events must specify a positive fee', path: ['fee'],
  });

const attendeeQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  participantType: z.enum(['STUDENT', 'EXTERNAL']).optional(),
});

// External participant OTP and registration schemas (Phase 3)
const externalOtpRequestBody = z.object({
  email: email,
  eventId: uuid.optional(),
});

const externalOtpVerifyBody = z.object({
  email: email,
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
  eventId: uuid.optional(),
});

const externalRegisterBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  rollNumber: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  gender: z.string().trim().max(50).optional().nullable(),
  yearOfStudy: z.string().trim().max(50).optional().nullable(),
  institutionName: z.string().trim().max(200).optional().nullable(),
  collegeName: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  formAnswers: z.record(z.unknown()).optional().nullable(),
});

const studentEventRegistrationBody = z.object({
  rollNumber: z.string().trim().max(50).optional().nullable(),
  name: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  gender: z.string().trim().max(50).optional().nullable(),
  yearOfStudy: z.string().trim().max(50).optional().nullable(),
  institutionName: z.string().trim().max(200).optional().nullable(),
  collegeName: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  formAnswers: z.record(z.unknown()).optional().nullable(),
  answers: z.record(z.unknown()).optional().nullable(),
});

module.exports = {
  uuid, inviteToken, idParam, userParams, membershipParams, idParams, clubParams, departmentParams, eventParams, clubEventParams,
  loginBody, forgotPasswordBody, resetPasswordBody, deletionVerificationBody, adminRegisterBody, managerInviteBody,
  createClubBody, updateClubBody, createDepartmentBody, updateDepartmentBody, clubIdsBody, departmentIdsBody,
  membershipBody, existingManagerBody, acceptInviteBody, createEventBody, updateEventBody, attendeeQuery,
  externalOtpRequestBody, externalOtpVerifyBody, externalRegisterBody, studentEventRegistrationBody,
  publicIdParams: z.object({ eventId: uuid, publicId: z.string().min(1).max(500) }),
};
