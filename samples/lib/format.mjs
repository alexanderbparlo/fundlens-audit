// Shared formatting helpers for synthetic fund documents.

/** US dollars, no cents, negatives in parentheses: 1234567 -> "$1,234,567". */
export function usd(n) {
  return (
    (n < 0 ? '(' : '') +
    '$' +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) +
    (n < 0 ? ')' : '')
  )
}

/** US dollars with cents: 94.2 -> "$94.20". */
export function usd2(n) {
  return (
    (n < 0 ? '(' : '') +
    '$' +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    (n < 0 ? ')' : '')
  )
}

/** Percentage from a ratio: 0.082 -> "8.2%" (default 1 decimal). */
export function pct(ratio, decimals = 1) {
  return `${(ratio * 100).toFixed(decimals)}%`
}
