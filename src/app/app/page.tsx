'use client'

import { Suspense } from 'react'
import { useAuditRun } from '@/hooks/useAuditRun'
import { EngagementView } from '@/components/EngagementView'
import { LibraryView }    from '@/components/LibraryView'
import { SetupView }      from '@/components/SetupView'
import { PipelineView }   from '@/components/PipelineView'
import { ReportView }     from '@/components/ReportView'
import { ApiKeyControl }  from '@/components/ApiKeyControl'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950">
      <div className="flex items-center gap-3 text-secondary">
        <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <span className="text-sm font-display">Loading...</span>
      </div>
    </div>
  )
}

// useAuditRun reads the URL via useSearchParams (Track E), which requires a
// Suspense boundary above it for prerendering.
export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuditApp />
    </Suspense>
  )
}

function AuditApp() {
  const run = useAuditRun()

  if (run.isLoading) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Top bar — hidden on the engagement landing view */}
      {run.view !== 'engagement' && (
        <header className="sticky top-0 z-50 border-b border-border bg-surface-950/90 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
            {/* Persistent home control + breadcrumb (Track E) */}
            <button
              onClick={() => run.setView('engagement')}
              className="flex items-center hover:opacity-80 transition-opacity"
              aria-label="FundLens Audit — home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fundlens-audit-logo.png" alt="FundLens Audit" width={67} height={32} className="h-8 w-auto block" />
            </button>
            {run.currentEngagement && (
              <>
                <span className="text-border select-none">·</span>
                <button
                  onClick={() => run.setView('library')}
                  className="text-secondary text-sm truncate max-w-xs hover:text-primary transition-colors text-left"
                >
                  {run.currentEngagement.name}
                </button>
              </>
            )}
            {/* BYOK: user's own Anthropic key, held in this tab only */}
            <ApiKeyControl />
          </div>
        </header>
      )}

      {/* Global error banner (pipeline view handles its own error display) */}
      {run.error && run.view !== 'pipeline' && (
        <div className="border-b border-negative/30 bg-negative/5 px-6 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <p className="text-negative text-sm">{run.error}</p>
            <button
              onClick={run.clearError}
              className="text-xs text-negative/60 hover:text-negative shrink-0 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {run.view === 'engagement' && (
        <>
          {/* BYOK control — the engagement view has no top bar, so pin it
              top-right without disturbing the centered layout. */}
          <div className="fixed top-4 right-6 z-50">
            <ApiKeyControl />
          </div>
          <EngagementView
            engagements={run.engagements}
            createEngagement={run.createEngagement}
            selectEngagement={run.selectEngagement}
            openLatestRun={run.openLatestRun}
          />
        </>
      )}

      {run.view === 'library' && (
        <LibraryView
          documents={run.documents}
          uploadProgress={run.uploadProgress}
          uploadDocument={run.uploadDocument}
          profileDocument={run.profileDocument}
          deleteDocument={run.deleteDocument}
          currentEngagement={run.currentEngagement}
          setView={run.setView}
        />
      )}

      {run.view === 'setup' && (
        <SetupView
          documents={run.documents}
          selectedDocIds={run.selectedDocIds}
          currentEngagement={run.currentEngagement}
          toggleDocSelection={run.toggleDocSelection}
          selectAllProfiled={run.selectAllProfiled}
          clearSelection={run.clearSelection}
          startAudit={run.startAudit}
          setView={run.setView}
        />
      )}

      {run.view === 'pipeline' && (
        <PipelineView
          phases={run.phases}
          error={run.error}
          currentJob={run.currentJob}
          setView={run.setView}
          resetForNewRun={run.resetForNewRun}
          awaitingExtractionReview={run.awaitingExtractionReview}
          continueAfterExtractionReview={run.continueAfterExtractionReview}
        />
      )}

      {run.view === 'report' && (
        <ReportView
          currentJob={run.currentJob}
          currentEngagement={run.currentEngagement}
          findingStatuses={run.findingStatuses}
          updateFindingStatus={run.updateFindingStatus}
          setView={run.setView}
          resetForNewRun={run.resetForNewRun}
        />
      )}
    </div>
  )
}
