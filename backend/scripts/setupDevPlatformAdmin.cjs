process.env.DATABASE_URL = 'postgresql://app_user:YuvaAppUserProd2026_Secure99%21@ep-delicate-truth-aooct0mf.c-2.ap-southeast-1.aws.neon.tech/yuva_prod?sslmode=require&channel_binding=require';
process.env.PLATFORM_DATABASE_URL = 'postgresql://platform_ops:YuvaPlatformOpsProd2026_Secure99%21@ep-delicate-truth-aooct0mf.c-2.ap-southeast-1.aws.neon.tech/yuva_prod?sslmode=require&channel_binding=require';
process.env.TOTP_ENCRYPTION_KEY = 'dev_totp_encryption_key_for_platform_admins';
process.env.PLATFORM_JWT_SECRET = 'dev_platform_super_admin_jwt_secret_fallback_key';

const bcrypt = require('bcryptjs');
const { platformPrisma } = require('../config/platformDb');
const {
  generateTotpSecret,
  encryptTotpSecret,
  generateHotp,
  base32Decode,
  generateOtpauthUrl,
} = require('../utils/totp');

async function setupAdmin(customEmail, customPassword) {
  const email = (customEmail || process.argv[2] || 'superadmin@platform.yuva').toLowerCase().trim();
  const password = customPassword || process.argv[3] || 'PlatformAdmin123!';

  console.log('======================================================================');
  console.log('4THEPEOPLE: PLATFORM SUPER-ADMIN DEV CREDENTIALS SETUP');
  console.log('======================================================================\n');

  const plainSecret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(plainSecret);
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await platformPrisma.platformAdmin.upsert({
    where: { email },
    create: {
      name: 'Platform Super-Administrator',
      email,
      passwordHash,
      totpSecret: encryptedSecret,
      isActive: true,
    },
    update: {
      passwordHash,
      totpSecret: encryptedSecret,
      isActive: true,
    },
  });

  const secretBuf = base32Decode(plainSecret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const currentCode = generateHotp(secretBuf, counter, 6);
  const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

  const otpUrl = generateOtpauthUrl(email, plainSecret, '4THEPEOPLE Platform');

  console.log('✔ Platform Super-Admin account successfully configured!\n');
  console.log('----------------------------------------------------------------------');
  console.log('LOGIN CREDENTIALS:');
  console.log('  Portal URL : http://admin.localhost:3000/login');
  console.log(`  Admin Email: ${email}`);
  console.log(`  Password   : ${password}`);
  console.log('----------------------------------------------------------------------');
  console.log('AUTHENTICATOR (TOTP 2FA) SETUP:');
  console.log(`  Base32 Secret Key : ${plainSecret}`);
  console.log(`  otpauth URI       : ${otpUrl}`);
  console.log('----------------------------------------------------------------------');
  console.log(`  CURRENT LIVE CODE : ${currentCode} (valid for next ${secondsRemaining}s)`);
  console.log('----------------------------------------------------------------------\n');
  console.log('You can either:');
  console.log('1. Type the secret key into Google Authenticator or 1Password.');
  console.log(`2. Or directly copy the CURRENT LIVE CODE above (${currentCode}) into the login form right now!`);
  console.log('======================================================================\n');
}

setupAdmin()
  .catch(console.error)
  .finally(() => platformPrisma.$disconnect());

