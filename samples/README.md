# Synthetic Sample Documents

A compliance-safe, fully **synthetic** fund-document corpus for testing the
FundLens Audit pipeline end to end. Every entity, person, and figure here is
fictional and internally generated. **No real, client, or employer data is ever
used.**

## The corpus

One engagement per fund type, each generated into its own folder:

| Folder | Engagement | Fund type | Docs |
|---|---|---|---|
| `meridian-growth-iii/` | Meridian Growth Partners III | PE | FS (7pp) + capital account + LPA |
| `lumen-ventures-ii/` | Lumen Ventures Fund II | VC | FS (7pp) + capital account + LPA |
| `hadrian-global-macro/` | Hadrian Global Macro Fund | HF | FS (7pp) + offering terms |
| `ironwood-direct-lending-iii/` | Ironwood Direct Lending Fund III | Credit | FS (7pp) + capital account + LPA |
| `cornerstone-real-assets-ii/` | Cornerstone Real Assets Fund II | Real Estate | FS (7pp) + capital account + LPA |

Within each engagement the documents are deliberately cross-referential — NAV /
partners' capital reconciles across the balance sheet and the statement of
changes, the LP capital account ties to fund-level figures pro rata, and the
LPA/offering terms restate the fee, carry, and governance terms that appear in
the financial-statement notes. Each fund's statements use the terminology and
metrics appropriate to its type (TVPI/DPI for VC, high water mark and per-unit
NAV for HF, CECL and non-accrual for Credit, cap rate / NOI / LTV for Real
Estate).

## Seeded discrepancies (ground truth)

Each engagement carries **one** realistic, intentionally seeded error so you have
a known finding to confirm the auditor surfaces. Everything else reconciles.

| Engagement | Seeded discrepancy | Expected category |
|---|---|---|
| **PE** — Meridian Growth III | Schedule of Investments total fair value ($548,400,000) ≠ balance-sheet investments ($550,000,000); $1,600,000 unreconciled. | CrossDocument / InvestmentSchedule |
| **VC** — Lumen Ventures II | LPA + Note 4 disclose a 100% management-fee offset for $1,800,000 of monitoring/director fees received, but the Statement of Operations shows gross management fees of $6,250,000 with no offset applied (should net to $4,450,000). | FeesAndCarry |
| **HF** — Hadrian Global Macro | $5,400,000 incentive fee accrued while NAV per unit ($94.20) is below the $100.00 perpetual high water mark — no incentive fee should accrue below the HWM. | FeesAndCarry |
| **Credit** — Ironwood DL III | Note 5 discloses a $4,200,000 ASC 326 (CECL) allowance "presented as a reduction of loans," but loans on the balance sheet are $238,200,000 (gross amortized cost) with no allowance deducted and no provision in operations (should be $234,000,000). | GAAP_ASC946 / NAV |
| **Real Estate** — Cornerstone II | Harbor Point Logistics Center carried at $92,000,000, but Note 4 discloses a December 2024 appraisal of $84,000,000 — the $8,000,000 difference was not reflected (no markdown). | NAV / CrossDocument |

A correct Reviewer/Challenger pass should flag each as a finding in (roughly) the
category noted.

## Generating

```bash
node samples/generate.mjs            # all five engagements
node samples/generate.mjs vc         # one engagement by fund type
node samples/generate.mjs hadrian    # or by slug substring
```

Output goes to `samples/<slug>/`. The generator is dependency-free — a minimal
PDF writer lives in `samples/lib/pdf.mjs` — so it runs with plain Node, no
Playwright, Chromium, or npm install required. The produced PDFs are text-based
and read cleanly as Anthropic document blocks.

## Using in the app

1. Generate the PDFs (above).
2. Create an engagement and pick the matching fund type (e.g. *Hadrian Global
   Macro Fund — Annual Review 2024*, fund type **HF**).
3. Upload that engagement's PDFs in the Library, let each profile, then run a
   **full** audit over the set.
4. Confirm the report flags that engagement's seeded discrepancy.

## Layout

```
samples/
  generate.mjs          # iterates all fund modules
  lib/
    pdf.mjs             # minimal dependency-free PDF writer
    format.mjs          # usd / usd2 / pct helpers
  funds/
    pe.mjs  vc.mjs  hf.mjs  credit.mjs  realestate.mjs
  <slug>/               # generated output, one folder per engagement
```

## Extending

Each `funds/*.mjs` default-exports `{ slug, name, fundType, seeded, build() }`,
where `build()` returns `[ [filename, Buffer], … ]`. To add another engagement,
copy the closest fund module, adjust the figures and terminology, and add the
import to the `FUNDS` array in `generate.mjs`. Keep all data synthetic and keep
exactly one documented seeded discrepancy per engagement so each fixture stays
useful as a regression check.
