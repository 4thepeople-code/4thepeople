const readline = require('readline');
const bcrypt = require('bcryptjs');
const { platformPrisma } = require('../config/platformDb');

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
  console.log('YUVA PLATFORM ADMINISTRATOR: 2FA AUTHENTICATOR RESET CLI');
  console.log('======================================================================');
  console.log('This utility resets the TOTP 2FA secret for an administrator who has');
  console.log('lost access to their authenticator app or device.');
  console.log('----------------------------------------------------------------------\n');

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

  console.log('\n✔ Authentication successful.');

  if (!admin.totpSecret) {
    console.log(`Notice: 2FA is not currently enrolled for ${admin.email} (totpSecret is already NULL).`);
    await platformPrisma.$disconnect();
    process.exit(0);
  }

  const confirmation = await promptVisible(
    `Are you sure you want to reset 2FA for ${admin.email}? (yes/no): `
  );

  if (confirmation.toLowerCase() !== 'yes') {
    console.log('Action cancelled. Database was not modified.');
    await platformPrisma.$disconnect();
    process.exit(0);
  }

  // Reset TOTP secret to NULL in PostgreSQL
  await platformPrisma.platformAdmin.update({
    where: { id: admin.id },
    data: { totpSecret: null },
  });

  console.log(`\n✔ SUCCESS: TOTP 2FA has been reset (totpSecret set to NULL) for ${admin.email}.`);
  console.log('✔ You can now re-enroll a new authenticator device using:');
  console.log('    node backend/scripts/enrollPlatformAdminTotp.js\n');

  await platformPrisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ Fatal Reset Error:', err.message);
  try {
    await platformPrisma.$disconnect();
  } catch {}
  process.exit(1);
});
