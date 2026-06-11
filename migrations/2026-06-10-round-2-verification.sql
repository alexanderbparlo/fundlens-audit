-- Round-2 fixes: deterministic verification layer + control-run mode.
-- Apply with: node scripts/apply-migration.mjs migrations/2026-06-10-round-2-verification.sql

-- Track D: persist the code-computed verification snapshot (verified figure set
-- + clerical/mathematical exception list) alongside each run, enabling
-- run-over-run regression diffing and profiler-vs-agent attribution.
ALTER TABLE audit_jobs ADD COLUMN IF NOT EXISTS verification jsonb;

-- Track C: control-run mode — the run was started from a known-good structured
-- extraction (profiler/preparer bypass), isolating agent reasoning from
-- profiler quality.
ALTER TABLE audit_jobs ADD COLUMN IF NOT EXISTS control_run boolean NOT NULL DEFAULT false;
