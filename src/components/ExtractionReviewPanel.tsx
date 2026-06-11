'use client'

import { useState } from 'react'
import type { VerificationResult, DeterministicCheck } from '@/types'

// Track C extraction-review surface: the normalized, code-verified extraction
// shown to the user before the agents run — the audit analog of tying out the
// lead schedule. Also the instrument for attributing profiler-vs-check error.

function StatusBadge({ status }: { status: DeterministicCheck['status'] }) {
  const styles = {
    pass:             'bg-positive/10 text-positive',
    fail:             'bg-negative/10 text-negative',
    unable_to_verify: 'bg-surface-700 text-secondary',
  } as const
  const labels = { pass: 'PASS', fail: 'FAIL', unable_to_verify: 'UNVERIFIED' } as const
  return (
    <span className={`text-[10px] font-mono rounded px-1.5 py-0.5 shrink-0 ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function CheckRow({ check }: { check: DeterministicCheck }) {
  return (
    <div className="rounded-lg bg-surface-800 border border-border px-4 py-3 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-primary text-xs font-medium">
          <span className="font-mono text-label mr-2">{check.id} · {check.family}</span>
          {check.check}
        </p>
        <StatusBadge status={check.status} />
      </div>
      <p className="text-secondary text-xs font-mono">{check.expected}</p>
      <p className="text-secondary text-xs font-mono">{check.found}</p>
      {check.variance && (
        <p className="text-negative text-xs font-mono">Variance: {check.variance}</p>
      )}
      {check.severityCeiling && (
        <p className="text-flag text-xs">Severity ceiling: {check.severityCeiling}</p>
      )}
      {check.note && <p className="text-label text-xs leading-relaxed">{check.note}</p>}
    </div>
  )
}

export function ExtractionReviewPanel({
  verification, controlRun, onContinue, onAbort,
}: {
  verification: VerificationResult
  controlRun: boolean
  onContinue: () => void
  onAbort: () => void
}) {
  const [showAll, setShowAll] = useState(false)

  const exceptions = verification.exceptionList
  const unverified = verification.checks.filter(c => c.status === 'unable_to_verify')
  const passes     = verification.checks.filter(c => c.status === 'pass')

  return (
    <div className="rounded-2xl bg-surface-900 border border-accent/30 p-6 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-accent font-display">
          Extraction Review{controlRun ? ' · Control Run' : ''}
        </p>
        <p className="text-secondary text-xs mt-2 leading-relaxed">
          Deterministic verification has run on the {controlRun ? 'injected known-good extraction' : 'extracted figures'}.
          Tie out the verified figure set and exceptions below before the agents reason on them.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-surface-800 border border-border py-3">
          <p className="font-mono text-lg text-positive">{passes.length}</p>
          <p className="text-label text-xs">verified</p>
        </div>
        <div className="rounded-lg bg-surface-800 border border-border py-3">
          <p className="font-mono text-lg text-negative">{exceptions.length}</p>
          <p className="text-label text-xs">exceptions</p>
        </div>
        <div className="rounded-lg bg-surface-800 border border-border py-3">
          <p className="font-mono text-lg text-secondary">{unverified.length}</p>
          <p className="text-label text-xs">unverifiable</p>
        </div>
      </div>

      {/* Verified figure set */}
      {verification.verifiedFigureSet.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-label font-display">Verified Figure Set</p>
          <div className="rounded-lg bg-surface-800 border border-border divide-y divide-border">
            {verification.verifiedFigureSet.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 gap-3">
                <span className="text-secondary text-xs truncate">{f.label}</span>
                <span className="font-mono text-xs text-primary shrink-0">
                  {f.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  <span className="text-label ml-2">{f.verifiedBy.join(', ')}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exceptions */}
      {exceptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-label font-display">
            Clerical / Mathematical Exceptions
          </p>
          <div className="space-y-2">
            {exceptions.map(c => <CheckRow key={c.id} check={c} />)}
          </div>
        </div>
      )}

      {/* Full check list, collapsed by default */}
      <button
        onClick={() => setShowAll(s => !s)}
        className="text-xs text-secondary hover:text-accent transition-colors"
      >
        {showAll ? 'Hide' : 'Show'} all {verification.checks.length} checks
      </button>
      {showAll && (
        <div className="space-y-2">
          {verification.checks.filter(c => c.status !== 'fail').map(c => <CheckRow key={c.id} check={c} />)}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onContinue}
          className="flex-1 rounded-xl bg-accent text-surface-950 font-semibold py-3 text-sm hover:bg-accent-dim transition-colors"
        >
          Continue — Run Agents →
        </button>
        <button
          onClick={onAbort}
          className="rounded-xl bg-surface-800 text-secondary font-medium px-5 py-3 text-sm hover:text-primary border border-border hover:border-accent/30 transition-colors"
        >
          Abort
        </button>
      </div>
    </div>
  )
}
