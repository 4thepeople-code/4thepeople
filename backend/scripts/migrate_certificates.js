const { PrismaClient } = require('@prisma/client');

const migratorUrl = 'postgresql://migrator:YuvaMigratorProd2026_Secure99%21@ep-delicate-truth-aooct0mf.c-2.ap-southeast-1.aws.neon.tech/yuva_prod?sslmode=require';

const migratorPrisma = new PrismaClient({
  datasources: {
    db: {
      url: migratorUrl,
    },
  },
});

async function migrateCertificates() {
  console.log('--- Starting Event Certificates Database Migration (as migrator) ---');

  const sqlStatements = [
    // 1. Create Enums if they do not exist
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificate_source_enum') THEN
        CREATE TYPE certificate_source_enum AS ENUM ('INDIVIDUAL_UPLOAD', 'BULK_UPLOAD', 'GENERATED');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificate_status_enum') THEN
        CREATE TYPE certificate_status_enum AS ENUM ('ISSUED', 'REVOKED');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificate_batch_status_enum') THEN
        CREATE TYPE certificate_batch_status_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificate_batch_method_enum') THEN
        CREATE TYPE certificate_batch_method_enum AS ENUM ('BULK_UPLOAD', 'GENERATED');
      END IF;
    END $$;`,

    // 2. Create certificate_batches table
    `CREATE TABLE IF NOT EXISTS certificate_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
      event_id UUID NOT NULL,
      method certificate_batch_method_enum NOT NULL,
      status certificate_batch_status_enum NOT NULL DEFAULT 'PENDING',
      total_count INT NOT NULL DEFAULT 0,
      success_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      skipped_count INT NOT NULL DEFAULT 0,
      error_details JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by_id UUID NOT NULL,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      CONSTRAINT fk_batches_event FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE,
      CONSTRAINT fk_batches_creator FOREIGN KEY (college_id, created_by_id) REFERENCES users(college_id, id) ON DELETE CASCADE,
      CONSTRAINT uq_certificate_batches_college_id UNIQUE (college_id, id)
    );`,

    // 3. Create event_certificate_templates table
    `CREATE TABLE IF NOT EXISTS event_certificate_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
      event_id UUID NOT NULL,
      template_name VARCHAR(255) NOT NULL,
      template_public_id VARCHAR(255) NOT NULL,
      template_url TEXT NOT NULL,
      placeholder_config JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by_id UUID NOT NULL,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      CONSTRAINT fk_cert_templates_event FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE,
      CONSTRAINT fk_cert_templates_creator FOREIGN KEY (college_id, created_by_id) REFERENCES users(college_id, id) ON DELETE CASCADE
    );`,

    // 4. Create event_certificates table
    `CREATE TABLE IF NOT EXISTS event_certificates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
      event_id UUID NOT NULL,
      user_id UUID NOT NULL,
      certificate_number VARCHAR(100) NOT NULL UNIQUE,
      certificate_public_id VARCHAR(255),
      certificate_url TEXT,
      source certificate_source_enum NOT NULL DEFAULT 'INDIVIDUAL_UPLOAD',
      status certificate_status_enum NOT NULL DEFAULT 'ISSUED',
      issued_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      issued_by_id UUID,
      revoked_at TIMESTAMPTZ(6),
      revoked_by_id UUID,
      revocation_reason TEXT,
      batch_id UUID,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      CONSTRAINT fk_certificates_event FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE,
      CONSTRAINT fk_certificates_user FOREIGN KEY (college_id, user_id) REFERENCES users(college_id, id) ON DELETE CASCADE,
      CONSTRAINT fk_certificates_batch FOREIGN KEY (college_id, batch_id) REFERENCES certificate_batches(college_id, id) ON DELETE SET NULL,
      CONSTRAINT fk_certificates_issuer FOREIGN KEY (college_id, issued_by_id) REFERENCES users(college_id, id) ON DELETE SET NULL,
      CONSTRAINT fk_certificates_revoker FOREIGN KEY (college_id, revoked_by_id) REFERENCES users(college_id, id) ON DELETE SET NULL
    );`,

    // 5. Partial unique index to prevent duplicate active certificates for same event & student
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_active_cert_per_event_user
      ON event_certificates(college_id, event_id, user_id)
      WHERE status = 'ISSUED';`,

    // 6. Helpful indexes for performance
    `CREATE INDEX IF NOT EXISTS idx_event_certificates_college_event ON event_certificates(college_id, event_id);`,
    `CREATE INDEX IF NOT EXISTS idx_event_certificates_college_user ON event_certificates(college_id, user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_event_certificates_status ON event_certificates(college_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_certificate_batches_event ON certificate_batches(college_id, event_id);`,
    `CREATE INDEX IF NOT EXISTS idx_cert_templates_event ON event_certificate_templates(college_id, event_id);`,

    // 7. Enable and enforce RLS
    `ALTER TABLE certificate_batches ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE certificate_batches FORCE ROW LEVEL SECURITY;`,
    `ALTER TABLE event_certificate_templates ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE event_certificate_templates FORCE ROW LEVEL SECURITY;`,
    `ALTER TABLE event_certificates ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE event_certificates FORCE ROW LEVEL SECURITY;`,

    // 8. Create tenant isolation policies
    `DO $$ BEGIN
      DROP POLICY IF EXISTS tenant_isolation_certificate_batches ON certificate_batches;
      CREATE POLICY tenant_isolation_certificate_batches ON certificate_batches
        FOR ALL TO app_user
        USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
        WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);
    END $$;`,

    `DO $$ BEGIN
      DROP POLICY IF EXISTS tenant_isolation_event_certificate_templates ON event_certificate_templates;
      CREATE POLICY tenant_isolation_event_certificate_templates ON event_certificate_templates
        FOR ALL TO app_user
        USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
        WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);
    END $$;`,

    `DO $$ BEGIN
      DROP POLICY IF EXISTS tenant_isolation_event_certificates ON event_certificates;
      CREATE POLICY tenant_isolation_event_certificates ON event_certificates
        FOR ALL TO app_user
        USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
        WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);
    END $$;`,

    // 9. Grant permissions to app_user and platform_ops
    `GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_batches, event_certificate_templates, event_certificates TO app_user, platform_ops;`
  ];

  for (const sql of sqlStatements) {
    console.log(`Executing: ${sql.slice(0, 60).replace(/\n/g, ' ')}...`);
    await migratorPrisma.$executeRawUnsafe(sql);
  }

  console.log('--- Migration completed successfully! ---');
  await migratorPrisma.$disconnect();
  process.exit(0);
}

migrateCertificates().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
