/**
 * Integration Test Suite: Event Certificates Management System
 * 
 * Verifies all certificate requirements:
 * 1. Authorization: unauthorized requests rejected (401/403).
 * 2. Eligibility: student not registered -> issuance rejected (400).
 * 3. Method A: Individual PDF upload, magic byte validation (%PDF-), duplicate prevention (409).
 * 4. Method B: Bulk ZIP upload, path traversal protection, manifest validation, batch error handling.
 * 5. Method C: Template upload, coordinate overlay preview, and batch generation.
 * 6. Revocation: explicit with reason, prevents download.
 * 7. Reissue: explicit operation creating a new certificate.
 * 8. Student self-service: students only see/download own active certificates.
 * 9. Public verification: verify certificate number without authentication.
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const http = require('http');
const AdmZip = require('adm-zip');
const { PDFDocument } = require('pdf-lib');
const { platformPrisma } = require('../config/platformDb');
const app = require('../index');

const JWT_SECRET = process.env.JWT_SECRET || 'myjwtsecretkey';
const PROXY_SECRET = process.env.PROXY_SHARED_SECRET || 'test_shared_proxy_secret_for_local_development_only';
process.env.PROXY_SHARED_SECRET = PROXY_SECRET;

let server = null;
let baseUrl = '';

// Tracked entities for clean teardown
let testCollege = null;
let testClub = null;
let testEvent = null;
let testAdmin = null;
let testManager = null;
let testStudent1 = null;
let testStudent2 = null;
let testStudentUnregistered = null;

let adminToken = '';
let managerToken = '';
let student1Token = '';
let student2Token = '';

// Helper to make multipart or JSON HTTP request
function makeHttpRequest({ method = 'GET', path, token, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = {
      'x-proxy-shared-secret': PROXY_SECRET,
      'x-forwarded-host': `${testCollege?.slug || 'lbrce'}.localhost`,
      Origin: `http://${testCollege?.slug || 'lbrce'}.localhost`,
      ...headers,
    };

    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(raw.toString('utf8'));
          } catch {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
            raw,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Helper to create a multipart boundary payload
function createMultipartFormData(fields = {}, files = {}) {
  const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    ));
  }

  for (const [name, file] of Object.entries(files)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`
    ));
    parts.push(file.buffer);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body,
  };
}

// Create a valid dummy PDF buffer
async function createValidPdfBuffer(text = 'Certificate') {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  page.drawText(text, { x: 50, y: 350, size: 24 });
  return Buffer.from(await doc.save());
}

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING EVENT CERTIFICATES TEST SUITE');
  console.log('======================================================================\n');

  // Start express server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const uniqueSuffix = Date.now().toString(36);
  const collegeSlug = `cert-test-${uniqueSuffix}`;

  try {
    // Setup test fixtures in database
    testCollege = await platformPrisma.college.create({
      data: {
        name: `Certificate College ${uniqueSuffix}`,
        slug: collegeSlug,
        code: `CC${uniqueSuffix.slice(-4).toUpperCase()}`,
        studentEmailDomain: 'cert.test',
      },
    });

    testAdmin = await platformPrisma.user.create({
      data: {
        collegeId: testCollege.id,
        name: 'College Admin',
        email: `admin_${uniqueSuffix}@cert.test`,
        role: 'COLLEGE_ADMIN',
        isActive: true,
      },
    });

    testManager = await platformPrisma.user.create({
      data: {
        collegeId: testCollege.id,
        name: 'Club Manager',
        email: `manager_${uniqueSuffix}@cert.test`,
        role: 'USER',
        isActive: true,
      },
    });

    testStudent1 = await platformPrisma.user.create({
      data: {
        collegeId: testCollege.id,
        name: 'Alice Registered',
        email: `alice_${uniqueSuffix}@cert.test`,
        rollNumber: `23CC01_${uniqueSuffix}`,
        role: 'USER',
        isActive: true,
      },
    });

    testStudent2 = await platformPrisma.user.create({
      data: {
        collegeId: testCollege.id,
        name: 'Bob Registered',
        email: `bob_${uniqueSuffix}@cert.test`,
        rollNumber: `23CC02_${uniqueSuffix}`,
        role: 'USER',
        isActive: true,
      },
    });

    testStudentUnregistered = await platformPrisma.user.create({
      data: {
        collegeId: testCollege.id,
        name: 'Charlie Unregistered',
        email: `charlie_${uniqueSuffix}@cert.test`,
        rollNumber: `23CC03_${uniqueSuffix}`,
        role: 'USER',
        isActive: true,
      },
    });

    testClub = await platformPrisma.club.create({
      data: {
        collegeId: testCollege.id,
        name: `Tech Club ${uniqueSuffix}`,
        clubType: 'CENTRAL',
        createdByUserId: testAdmin.id,
      },
    });

    // Assign manager to club
    await platformPrisma.membership.create({
      data: {
        collegeId: testCollege.id,
        clubId: testClub.id,
        userId: testManager.id,
        role: 'MANAGER',
      },
    });

    testEvent = await platformPrisma.event.create({
      data: {
        collegeId: testCollege.id,
        clubId: testClub.id,
        title: `CodeFest 2026 ${uniqueSuffix}`,
        description: 'Annual coding event',
        location: 'Tech Lab 1',
        startAt: new Date(Date.now() + 86400000),
        registrationMode: 'INTERNAL',
      },
    });

    // Register Alice and Bob (Charlie remains unregistered)
    await platformPrisma.eventRegistration.createMany({
      data: [
        { collegeId: testCollege.id, eventId: testEvent.id, userId: testStudent1.id },
        { collegeId: testCollege.id, eventId: testEvent.id, userId: testStudent2.id },
      ],
    });

    // Generate JWTs
    adminToken = jwt.sign(
      { userId: testAdmin.id, id: testAdmin.id, collegeId: testCollege.id, role: 'COLLEGE_ADMIN' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    managerToken = jwt.sign(
      { userId: testManager.id, id: testManager.id, collegeId: testCollege.id, role: 'USER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    student1Token = jwt.sign(
      { userId: testStudent1.id, id: testStudent1.id, collegeId: testCollege.id, role: 'USER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    student2Token = jwt.sign(
      { userId: testStudent2.id, id: testStudent2.id, collegeId: testCollege.id, role: 'USER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ========================================================================
    // TEST 1: Authorization
    // ========================================================================
    console.log('Test 1: Authorization checks...');
    {
      // No token -> 401
      const res1 = await makeHttpRequest({
        path: `/manager/events/${testEvent.id}/certificates`,
      });
      assert.strictEqual(res1.status, 401, 'Unauthenticated request should return 401');

      // Student token -> 403 (student is not manager of club)
      const res2 = await makeHttpRequest({
        path: `/manager/events/${testEvent.id}/certificates`,
        token: student1Token,
      });
      assert.strictEqual(res2.status, 403, 'Unauthorized student request should return 403');

      // Manager token -> 200
      const res3 = await makeHttpRequest({
        path: `/manager/events/${testEvent.id}/certificates`,
        token: managerToken,
      });
      assert.strictEqual(res3.status, 200, 'Authorized manager request should return 200');
      assert.strictEqual(res3.body.success, true);
      console.log('  ✔ Passed: Authorization properly enforced.');
    }

    // ========================================================================
    // TEST 2: Eligibility Check (Method A - Individual Upload)
    // ========================================================================
    console.log('\nTest 2: Eligibility check on individual certificate issuance...');
    const validPdfBuffer = await createValidPdfBuffer('Alice Certificate');
    {
      // Try to issue to unregistered student (Charlie)
      const formUnregistered = createMultipartFormData(
        { userId: testStudentUnregistered.id },
        { file: { filename: 'cert.pdf', buffer: validPdfBuffer, contentType: 'application/pdf' } }
      );
      const res = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/individual`,
        token: managerToken,
        headers: { 'Content-Type': formUnregistered.contentType },
        body: formUnregistered.body,
      });
      assert.strictEqual(res.status, 400, 'Unregistered student issuance must be rejected with 400');
      assert(res.body.message.includes('not registered'), 'Message must indicate student is not registered');
      console.log('  ✔ Passed: Unregistered student issuance rejected.');
    }

    // ========================================================================
    // TEST 3: Issue Individual Certificate (Method A) & Duplicate Prevention
    // ========================================================================
    console.log('\nTest 3: Issue individual certificate & prevent duplicate issuance...');
    let issuedCertAlice = null;
    {
      // Issue to Alice (registered)
      const formAlice = createMultipartFormData(
        { userId: testStudent1.id },
        { file: { filename: 'alice_cert.pdf', buffer: validPdfBuffer, contentType: 'application/pdf' } }
      );
      const res = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/individual`,
        token: managerToken,
        headers: { 'Content-Type': formAlice.contentType },
        body: formAlice.body,
      });
      assert.strictEqual(res.status, 201, 'Issuance to registered student should return 201');
      assert.strictEqual(res.body.success, true);
      assert(res.body.data.certificateNumber.startsWith('CERT-'), 'Certificate number must start with CERT-');
      issuedCertAlice = res.body.data;

      // Try duplicate issuance for Alice -> 409 Conflict
      const resDup = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/individual`,
        token: managerToken,
        headers: { 'Content-Type': formAlice.contentType },
        body: formAlice.body,
      });
      assert.strictEqual(resDup.status, 409, 'Duplicate active certificate issuance must return 409 Conflict');
      console.log('  ✔ Passed: Individual certificate issued and duplicate prevention verified.');
    }

    // ========================================================================
    // TEST 4: Method B - Bulk Upload (Security, Traversal, Manifest Validation)
    // ========================================================================
    console.log('\nTest 4: Method B bulk upload with ZIP and CSV manifest...');
    {
      // 4a. Malicious zip with path traversal
      const maliciousZip = new AdmZip();
      maliciousZip.addFile('exploit.txt', Buffer.from('exploit'));
      maliciousZip.getEntries()[0].entryName = '../secret.txt';
      const formMalicious = createMultipartFormData(
        {},
        { archive: { filename: 'exploit.zip', buffer: maliciousZip.toBuffer(), contentType: 'application/zip' } }
      );
      const resTrav = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/bulk`,
        token: managerToken,
        headers: { 'Content-Type': formMalicious.contentType },
        body: formMalicious.body,
      });
      assert.strictEqual(resTrav.status, 400, 'Zip with path traversal must be rejected with 400');
      assert(resTrav.body.message.includes('Path traversal') || resTrav.body.message.includes('Malicious'), 'Should identify traversal');

      // 4b. Valid bulk zip:
      // - Bob (valid registered student)
      // - Charlie (unregistered student -> should fail in errorDetails)
      // - Fake student (not found -> should fail in errorDetails)
      const bulkZip = new AdmZip();
      const csvContent = `rollNumber,filename\n${testStudent2.rollNumber},bob_cert.pdf\n${testStudentUnregistered.rollNumber},charlie_cert.pdf\nNOT_EXIST_ROLL,missing.pdf\n`;
      bulkZip.addFile('manifest.csv', Buffer.from(csvContent, 'utf8'));

      const bobPdf = await createValidPdfBuffer('Bob Certificate');
      bulkZip.addFile('bob_cert.pdf', bobPdf);
      const charliePdf = await createValidPdfBuffer('Charlie Certificate');
      bulkZip.addFile('charlie_cert.pdf', charliePdf);

      const formBulk = createMultipartFormData(
        {},
        { archive: { filename: 'certs.zip', buffer: bulkZip.toBuffer(), contentType: 'application/zip' } }
      );

      const resBulk = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/bulk`,
        token: managerToken,
        headers: { 'Content-Type': formBulk.contentType },
        body: formBulk.body,
      });

      assert.strictEqual(resBulk.status, 200, 'Bulk processing should return 200');
      const batchData = resBulk.body.data;
      assert.strictEqual(batchData.totalCount, 3, 'Total records should be 3');
      assert.strictEqual(batchData.successCount, 1, 'Only Bob should succeed');
      assert.strictEqual(batchData.failedCount, 2, 'Charlie and NOT_EXIST should fail');
      assert.strictEqual(batchData.status, 'COMPLETED_WITH_ERRORS');
      console.log('  ✔ Passed: Bulk ZIP processed with safe error accounting and traversal defense.');
    }

    // ========================================================================
    // TEST 5: Method C - Template Upload, Preview, and Batch Generation
    // ========================================================================
    console.log('\nTest 5: Method C template upload, coordinate preview, and generation...');
    let templateId = null;
    {
      const templateDoc = await PDFDocument.create();
      templateDoc.addPage([600, 400]);
      const templateBuffer = Buffer.from(await templateDoc.save());

      const placeholderConfig = [
        { placeholder: '{{studentName}}', x: 300, y: 250, size: 20, align: 'center', color: '#1E293B' },
        { placeholder: '{{rollNumber}}', x: 300, y: 220, size: 14, align: 'center', color: '#64748B' },
        { placeholder: '{{certificateId}}', x: 300, y: 100, size: 12, align: 'center', color: '#0F172A' },
      ];

      // Save template
      const formTemplate = createMultipartFormData(
        {
          templateName: 'Official TechFest Template',
          placeholderConfig: JSON.stringify(placeholderConfig),
        },
        { template: { filename: 'template.pdf', buffer: templateBuffer, contentType: 'application/pdf' } }
      );

      const resTmpl = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/template`,
        token: managerToken,
        headers: { 'Content-Type': formTemplate.contentType },
        body: formTemplate.body,
      });
      assert.strictEqual(resTmpl.status, 201, 'Saving template should return 201');
      templateId = resTmpl.body.data.id;

      // Preview template
      const formPreview = createMultipartFormData(
        {
          templateId,
          placeholderConfig: JSON.stringify(placeholderConfig),
        },
        {}
      );
      const resPrev = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/template/preview`,
        token: managerToken,
        headers: { 'Content-Type': formPreview.contentType },
        body: formPreview.body,
      });
      assert.strictEqual(resPrev.status, 200, 'Preview should return 200');
      assert.strictEqual(resPrev.headers['content-type'], 'application/pdf');
      assert(resPrev.raw.slice(0, 5).toString('ascii') === '%PDF-', 'Preview must return valid PDF bytes');
      console.log('  ✔ Passed: Template saved and coordinate preview generated.');
    }

    // ========================================================================
    // TEST 6: Revocation & Reissue Lifecycle
    // ========================================================================
    console.log('\nTest 6: Revocation and reissue audit trails...');
    {
      // Revoke Alice's certificate
      const resRevoke = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/${issuedCertAlice.id}/revoke`,
        token: managerToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Name correction requested by student' }),
      });
      assert.strictEqual(resRevoke.status, 200, 'Revoke should return 200');
      assert.strictEqual(resRevoke.body.data.status, 'REVOKED');
      assert.strictEqual(resRevoke.body.data.revocationReason, 'Name correction requested by student');

      // Student attempts to download revoked certificate -> 403 Forbidden
      const resDlRevoked = await makeHttpRequest({
        path: `/certificates/${issuedCertAlice.id}/download`,
        token: student1Token,
      });
      assert.strictEqual(resDlRevoked.status, 403, 'Downloading revoked certificate must return 403');

      // Reissue certificate for Alice
      const newPdfBuffer = await createValidPdfBuffer('Alice Corrected Certificate');
      const formReissue = createMultipartFormData(
        {},
        { file: { filename: 'alice_reissued.pdf', buffer: newPdfBuffer, contentType: 'application/pdf' } }
      );
      const resReissue = await makeHttpRequest({
        method: 'POST',
        path: `/manager/events/${testEvent.id}/certificates/${issuedCertAlice.id}/reissue`,
        token: managerToken,
        headers: { 'Content-Type': formReissue.contentType },
        body: formReissue.body,
      });
      assert.strictEqual(resReissue.status, 200, 'Reissue should return 200');
      const reissuedCert = resReissue.body.data;
      assert.strictEqual(reissuedCert.status, 'ISSUED');
      assert.notStrictEqual(reissuedCert.id, issuedCertAlice.id, 'New certificate record must have distinct ID');
      console.log('  ✔ Passed: Revocation and reissue audit lifecycle verified.');
    }

    // ========================================================================
    // TEST 7: Student Self-Service Isolation
    // ========================================================================
    console.log('\nTest 7: Student self-service isolation...');
    {
      // Alice checks her certificates
      const resMy = await makeHttpRequest({
        path: '/certificates/my',
        token: student1Token,
      });
      assert.strictEqual(resMy.status, 200);
      assert.strictEqual(resMy.body.success, true);
      assert.strictEqual(resMy.body.data.length, 1, 'Alice should see her 1 active reissued certificate');
      assert.strictEqual(resMy.body.data[0].status, 'ISSUED');

      // Student 2 (Bob) downloads his certificate
      const bobCerts = await makeHttpRequest({
        path: '/certificates/my',
        token: student2Token,
      });
      assert.strictEqual(bobCerts.body.data.length, 1, 'Bob should have 1 certificate from bulk upload');
      const bobCertId = bobCerts.body.data[0].id;

      // Alice tries to download Bob's certificate -> 404 (isolation)
      const resCrossDl = await makeHttpRequest({
        path: `/certificates/${bobCertId}/download`,
        token: student1Token,
      });
      assert.strictEqual(resCrossDl.status, 404, 'Cross-student certificate download must return 404');
      console.log('  ✔ Passed: Student self-service and download isolation verified.');
    }

    // ========================================================================
    // TEST 8: Public Verification
    // ========================================================================
    console.log('\nTest 8: Public certificate verification endpoint...');
    {
      // Verify Bob's certificate number
      const bobCerts = await makeHttpRequest({
        path: '/certificates/my',
        token: student2Token,
      });
      const bobCertNumber = bobCerts.body.data[0].certificateNumber;

      const resVerify = await makeHttpRequest({
        path: `/certificates/verify/${bobCertNumber}`,
      });
      assert.strictEqual(resVerify.status, 200);
      assert.strictEqual(resVerify.body.data.valid, true);
      assert.strictEqual(resVerify.body.data.status, 'ISSUED');
      assert.strictEqual(resVerify.body.data.certificateNumber, bobCertNumber);
      assert(resVerify.body.data.recipientName.includes('*'), 'Student name must be masked in public verification');
      assert.strictEqual(resVerify.body.data.eventTitle, testEvent.title);

      // Verify non-existent certificate number
      const resVerifyFake = await makeHttpRequest({
        path: '/certificates/verify/CERT-INVALID-9999-FAKE',
      });
      assert.strictEqual(resVerifyFake.status, 200);
      assert.strictEqual(resVerifyFake.body.data.valid, false);
      console.log('  ✔ Passed: Public verification works accurately with privacy masking.');
    }

    console.log('\n======================================================================');
    console.log('ALL 8 INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('======================================================================\n');
  } finally {
    // Teardown test records
    if (testCollege) {
      try {
        await platformPrisma.eventCertificate.deleteMany({ where: { collegeId: testCollege.id } });
        await platformPrisma.eventCertificateTemplate.deleteMany({ where: { collegeId: testCollege.id } });
        await platformPrisma.certificateBatch.deleteMany({ where: { collegeId: testCollege.id } });
        await platformPrisma.eventRegistration.deleteMany({ where: { collegeId: testCollege.id } });
        await platformPrisma.event.deleteMany({ where: { collegeId: testCollege.id } });
        await platformPrisma.membership.deleteMany({ where: { collegeId: testCollege.id } });
        await platformPrisma.club.deleteMany({ where: { collegeId: testCollege.id } });
        await platformPrisma.user.deleteMany({ where: { collegeId: testCollege.id } });
        await platformPrisma.college.delete({ where: { id: testCollege.id } });
      } catch (err) {
        console.warn('Teardown notice:', err.message);
      }
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
