const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { withTenant } = require('../config/tenantContext');
const { prisma } = require('../config/internalClient');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function run() {
  const isExecute = process.argv.includes('--execute');
  console.log(`\n======================================================`);
  console.log(`TECH-TALK 2026 DATA INGESTION [Mode: ${isExecute ? 'EXECUTE' : 'DRY-RUN'}]`);
  console.log(`======================================================\n`);

  const csvPath = path.join(__dirname, '../data/techtalk_2026_responses.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Fetch LBRCE college, CSE department, and ACG club
  const college = await prisma.college.findUnique({
    where: { slug: 'lbrce' },
    include: {
      departments: { where: { shortCode: 'CSE' } },
      clubs: { where: { name: 'ACG' } },
    },
  });

  if (!college) {
    throw new Error('College "lbrce" not found');
  }
  const cseDept = college.departments[0];
  const acgClub = college.clubs[0];

  console.log(`Target College: ${college.name} (${college.id})`);
  console.log(`Target Dept:    ${cseDept.name} (${cseDept.id})`);
  console.log(`Target Club:    ${acgClub.name} (${acgClub.id})\n`);

  // 2. Parse CSV rows
  const studentsMap = new Map(); // rollNumber -> student details
  const submissions = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 7) continue;

    const [
      timestamp,
      participationType,
      fullName1,
      rollNumber1Raw,
      section1,
      email1,
      phone1,
      fullName2,
      rollNumber2Raw,
      section2,
      email2,
      phone2,
    ] = cols;

    const roll1 = (rollNumber1Raw || '').replace(/[\s,]+/g, '').toUpperCase();
    const name1 = (fullName1 || '').replace(/^"|"$/g, '').trim();
    const em1 = (email1 || '').trim().toLowerCase();
    const ph1 = (phone1 || '').replace(/\D/g, '');
    const sec1 = (section1 || '').trim().toUpperCase();

    if (roll1) {
      studentsMap.set(roll1, {
        rollNumber: roll1,
        name: name1,
        email: em1,
        phone: ph1,
        section: sec1,
      });
    }

    const isTeam = participationType.toLowerCase() === 'team';
    const roll2 = (rollNumber2Raw || '').replace(/[\s,]+/g, '').toUpperCase();
    const name2 = (fullName2 || '').replace(/^"|"$/g, '').trim();
    const em2 = (email2 || '').trim().toLowerCase();
    const ph2 = (phone2 || '').replace(/\D/g, '');
    const sec2 = (section2 || '').trim().toUpperCase();

    const hasDistinctMember2 = isTeam && roll2 && roll2 !== roll1;

    if (hasDistinctMember2) {
      studentsMap.set(roll2, {
        rollNumber: roll2,
        name: name2,
        email: em2,
        phone: ph2,
        section: sec2,
      });
    }

    submissions.push({
      timestamp,
      isTeam: hasDistinctMember2,
      leader: { rollNumber: roll1, name: name1, email: em1, phone: ph1, section: sec1 },
      member: hasDistinctMember2
        ? { rollNumber: roll2, name: name2, email: em2, phone: ph2, section: sec2 }
        : null,
    });
  }

  console.log(`Total Submissions: ${submissions.length}`);
  console.log(`Total Unique Students: ${studentsMap.size}`);

  if (!isExecute) {
    console.log('\n[DRY RUN] Everything parsed successfully. To execute live database writes, run:');
    console.log('node backend/scripts/import_techtalk_data.js --execute\n');
    await prisma.$disconnect();
    return;
  }

  // --- Step 1: Provision Student Accounts ---
  console.log('\n--- Step 1: Provisioning Student Accounts ---');
  let createdUsers = 0;
  let updatedUsers = 0;

  for (const st of studentsMap.values()) {
    await withTenant(college.id, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { collegeId: college.id, rollNumber: st.rollNumber },
      });

      if (!existing) {
        await tx.user.create({
          data: {
            collegeId: college.id,
            name: st.name,
            email: st.email,
            rollNumber: st.rollNumber,
            phone: st.phone,
            section: st.section,
            departmentId: cseDept.id,
            admissionYear: 2026,
            yearOfStudy: '1st Year',
            role: 'USER',
            isActive: false,
            passwordHash: null,
          },
        });
        createdUsers++;
      } else {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            section: st.section || existing.section,
            phone: st.phone || existing.phone,
          },
        });
        updatedUsers++;
      }
    });
  }
  console.log(`✓ Finished Accounts: ${createdUsers} created, ${updatedUsers} updated.`);

  // Load user map
  const allUsers = await withTenant(college.id, async (tx) => {
    return tx.user.findMany({
      where: {
        collegeId: college.id,
        rollNumber: { in: Array.from(studentsMap.keys()) },
      },
      select: { id: true, rollNumber: true, name: true, email: true, phone: true, section: true },
    });
  });
  const userDbMap = new Map();
  for (const u of allUsers) {
    userDbMap.set(u.rollNumber, u);
  }

  // --- Step 2: Locating or Creating TECH-TALK 2026 Event ---
  console.log('\n--- Step 2: Locating or Creating TECH-TALK 2026 Event ---');
  let event = await withTenant(college.id, async (tx) => {
    let ev = await tx.event.findFirst({
      where: {
        collegeId: college.id,
        clubId: acgClub.id,
        title: { contains: 'TECH-TALK 2026', mode: 'insensitive' },
      },
    });

    if (!ev) {
      ev = await tx.event.create({
        data: {
          collegeId: college.id,
          clubId: acgClub.id,
          title: 'TECH-TALK 2026 – Student Seminar Activity',
          description:
            'TECH-TALK 2026 Student Seminar Activity for First-Year B.Tech Students organized by the Department of Computer Science & Engineering under Association of Computer Geeks (ACG). Mode: Individual / Team (Max 2). Suggested Topics: Semester Course Fundamentals, Emerging Technologies (AI, IoT, Cloud, Cyber Security, Quantum), Technology and Society. Duration: 5-7 Minutes (5-6 PPT Slides). Evaluation Criteria: 20 Marks.',
          location: 'CSE Department Seminar Hall',
          startAt: new Date('2026-11-28T09:30:00+05:30'),
          registrationDeadline: new Date('2026-11-28T09:00:00+05:30'),
          registrationMode: 'INTERNAL',
          visibility: 'COLLEGE',
          isPaid: false,
          fee: 0,
          currency: 'INR',
          capacity: 100,
        },
      });
      console.log(`Created new Event: "${ev.title}" (${ev.id})`);
    } else {
      console.log(`Found existing Event: "${ev.title}" (${ev.id})`);
    }
    return ev;
  });

  // --- Step 3: Registering Teams and Individuals ---
  console.log('\n--- Step 3: Registering Teams and Individuals ---');
  let regSuccess = 0;
  let regSkipped = 0;

  for (const sub of submissions) {
    const leaderUser = userDbMap.get(sub.leader.rollNumber);
    if (!leaderUser) {
      console.warn(`Could not find DB user for leader ${sub.leader.rollNumber}, skipping.`);
      regSkipped++;
      continue;
    }

    await withTenant(college.id, async (tx) => {
      const existingReg = await tx.eventRegistration.findFirst({
        where: {
          collegeId: college.id,
          eventId: event.id,
          userId: leaderUser.id,
        },
      });

      if (existingReg) {
        regSkipped++;
        return;
      }

      let formAnswers = null;
      if (sub.isTeam && sub.member) {
        const teamName = `Team ${sub.leader.rollNumber}`;
        formAnswers = {
          isTeamRegistration: true,
          teamName,
          teamSize: 2,
          teamLeader: {
            name: sub.leader.name,
            rollNumber: sub.leader.rollNumber,
            email: sub.leader.email,
            phone: sub.leader.phone,
            section: sub.leader.section,
            department: 'Computer Science and Engineering',
          },
          teamMembers: [
            {
              name: sub.member.name,
              rollNumber: sub.member.rollNumber,
              email: sub.member.email,
              phone: sub.member.phone,
              section: sub.member.section,
              department: 'Computer Science and Engineering',
            },
          ],
        };
      } else {
        formAnswers = {
          isTeamRegistration: false,
          section: sub.leader.section,
        };
      }

      await tx.eventRegistration.create({
        data: {
          collegeId: college.id,
          eventId: event.id,
          userId: leaderUser.id,
          participantType: 'STUDENT',
          homeCollegeId: college.id,
          participantName: sub.leader.name,
          participantEmail: sub.leader.email,
          participantRollNumber: sub.leader.rollNumber,
          participantCollegeName: college.name,
          participantDepartment: 'Computer Science and Engineering',
          participantYearOfStudy: '1st Year',
          participantPhone: sub.leader.phone,
          registeredByRole: 'SELF',
          formAnswers,
        },
      });
      regSuccess++;
    });
  }

  // Update registeredCount on event
  await withTenant(college.id, async (tx) => {
    const totalRegistrations = await tx.eventRegistration.count({
      where: { collegeId: college.id, eventId: event.id },
    });

    await tx.event.update({
      where: { id: event.id },
      data: { registeredCount: totalRegistrations },
    });

    console.log(`Created ${regSuccess} event registrations (${regSkipped} skipped).`);
    console.log(`Total registrations on Event: ${totalRegistrations}`);
  });

  console.log(`\n======================================================`);
  console.log(`TECH-TALK 2026 INGESTION COMPLETED SUCCESSFULLY!`);
  console.log(`======================================================\n`);

  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error('\nFatal Ingestion Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
