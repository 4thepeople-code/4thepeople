/**
 * backend/scripts/bootstrapProduction.js
 *
 * Idempotent, auditable production bootstrap runner.
 * Connects via PLATFORM_DATABASE_URL (platform_ops role, BYPASSRLS).
 *
 * Seeds:
 * 1. Two Initial Colleges: LBRCE and VRSEC.
 * 2. One Platform Super-Administrator in platform_admins (NEVER in users).
 * 3. Two Initial College Administrators in users (1 for LBRCE, 1 for VRSEC).
 *
 * Environment variables required:
 * - PLATFORM_DATABASE_URL
 * - BOOTSTRAP_PLATFORM_ADMIN_EMAIL
 * - BOOTSTRAP_PLATFORM_ADMIN_NAME
 * - BOOTSTRAP_PLATFORM_ADMIN_PASSWORD
 * - BOOTSTRAP_LBRCE_ADMIN_EMAIL
 * - BOOTSTRAP_LBRCE_ADMIN_NAME
 * - BOOTSTRAP_LBRCE_ADMIN_PASSWORD
 * - BOOTSTRAP_VRSEC_ADMIN_EMAIL
 * - BOOTSTRAP_VRSEC_ADMIN_NAME
 * - BOOTSTRAP_VRSEC_ADMIN_PASSWORD
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function waitForNeon(client, maxRetries = 8, delayMs = 2500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.$connect();
      await client.$queryRawUnsafe('SELECT 1');
      return true;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function runBootstrap(customConfig = {}) {
  const config = {
    databaseUrl: customConfig.databaseUrl || process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL,
    platformAdminEmail: (customConfig.platformAdminEmail || process.env.BOOTSTRAP_PLATFORM_ADMIN_EMAIL || 'irfanjankhan7860@gmail.com').toLowerCase().trim(),
    platformAdminName: (customConfig.platformAdminName || process.env.BOOTSTRAP_PLATFORM_ADMIN_NAME || 'Platform Super-Administrator').trim(),
    platformAdminPassword: customConfig.platformAdminPassword || process.env.BOOTSTRAP_PLATFORM_ADMIN_PASSWORD,
    lbrceAdminEmail: (customConfig.lbrceAdminEmail || process.env.BOOTSTRAP_LBRCE_ADMIN_EMAIL || 'admin@lbrce.ac.in').toLowerCase().trim(),
    lbrceAdminName: (customConfig.lbrceAdminName || process.env.BOOTSTRAP_LBRCE_ADMIN_NAME || 'LBRCE Administrator').trim(),
    lbrceAdminPassword: customConfig.lbrceAdminPassword || process.env.BOOTSTRAP_LBRCE_ADMIN_PASSWORD,
    vrsecAdminEmail: (customConfig.vrsecAdminEmail || process.env.BOOTSTRAP_VRSEC_ADMIN_EMAIL || 'admin@vrsec.ac.in').toLowerCase().trim(),
    vrsecAdminName: (customConfig.vrsecAdminName || process.env.BOOTSTRAP_VRSEC_ADMIN_NAME || 'VRSEC Administrator').trim(),
    vrsecAdminPassword: customConfig.vrsecAdminPassword || process.env.BOOTSTRAP_VRSEC_ADMIN_PASSWORD,
  };

  if (!config.databaseUrl) {
    throw new Error('BOOTSTRAP ERROR: Missing PLATFORM_DATABASE_URL');
  }
  if (!config.platformAdminPassword) {
    throw new Error('BOOTSTRAP ERROR: Missing BOOTSTRAP_PLATFORM_ADMIN_PASSWORD');
  }
  if (!config.lbrceAdminPassword) {
    throw new Error('BOOTSTRAP ERROR: Missing BOOTSTRAP_LBRCE_ADMIN_PASSWORD');
  }
  if (!config.vrsecAdminPassword) {
    throw new Error('BOOTSTRAP ERROR: Missing BOOTSTRAP_VRSEC_ADMIN_PASSWORD');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: config.databaseUrl } },
    log: ['error'],
  });

  try {
    await waitForNeon(prisma);
    console.log('[BOOTSTRAP] Starting production bootstrap...');

    // 1. Initial Colleges
    const collegesToUpsert = [
      { name: 'Lakireddy Bali Reddy College of Engineering', slug: 'lbrce' },
      { name: 'Velagapudi Ramakrishna Siddhartha Engineering College', slug: 'vrsec' },
    ];

    const colleges = {};
    for (const c of collegesToUpsert) {
      const record = await prisma.college.upsert({
        where: { slug: c.slug },
        update: { name: c.name },
        create: { name: c.name, slug: c.slug },
      });
      colleges[c.slug] = record;
      console.log(`[BOOTSTRAP] College upserted: ${c.slug} (ID: ${record.id})`);
    }

    // 2. Platform Super-Administrator (STRICTLY in platform_admins, NEVER in users)
    const platformPwHash = await bcrypt.hash(config.platformAdminPassword, 10);
    const platformAdmin = await prisma.platformAdmin.upsert({
      where: { email: config.platformAdminEmail },
      update: {
        name: config.platformAdminName,
        isActive: true,
      },
      create: {
        name: config.platformAdminName,
        email: config.platformAdminEmail,
        passwordHash: platformPwHash,
        isActive: true,
      },
    });
    console.log(`[BOOTSTRAP] Platform Admin upserted: ${platformAdmin.email} (ID: ${platformAdmin.id})`);

    // Verify Platform Admin is NOT in users table
    const leakedUser = await prisma.user.findFirst({
      where: { email: config.platformAdminEmail },
    });
    if (leakedUser) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Platform Admin email ${config.platformAdminEmail} exists in users table!`);
    }

    // 3. Initial College Administrators (In users table with role COLLEGE_ADMIN)
    const collegeAdminsToUpsert = [
      {
        slug: 'lbrce',
        email: config.lbrceAdminEmail,
        name: config.lbrceAdminName,
        password: config.lbrceAdminPassword,
      },
      {
        slug: 'vrsec',
        email: config.vrsecAdminEmail,
        name: config.vrsecAdminName,
        password: config.vrsecAdminPassword,
      },
    ];

    const collegeAdminRecords = [];
    for (const ca of collegeAdminsToUpsert) {
      const college = colleges[ca.slug];
      if (!college) {
        throw new Error(`College ${ca.slug} not found for admin provisioning`);
      }
      const adminPwHash = await bcrypt.hash(ca.password, 10);
      const adminUser = await prisma.user.upsert({
        where: {
          collegeId_email: {
            collegeId: college.id,
            email: ca.email,
          },
        },
        update: {
          name: ca.name,
          role: 'COLLEGE_ADMIN',
          isActive: true,
        },
        create: {
          collegeId: college.id,
          name: ca.name,
          email: ca.email,
          passwordHash: adminPwHash,
          role: 'COLLEGE_ADMIN',
          isActive: true,
        },
      });
      collegeAdminRecords.push(adminUser);
      console.log(`[BOOTSTRAP] College Admin upserted for ${ca.slug}: ${adminUser.email} (ID: ${adminUser.id}, CollegeID: ${college.id})`);
    }

    // 4. Verification of clean slate post-bootstrap
    const totalUsers = await prisma.user.count();
    const regularUsers = await prisma.user.count({ where: { role: 'USER' } });
    const clubsCount = await prisma.club.count();
    const eventsCount = await prisma.event.count();
    const regCount = await prisma.eventRegistration.count();
    const platformAdminsCount = await prisma.platformAdmin.count();

    console.log('\n[BOOTSTRAP VERIFICATION SUMMARY]');
    console.log(`- Platform Admins: ${platformAdminsCount} (expected: 1)`);
    console.log(`- Total Users: ${totalUsers} (expected: 2, exactly 2 college admins)`);
    console.log(`- Regular Users: ${regularUsers} (expected: 0)`);
    console.log(`- Clubs: ${clubsCount} (expected: 0)`);
    console.log(`- Events: ${eventsCount} (expected: 0)`);
    console.log(`- Event Registrations: ${regCount} (expected: 0)`);

    if (platformAdminsCount !== 1) {
      throw new Error(`Post-bootstrap verification failed: Platform admin count is ${platformAdminsCount} (expected 1)`);
    }
    if (totalUsers !== 2 || regularUsers !== 0) {
      throw new Error(`Post-bootstrap verification failed: User count is ${totalUsers}, regular users ${regularUsers} (expected 2 and 0)`);
    }
    if (clubsCount !== 0 || eventsCount !== 0 || regCount !== 0) {
      throw new Error(`Post-bootstrap verification failed: Unexpected data rows found!`);
    }

    console.log('[BOOTSTRAP] All post-bootstrap invariants verified successfully!');
    return {
      colleges,
      platformAdmin,
      collegeAdmins: collegeAdminRecords,
    };
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runBootstrap().catch(err => {
    console.error('[BOOTSTRAP FATAL ERROR]', err.message);
    process.exit(1);
  });
}

module.exports = { runBootstrap };
