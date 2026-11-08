require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { platformPrisma } = require('../config/platformDb');
const { decryptTotpSecret, base32Decode, generateHotp } = require('../utils/totp');

async function main() {
  const email = (process.argv[2] || 'irfanjankhan7860@gmail.com').toLowerCase().trim();
  const admin = await platformPrisma.platformAdmin.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, totpSecret: true, isActive: true },
  });

  if (!admin) {
    console.error(`Error: Platform administrator with email '${email}' not found.`);
    process.exit(1);
  }

  if (!admin.totpSecret) {
    console.error(`Error: TOTP 2FA is not enrolled for '${email}'.`);
    process.exit(1);
  }

  const plainSecret = decryptTotpSecret(admin.totpSecret);
  const secretBuf = base32Decode(plainSecret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const currentCode = generateHotp(secretBuf, counter, 6);
  const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

  console.log('\n======================================================');
  console.log('4THEPEOPLE: PLATFORM ADMIN 2FA TOTP CODE');
  console.log('======================================================');
  console.log('Account   :', admin.email);
  console.log('Live Code :', currentCode);
  console.log('Valid For : Next', secondsRemaining, 'seconds');
  console.log('======================================================\n');
}

main()
  .catch(console.error)
  .finally(() => platformPrisma.$disconnect());

