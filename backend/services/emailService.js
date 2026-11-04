const dotenv = require('dotenv');
const { BrevoClient } = require('@getbrevo/brevo');

dotenv.config();

/**
 * Brevo transactional email client
 *
 * Required environment variables:
 * BREVO_API_KEY
 * BREVO_SENDER_EMAIL
 * BREVO_SENDER_NAME (optional)
 */

let brevo;

/**
 * Validates that the active database host in test environment is strictly local or Neon dev.
 * Throws an error if tests are attempting to run against an unauthorized database host.
 */
const verifyTestDatabaseHost = () => {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Test environment error: No database URL configured in TEST_DATABASE_URL or DATABASE_URL');
  }

  let host = '';
  try {
    const parsed = new URL(dbUrl);
    host = parsed.hostname.toLowerCase();
  } catch {
    const match = dbUrl.match(/@([^:/]+)/);
    host = match ? match[1].toLowerCase() : '';
  }

  const isLocal = host === '127.0.0.1' || host === 'localhost';
  const isNeonDev = host.endsWith('.neon.tech') && (host.includes('dev') || host.includes('ep-withered-bird-ao71e632'));

  if (!isLocal && !isNeonDev) {
    throw new Error(`Safety violation: emailService test stub refused to execute. Database host '${host}' is neither local (127.0.0.1/localhost) nor a Neon dev endpoint (*.neon.tech).`);
  }
  return true;
};

const getBrevoClient = () => {
  if (process.env.NODE_ENV === 'test') {
    verifyTestDatabaseHost();
    return null;
  }

  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not configured.');
  }

  if (!brevo) {
    brevo = new BrevoClient({
      apiKey: process.env.BREVO_API_KEY,
      timeoutInSeconds: 30,
      maxRetries: 2,
    });
  }

  return brevo;
};

/**
 * Generic Brevo email sender
 */
const sendEmail = async ({ toEmail, toName, subject, html }) => {
  if (process.env.NODE_ENV === 'test') {
    verifyTestDatabaseHost();
    return { messageId: 'test-stub-message-id', success: true };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName =
    process.env.BREVO_SENDER_NAME || '4 THE PEOPLE';

  try {
    if (!senderEmail) {
      throw new Error('BREVO_SENDER_EMAIL is not configured.');
    }

    const client = getBrevoClient();
    const response = await client.transactionalEmails.sendTransacEmail({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: toEmail,
          name: toName,
        },
      ],
      subject,
      htmlContent: html,
    });

    console.log(
      `Email sent successfully to ${toEmail}. Message ID: ${response.messageId}`
    );
    return response;
  } catch (error) {
    console.error('Brevo email sending failed.');

    if (error.statusCode) {
      console.error('Brevo status:', error.statusCode);
    }

    if (error.message) {
      console.error('Brevo error:', error.message);
    }

    if (error.body) {
      console.error('Brevo response:', error.body);
    }

    throw error;
  }
};

/**
 * Sends a Manager Invite Email
 *
 * @param {string} toEmail
 * @param {string} name
 * @param {string} inviteToken
 */
const sendInviteEmail = async (toEmail, name, inviteToken) => {
  const frontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:5173';

  const inviteLink =
    `${frontendUrl}/accept-invite/${inviteToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background-color: #0B0F17; color: #F8FAFC; border: 1px solid #1E293B; border-radius: 20px;">

      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 34px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px; margin: 0; font-family: 'Syne', Arial, sans-serif;">
          <span style="color: #FF5733;">4</span> THE PEOPLE<span style="color: #FF5733;">.</span>
        </h1>

        <p style="color: #FF5733; font-size: 11px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px;">
          Campus Events & Club Manager
        </p>
      </div>

      <h2 style="color: #FFFFFF; font-size: 20px; font-weight: 800; margin-top: 0;">
        Welcome to 4 THE PEOPLE
      </h2>

      <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">
        Hello <strong style="color: #F8FAFC;">${name}</strong>,
      </p>

      <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">
        You have been invited to join the platform as a
        <strong>Club Manager</strong>.
        Please click the button below to complete your registration
        and set your password:
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a
          href="${inviteLink}"
          style="background-color: #FF5733; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block;"
        >
          Accept Invitation & Set Password
        </a>
      </div>

      <p style="color: #94A3B8; font-size: 13px;">
        Or copy and paste this link into your browser:
      </p>

      <p style="word-break: break-all;">
        <a
          href="${inviteLink}"
          style="color: #3B82F6; text-decoration: underline;"
        >
          ${inviteLink}
        </a>
      </p>

      <p style="color: #64748B; font-size: 12px; margin-top: 24px; border-top: 1px solid #1E293B; padding-top: 16px;">
        Note: This invitation link will expire in 48 hours.
      </p>

    </div>
  `;

  return sendEmail({
    toEmail,
    toName: name,
    subject:
      'Welcome to 4 THE PEOPLE - Invitation to Join as Club Manager',
    html,
  });
};

/**
 * Sends Manager Password Reset OTP
 *
 * @param {string} toEmail
 * @param {string} name
 * @param {string} otp
 */
const sendManagerPasswordResetOtp = async (
  toEmail,
  name,
  otp
) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background-color: #0B0F17; color: #F8FAFC; border: 1px solid #1E293B; border-radius: 20px;">

      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 34px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px; margin: 0; font-family: 'Syne', Arial, sans-serif;">
          <span style="color: #FF5733;">4</span> THE PEOPLE<span style="color: #FF5733;">.</span>
        </h1>
      </div>

      <h2 style="color: #FFFFFF; font-size: 20px; font-weight: 800; margin-top: 0;">
        Password Reset Request
      </h2>

      <p style="color: #94A3B8; font-size: 14px;">
        Hello <strong style="color: #F8FAFC;">${name}</strong>,
      </p>

      <p style="color: #94A3B8; font-size: 14px;">
        Use the following one-time code to reset your manager password:
      </p>

      <p style="font-size: 36px; letter-spacing: 8px; font-weight: 900; text-align: center; color: #FF5733; margin: 24px 0;">
        ${otp}
      </p>

      <p style="color: #64748B; font-size: 12px;">
        This code expires in 10 minutes.
        If you did not request this, you can safely ignore this email.
      </p>

    </div>
  `;

  return sendEmail({
    toEmail,
    toName: name,
    subject:
      '4 THE PEOPLE Manager Password Reset Code',
    html,
  });
};

/**
 * Sends Account Deletion Verification Code
 *
 * @param {string} toEmail
 * @param {string} name
 * @param {string} code
 */
const sendDeletionVerificationCode = async (
  toEmail,
  name,
  code
) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background-color: #0B0F17; color: #F8FAFC; border: 1px solid #1E293B; border-radius: 20px;">

      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 34px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px; margin: 0; font-family: 'Syne', Arial, sans-serif;">
          <span style="color: #FF5733;">4</span> THE PEOPLE<span style="color: #FF5733;">.</span>
        </h1>
      </div>

      <h2 style="color: #FFFFFF; font-size: 20px; font-weight: 800; margin-top: 0;">
        Confirm Destructive Action
      </h2>

      <p style="color: #94A3B8; font-size: 14px;">
        Hello <strong style="color: #F8FAFC;">${name}</strong>,
      </p>

      <p style="color: #94A3B8; font-size: 14px;">
        Use this one-time verification code to confirm deletion:
      </p>

      <p style="font-size: 36px; letter-spacing: 8px; font-weight: 900; text-align: center; color: #EF4444; margin: 24px 0;">
        ${code}
      </p>

      <p style="color: #64748B; font-size: 12px;">
        This code expires in 10 minutes.
      </p>

    </div>
  `;

  return sendEmail({
    toEmail,
    toName: name,
    subject:
      '4 THE PEOPLE Deletion Verification Code',
    html,
  });
};

module.exports = {
  sendEmail,
  sendInviteEmail,
  sendManagerPasswordResetOtp,
  sendDeletionVerificationCode,
  verifyTestDatabaseHost,
};
