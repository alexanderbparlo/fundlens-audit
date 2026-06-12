'use client'

import type { AuditRunHook, PhaseStatus, PipelinePhases } from '@/hooks/useAuditRun'
import { ExtractionReviewPanel } from './ExtractionReviewPanel'

const PHASE_META = {
  prepare: {
    label:    'Prepare',
    step:     '01',
    desc:     'Synthesizing document profiles into structured fund data',
  },
  review: {
    label:    'Review',
    step:     '02a',
    desc:     'Systematic validation against GAAP, ASC 946, and ILPA standards',
  },
  challenge: {
    label:    'Challenge',
    step:     '02b',
    desc:     'Adversarial analysis against market benchmarks and LP-adverse terms',
  },
  synthesize: {
    label:    'Synthesize',
    step:     '03',
    desc:     'Merging findings, scoring, and generating the final report',
  },
} as const

type PhaseName = keyof typeof PHASE_META

function PhaseCard({
  name, status, parallel,
}: {
  name: PhaseName
  status: PhaseStatus
  parallel?: boolean
}) {
  const meta = PHASE_META[name]

  const statusColors: Record<PhaseStatus, string> = {
    idle:    'border-border text-muted bg-surface-800',
    running: 'border-accent/40 text-primary bg-surface-800',
    done:    'border-positive/30 text-primary bg-positive/5',
    error:   'border-negative/30 text-primary bg-negative/5',
  }

  const dotColors: Record<PhaseStatus, string> = {
    idle:    'bg-muted',
    running: 'bg-accent animate-pulse',
    done:    'bg-positive',
    error:   'bg-negative',
  }

  const statusLabel: Record<PhaseStatus, string> = {
    idle:    'Waiting',
    running: 'Running',
    done:    'Complete',
    error:   'Failed',
  }

  return (
    <div className={`rounded-xl border px-5 py-4 transition-colors ${statusColors[status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${dotColors[status]}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-label">{meta.step}</span>
              <span className="text-sm font-semibold font-display text-primary">{meta.label}</span>
              {parallel && (
                <span className="text-xs rounded px-1.5 py-0.5 bg-surface-700 text-secondary">parallel</span>
              )}
            </div>
            <p className="text-xs text-secondary mt-0.5">{meta.desc}</p>
          </div>
        </div>
        <span className={`text-xs shrink-0 ${
          status === 'done'    ? 'text-positive' :
          status === 'error'   ? 'text-negative' :
          status === 'running' ? 'text-accent'   : 'text-muted'
        }`}>
          {statusLabel[status]}
        </span>
      </div>
    </div>
  )
}

export function PipelineView({
  phases, error, currentJob, setView, resetForNewRun,
  awaitingExtractionReview, continueAfterExtractionReview,
}: Pick<AuditRunHook,
  'phases' | 'error' | 'currentJob' | 'setView' | 'resetForNewRun' |
  'awaitingExtractionReview' | 'continueAfterExtractionReview'
>) {
  const allDone = (p: PipelinePhases) =>
    p.prepare === 'done' && p.review === 'done' && p.challenge === 'done' && p.synthesize === 'done'

  const hasFailed = (p: PipelinePhases) =>
    p.prepare === 'error' || p.review === 'error' || p.challenge === 'error' || p.synthesize === 'error'

  const isRunning = !allDone(phases) && !hasFailed(phases) && !awaitingExtractionReview

  const verification = currentJob?.verification ?? null

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-label font-display mb-2">
          Audit Pipeline
        </p>
        <h2 className="text-primary text-xl font-semibold font-display">
          {awaitingExtractionReview && 'Extraction ready for review'}
          {isRunning && 'Running analysis...'}
          {allDone(phases) && 'Analysis complete'}
          {hasFailed(phases) && 'Analysis failed'}
        </h2>
        {isRunning && (
          <p className="text-secondary text-sm mt-2">
            This may take several minutes. Each phase is an independent AI agent.
          </p>
        )}
      </div>

      {/* Phase cards */}
      <div className="space-y-3">
        <PhaseCard name="prepare"   status={phases.prepare} />

        {/* Verification summary once extraction is verified */}
        {verification && phases.prepare === 'done' && !awaitingExtractionReview && (
          <p className="text-xs text-secondary px-1 font-mono">
            Deterministic verification: {verification.verifiedFigureSet.length} figures verified ·{' '}
            <span className={verification.exceptionList.length > 0 ? 'text-negative' : 'text-positive'}>
              {verification.exceptionList.length} exception{verification.exceptionList.length !== 1 ? 's' : ''}
            </span>
          </p>
        )}

        {/* Track C: pause for extraction tie-out before the agents run */}
        {awaitingExtractionReview && verification && (
          <ExtractionReviewPanel
            verification={verification}
            controlRun={currentJob?.controlRun ?? false}
            onContinue={continueAfterExtractionReview}
            onAbort={resetForNewRun}
          />
        )}

        {/* Review + Challenge are parallel */}
        <div className="grid grid-cols-2 gap-3">
          <PhaseCard name="review"    status={phases.review}    parallel />
          <PhaseCard name="challenge" status={phases.challenge} parallel />
        </div>

        <PhaseCard name="synthesize" status={phases.synthesize} />
      </div>

      {/* Error box */}
      {error && (
        <div className="rounded-xl bg-negative/10 border border-negative/30 p-4">
          <p className="text-negative text-sm font-medium">Error</p>
          <p className="text-negative/80 text-xs mt-1">{error}</p>
        </div>
      )}

      {/* CTA */}
      {allDone(phases) && currentJob?.finalReport && (
        <button
          onClick={() => setView('report')}
          className="w-full rounded-xl bg-accent text-surface-950 font-semibold py-4 text-sm hover:bg-accent-dim transition-colors"
        >
          View Report →
        </button>
      )}

      {hasFailed(phases) && (
        <div className="flex gap-3">
          <button
            onClick={resetForNewRun}
            className="flex-1 rounded-xl bg-surface-800 text-secondary font-medium py-3 text-sm hover:text-primary border border-border hover:border-accent/30 transition-colors"
          >
            Retry Setup
          </button>
          <button
            onClick={() => setView('library')}
            className="flex-1 rounded-xl bg-surface-800 text-secondary font-medium py-3 text-sm hover:text-primary border border-border hover:border-accent/30 transition-colors"
          >
            Back to Library
          </button>
        </div>
      )}
    </div>
  )
}
