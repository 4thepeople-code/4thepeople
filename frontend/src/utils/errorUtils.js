/**
 * Formats server errors into clean, readable, user-friendly messages.
 * Handles both RTK Query mutation errors and Axios/Fetch errors.
 */
export const formatErrorMessage = (err, fallback = 'Operation failed. Please try again.') => {
  if (!err) return fallback;

  // Extract status code if available
  const status = err?.status || err?.response?.status;

  // Extract message from RTK Query or Axios or Error
  const rawMsg =
    err?.data?.message ||
    err?.data?.error ||
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    '';

  const lower = typeof rawMsg === 'string' ? rawMsg.toLowerCase() : '';

  // Rule 1: Central club cannot be linked to a department
  if (lower.includes('central clubs cannot be linked to a department')) {
    return 'Central clubs cannot be linked to a department. Please deselect any central clubs.';
  }

  // Rule 2: Club with department links cannot be marked central
  if (
    lower.includes('club with department links cannot be marked central') ||
    (status === 409 && lower.includes('department links') && lower.includes('central'))
  ) {
    return 'This club is linked to one or more departments. Department links must be removed before marking it as central.';
  }

  // Rule 3: 409 Conflict - Duplicate name or short code
  if (
    status === 409 ||
    lower.includes('already exists') ||
    lower.includes('duplicate') ||
    lower.includes('unique constraint')
  ) {
    if (lower.includes('short code') || lower.includes('shortcode')) {
      return 'A department with this short code already exists. Please choose a different short code.';
    }
    if (lower.includes('department with this name') || lower.includes('name or short code')) {
      return 'A department with this name or short code already exists. Please choose a different name or short code.';
    }
    if (lower.includes('club') && lower.includes('name')) {
      return 'A club with this name already exists. Please choose a different name.';
    }
    return rawMsg || 'A record with these details already exists. Please adjust your input.';
  }

  // Rule 4: Validation errors (e.g. 400)
  if (typeof rawMsg === 'string' && rawMsg.trim()) {
    return rawMsg;
  }

  return fallback;
};

