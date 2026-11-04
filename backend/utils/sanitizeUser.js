/**
 * Sanitizes user objects by stripping out sensitive fields like password hashes,
 * tokens, and OTP secrets.
 *
 * @param {Object|Array} user - User object or array of user objects
 * @returns {Object|Array} Sanitized user object(s)
 */
const sanitizeUser = (user) => {
  if (!user) return user;

  if (Array.isArray(user)) {
    return user.map((u) => sanitizeUser(u));
  }

  const {
    password,
    passwordHash,
    inviteToken,
    inviteTokenHash,
    inviteExpiresAt,
    passwordResetOtpHash,
    passwordResetOtpExpiresAt,
    passwordResetAttempts,
    avatarUrl,
    avatarPublicId,
    ...sanitized
  } = user;

  let avatar = user.avatar;
  if (avatar === undefined) {
    if (avatarUrl || avatarPublicId) {
      avatar = { url: avatarUrl || null, publicId: avatarPublicId || null };
    } else {
      avatar = null;
    }
  }

  return {
    ...sanitized,
    avatar,
  };
};

module.exports = { sanitizeUser };
