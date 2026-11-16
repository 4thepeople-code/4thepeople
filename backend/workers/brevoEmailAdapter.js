/**
 * BrevoEmailAdapter
 *
 * Production email adapter for the OutboxWorker.
 * Implements sendEmail({ idempotencyKey, to, recipientName, templateType, params })
 * by rendering template-specific HTML and dispatching via the Brevo transactional API.
 *
 * Template types supported:
 *   STUDENT_ACTIVATION — 6-digit activation code for new students.
 *   PASSWORD_RESET     — 6-digit password reset OTP for managers.
 *   EXTERNAL_OTP       — 6-digit OTP for external participant registration.
 *   EVENT_TICKET       — Registration confirmation for an event.
 *   CLUB_INVITE        — Manager invitation to a club.
 *   (default)          — Generic notification fallback.
 */
const { sendEmail } = require('../services/emailService');

/**
 * Platform branding header block, shared across all templates.
 */
function brandHeader() {
  return `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:34px;font-weight:900;color:#FFFFFF;letter-spacing:2px;margin:0;font-family:'Syne',Arial,sans-serif;">
        <span style="color:#FF5733;">4</span> THE PEOPLE<span style="color:#FF5733;">.</span>
      </h1>
      <p style="color:#FF5733;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">
        Campus Events &amp; Club Manager
      </p>
    </div>
  `;
}

/**
 * Wraps content in the platform dark card container.
 */
function wrapCard(innerHtml) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;
                background-color:#0B0F17;color:#F8FAFC;border:1px solid #1E293B;border-radius:20px;">
      ${brandHeader()}
      ${innerHtml}
    </div>
  `;
}

/**
 * Renders an EXTERNAL_OTP verification email.
 * params: { code: string, eventTitle: string, expiresInMinutes: number }
 */
function renderExternalOtp(recipientEmail, params) {
  const { code, eventTitle, expiresInMinutes } = params;
  const displayEmail = String(recipientEmail || '').toLowerCase();
  const displayEvent = String(eventTitle || 'the event');
  const displayExpiry = Number(expiresInMinutes) || 10;

  const inner = `
    <h2 style="color:#FFFFFF;font-size:20px;font-weight:800;margin-top:0;">
      Your Verification Code
    </h2>

    <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
      Hello <strong style="color:#F8FAFC;">${displayEmail}</strong>,
    </p>

    <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
      You requested to register for <strong style="color:#F8FAFC;">${displayEvent}</strong>.
      Use the code below to verify your email address and complete your registration.
    </p>

    <div style="background:#12141C;border:2px solid #00F0FF;border-radius:16px;
                padding:28px 24px;text-align:center;margin:28px 0;">
      <p style="color:#94A3B8;font-size:12px;font-weight:700;letter-spacing:2px;
                text-transform:uppercase;margin:0 0 12px;">Verification Code</p>
      <p style="font-size:48px;letter-spacing:12px;font-weight:900;color:#00F0FF;
                margin:0;font-family:'Courier New',monospace;">${code}</p>
    </div>

    <p style="color:#94A3B8;font-size:13px;line-height:1.6;">
      This code is valid for <strong>${displayExpiry} minutes</strong> and can be used only once.
      Do not share it with anyone.
    </p>

    <p style="color:#64748B;font-size:12px;margin-top:24px;border-top:1px solid #1E293B;padding-top:16px;">
      If you did not request this code, you can safely ignore this email.
      No account has been created.
    </p>
  `;

  return {
    subject: `Your verification code – ${displayEvent}`,
    html: wrapCard(inner),
  };
}

/**
 * Renders a STUDENT_ACTIVATION email.
 * params: { name: string, rollNumber: string, code: string }
 */
function renderStudentActivation(recipientName, params) {
  const { name, rollNumber, code } = params;
  const inner = `
    <h2 style="color:#FFFFFF;font-size:20px;font-weight:800;margin-top:0;">
      Activate Your Student Account
    </h2>

    <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
      Hello <strong style="color:#F8FAFC;">${name || recipientName}</strong>,
    </p>

    <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
      Your activation code for roll number
      <strong style="color:#F8FAFC;">${rollNumber}</strong>:
    </p>

    <div style="background:#12141C;border:2px solid #FF5733;border-radius:16px;
                padding:28px 24px;text-align:center;margin:28px 0;">
      <p style="color:#94A3B8;font-size:12px;font-weight:700;letter-spacing:2px;
                text-transform:uppercase;margin:0 0 12px;">Activation Code</p>
      <p style="font-size:48px;letter-spacing:12px;font-weight:900;color:#FF5733;
                margin:0;font-family:'Courier New',monospace;">${code}</p>
    </div>

    <p style="color:#64748B;font-size:12px;margin-top:24px;border-top:1px solid #1E293B;padding-top:16px;">
      This code expires in 10 minutes. If you did not request this, please contact your college administrator.
    </p>
  `;
  return {
    subject: '4 THE PEOPLE — Student Account Activation Code',
    html: wrapCard(inner),
  };
}

/**
 * Renders a PASSWORD_RESET email.
 * params: { name: string, otp: string }
 */
function renderPasswordReset(recipientName, params) {
  const { name, otp } = params;
  const inner = `
    <h2 style="color:#FFFFFF;font-size:20px;font-weight:800;margin-top:0;">
      Password Reset Request
    </h2>

    <p style="color:#94A3B8;font-size:14px;">
      Hello <strong style="color:#F8FAFC;">${name || recipientName}</strong>,
    </p>

    <p style="color:#94A3B8;font-size:14px;">
      Use the following one-time code to reset your password:
    </p>

    <p style="font-size:36px;letter-spacing:8px;font-weight:900;text-align:center;color:#FF5733;margin:24px 0;">
      ${otp}
    </p>

    <p style="color:#64748B;font-size:12px;">
      This code expires in 1 hour. If you did not request this, you can safely ignore this email.
    </p>
  `;
  return {
    subject: '4 THE PEOPLE — Password Reset Code',
    html: wrapCard(inner),
  };
}

/**
 * Renders an EVENT_TICKET confirmation email.
 * params: { eventTitle: string, eventDate: string, location: string, registrationId: string }
 */
function renderEventTicket(recipientName, params) {
  const { eventTitle, eventDate, location, registrationId } = params;
  const inner = `
    <h2 style="color:#FFFFFF;font-size:20px;font-weight:800;margin-top:0;">
      You're Registered!
    </h2>

    <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
      Hello <strong style="color:#F8FAFC;">${recipientName}</strong>,
    </p>

    <p style="color:#94A3B8;font-size:14px;line-height:1.6;">
      Your registration for <strong style="color:#F8FAFC;">${eventTitle || 'the event'}</strong> is confirmed.
    </p>

    ${eventDate ? `<p style="color:#94A3B8;font-size:14px;"><strong style="color:#F8FAFC;">Date:</strong> ${eventDate}</p>` : ''}
    ${location ? `<p style="color:#94A3B8;font-size:14px;"><strong style="color:#F8FAFC;">Location:</strong> ${location}</p>` : ''}
    ${registrationId ? `<p style="color:#64748B;font-size:12px;">Registration ID: ${registrationId}</p>` : ''}

    <p style="color:#64748B;font-size:12px;margin-top:24px;border-top:1px solid #1E293B;padding-top:16px;">
      See you there!
    </p>
  `;
  return {
    subject: `Registration confirmed – ${eventTitle || 'Event'}`,
    html: wrapCard(inner),
  };
}

/**
 * Generic fallback renderer for unknown template types.
 */
function renderGeneric(recipientName, params) {
  const inner = `
    <h2 style="color:#FFFFFF;font-size:20px;font-weight:800;margin-top:0;">
      Notification from 4 THE PEOPLE
    </h2>
    <p style="color:#94A3B8;font-size:14px;">Hello ${recipientName},</p>
    <pre style="color:#94A3B8;font-size:12px;white-space:pre-wrap;">${JSON.stringify(params, null, 2)}</pre>
  `;
  return {
    subject: '4 THE PEOPLE Notification',
    html: wrapCard(inner),
  };
}

class BrevoEmailAdapter {
  /**
   * Renders the template and dispatches the email via Brevo.
   *
   * @param {Object} options
   * @param {string} options.idempotencyKey   - UUID job ID (unused at Brevo layer but kept for interface parity)
   * @param {string} options.to               - Recipient email
   * @param {string} options.recipientName    - Recipient display name
   * @param {string} options.templateType     - Template type string
   * @param {Object} options.params           - Decrypted template parameters
   */
  async sendEmail({ to, recipientName, templateType, params }) {
    let rendered;

    switch (templateType) {
      case 'EXTERNAL_OTP':
        rendered = renderExternalOtp(to, params);
        break;
      case 'STUDENT_ACTIVATION':
        rendered = renderStudentActivation(recipientName, params);
        break;
      case 'PASSWORD_RESET':
        rendered = renderPasswordReset(recipientName, params);
        break;
      case 'EVENT_TICKET':
        rendered = renderEventTicket(recipientName, params);
        break;
      default:
        rendered = renderGeneric(recipientName, params);
    }

    return sendEmail({
      toEmail: to,
      toName: recipientName,
      subject: rendered.subject,
      html: rendered.html,
    });
  }
}

module.exports = {
  BrevoEmailAdapter,
  // Export renderers for unit testing without network calls
  renderExternalOtp,
  renderStudentActivation,
  renderPasswordReset,
  renderEventTicket,
};
