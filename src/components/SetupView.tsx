'use client'

import { useState, useEffect } from 'react'
import type { AuditRunHook } from '@/hooks/useAuditRun'
import type { AuditScope, FundType } from '@/types'
import { FUND_TYPE_LABELS } from '@/lib/utils'

const FUND_TYPES = Object.entries(FUND_TYPE_LABELS) as [FundType, string][]

export function SetupView({
  documents, selectedDocIds, currentEngagement,
  toggleDocSelection, selectAllProfiled, clearSelection,
  startAudit, setView,
}: Pick<AuditRunHook,
  'documents' | 'selectedDocIds' | 'currentEngagement' |
  'toggleDocSelection' | 'selectAllProfiled' | 'clearSelection' |
  'startAudit' | 'setView'
>) {
  const [fundType,   setFundType]   = useState<FundType>(currentEngagement?.fundType ?? 'PE')
  const [auditScope, setAuditScope] = useState<AuditScope>('full')
  const [submitting, setSubmitting] = useState(false)

  // Pre-select all profiled docs on mount
  useEffect(() => { selectAllProfiled() }, [selectAllProfiled])

  const profiledDocs    = documents.filter(d => d.profileJson)
  const selectionArray  = Array.from(selectedDocIds)
  const allSelected     = selectedDocIds.has

  const canRun = selectionArray.length > 0 && selectionArray.every(id => {
    const doc = documents.find(d => d.id === id)
    return doc?.profileJson != null
  })

  async function handleRun() {
    if (!canRun) return
    setSubmitting(true)
    await startAudit(selectionArray, fundType, auditScope)
    setSubmitting(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-label font-display">
            Configure Audit
          </p>
          <h2 className="text-primary text-xl font-semibold font-display mt-1">
            {currentEngagement?.name}
          </h2>
        </div>
        <button onClick={() => setView('library')} className="text-secondary text-sm hover:text-primary transition-colors">
          ← Back to Library
        </button>
      </div>

      {/* Fund type */}
      <div className="rounded-2xl bg-surface-900 border border-border p-6">
        <p className="text-xs uppercase tracking-widest text-label font-display mb-3">Fund Type</p>
        <div className="flex flex-wrap gap-2">
          {FUND_TYPES.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFundType(value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                fundType === value
                  ? 'bg-accent text-surface-950'
                  : 'bg-surface-800 text-secondary hover:text-primary border border-border hover:border-accent/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit scope */}
      <div className="rounded-2xl bg-surface-900 border border-border p-6 space-y-3">
        <p className="text-xs uppercase tracking-widest text-label font-display">Audit Scope</p>
        <div className="flex gap-2">
          {([['full', 'Full Audit'], ['partial', 'Partial Audit']] as [AuditScope, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setAuditScope(value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                auditScope === value
                  ? 'bg-accent text-surface-950'
                  : 'bg-surface-800 text-secondary hover:text-primary border border-border hover:border-accent/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {auditScope === 'partial' && (
          <p className="text-secondary text-xs leading-relaxed">
            Partial audit mode — the model will not penalize for missing document types. Scope findings are limited to the documents you upload.
          </p>
        )}
      </div>

      {/* Document selection */}
      <div className="rounded-2xl bg-surface-900 border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-label font-display">
            Documents ({selectionArray.length} selected)
          </p>
          <div className="flex gap-3">
            <button onClick={selectAllProfiled} className="text-xs text-secondary hover:text-accent transition-colors">
              Select all
            </button>
            <button onClick={clearSelection} className="text-xs text-secondary hover:text-accent transition-colors">
              Clear
            </button>
          </div>
        </div>

        {profiledDocs.length === 0 ? (
          <p className="text-secondary text-sm py-4 text-center">
            No profiled documents. Go back and profile your documents first.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const isProfiled = !!doc.profileJson
              const isSelected = selectedDocIds.has(doc.id)
              return (
                <label
                  key={doc.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-accent/10 border border-accent/30'
                      : 'bg-surface-800 border border-border hover:border-border'
                  } ${!isProfiled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!isProfiled}
                    onChange={() => isProfiled && toggleDocSelection(doc.id)}
                    className="accent-accent w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-primary text-sm truncate">{doc.filename}</p>
                    <p className="text-secondary text-xs mt-0.5">
                      {isProfiled ? `${doc.profileJson!.documentType}${doc.profileJson!.fundName ? ' · ' + doc.profileJson!.fundName : ''}` : 'Not profiled'}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={!canRun || submitting}
        className="w-full rounded-xl bg-accent text-surface-950 font-semibold py-4 text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting
          ? 'Starting audit...'
          : `Run Audit — ${selectionArray.length} document${selectionArray.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
