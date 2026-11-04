const readline = require('readline');
const bcrypt = require('bcryptjs');
const { platformPrisma } = require('../config/platformDb');
const {
  generateTotpSecret,
  encryptTotpSecret,
  generateOtpauthUrl,
  verifyTotp,
} = require('../utils/totp');

/**
 * Prompts user for hidden input (such as passwords) without echoing keystrokes to stdout.
 */
function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.openStdin();
    const onData = (char) => {
      char = char.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          break;
        default:
          process.stdout.write('\x1B[2K\x1B[200D' + query + '*'.repeat(rl.line ? rl.line.length : 0));
          break;
      }
    };

    process.stdin.on('data', onData);

    rl.question(query, (value) => {
      rl.close();
      process.stdout.write('\n');
      resolve(value.trim());
    });
  });
}

function promptVisible(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  console.log('======================================================================');
  console.log('YUVA PLATFORM ADMINISTRATOR: TOTP ENROLLMENT CLI');
  console.log('======================================================================');

  const email = await promptVisible('Enter Platform Administrator Email: ');
  if (!email) {
    console.error('Error: Email cannot be empty.');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find platform admin record
  const admin = await platformPrisma.platformAdmin.findUnique({
    where: { email: normalizedEmail },
  });

  if (!admin) {
    console.error(`Error: No platform administrator found with email: ${normalizedEmail}`);
    await platformPrisma.$disconnect();
    process.exit(1);
  }

  if (!admin.isActive) {
    console.error('Error: This platform administrator account is inactive.');
    await platformPrisma.$disconnect();
    process.exit(1);
  }

  const password = await promptHidden('Enter Platform Administrator Password: ');
  if (!password) {
    console.error('Error: Password cannot be empty.');
    await platformPrisma.$disconnect();
    process.exit(1);
  }

  const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isPasswordValid) {
    console.error('Error: Authentication failed. Invalid password.');
    await platformPrisma.$disconnect();
    process.exit(1);
  }

  console.log('\n✔ Authentication successful. Generating secure TOTP keypair...\n');

  // Generate plain Base32 secret and encrypt it for database storage
  const plainSecret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(plainSecret);
  const otpauthUrl = generateOtpauthUrl(admin.email, plainSecret);

  console.log('----------------------------------------------------------------------');
  console.log('SCAN THIS OTPAUTH URL IN YOUR AUTHENTICATOR APP (1Password / Google Authenticator):');
  console.log('----------------------------------------------------------------------');
  console.log(otpauthUrl);
  console.log('----------------------------------------------------------------------');
  console.log(`Manual Secret Key : ${plainSecret}`);
  console.log('----------------------------------------------------------------------\n');

  // Require verification of the first 6-digit code before committing to database
  const verificationCode = await promptVisible('Enter 6-digit code from your authenticator app to verify: ');

  const isValidCode = verifyTotp(verificationCode, plainSecret);
  if (!isValidCode) {
    console.error('\n❌ Error: Invalid verification code. TOTP enrollment aborted. Database was not modified.');
    await platformPrisma.$disconnect();
    process.exit(1);
  }

  // Update encrypted secret in database
  await platformPrisma.platformAdmin.update({
    where: { id: admin.id },
    data: { totpSecret: encryptedSecret },
  });

  console.log(`\n✔ SUCCESS: TOTP 2FA has been successfully enrolled for ${admin.email}!`);
  console.log('✔ The secret key has been encrypted at rest with AES-256-GCM.');
  console.log('✔ Subsequent platform logins will require your 6-digit TOTP code.\n');

  await platformPrisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ Fatal Enrollment Error:', err.message);
  try {
    await platformPrisma.$disconnect();
  } catch {}
  process.exit(1);
});
