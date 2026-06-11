# FundLens Audit — Round 2 Remediation Handoff

**Purpose:** Implementation spec for fixes identified during Round 2 performance testing.
**Audience:** Claude Code.
**Source:** Four assessed engagements — HF (Apex, clean), Multi-Strategy (Ironwood, flawed), PE (Bridgepoint, flawed), VC (Sequoia, clean).

---

## 1. Root cause

Across all four engagements the agents' *reasoning* and *calibration* were strong (correct fund-type classification in PE/VC, rounding tolerance, fund-type-aware Level 3 judgment, scope framing, PBC routing, domain valuation skepticism). The defects cluster in the **deterministic/extraction layer feeding the agents**, which exhibits one consistent failure:

> The agents accept an extracted figure as ground truth without footing, vouching, or recomputing it, then base the rest of the audit on it.

Two upstream causes:

1. **Profiler extraction** — signs are captured as displayed (e.g. distributions as `−10,100`) rather than normalized to a canonical convention, and itemized line items are dropped (asset lines, liability lines, income-statement components).
2. **Missing deterministic checks** — even when data *is* extracted, there is no code-backed check that foots it, cross-foots it, or ties it across statements/periods.

The fix has two headline workstreams plus three supporting tracks.

---

## 2. Workstream A — Deterministic Verification Layer (Preparer pre-step) — **P0**

A code-backed pass that runs in TypeScript **before any LLM reasoning in the Preparer agent**. It establishes verified ground truth once, so the Preparer, Reviewer, and Challenger all reason on verified numbers — never on raw extraction. Clerical/mathematical verification **must not** live in the Synthesis agent: by then the agents have already built on the bad figure.

**Hard constraint:** all arithmetic in this layer is executed in code, not by the model. LLM mental math on the NAV bridge is the current bug; do not reintroduce it.

**Inputs:** normalized extraction.
**Outputs:** (a) a *verified figure set* and (b) a *clerical/mathematical exception list*, both passed downstream to the Preparer.

### Sign normalization (prerequisite for everything below)

Normalize every flow at the extraction→verification boundary to magnitude + explicit direction (e.g. `{amount: 10100, direction: "outflow"}`). Bridge/recon formulas operate on direction, never on a raw signed value. This single change removes the double-count that appeared in all four NAV bridges.

### Checks

| ID | Check | Logic | Status |
|----|-------|-------|--------|
| C1 | NAV bridge | Recompute ending NAV from normalized flows; compare to stated ending. **Guardrail:** if variance ≈ 2× a single extracted flow, treat as a sign artifact, auto-correct, and demote rather than escalate. | New / fixes existing D-003/D-005 |
| C2 | Section footing | Sum line items to their stated subtotal: assets→Total Assets; liabilities→Total Liabilities; income components→Net Increase from Operations. | New (requires line-item extraction) |
| C3 | FV hierarchy footing | Sum L1+L2+L3; compare to **both** the Note 2 stated total **and** the balance-sheet investments line. Attribute the break to whichever figure is the outlier. | New / fixes existing FV check |
| C4 | Balance-sheet equation | Assets = Liabilities + Capital. | Keep (works) — **must not suppress C2** |
| C5 | Capital-account rollforward | Foot LP rollforward: beginning + contributions − distributions + allocated income = ending. | Keep / generalize (D-004 works) |
| C6 | Rollforward table audit | (a) Internal footing of each rollforward column; (b) endpoints tie to holdings/balance subtotals. | New |
| C7 | Flow-to-balance / cross-period | Period flows reconcile to period-over-period balance changes (e.g. period capital calls = Δ cumulative called). | New |
| C8 | Cross-statement consistency | Statement-of-Changes ending capital = Balance-Sheet capital. | New |
| C9 | Date sequencing | Reviewed date ≥ prepared date. | Keep (works, D-006) |
| C10 | Typo / OCR-quality pass | Deterministic low-severity surfacing of misspellings in extracted text. | New (currently inconsistent) |

**Note on C2 ⊄ C4:** the HF engagement balanced at the totals level (C4 passes) while the asset *line items* did not foot (C2 fails). C4 passing must never short-circuit C2.

---

## 3. Workstream B — Synthesis-as-EQR gate — **P1**

The Synthesis agent acts as an engagement-quality-review (EQR) partner: a final coherence and calibration check over already-verified work. It does **not** perform primary footing.

- **Coherence:** no finding may contradict another. (VC: F-002 escalated a sign artifact on the NAV bridge while F-003 correctly diagnosed the identical artifact on liabilities — the EQR gate must reconcile these to one consistent treatment.)
- **Calibration:** cap severity for metrics that cannot be independently recomputed. (VC: an 18.4% IRR vs 1.16x TVPI tension is unverifiable without dated cash flows → WARNING, not CRITICAL.) Distinguish *recomputable internal inconsistency* (may be CRITICAL — e.g. Ironwood TVPI ≠ DPI + RVPI) from *plausibility tension on an unverifiable figure* (WARNING).
- **Provenance:** every quantitative finding must cite a deterministic check (C1–C10) or a vouched figure.

---

## 4. Supporting tracks

### Track C — Profiler / extraction transparency — **P1**
- Add **remove & re-upload** per audit-support document (don't force an engagement restart on a bad extraction).
- Add an **extraction-review surface**: show the user the normalized values the profiler captured before the agents run (audit analog: tie out the lead schedule). Also the instrument for attributing profiler-vs-check error.
- Add a **control-run mode** that feeds the agents a known-good structured extraction (profiler bypass) — isolates agent reasoning from profiler quality for test runs.

### Track D — Run persistence (Neon) — **P2**
- Persist the **latest run per engagement** (last-write-wins, or versioned for history).
- Persist the **extraction snapshot + verified figure set** alongside the findings, not just the output. Enables run-over-run regression diffing and retroactive profiler-vs-agent attribution.

### Track E — Navigation — **P2**
- Client-side routing (Next.js `router.push` / `Link`); persistent launch/home control + breadcrumb; no hard refresh to return to the launch page.

---

## 5. Sequencing

1. **P0:** Sign normalization + C1; section/FV footing C2/C3 (largest share of real misses). Requires the profiler to retain itemized line items.
2. **P0/P1:** Remainder of Workstream A — C6 (rollforward), C7 (flow-to-balance), C8 (cross-statement), C10 (typo).
3. **P1:** Workstream B EQR gate; Track C extraction-review (needed to de-confound future test rounds).
4. **P2:** Track D persistence; Track E navigation (bundle into the same PR series — low effort).

---

## 6. Regression suite

Each check ships with the cases below drawn from the four engagements. Expected values assume **fixed** sign normalization and line-item extraction.

### C1 — NAV bridge (normalized signs)
| Engagement | Correct computation | Stated | Expected variance | Buggy output (pre-fix) |
|-----------|--------------------|--------|-------------------|------------------------|
| HF (Apex) | 152,840 + 12,500 − 18,810 + 30,595 | 177,125 | **0** | — |
| PE (Bridgepoint) | 152,840 + 12,500 − 18,810 + 31,095 | 177,625 | **0** | −37,620 |
| Ironwood | 285,100 + 15,000 − 8,200 − 4,200 + 22,400 | 312,500 | **−2,400** (genuine; likely missing realized line) | −22,400 |
| VC (Sequoia) | 271,440 − 10,100 + 13,280 + 12,200 − 2,300 | 284,720 | **−200** (genuine) | −24,600 |

Guardrail test: Ironwood/PE/VC pre-fix variances each equaled 2× a single flow → must auto-flag as sign artifact. The VC **−200** and Ironwood **−2,400** are *not* 2× any single flow → must surface as genuine exceptions (not suppressed).

### C2 — Section footing
| Engagement | Section | Sum of items | Stated subtotal | Expected exception |
|-----------|---------|-------------|-----------------|--------------------|
| HF | Assets | 204,015 | 203,915 | +100 |
| PE | Assets | 204,015 | 203,515 | +500 |
| PE | Operations (NII −3,495 + Net Gain 34,090) | 30,595 | 31,095 | +500 (root cause of the cross-statement break) |

### C3 — FV hierarchy footing
| Engagement | L1+L2+L3 | Note 2 stated total | BS investments | Expected attribution |
|-----------|----------|--------------------|-----------------|--------------------|
| PE | 187,450 | 188,200 | 187,450 | Components **tie to BS**; the **stated Note 2 total (188,200) is the outlier**, +750. (Pre-fix mischaracterized the components as 188,200.) |

### C4 — Balance-sheet equation
| Engagement | Assets | Liab + Capital | Expected |
|-----------|--------|----------------|----------|
| PE | 203,515 | 203,915 | −400 exception |
| HF | 203,915 | 203,915 | Balances — **but C2 must still flag the asset footing** |

### C6 — Rollforward audit
| Engagement | Column foot | Stated end | Exception | Endpoint tie |
|-----------|------------|-----------|-----------|--------------|
| Ironwood | 248,100 + 15,000 − 8,200 + 22,400 = 277,300 | 279,100 | +1,800 | opening 248,100 vs Q3 L3 207,000; ending 279,100 vs Q4 L3 228,400 → disconnect |
| VC | 253,240 − 12,200 + 13,280 = 254,320 | 264,900 | +10,580 | opening 253,240 vs Q3 L3 271,240; ending 264,900 vs Q4 L3 284,720 → disconnect (off by liability amounts) |

### C7 — Flow-to-balance
| Engagement | Condition | Expected |
|-----------|-----------|----------|
| Ironwood | Q4 calls 15,000 but cumulative called flat 290,000 → 290,000 | **Exception** (was a false PASS / 10-10) |
| VC | No Q4 calls, cumulative called flat 285,500 → 285,500 | **PASS** (true negative — must not flag) |

### C8 — Cross-statement consistency
| Engagement | SoC ending | BS capital | Expected |
|-----------|-----------|-----------|----------|
| PE | 177,625 | 177,125 | −500 exception (ties to C2 operations +500) |

### C9 — Date sequencing
| Engagement | Reviewed | Prepared | Expected |
|-----------|----------|----------|----------|
| PE | 2024-02-09 | 2024-02-14 | Exception (reviewed precedes prepared) |
| HF | 2024-02-21 | 2024-02-14 | PASS |

### C10 — Typo / OCR
| Engagement | Tokens | Expected |
|-----------|--------|----------|
| PE | "Decmber", "PAFORMANCE", "substntial" | Surface (low severity) |
| Ironwood | "Mangement" | Surface (low severity) |

### EQR (Workstream B)
| Case | Expected EQR action |
|------|--------------------|
| VC IRR 18.4% vs TVPI 1.16x (unverifiable) | Cap severity at WARNING, not CRITICAL |
| VC F-002 (bridge sign artifact) vs F-003 (liability sign artifact) | Reconcile to one consistent treatment |
| Ironwood TVPI ≠ DPI + RVPI (recomputable) | May remain CRITICAL |

---

## 7. Preserve (do not regress)

These behaviors worked and must survive the refactor:

- Cross-document NAV reasoning (PE three-NAV reconciliation; VC IRR/TVPI logic).
- Domain valuation skepticism (VC above-cost marks through the 2022–2023 correction; coverage-gap **range** framing).
- Fund-type-aware Level 3 judgment (flag 87% L1 in PE as unusual; do **not** flag 100% L3 in VC).
- Rounding-tolerance calibration (VC TVPI 1.166 vs stated 1.16 → PASS within tolerance).
- Partial-audit scope framing; PBC party-routing (Administrator / Auditor / GP / Legal Counsel); content-completeness-within-document vs missing-document-type distinction.
- The sign-artifact **hedging** logic that fired correctly in HF/PE/VC-F003 — the goal is to make it fire **deterministically** via C1's guardrail, not to remove it.

---

## 8. Known caveat on Round 2 scores

A meaningful share of this round's misses trace to profiler extraction (sign handling, dropped line items) rather than agent reasoning. Treat Round 2 scores (HF 8, Ironwood 6.5, PE 7, VC 6.5) as a **floor** on agent quality, not a ceiling. The Track C control-run is the clean way to re-baseline agent reasoning independent of the profiler after these fixes land.
