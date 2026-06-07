'use client'

import { useState } from 'react'
import type { AuditRunHook } from '@/hooks/useAuditRun'
import type { Finding, FindingSeverity, FindingStatus } from '@/types'
import {
  SEVERITY_COLORS, SEVERITY_LABELS, RISK_COLORS,
  FINDING_STATUS_LABELS, FINDING_STATUS_ORDER, FINDING_STATUS_COLORS,
} from '@/lib/utils'
import { findingsToCsv } from '@/lib/export/findingsCsv'
import { reportToPrintableHtml } from '@/lib/export/printableReport'
import { downloadTextFile, printHtmlDocument, slugifyFilename } from '@/lib/export/download'

// ── Small reusable pieces ─────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${SEVERITY_COLORS[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  )
}

function Score({ value }: { value: number }) {
  const color = value >= 8 ? 'text-positive' : value >= 6 ? 'text-flag' : 'text-negative'
  return (
    <span className={`font-mono text-2xl font-bold ${color}`}>
      {value}<span className="text-sm text-secondary font-normal">/10</span>
    </span>
  )
}

function Section({ title, count, children, defaultOpen = true }: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl bg-surface-900 border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-display font-semibold text-primary">{title}</h3>
          {count !== undefined && (
            <span className="text-xs rounded-full px-2 py-0.5 bg-surface-700 text-secondary font-mono">{count}</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  )
}

// ── Finding card ──────────────────────────────────────────────────────────────

function FindingCard({ finding, status, onStatusChange }: {
  finding: Finding
  status: FindingStatus
  onStatusChange: (s: FindingStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`rounded-xl border px-5 py-4 space-y-3 ${
      finding.severity === 'critical' ? 'border-negative/30 bg-negative/5' :
      finding.severity === 'warning'  ? 'border-flag/30 bg-flag/5' :
      finding.severity === 'pass'     ? 'border-positive/20 bg-positive/5' :
      'border-border bg-surface-800'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={finding.severity} />
          <span className="text-xs rounded px-1.5 py-0.5 bg-surface-700 text-secondary">{finding.category}</span>
          <span className="text-xs text-muted font-mono">{finding.id}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {finding.requiresHumanVerification && (
            <span className="text-xs text-flag">⚠ Verify</span>
          )}
          <span className="text-xs text-muted capitalize">{finding.confidence}</span>
        </div>
      </div>

      <p className="text-primary text-sm">{finding.description}</p>

      <div className="rounded-lg bg-surface-900 border border-border px-4 py-2.5">
        <p className="text-xs text-label uppercase tracking-wider mb-1">Recommendation</p>
        <p className="text-secondary text-sm">{finding.recommendation}</p>
      </div>

      {finding.sourceCitations.length > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-secondary hover:text-accent transition-colors"
        >
          {expanded ? '▲ Hide' : '▼ Show'} {finding.sourceCitations.length} source citation{finding.sourceCitations.length !== 1 ? 's' : ''}
        </button>
      )}

      {expanded && finding.sourceCitations.map((c, i) => (
        <div key={i} className="rounded-lg bg-surface-900 border border-border px-4 py-2.5 text-xs space-y-1">
          <p className="text-accent font-medium">{c.documentName}</p>
          {c.page    && <p className="text-secondary">Page {c.page}{c.section ? ` · ${c.section}` : ''}</p>}
          {c.excerpt && <p className="text-muted italic">&ldquo;{c.excerpt}&rdquo;</p>}
        </div>
      ))}

      {/* Status workflow */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <span className="text-xs text-label uppercase tracking-wider shrink-0">Status</span>
        <div className="flex flex-wrap gap-1.5">
          {FINDING_STATUS_ORDER.map(s => {
            const active = status === s
            return (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                  active
                    ? FINDING_STATUS_COLORS[s]
                    : 'border-transparent text-muted hover:text-secondary'
                }`}
              >
                {FINDING_STATUS_LABELS[s]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main report ───────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ReportView({
  currentJob, currentEngagement, findingStatuses, updateFindingStatus, setView, resetForNewRun,
}: Pick<AuditRunHook,
  'currentJob' | 'currentEngagement' | 'findingStatuses' | 'updateFindingStatus' | 'setView' | 'resetForNewRun'
>) {
  const report = currentJob?.finalReport
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'all'>('all')

  const baseName = slugifyFilename(currentEngagement?.name ?? 'fundlens-audit')

  const exportCsv = () => {
    if (!report) return
    downloadTextFile(`${baseName}-findings.csv`, findingsToCsv(report, findingStatuses), 'text/csv;charset=utf-8')
  }

  const exportPdf = () => {
    if (!currentJob) return
    const html = reportToPrintableHtml(currentJob, currentEngagement, findingStatuses)
    const opened = printHtmlDocument(html)
    if (!opened) {
      alert('Please allow pop-ups for this site to export the PDF report.')
    }
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-secondary">No report available.</p>
      </div>
    )
  }

  const severities: (FindingSeverity | 'all')[] = ['all', 'critical', 'warning', 'informational', 'pass']
  const filteredFindings = severityFilter === 'all'
    ? report.findings
    : report.findings.filter(f => f.severity === severityFilter)

  const findingCountBySeverity = (s: FindingSeverity) => report.findings.filter(f => f.severity === s).length

  const sortedFindings = [...filteredFindings].sort((a, b) => {
    const order: Record<FindingSeverity, number> = { critical: 0, warning: 1, informational: 2, pass: 3 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
      {/* Report header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-label font-display">Final Report</p>
          <h1 className="font-display text-2xl font-semibold text-primary mt-1">
            {currentEngagement?.name}
          </h1>
          <p className="text-secondary text-sm mt-1">
            {currentEngagement ? `${currentEngagement.fundType} Fund · ` : ''}
            {report.findings.length} finding{report.findings.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-muted font-mono">
              Date Prepared: {formatDate(currentJob?.createdAt)}
            </span>
            <span className="text-xs text-muted font-mono">
              Date Reviewed: {formatDate(currentJob?.completedAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={exportPdf}
            className="text-sm rounded-lg px-4 py-2 bg-accent text-surface-950 font-medium hover:bg-accent-dim transition-colors"
          >
            Export PDF
          </button>
          <button
            onClick={exportCsv}
            className="text-sm rounded-lg px-4 py-2 bg-surface-800 text-secondary border border-border hover:text-primary hover:border-accent/30 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={resetForNewRun}
            className="text-sm rounded-lg px-4 py-2 bg-surface-800 text-secondary border border-border hover:text-primary hover:border-accent/30 transition-colors"
          >
            New Run
          </button>
          <button
            onClick={() => setView('library')}
            className="text-sm rounded-lg px-4 py-2 bg-surface-800 text-secondary border border-border hover:text-primary hover:border-accent/30 transition-colors"
          >
            Library
          </button>
        </div>
      </div>

      {/* Partial audit scope banner */}
      {currentJob?.auditScope === 'partial' && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-3 flex items-start gap-3">
          <span className="text-accent text-sm font-medium shrink-0">Partial Audit</span>
          <p className="text-secondary text-sm">
            This audit was run in partial scope mode. Findings reflect only the documents uploaded — absence of other document types is not treated as a deficiency.
          </p>
        </div>
      )}

      {/* Overview card */}
      <div className="rounded-2xl bg-surface-900 border border-border p-6">
        <div className="flex items-start justify-between gap-6 mb-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-label font-display mb-2">Overall Risk</p>
            <span className={`font-display font-bold text-2xl uppercase ${RISK_COLORS[report.overallRiskRating]}`}>
              {report.overallRiskRating}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-label font-display mb-1">Quality Score</p>
            <Score value={report.overallScore} />
          </div>
        </div>

        <p className="text-primary text-sm leading-relaxed">{report.executiveSummary}</p>

        {/* Category scores */}
        {report.categoryScores.length > 0 && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {report.categoryScores.map(cs => (
              <div key={cs.category} className="rounded-lg bg-surface-800 border border-border px-3 py-2.5">
                <p className="text-xs text-label truncate">{cs.category}</p>
                <Score value={cs.score} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Risk matrix */}
      {report.riskMatrix.length > 0 && (
        <Section title="Risk Matrix" defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-label pb-2 font-display uppercase tracking-wider">Category</th>
                  <th className="text-center text-xs text-negative pb-2 font-display uppercase tracking-wider">Critical</th>
                  <th className="text-center text-xs text-flag pb-2 font-display uppercase tracking-wider">Warning</th>
                  <th className="text-center text-xs text-secondary pb-2 font-display uppercase tracking-wider">Info</th>
                  <th className="text-center text-xs text-positive pb-2 font-display uppercase tracking-wider">Pass</th>
                </tr>
              </thead>
              <tbody>
                {report.riskMatrix.map(row => (
                  <tr key={row.category} className="border-b border-border/50 last:border-0">
                    <td className="py-2 text-secondary text-xs">{row.category}</td>
                    <td className="py-2 text-center font-mono text-xs text-negative">{row.critical || '—'}</td>
                    <td className="py-2 text-center font-mono text-xs text-flag">{row.warning || '—'}</td>
                    <td className="py-2 text-center font-mono text-xs text-secondary">{row.informational || '—'}</td>
                    <td className="py-2 text-center font-mono text-xs text-positive">{row.pass || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Findings */}
      <Section title="Findings" count={report.findings.length}>
        {/* Severity filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {severities.map(s => {
            const count = s === 'all' ? report.findings.length : findingCountBySeverity(s)
            return (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  severityFilter === s
                    ? 'bg-accent text-surface-950'
                    : 'bg-surface-800 text-secondary border border-border hover:text-primary'
                }`}
              >
                {s === 'all' ? 'All' : SEVERITY_LABELS[s]} ({count})
              </button>
            )
          })}
        </div>
        <div className="space-y-3">
          {sortedFindings.map(f => (
            <FindingCard
              key={f.id}
              finding={f}
              status={findingStatuses[f.id] ?? 'open'}
              onStatusChange={s => updateFindingStatus(f.id, s)}
            />
          ))}
          {sortedFindings.length === 0 && (
            <p className="text-secondary text-sm text-center py-4">No findings match this filter.</p>
          )}
        </div>
      </Section>

      {/* Cross-document validations */}
      {report.crossDocumentValidations.length > 0 && (
        <Section title="Cross-Document Checks" count={report.crossDocumentValidations.length} defaultOpen={false}>
          <div className="space-y-3">
            {report.crossDocumentValidations.map((v, i) => (
              <div key={i} className={`rounded-xl border px-5 py-4 ${
                v.status === 'fail'           ? 'border-negative/30 bg-negative/5' :
                v.status === 'pass'           ? 'border-positive/20 bg-positive/5' :
                'border-border bg-surface-800'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-primary text-sm font-medium">{v.check}</p>
                  <SeverityBadge severity={v.severity} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-label">Expected</p>
                    <p className="text-primary font-mono mt-0.5">{v.expected}</p>
                  </div>
                  <div>
                    <p className="text-label">Found</p>
                    <p className="text-primary font-mono mt-0.5">{v.found}</p>
                  </div>
                </div>
                {v.variance && (
                  <p className="text-flag text-xs mt-2">Variance: {v.variance}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* PBC list */}
      {report.pbcList.length > 0 && (
        <Section title="PBC Document Requests" count={report.pbcList.length} defaultOpen={false}>
          <div className="space-y-2">
            {(['high', 'medium', 'low'] as const).map(priority => {
              const items = report.pbcList.filter(p => p.priority === priority)
              if (items.length === 0) return null
              return (
                <div key={priority}>
                  <p className={`text-xs uppercase tracking-widest font-display mb-2 ${
                    priority === 'high' ? 'text-negative' : priority === 'medium' ? 'text-flag' : 'text-secondary'
                  }`}>{priority} priority</p>
                  {items.map(item => (
                    <div key={item.id} className="rounded-lg bg-surface-800 border border-border px-4 py-3 mb-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-primary text-sm">{item.description}</p>
                        <span className="text-xs text-label font-mono shrink-0">{item.id}</span>
                      </div>
                      <p className="text-secondary text-xs mt-1">Request from: {item.requestedFrom}</p>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Next steps */}
      {report.recommendedNextSteps.length > 0 && (
        <Section title="Recommended Next Steps" defaultOpen={false}>
          <div className="space-y-2">
            {report.recommendedNextSteps
              .sort((a, b) => a.priority - b.priority)
              .map(step => (
                <div key={step.priority} className="flex items-start gap-4 rounded-lg bg-surface-800 border border-border px-4 py-3">
                  <span className="font-mono text-xs text-label mt-0.5 shrink-0">#{step.priority}</span>
                  <div className="flex-1">
                    <p className="text-primary text-sm">{step.action}</p>
                  </div>
                  <span className={`text-xs shrink-0 ${
                    step.urgency === 'immediate'          ? 'text-negative' :
                    step.urgency === 'near_term'          ? 'text-flag' :
                    'text-secondary'
                  }`}>{step.urgency.replace('_', ' ')}</span>
                </div>
              ))}
          </div>
        </Section>
      )}

      {/* Document set completeness */}
      {report.documentSetCompleteness && (
        <Section title="Document Set" defaultOpen={false}>
          <p className="text-secondary text-sm mb-4">{report.documentSetCompleteness.completenessNote}</p>
          {report.documentSetCompleteness.missing.length > 0 && (
            <div className="rounded-lg bg-flag/5 border border-flag/20 px-4 py-3">
              <p className="text-flag text-xs font-medium mb-2">Recommended but not provided</p>
              <div className="flex flex-wrap gap-2">
                {report.documentSetCompleteness.missing.map(m => (
                  <span key={m} className="text-xs rounded px-2 py-1 bg-surface-800 text-secondary border border-border">{m}</span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Disclaimer */}
      <p className="text-center text-muted text-xs pb-8">
        AI-generated decision support — not a professional audit opinion or sign-off. All findings require qualified professional review.
      </p>
    </div>
  )
}
