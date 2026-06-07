import type { AuditJob, Engagement, Finding, FindingStatus } from '@/types'
import { FINDING_STATUS_LABELS, FUND_TYPE_LABELS, SEVERITY_LABELS } from '@/lib/utils'

/** Escape text for safe interpolation into HTML. */
function esc(value: string | number | null | undefined): string {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Light-theme severity colors for print (ink-friendly, not the dark-UI tokens).
const SEV_PRINT: Record<string, string> = {
  critical:      '#b42318',
  warning:       '#b45309',
  informational: '#475467',
  pass:          '#067647',
}

function findingBlock(finding: Finding, status: FindingStatus): string {
  const sources = finding.sourceCitations.length
    ? `<div class="cites">${finding.sourceCitations.map(c => `
        <div class="cite">
          <span class="cite-doc">${esc(c.documentName)}</span>${c.page != null ? ` · p.${esc(c.page)}` : ''}${c.section ? ` · ${esc(c.section)}` : ''}
          ${c.excerpt ? `<div class="cite-ex">“${esc(c.excerpt)}”</div>` : ''}
        </div>`).join('')}</div>`
    : ''
  return `
    <div class="finding">
      <div class="finding-head">
        <span class="sev" style="color:${SEV_PRINT[finding.severity]}">${esc(SEVERITY_LABELS[finding.severity])}</span>
        <span class="tag">${esc(finding.category)}</span>
        <span class="tag">${esc(finding.confidence)} confidence</span>
        <span class="tag status-${esc(status)}">${esc(FINDING_STATUS_LABELS[status])}</span>
        ${finding.requiresHumanVerification ? '<span class="verify">Requires verification</span>' : ''}
        <span class="fid">${esc(finding.id)}</span>
      </div>
      <p class="finding-desc">${esc(finding.description)}</p>
      <div class="rec"><span class="rec-label">Recommendation</span> ${esc(finding.recommendation)}</div>
      ${sources}
    </div>`
}

/**
 * Build a complete, light-themed, print-optimized HTML document for an audit report.
 * Intended to be opened in a new window and sent to the browser's "Save as PDF".
 */
export function reportToPrintableHtml(
  job: AuditJob,
  engagement: Engagement | null,
  statusMap: Record<string, FindingStatus> = {},
): string {
  const report = job.finalReport
  if (!report) return '<!doctype html><title>No report</title><p>No report available.</p>'

  const title = engagement?.name ?? 'FundLens Audit Report'
  const fundLabel = engagement ? FUND_TYPE_LABELS[engagement.fundType] : ''

  const sortedFindings = [...report.findings].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, informational: 2, pass: 3 }
    return order[a.severity] - order[b.severity]
  })

  const riskMatrix = report.riskMatrix.length ? `
    <h2>Risk Matrix</h2>
    <table class="matrix">
      <thead><tr><th>Category</th><th>Critical</th><th>Warning</th><th>Info</th><th>Pass</th></tr></thead>
      <tbody>
        ${report.riskMatrix.map(r => `<tr>
          <td>${esc(r.category)}</td>
          <td class="num">${r.critical || '—'}</td>
          <td class="num">${r.warning || '—'}</td>
          <td class="num">${r.informational || '—'}</td>
          <td class="num">${r.pass || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''

  const crossDoc = report.crossDocumentValidations.length ? `
    <h2>Cross-Document Checks</h2>
    ${report.crossDocumentValidations.map(v => `
      <div class="xdoc">
        <div class="xdoc-head"><strong>${esc(v.check)}</strong>
          <span class="sev" style="color:${SEV_PRINT[v.severity]}">${esc(SEVERITY_LABELS[v.severity])}</span></div>
        <div class="xdoc-grid">
          <div><span class="lbl">Expected</span> ${esc(v.expected)}</div>
          <div><span class="lbl">Found</span> ${esc(v.found)}</div>
        </div>
        ${v.variance ? `<div class="variance">Variance: ${esc(v.variance)}</div>` : ''}
      </div>`).join('')}` : ''

  const pbc = report.pbcList.length ? `
    <h2>PBC Document Requests</h2>
    <ul class="pbc">
      ${report.pbcList.map(p => `<li><span class="pbc-pri pri-${esc(p.priority)}">${esc(p.priority)}</span>
        ${esc(p.description)} <span class="pbc-from">— ${esc(p.requestedFrom)}</span></li>`).join('')}
    </ul>` : ''

  const nextSteps = report.recommendedNextSteps.length ? `
    <h2>Recommended Next Steps</h2>
    <ol class="steps">
      ${[...report.recommendedNextSteps].sort((a, b) => a.priority - b.priority)
        .map(s => `<li>${esc(s.action)} <span class="urgency">${esc(s.urgency.replace('_', ' '))}</span></li>`).join('')}
    </ol>` : ''

  const completeness = report.documentSetCompleteness ? `
    <h2>Document Set</h2>
    <p>${esc(report.documentSetCompleteness.completenessNote)}</p>
    ${report.documentSetCompleteness.missing.length
      ? `<p class="missing"><strong>Recommended but not provided:</strong> ${report.documentSetCompleteness.missing.map(esc).join(', ')}</p>`
      : ''}` : ''

  const categoryScores = report.categoryScores.length ? `
    <div class="cat-scores">
      ${report.categoryScores.map(c => `<div class="cat"><span class="cat-name">${esc(c.category)}</span><span class="cat-val">${esc(c.score)}/10</span></div>`).join('')}
    </div>` : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)} — FundLens Audit</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1f2e; line-height: 1.5; margin: 0; font-size: 11pt; }
  .meta, .tag, .sev, .num, .fid, table, .urgency, .pbc-pri { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
  header { border-bottom: 2px solid #1a1f2e; padding-bottom: 14px; margin-bottom: 20px; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 8pt; color: #6b7785; font-family: -apple-system, sans-serif; }
  h1 { font-size: 20pt; margin: 4px 0 6px; }
  .meta { font-size: 9pt; color: #475467; }
  .meta span { margin-right: 16px; }
  .scope { margin: 14px 0; padding: 8px 12px; border: 1px solid #b45309; background: #fffaf0; font-size: 9.5pt; color: #7a4a08; }
  .overview { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin: 18px 0; padding: 14px 16px; border: 1px solid #d0d5dd; background: #f9fafb; }
  .overview .risk { text-transform: uppercase; font-size: 16pt; font-weight: bold; }
  .overview .score { font-size: 16pt; font-weight: bold; font-family: -apple-system, sans-serif; }
  .lbl, .rec-label, .eyebrow2 { text-transform: uppercase; letter-spacing: 0.08em; font-size: 7.5pt; color: #6b7785; font-family: -apple-system, sans-serif; }
  .summary { font-size: 11pt; margin: 4px 0 0; }
  .cat-scores { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .cat { border: 1px solid #d0d5dd; padding: 5px 9px; font-size: 9pt; font-family: -apple-system, sans-serif; }
  .cat-name { color: #475467; } .cat-val { font-weight: bold; margin-left: 6px; }
  h2 { font-size: 13pt; margin: 24px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #d0d5dd; }
  table.matrix { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table.matrix th { text-align: left; color: #475467; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 6px; border-bottom: 1px solid #d0d5dd; }
  table.matrix td { padding: 4px 6px; border-bottom: 1px solid #eaecf0; }
  table.matrix .num { text-align: center; }
  .finding { border: 1px solid #d0d5dd; border-radius: 4px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .finding-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 8.5pt; font-family: -apple-system, sans-serif; margin-bottom: 6px; }
  .sev { font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; }
  .tag { background: #f2f4f7; color: #344054; padding: 1px 7px; border-radius: 10px; }
  .status-resolved { background: #ecfdf3; color: #067647; }
  .status-reviewed { background: #eff8ff; color: #175cd3; }
  .status-accepted_risk { background: #fffaeb; color: #b45309; }
  .verify { color: #b45309; }
  .fid { margin-left: auto; color: #98a2b3; }
  .finding-desc { margin: 4px 0 8px; }
  .rec { background: #f9fafb; border-left: 0; border: 1px solid #eaecf0; padding: 6px 10px; font-size: 10pt; }
  .rec-label { display: block; margin-bottom: 2px; }
  .cites { margin-top: 8px; }
  .cite { font-size: 8.5pt; color: #475467; margin-top: 4px; }
  .cite-doc { font-weight: bold; color: #344054; }
  .cite-ex { font-style: italic; color: #667085; }
  .xdoc { border: 1px solid #d0d5dd; padding: 9px 12px; margin-bottom: 8px; page-break-inside: avoid; }
  .xdoc-head { display: flex; justify-content: space-between; }
  .xdoc-grid { display: flex; gap: 32px; margin-top: 6px; font-size: 9.5pt; }
  .variance { color: #b45309; font-size: 9pt; margin-top: 4px; }
  ul.pbc, ol.steps { padding-left: 18px; }
  ul.pbc li, ol.steps li { margin-bottom: 6px; page-break-inside: avoid; }
  .pbc-pri { text-transform: uppercase; font-size: 7.5pt; padding: 1px 6px; border-radius: 8px; margin-right: 6px; }
  .pri-high { background: #fef3f2; color: #b42318; } .pri-medium { background: #fffaeb; color: #b45309; } .pri-low { background: #f2f4f7; color: #475467; }
  .pbc-from { color: #667085; }
  .urgency { color: #667085; font-size: 9pt; font-family: -apple-system, sans-serif; }
  .missing { color: #7a4a08; }
  footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #d0d5dd; font-size: 8.5pt; color: #667085; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <header>
    <div class="eyebrow">FundLens Audit — Final Report</div>
    <h1>${esc(title)}</h1>
    <div class="meta">
      ${fundLabel ? `<span>${esc(fundLabel)} Fund</span>` : ''}
      <span>${report.findings.length} finding${report.findings.length !== 1 ? 's' : ''}</span>
      <span>Prepared ${esc(fmtDate(job.createdAt))}</span>
      <span>Reviewed ${esc(fmtDate(job.completedAt))}</span>
    </div>
  </header>

  ${job.auditScope === 'partial' ? `<div class="scope"><strong>Partial Audit.</strong> Findings reflect only the documents provided; absence of other document types is not treated as a deficiency.</div>` : ''}

  <div class="overview">
    <div>
      <div class="lbl">Overall Risk</div>
      <div class="risk">${esc(report.overallRiskRating)}</div>
    </div>
    <div style="text-align:right">
      <div class="lbl">Quality Score</div>
      <div class="score">${esc(report.overallScore)}/10</div>
    </div>
  </div>
  <p class="summary">${esc(report.executiveSummary)}</p>
  ${categoryScores}

  ${riskMatrix}

  <h2>Findings</h2>
  ${sortedFindings.map(f => findingBlock(f, statusMap[f.id] ?? 'open')).join('')}

  ${crossDoc}
  ${pbc}
  ${nextSteps}
  ${completeness}

  <footer>
    AI-generated decision support — not a professional audit opinion or sign-off. All findings require qualified professional review.
  </footer>
</body>
</html>`
}
