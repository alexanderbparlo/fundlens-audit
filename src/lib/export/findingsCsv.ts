import type { Finding, FindingStatus, SynthesisReport } from '@/types'
import { FINDING_STATUS_LABELS, SEVERITY_LABELS } from '@/lib/utils'

/** Escape a single CSV cell per RFC 4180 — quote if it contains comma, quote, or newline. */
function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(',')
}

const HEADERS = [
  'Finding ID',
  'Severity',
  'Category',
  'Confidence',
  'Agent',
  'Status',
  'Requires Human Verification',
  'Description',
  'Recommendation',
  'Fields Referenced',
  'Source Documents',
] as const

function findingToRow(finding: Finding, status: FindingStatus): string {
  const sources = finding.sourceCitations
    .map(c => (c.page != null ? `${c.documentName} p.${c.page}` : c.documentName))
    .join('; ')
  return csvRow([
    finding.id,
    SEVERITY_LABELS[finding.severity],
    finding.category,
    finding.confidence,
    finding.agent,
    FINDING_STATUS_LABELS[status],
    finding.requiresHumanVerification ? 'Yes' : 'No',
    finding.description,
    finding.recommendation,
    finding.fieldsReferenced.join('; '),
    sources,
  ])
}

/**
 * Render a report's findings to a CSV string.
 * `statusMap` carries user-managed statuses; findings absent from it default to 'open'.
 */
export function findingsToCsv(
  report: SynthesisReport,
  statusMap: Record<string, FindingStatus> = {},
): string {
  const lines = [
    csvRow([...HEADERS]),
    ...report.findings.map(f => findingToRow(f, statusMap[f.id] ?? 'open')),
  ]
  // Prepend a UTF-8 BOM so Excel reads accented characters correctly.
  return '﻿' + lines.join('\r\n')
}
