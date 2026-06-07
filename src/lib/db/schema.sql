-- FundLens Audit — Neon (Postgres) schema
-- Run this once against your Neon project after DATABASE_URL is set.
-- Connection pooling is handled by @neondatabase/serverless.

-- ── Documents ─────────────────────────────────────────────────────────────────
-- Each document is stored once in Vercel Blob and profiled once by the Profiler agent.
-- Content-hash deduplication prevents re-processing the same file.

CREATE TABLE IF NOT EXISTS documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash      TEXT        UNIQUE NOT NULL,          -- SHA-256, hex string
  filename          TEXT        NOT NULL,
  file_type         TEXT        NOT NULL,                  -- MIME type
  blob_url          TEXT        NOT NULL,
  file_size_bytes   INTEGER     NOT NULL,
  detected_category TEXT        NOT NULL DEFAULT 'Unknown',
  profile_json      JSONB,                                 -- DocumentProfile, null until profiled
  profiled_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents (content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (detected_category);

-- ── Engagements ───────────────────────────────────────────────────────────────
-- Named groupings: one engagement per fund / review cycle.

CREATE TABLE IF NOT EXISTS engagements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  fund_name       TEXT        NOT NULL,
  fund_type       TEXT        NOT NULL,                    -- FundType enum
  description     TEXT,
  document_ids    UUID[]      NOT NULL DEFAULT '{}',
  audit_job_ids   UUID[]      NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagements_fund_name ON engagements (fund_name);

-- ── Audit jobs ────────────────────────────────────────────────────────────────
-- One row per audit run. Updated in place as each phase completes.

CREATE TABLE IF NOT EXISTS audit_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id       UUID        NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  status              TEXT        NOT NULL DEFAULT 'queued',
  -- status enum: queued | profiling | preparing | reviewing | challenging | synthesizing | complete | failed
  fund_type           TEXT        NOT NULL,
  audit_scope         TEXT        NOT NULL DEFAULT 'full',
  -- audit_scope enum: full | partial
  document_ids        UUID[]      NOT NULL DEFAULT '{}',
  preparer_output     JSONB,
  reviewer_output     JSONB,
  challenger_output   JSONB,
  final_report        JSONB,
  error_message       TEXT,
  prompt_version      TEXT        NOT NULL,
  model_version       TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- Migration: add audit_scope to existing tables
-- Run this if upgrading from a schema version before 1.1.0:
-- ALTER TABLE audit_jobs ADD COLUMN IF NOT EXISTS audit_scope TEXT NOT NULL DEFAULT 'full';

CREATE INDEX IF NOT EXISTS idx_audit_jobs_engagement ON audit_jobs (engagement_id);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON audit_jobs (status);

-- ── Finding status ────────────────────────────────────────────────────────────
-- User-managed status per finding (open / reviewed / accepted_risk / resolved).
-- Finding IDs originate in the final_report JSONB — stored separately for efficient updates.

CREATE TABLE IF NOT EXISTS finding_statuses (
  finding_id  TEXT        NOT NULL,
  job_id      UUID        NOT NULL REFERENCES audit_jobs(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'open',
  note        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (finding_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_finding_statuses_job ON finding_statuses (job_id);

-- ── Updated_at trigger for engagements ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER engagements_updated_at
  BEFORE UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
