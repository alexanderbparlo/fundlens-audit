'use client'

import { useState } from 'react'
import type { AuditRunHook } from '@/hooks/useAuditRun'
import type { FundType } from '@/types'
import { FUND_TYPE_LABELS } from '@/lib/utils'

const FUND_TYPES = Object.entries(FUND_TYPE_LABELS) as [FundType, string][]

export function EngagementView({ engagements, createEngagement, selectEngagement }: Pick<
  AuditRunHook, 'engagements' | 'createEngagement' | 'selectEngagement'
>) {
  const [name,        setName]        = useState('')
  const [fundName,    setFundName]    = useState('')
  const [fundType,    setFundType]    = useState<FundType>('PE')
  const [description, setDescription] = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !fundName.trim()) return
    setSubmitting(true)
    await createEngagement(name.trim(), fundName.trim(), fundType, description.trim() || undefined)
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      {/* Logo block */}
      <div className="mb-12 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-primary">
          FundLens <span className="text-accent">Audit</span>
        </h1>
        <p className="mt-3 text-secondary text-base">
          Multi-agent adversarial fund document auditor
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-8">
        {/* Existing engagements */}
        {engagements.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-label mb-3 font-display">
              Existing Engagements
            </p>
            <div className="space-y-2">
              {engagements.map(e => (
                <button
                  key={e.id}
                  onClick={() => selectEngagement(e)}
                  className="w-full flex items-center justify-between rounded-xl bg-surface-800 border border-border px-5 py-4 text-left hover:bg-surface-700 hover:border-accent/30 transition-colors group"
                >
                  <div>
                    <p className="text-primary font-medium group-hover:text-accent transition-colors">
                      {e.name}
                    </p>
                    <p className="text-secondary text-sm mt-0.5">
                      {e.fundName} &middot; {FUND_TYPE_LABELS[e.fundType]}
                      {e.documentIds.length > 0 && ` · ${e.documentIds.length} doc${e.documentIds.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-muted group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-950 px-4 text-xs text-label uppercase tracking-widest">
                  or create new
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Create engagement form */}
        <div className="rounded-2xl bg-surface-900 border border-border p-8">
          {engagements.length === 0 && (
            <h2 className="font-display text-lg font-medium text-primary mb-6">
              Create your first engagement
            </h2>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-label mb-1.5 uppercase tracking-wider">
                  Engagement Name
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Acme Capital Fund III — Annual Review 2025"
                  required
                  className="w-full rounded-lg bg-surface-800 border border-border text-primary placeholder-muted px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-label mb-1.5 uppercase tracking-wider">
                  Fund Name
                </label>
                <input
                  value={fundName}
                  onChange={e => setFundName(e.target.value)}
                  placeholder="Acme Capital Fund III"
                  required
                  className="w-full rounded-lg bg-surface-800 border border-border text-primary placeholder-muted px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-label mb-1.5 uppercase tracking-wider">
                  Fund Type
                </label>
                <select
                  value={fundType}
                  onChange={e => setFundType(e.target.value as FundType)}
                  className="w-full rounded-lg bg-surface-800 border border-border text-primary px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
                >
                  {FUND_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-label mb-1.5 uppercase tracking-wider">
                  Description <span className="text-muted normal-case">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Annual audit review for limited partnership interests..."
                  rows={2}
                  className="w-full rounded-lg bg-surface-800 border border-border text-primary placeholder-muted px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !fundName.trim()}
              className="w-full rounded-lg bg-accent text-surface-950 font-semibold py-3 text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Engagement'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
