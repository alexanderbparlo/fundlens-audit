# FundLens Audit — Round-3 Control-Run Assessment (2026-07-07)

**Verdict: PASS across all three owed engagements. Round-3 validation complete for all four fund types.**
Method: Track C control-run (profiler bypassed, known-good extraction injected). Scored against the
Round-3 Control-Run Assessment Kit. Deterministic layer previously confirmed (vitest 33/33); HF agent
layer confirmed 2026-06-10. This closes VC / Multi / PE.

| Engagement | Kit pass bar | Result | MUST-FIND | MUST-NOT | PRESERVE | EQR |
|---|---|---|---|---|---|---|
| VC (Sequoia) | ≥ 8.5 | **PASS** | all hit | all avoided | intact | coherent |
| Multi (Ironwood) | ≥ 8.0 | **PASS** | all hit | all avoided | intact | coherent |
| PE (Bridgepoint) | ≥ 8.5 | **PASS** | all hit | all avoided | intact | coherent |

---

## VC — Sequoia Growth Fund VI (10 findings)

**MUST-FIND**
- C1 −200 genuine → **F-001** (D-007 FAIL, +200 residual, treated as undisclosed bridge component, not suppressed). ✓
- C6 +10,580 disconnect → **F-002** (D-008 FAIL; also the 19,820 rollforward-vs-FV gap). ✓
- Concentration / mark-reliance → **F-009** (DataCore ~14%, Nexus ~13%, top-5 ≈ half of NAV). ✓
- Investment-period status, 2018 vintage → **F-004 / F-008**. ✓

**MUST-NOT (round-1 false negatives — must be gone)**
- XYZ Valuation Services false negative → **fixed**. F-003 states the firm is disclosed at >80% scope and
  reasons about the ~20% (~57,000) GP-marked remainder. ✓✓
- TVPI/DPI/RVPI "not disclosed" → **fixed**. F-005 treats all four metrics as present. ✓✓
- Sign double-count (−24,600) → **absent**. ✓

**PRESERVE**
- 100% L3 not flagged as improper (F-003 uses it as disclosure context). ✓
- Rounding tolerance (1.166→1.16) not false-flagged. ✓
- IRR (18.4%) vs TVPI (1.16x) tension explicitly capped at WARNING per D-018 ceiling (F-005). ✓✓

**EQR** — F-002/F-010 handle the 19,820 coincidence consistently (both defer to D-019 PASS: no NAV error);
all quantitative findings cite D-checks.

---

## Multi — Ironwood Multi-Strategy Fund II (12 findings)

**MUST-FIND**
- C1 −2,400 genuine → **F-003** (D-007, +2,400, not suppressed). ✓
- C6 +1,800 + endpoint disconnect → **F-004** (D-008; correctly flags D-009/D-010 unable_to_verify rather
  than over-asserting the 279,100-vs-228,400 gap). ✓
- **C7 cumulative-called-flat canary → F-002 (CRITICAL).** Round-1 gave this a false 10/10 PASS; now caught. ✓✓
- TVPI≠DPI+RVPI recomputable → **F-001 (CRITICAL)** (D-014 1.26 vs 1.31; D-015 DPI 0.145 vs 0.18; D-017
  TVPI 1.222 vs 1.31; notes all three break manager-favorable). ✓✓
- "Mangement" typo → **F-011** (D-021, informational). ✓

**MUST-NOT**
- Sign double-count (−22,400) → **absent** (F-003 computes +2,400). ✓
- TVPI/DPI/RVPI as undisclosed → **avoided** (F-001 recomputes from stated values). ✓

**PRESERVE**
- Fund-type-aware L3 handling (~73% L3) (F-006). ✓
- Rounding tolerance — RVPI 1.078 vs 1.08 PASS (D-016), no false flag. ✓
- Bonus: **F-010** independently flagged the HF-label-vs-drawdown-mechanics tension — validates the
  `fundType: HF` mapping caveat. Handled as an INFORMATIONAL classification note, not an error.

**EQR** — F-001/F-002/F-003 cross-reference coherently (called-capital base links F-002→F-001; NAV residual
links F-003→multiples); severity ladder correct (recomputable→CRITICAL, unverifiable IRR→WARNING, typo→INFO).

---

## PE — Bridgepoint PE Fund III (13 findings; 3-doc set)

**MUST-FIND**
- C2 assets +500 → **F-001** (D-003). ✓
- C2 operations +500 → **F-002** (D-005). ✓
- C3 Note-2 total outlier +750, components tie to BS → **F-003** (D-006; break attributed to the stated
  188,200 total, **not** the 187,450 components). ✓✓
- C4 −400 balance-sheet equation → **F-001** (D-002; "a C4 pass never clears a C2 fail" applied). ✓
- C8 −500 cross-statement, ties to ops → **F-002** (D-011; two ending NAVs 177,625 vs 177,125). ✓
- C9 reviewed-before-prepared → **F-005** (D-012, 2024-02-09 < 2024-02-14). ✓
- CAS-vs-FS cross-document mismatch → **F-009** (142,840 vs 152,840; 156,520 vs 177,625), with **F-011**
  correctly explaining the single-LP-coverage gap as expected, not an integrity break. ✓✓
- Typos → **F-012** (Decmber, Paformance detected). ✓ (see nit below)

**MUST-NOT**
- Sign double-count (−37,620) → **absent**. F-013 foots the bridge to 177,625 (PASS). ✓✓
- FV components mischaracterized as 188,200 → **avoided** (F-003 attributes to stated total). ✓✓
- C2 suppressed when C4 passes → **avoided** (both surfaced as independent breaks). ✓

**PRESERVE**
- 87% L1 flagged as unusual for PE → **F-008**, and **capped at WARNING** as interpretive despite the
  Challenger escalating to CRITICAL — exactly the round-2 §7 calibration behavior. ✓✓
- PBC routing to GP/management in recommendations. ✓

**EQR** — **F-002 explicitly merges Reviewer R-002/R-003 + Challenger C-002** into one treatment
(operations→equity propagation): the coherence gate deduplicating a propagating error. Calibration:
deterministic recomputable → CRITICAL; interpretive plausibility → WARNING. Provenance intact.

---

## Consolidated defect list

**Agent-reasoning defects: none.** No sign double-count, no round-1 false negatives, no suppressed checks,
no miscalibrated severities on the recomputable breaks, EQR coherence + calibration both working. Nothing
here warrants remediation-design capacity.

**Cosmetic / low-priority (Claude Code, not Fable):**
1. **Presentation/typo check calibration.** Over-triggers on legitimate domain vocabulary ("financing" in
   VC F-007; "committee"→"committed" in PE F-012) and missed "substntial" in the PE workpaper. Self-hedged
   and informational-only; typo detection is out of the round-3 agent-reasoning scope by design. Low priority.
2. **Deterministic check-ID stability.** Typo checks surface as `D-021` in VC/Multi but `D-014/D-015/D-016`
   in PE — IDs appear to shift with document count/fund type. Findings cite these IDs, so unstable numbering
   is a minor provenance/traceability nit worth a look. Cosmetic, not blocking.
3. **One hot severity (single data point).** Multi F-003 rates the +2,400 (0.77% of NAV) bridge residual
   CRITICAL; WARNING would be defensible. Not a pattern — no action unless it recurs.

**Already logged (prior session):** control-run citation-normalize — make review/challenge routes backfill
missing citation keys with null + documentId/documentName from engagement documents, so control-runs don't
depend on an injected citation scaffold. Route-level normalize, not a schema loosening. Claude Code item.

---

## Close-out

Round-3 validation is complete and successful for HF / VC / Multi / PE. The round-2 architectural fix
(deterministic C1–C10 layer, EQR gate, sign normalization) is validated end-to-end at the agent layer.
fundlens-audit's performance-testing loop is closed. Remaining items are cosmetic and belong in a Claude
Code cleanup pass, not a frontier-model remediation session.

*Open decision for the operator: whether to keep Ironwood on the `HF` fundType lane (the classification
tension was handled correctly as-is) or re-run it on the PE lane to remove the F-010 classification note.*
