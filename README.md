# FundLens Audit

**Demo runs on a constrained hosting tier; full multi-agent runs against complete document sets require longer execution limits.**

Multi-agent adversarial fund documentation auditor. Part of the **FundLens** suite of AI-powered fund operations tools for alternative asset professionals (fund accountants, fund administrators, auditors).

Upload a fund's document set — audited financial statements, capital account statements, LPA key terms — and FundLens Audit runs a team of specialized AI agents that prepare, review, challenge, and synthesize an audit-style findings report, grounded in deterministic, code-verified arithmetic.

## Highlighted features

### Adversarial multi-agent pipeline
Five specialized agents, orchestrated in phases rather than a single monolithic prompt:

| Agent | Role |
|-------|------|
| **Profiler** | Classifies each uploaded document and extracts a structured per-document profile (cached — the same document is never re-profiled) |
| **Preparer** | Reads the raw PDFs plus profiles and produces the cross-document extraction the rest of the pipeline reasons over |
| **Reviewer** | Independently validates the Preparer's work for errors and omissions (ILPA Principles 3.0 aware) |
| **Challenger** | Runs in parallel with the Reviewer; adversarially stress-tests assumptions, valuations, and disclosures against fund-type market benchmarks |
| **Synthesizer** | Acts as an engagement-quality-review (EQR) gate: reconciles contradictions, calibrates severity, and produces the final prioritized findings report |

### Deterministic verification layer (C1–C10)
All arithmetic runs in TypeScript **before any agent reasons** — the model never does mental math. Extracted flows are sign-normalized to magnitude + explicit direction, then a battery of code-backed checks establishes verified ground truth:

- **C1** NAV bridge recomputation (with a sign-artifact guardrail that auto-corrects 2×-flow variances)
- **C2** Section footing (assets, liabilities, income components vs. stated subtotals)
- **C3** Fair-value hierarchy footing with outlier attribution (L1+L2+L3 vs. Note total vs. balance sheet)
- **C4** Balance-sheet equation
- **C5** Capital-account rollforward footing
- **C6** Rollforward table audit (column footing + endpoint ties)
- **C7** Flow-to-balance / cross-period reconciliation
- **C8** Cross-statement consistency
- **C9** Date sequencing (reviewed ≥ prepared)
- **C10** Typo / OCR-quality pass

Every quantitative finding must cite a deterministic check or a vouched figure. A vitest regression suite pins each check to fixtures drawn from real test engagements.

### Extraction transparency & control runs
- **Extraction review pause** — optionally halt the pipeline after extraction so you can tie out the verified figure set before any agent reasons on it (the audit analog of tying out a lead schedule).
- **Control-run mode** — feed the agents a known-good structured extraction (profiler bypass) to isolate agent reasoning quality from extraction quality.
- **Remove & re-upload** per document — recover from a bad extraction without restarting the engagement.

### Engagement workspaces & run persistence
- Named engagements ("Acme Capital Fund III — Annual Review 2025") with strict document isolation between engagements.
- Document library with content-hash deduplication, per-document profiling, and DOCX→PDF conversion.
- Every run is persisted (Neon/Postgres) with its extraction snapshot and verification results, enabling run-over-run regression diffing. Reopen the latest report for any engagement in one click.
- URL-synced client-side navigation — browser back/forward and deep links work, and report links recover from the latest persisted run.

### Audit-grade reporting
- Findings with severity, confidence scores, source citations, agent attribution, and related-finding links.
- Category-level quality scoring, cross-document validation matrix, document-completeness indicator.
- PBC (Prepared-By-Client) list generation with party routing.
- Per-finding status workflow (open / reviewed / accepted risk / resolved).
- PDF and CSV export. Prompt + model version stamped on every run.

### Production hardening
- Per-route rate limiting (Upstash Redis with in-memory dev fallback).
- Streaming agent calls with max-token truncation detection and one-shot JSON correction retries.
- Zod validation on every agent handoff.
- Fund-type-aware prompting (PE / VC / hedge fund / private credit / real estate).

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router), TypeScript strict |
| AI | Claude (Anthropic API) — native PDF ingestion via base64 document blocks, prompt caching across agents, adaptive extended thinking |
| Database | Neon (Postgres) via `@neondatabase/serverless` |
| File storage | Vercel Blob |
| Rate limiting | Upstash Redis |
| Styling | Tailwind CSS with custom design tokens |
| Testing | Vitest |
| Deployment | Vercel |

## Getting started

```bash
npm install
cp .env.local.template .env.local   # fill in secrets (see below)
npm run dev
```

Apply `src/lib/db/schema.sql` to your Neon project once before first run.

### Environment variables

```bash
DATABASE_URL=             # Neon Postgres
BLOB_READ_WRITE_TOKEN=    # Vercel Blob
UPSTASH_REDIS_REST_URL=   # optional — in-memory fallback in dev
UPSTASH_REDIS_REST_TOKEN=
CLOUDCONVERT_API_KEY=     # optional — DOCX→PDF conversion
```

**Anthropic key (BYOK).** There is no server-side Anthropic key. Each user
supplies their own key in the app UI — it is held in that browser tab only
(`sessionStorage`), sent with each request, and never persisted server-side.

### Synthetic test corpus

```bash
node samples/generate.mjs        # all five funds
node samples/generate.mjs vc     # one fund
```

Generates five internally reconciled fictional engagements (PE / VC / HF / credit / real estate), each carrying exactly one documented seeded discrepancy as ground truth for end-to-end evaluation (see `samples/README.md`).

### Tests

```bash
npm run test    # deterministic verification regression suite
```

## Disclaimer

FundLens Audit is an AI-assisted analysis tool. Its output does not constitute an audit, attestation, or assurance engagement under any professional standard, and must be reviewed by a qualified professional before reliance.

## Credits

Built by [Alexander Parlo](https://github.com/alexanderbparlo). Co-authored by **Claude Fable 5** (Anthropic).
