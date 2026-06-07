import type { FindingSeverity, FindingStatus, OverallRiskRating } from '@/types'

/** Merge Tailwind class strings — drop-in cn() without a dep on clsx. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Format a number as USD currency using DM Mono conventions. */
export function formatCurrency(value: number | null | undefined, decimals = 0): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Format a decimal (0.02) as a percentage string ("2.00%"). */
export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(decimals)}%`
}

/** Format an ISO date string as "December 31, 2024". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Map severity to a Tailwind color token for badges and text. */
export const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical:      'text-negative bg-negative/10 border-negative/30',
  warning:       'text-flag bg-flag/10 border-flag/30',
  informational: 'text-secondary bg-surface-800 border-border',
  pass:          'text-positive bg-positive/10 border-positive/30',
}

/** Map severity to a display label. */
export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical:      'Critical',
  warning:       'Warning',
  informational: 'Informational',
  pass:          'Pass',
}

/** Map a user-managed finding status to a display label. */
export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open:          'Open',
  reviewed:      'Reviewed',
  accepted_risk: 'Accepted Risk',
  resolved:      'Resolved',
}

/** Ordered list of finding statuses for status pickers. */
export const FINDING_STATUS_ORDER: FindingStatus[] = ['open', 'reviewed', 'accepted_risk', 'resolved']

/** Map a finding status to Tailwind color tokens for chips. */
export const FINDING_STATUS_COLORS: Record<FindingStatus, string> = {
  open:          'text-secondary bg-surface-800 border-border',
  reviewed:      'text-accent bg-accent/10 border-accent/30',
  accepted_risk: 'text-flag bg-flag/10 border-flag/30',
  resolved:      'text-positive bg-positive/10 border-positive/30',
}

/** Map overall risk rating to color. */
export const RISK_COLORS: Record<OverallRiskRating, string> = {
  low:      'text-positive',
  medium:   'text-flag',
  high:     'text-negative',
  critical: 'text-negative font-semibold',
}

/** Map fund type to a display label. */
export const FUND_TYPE_LABELS = {
  PE:          'Private Equity',
  VC:          'Venture Capital',
  HF:          'Hedge Fund',
  Credit:      'Private Credit',
  RealEstate:  'Real Estate',
} as const

/** SHA-256 hash of a file for content-hash deduplication. */
export async function hashFile(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Convert an ArrayBuffer to a base64 string. */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
