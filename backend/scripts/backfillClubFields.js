require('dotenv').config();

const { prisma } = require('../config/db');
const { DEFAULT_COLLEGE_ID } = require('../config/college');
const applyChanges = process.argv.slice(2).includes('--apply');
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== '--apply');
const missingField = (field) => ({
  OR: [{ [field]: null }, { [field]: { isSet: false } }],
});

const getDatabaseTarget = () => {
  try {
    const databaseUrl = new URL(process.env.DATABASE_URL);
    return {
      host: databaseUrl.hostname || 'unknown',
      database: decodeURIComponent(databaseUrl.pathname.slice(1)) || '(default)',
    };
  } catch {
    return { host: 'unknown', database: 'unknown' };
  }
};

const getSafeErrorMessage = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  const sanitizedMessage = message.replace(
    /mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi,
    '[redacted MongoDB connection string]'
  );
  return process.env.DATABASE_URL
    ? sanitizedMessage.replace(process.env.DATABASE_URL, '[redacted DATABASE_URL]')
    : sanitizedMessage;
};

const main = async () => {
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument: ${unknownArgs[0]}. Use --apply to write changes.`);
  }

  const { host, database } = getDatabaseTarget();
  console.log(`Database: host=${host}, database=${database}`);
  console.log(`Mode: ${applyChanges ? 'APPLY' : 'DRY RUN'}`);

  await prisma.$connect();
  console.log('Database Connected...');

  const totalClubs = await prisma.club.count();
  const missingCollegeId = await prisma.club.count({ where: missingField('collegeId') });
  const missingIsCentral = await prisma.club.count({ where: missingField('isCentral') });

  let updatedCollegeId = 0;
  let updatedIsCentral = 0;

  if (applyChanges) {
    const collegeUpdate = await prisma.club.updateMany({
      where: missingField('collegeId'),
      data: { collegeId: DEFAULT_COLLEGE_ID },
    });
    const centralUpdate = await prisma.club.updateMany({
      where: missingField('isCentral'),
      data: { isCentral: false },
    });
    updatedCollegeId = collegeUpdate.count;
    updatedIsCentral = centralUpdate.count;
  }

  console.log(`Total clubs: ${totalClubs}`);
  console.log(`Missing collegeId: ${missingCollegeId}`);
  console.log(`Missing isCentral: ${missingIsCentral}`);
  if (!applyChanges) {
    console.log(`Would update collegeId: ${missingCollegeId}`);
    console.log(`Would update isCentral: ${missingIsCentral}`);
  }
  console.log(`Updated collegeId: ${updatedCollegeId}`);
  console.log(`Updated isCentral: ${updatedIsCentral}`);
};

main()
  .catch((error) => {
    console.error(`Backfill failed: ${getSafeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
