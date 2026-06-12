'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AuditScope, Engagement, FundDocument, AuditJob, FundType, FindingStatus, FindingStatusRecord, PreparerOutput } from '@/types'
import { ANTHROPIC_KEY_HEADER, getStoredApiKey } from '@/lib/apiKey'

export type PhaseStatus = 'idle' | 'running' | 'done' | 'error'
export type AppView = 'engagement' | 'library' | 'setup' | 'pipeline' | 'report'

const APP_VIEWS: readonly AppView[] = ['engagement', 'library', 'setup', 'pipeline', 'report']
export type UploadStage = 'uploading' | 'profiling' | 'done' | 'error'

export interface PipelinePhases {
  prepare:   PhaseStatus
  review:    PhaseStatus
  challenge: PhaseStatus
  synthesize: PhaseStatus
}

// Track C run options: pause for extraction review before the agents reason,
// or inject a known-good extraction (control run, profiler bypass).
export interface StartAuditOptions {
  reviewExtraction?: boolean
  controlPreparerOutput?: PreparerOutput | null
}

export interface AuditRunHook {
  view:               AppView
  engagements:        Engagement[]
  currentEngagement:  Engagement | null
  documents:          FundDocument[]
  selectedDocIds:     Set<string>
  currentJob:         AuditJob | null
  phases:             PipelinePhases
  uploadProgress:     Record<string, UploadStage>
  findingStatuses:    Record<string, FindingStatus>
  isLoading:          boolean
  error:              string | null
  awaitingExtractionReview: boolean

  createEngagement:  (name: string, fundName: string, fundType: FundType, description?: string) => Promise<void>
  selectEngagement:  (e: Engagement) => void
  openLatestRun:     (e: Engagement) => Promise<void>
  uploadDocument:    (file: File) => Promise<void>
  profileDocument:   (docId: string) => Promise<void>
  deleteDocument:    (docId: string) => Promise<void>
  toggleDocSelection: (docId: string) => void
  selectAllProfiled: () => void
  clearSelection:    () => void
  startAudit:        (docIds: string[], fundType: FundType, auditScope: AuditScope, options?: StartAuditOptions) => Promise<void>
  continueAfterExtractionReview: () => Promise<void>
  updateFindingStatus: (findingId: string, status: FindingStatus, note?: string | null) => Promise<void>
  setView:           (v: AppView) => void
  clearError:        () => void
  resetForNewRun:    () => void
}

// ── Module-level API helpers ──────────────────────────────────────────────────

// BYOK: attach the caller's own Anthropic key to every API request. Routes that
// don't reach Anthropic simply ignore it; the agent/profile routes require it.
function withApiKey(init?: RequestInit): RequestInit {
  const key = getStoredApiKey()
  if (!key) return init ?? {}
  return { ...init, headers: { ...init?.headers, [ANTHROPIC_KEY_HEADER]: key } }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, withApiKey(init))
  if (!res.ok) {
    let msg: string
    try {
      const json = await res.json()
      const e = json.error ?? json.message ?? json
      msg = typeof e === 'string' ? e : JSON.stringify(e)
    } catch {
      msg = `Server error (${res.status})`
    }
    throw new Error(msg)
  }
  const json = await res.json()
  if (!json.success) {
    const e = json.error
    throw new Error(typeof e === 'string' ? e : JSON.stringify(e))
  }
  return json.data as T
}

function jsonSend<T>(method: 'POST' | 'PATCH', url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function jsonPost<T>(url: string, body?: unknown): Promise<T> {
  return jsonSend<T>('POST', url, body)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuditRun(): AuditRunHook {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view,              setViewState]      = useState<AppView>('engagement')
  const [engagements,       setEngagements]    = useState<Engagement[]>([])
  const [currentEngagement, setCurrentEngagement] = useState<Engagement | null>(null)
  const [documents,         setDocuments]      = useState<FundDocument[]>([])
  const [selectedDocIds,    setSelectedDocIds] = useState<Set<string>>(new Set())
  const [currentJob,        setCurrentJob]     = useState<AuditJob | null>(null)
  const [phases,            setPhases]         = useState<PipelinePhases>({
    prepare: 'idle', review: 'idle', challenge: 'idle', synthesize: 'idle',
  })
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadStage>>({})
  const [findingStatuses, setFindingStatuses] = useState<Record<string, FindingStatus>>({})
  const [isLoading,      setIsLoading]      = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [awaitingExtractionReview, setAwaitingExtractionReview] = useState(false)
  // Job id whose downstream phases are deferred pending extraction review
  const pausedJobIdRef = useRef<string | null>(null)

  // Refs mirror navigation-relevant state so the URL-restore effect can read
  // current values without re-subscribing on every state change (which would
  // re-fire on its own router.push). This effect must stay declared before the
  // URL-restore effect so the mirrors are fresh when it runs.
  const viewRef        = useRef(view)
  const engRef         = useRef(currentEngagement)
  const jobRef         = useRef(currentJob)
  const engagementsRef = useRef(engagements)
  useEffect(() => {
    viewRef.current        = view
    engRef.current         = currentEngagement
    jobRef.current         = currentJob
    engagementsRef.current = engagements
  })

  // ── Track E: URL-synced client-side navigation ──────────────────────────────
  // View + engagement live in the query string so browser back/forward and deep
  // links work without a hard refresh. Actions push; the effect below pulls.
  const pushUrl = useCallback((v: AppView, engagementId: string | null) => {
    const params = new URLSearchParams()
    if (v !== 'engagement') params.set('view', v)
    if (engagementId)       params.set('eng', engagementId)
    const qs = params.toString()
    // The app is mounted at /app; the bare engagement view (no query) lives there too.
    router.push(qs ? `/app?${qs}` : '/app', { scroll: false })
  }, [router])

  // ── Replay mode ─────────────────────────────────────────────────────────────
  // Drive the pipeline view through its phases on a timer from an already-completed
  // persisted run — no API calls, no agents, no key. Powers the landing page's
  // "Run a sample audit" demo (a deep link to a pipeline that has no live run).
  const replayTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const replayingRef = useRef(false)
  const clearReplay = useCallback(() => {
    replayTimersRef.current.forEach(clearTimeout)
    replayTimersRef.current = []
    replayingRef.current = false
  }, [])
  const replayRun = useCallback((job: AuditJob) => {
    clearReplay()
    replayingRef.current = true
    // finalReport present → the finding-status effect loads, and PipelineView's
    // "View Report" button stays gated on phases until the animation completes.
    setCurrentJob(job)
    setPhases({ prepare: 'idle', review: 'idle', challenge: 'idle', synthesize: 'idle' })
    const at = (ms: number, fn: () => void) => replayTimersRef.current.push(setTimeout(fn, ms))
    at(200,  () => setPhases(p => ({ ...p, prepare: 'running' })))
    at(1500, () => setPhases(p => ({ ...p, prepare: 'done' })))
    at(1850, () => setPhases(p => ({ ...p, review: 'running', challenge: 'running' })))
    at(3300, () => setPhases(p => ({ ...p, review: 'done' })))
    at(3750, () => setPhases(p => ({ ...p, challenge: 'done' })))
    at(4100, () => setPhases(p => ({ ...p, synthesize: 'running' })))
    at(5500, () => { setPhases(p => ({ ...p, synthesize: 'done' })); replayingRef.current = false })
  }, [clearReplay])
  // Clear any pending replay timers on unmount.
  useEffect(() => clearReplay, [clearReplay])

  useEffect(() => {
    if (isLoading) return   // engagement list not loaded yet
    const rawView  = searchParams.get('view')
    const urlView  = rawView && (APP_VIEWS as readonly string[]).includes(rawView)
      ? rawView as AppView : 'engagement'
    const urlEngId = searchParams.get('eng')

    if (urlEngId !== (engRef.current?.id ?? null)) {
      const engagement = urlEngId
        ? engagementsRef.current.find(e => e.id === urlEngId) ?? null
        : null
      setCurrentEngagement(engagement)
      setSelectedDocIds(new Set())   // selection must not carry across engagements
      if (!engagement) {
        if (viewRef.current !== 'engagement') setViewState('engagement')
        return
      }
    }
    if (urlView === viewRef.current) return

    // Report and pipeline need a job in memory. On a deep link or refresh,
    // recover the report from the latest persisted run (Track D); a live pipeline
    // run cannot be re-attached, so replay the latest completed run instead.
    if (urlView === 'report' && !jobRef.current?.finalReport && urlEngId) {
      ;(async () => {
        const job = await apiFetch<AuditJob | null>(`/api/audit/latest?engagementId=${urlEngId}`).catch(() => null)
        if (job?.finalReport) {
          setCurrentJob(job)
          setPhases({ prepare: 'done', review: 'done', challenge: 'done', synthesize: 'done' })
          setViewState('report')
        } else {
          setViewState('library')
        }
      })()
      return
    }
    if (urlView === 'pipeline' && !jobRef.current) {
      // Replay the latest completed run as a timed animation (demo / revisit);
      // fall back to the library only if there is no completed run to replay.
      if (urlEngId && !replayingRef.current) {
        ;(async () => {
          const job = await apiFetch<AuditJob | null>(`/api/audit/latest?engagementId=${urlEngId}`).catch(() => null)
          if (job?.finalReport) {
            replayRun(job)
            setViewState('pipeline')
          } else {
            setViewState('library')
          }
        })()
      } else if (!urlEngId) {
        setViewState('library')
      }
      return
    }
    setViewState(urlView)
  }, [searchParams, isLoading, replayRun])

  // ── Initial data load ───────────────────────────────────────────────────────
  // Documents are scoped per engagement and loaded on engagement selection.
  useEffect(() => {
    ;(async () => {
      try {
        const engRes = await fetch('/api/engagements')
        const engJson = await engRes.json()
        if (engJson.success) setEngagements(engJson.data)
      } catch {
        setError('Failed to load initial data.')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  // ── Load this engagement's documents whenever the engagement changes ────────
  const currentEngagementId = currentEngagement?.id ?? null
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!currentEngagementId) {
        if (!cancelled) setDocuments([])
        return
      }
      try {
        const docs = await apiFetch<FundDocument[]>(`/api/documents?engagementId=${currentEngagementId}`)
        if (!cancelled) setDocuments(docs)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load documents.')
      }
    })()
    return () => { cancelled = true }
  }, [currentEngagementId])

  // ── Load finding statuses whenever a completed job is in view ────────────────
  const completedJobId = currentJob?.finalReport ? currentJob.id : null
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!completedJobId) {
        if (!cancelled) setFindingStatuses({})
        return
      }
      try {
        const records = await apiFetch<FindingStatusRecord[]>(`/api/audit/${completedJobId}/findings`)
        if (cancelled) return
        const map: Record<string, FindingStatus> = {}
        for (const r of records) map[r.findingId] = r.status
        setFindingStatuses(map)
      } catch {
        if (!cancelled) setFindingStatuses({})
      }
    })()
    return () => { cancelled = true }
  }, [completedJobId])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const setView = useCallback((v: AppView) => {
    setViewState(v)
    pushUrl(v, engRef.current?.id ?? null)
  }, [pushUrl])
  const clearError   = useCallback(() => setError(null), [])
  const resetForNewRun = useCallback(() => {
    clearReplay()
    setCurrentJob(null)
    setFindingStatuses({})
    setPhases({ prepare: 'idle', review: 'idle', challenge: 'idle', synthesize: 'idle' })
    setAwaitingExtractionReview(false)
    pausedJobIdRef.current = null
    setViewState('setup')
    pushUrl('setup', engRef.current?.id ?? null)
  }, [pushUrl, clearReplay])

  const updateFindingStatus = useCallback(async (
    findingId: string, status: FindingStatus, note?: string | null
  ) => {
    const jobId = currentJob?.id
    if (!jobId) return
    const prev = findingStatuses[findingId] ?? 'open'
    setFindingStatuses(s => ({ ...s, [findingId]: status }))   // optimistic
    try {
      await jsonSend<FindingStatusRecord>('PATCH', `/api/audit/${jobId}/findings`, { findingId, status, note: note ?? null })
    } catch (err) {
      setFindingStatuses(s => ({ ...s, [findingId]: prev }))   // rollback
      setError(err instanceof Error ? err.message : 'Failed to update finding status.')
    }
  }, [currentJob, findingStatuses])

  const createEngagement = useCallback(async (
    name: string, fundName: string, fundType: FundType, description?: string
  ) => {
    try {
      const engagement = await jsonPost<Engagement>('/api/engagements', {
        name, fundName, fundType, description: description || null,
      })
      setEngagements(prev => [engagement, ...prev])
      setCurrentEngagement(engagement)
      setViewState('library')
      pushUrl('library', engagement.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create engagement.')
    }
  }, [pushUrl])

  const selectEngagement = useCallback((engagement: Engagement) => {
    setCurrentEngagement(engagement)
    setSelectedDocIds(new Set())   // selection must not carry across engagements
    setViewState('library')
    pushUrl('library', engagement.id)
  }, [pushUrl])

  // Track D surfacing: jump straight to an engagement's most recent persisted
  // run without re-running the pipeline.
  const openLatestRun = useCallback(async (engagement: Engagement) => {
    setCurrentEngagement(engagement)
    setSelectedDocIds(new Set())
    try {
      const job = await apiFetch<AuditJob | null>(`/api/audit/latest?engagementId=${engagement.id}`)
      if (job?.finalReport) {
        setCurrentJob(job)
        setPhases({ prepare: 'done', review: 'done', challenge: 'done', synthesize: 'done' })
        setViewState('report')
        pushUrl('report', engagement.id)
        return
      }
      if (job) setCurrentJob(job)
      setError(job
        ? 'The latest run for this engagement did not complete — start a new run.'
        : 'No runs for this engagement yet.')
      setViewState('library')
      pushUrl('library', engagement.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the latest run.')
      setViewState('library')
      pushUrl('library', engagement.id)
    }
  }, [pushUrl])

  const uploadDocument = useCallback(async (file: File) => {
    if (!currentEngagement) {
      setError('Select an engagement before uploading documents.')
      return
    }
    const key = file.name
    setUploadProgress(p => ({ ...p, [key]: 'uploading' }))
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('engagementId', currentEngagement.id)
      const uploadRes  = await fetch('/api/documents/upload', { method: 'POST', body: formData })
      const uploadJson = await uploadRes.json()
      if (!uploadJson.success) throw new Error(uploadJson.error)
      const doc: FundDocument = uploadJson.data

      setDocuments(prev => {
        const exists = prev.some(d => d.id === doc.id)
        return exists ? prev : [doc, ...prev]
      })

      setUploadProgress(p => ({ ...p, [key]: 'profiling' }))
      const profiled = await apiFetch<FundDocument>(`/api/documents/profile/${doc.id}`, { method: 'POST' })
      setDocuments(prev => prev.map(d => d.id === profiled.id ? profiled : d))
      setUploadProgress(p => { const { [key]: _, ...rest } = p; return rest })
    } catch (err) {
      setUploadProgress(p => ({ ...p, [key]: 'error' }))
      setError(err instanceof Error ? err.message : 'Upload failed.')
    }
  }, [currentEngagement])

  const profileDocument = useCallback(async (docId: string) => {
    try {
      const doc = await apiFetch<FundDocument>(`/api/documents/profile/${docId}`, { method: 'POST' })
      setDocuments(prev => prev.map(d => d.id === doc.id ? doc : d))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profiling failed.')
    }
  }, [])

  // Track C: remove a document (e.g. after a bad extraction) so it can be
  // re-uploaded without restarting the engagement.
  const deleteDocument = useCallback(async (docId: string) => {
    try {
      await apiFetch<{ id: string }>(`/api/documents/${docId}`, { method: 'DELETE' })
      setDocuments(prev => prev.filter(d => d.id !== docId))
      setSelectedDocIds(prev => {
        if (!prev.has(docId)) return prev
        const next = new Set(prev)
        next.delete(docId)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document.')
    }
  }, [])

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev)
      next.has(docId) ? next.delete(docId) : next.add(docId)
      return next
    })
  }, [])

  const selectAllProfiled = useCallback(() => {
    setSelectedDocIds(prev => {
      const next = new Set(prev)
      documents.filter(d => d.profileJson).forEach(d => next.add(d.id))
      return next
    })
  }, [documents])

  const clearSelection = useCallback(() => setSelectedDocIds(new Set()), [])

  // Review + Challenge in parallel, then Synthesize. Shared by the straight-through
  // run and the resume-after-extraction-review path (Track C).
  const runDownstreamPhases = useCallback(async (jobId: string) => {
    setPhases(p => ({ ...p, review: 'running', challenge: 'running' }))
    const [reviewResult, challengeResult] = await Promise.allSettled([
      jsonPost(`/api/audit/${jobId}/review`),
      jsonPost(`/api/audit/${jobId}/challenge`),
    ])
    const reviewFailed    = reviewResult.status === 'rejected'
    const challengeFailed = challengeResult.status === 'rejected'
    setPhases(p => ({
      ...p,
      review:    reviewFailed    ? 'error' : 'done',
      challenge: challengeFailed ? 'error' : 'done',
    }))
    if (reviewFailed || challengeFailed) {
      const msgs = [
        reviewFailed    ? `Review: ${(reviewResult    as PromiseRejectedResult).reason?.message}` : null,
        challengeFailed ? `Challenge: ${(challengeResult as PromiseRejectedResult).reason?.message}` : null,
      ].filter(Boolean)
      throw new Error(msgs.join('; '))
    }

    setPhases(p => ({ ...p, synthesize: 'running' }))
    const finalJob = await jsonPost<AuditJob>(`/api/audit/${jobId}/synthesize`)
    setPhases(p => ({ ...p, synthesize: 'done' }))
    setCurrentJob(finalJob)
    setViewState('report')
    pushUrl('report', engRef.current?.id ?? null)
  }, [pushUrl])

  const startAudit = useCallback(async (
    docIds: string[], fundType: FundType, auditScope: AuditScope, options?: StartAuditOptions,
  ) => {
    if (!currentEngagement) return
    setError(null)
    setAwaitingExtractionReview(false)
    pausedJobIdRef.current = null
    setPhases({ prepare: 'idle', review: 'idle', challenge: 'idle', synthesize: 'idle' })

    let job: AuditJob | null = null
    try {
      job = await jsonPost<AuditJob>('/api/audit/start', {
        engagementId: currentEngagement.id,
        documentIds: docIds,
        fundType,
        auditScope,
        controlPreparerOutput: options?.controlPreparerOutput ?? undefined,
      })
      setCurrentJob(job)
      setViewState('pipeline')
      pushUrl('pipeline', currentEngagement.id)

      // Phase 1: Prepare (extraction + deterministic verification in code).
      // Control runs skip the LLM server-side and only verify.
      setPhases(p => ({ ...p, prepare: 'running' }))
      const prepared = await jsonPost<AuditJob>(`/api/audit/${job.id}/prepare`)
      setPhases(p => ({ ...p, prepare: 'done' }))
      setCurrentJob(prepared)

      // Track C: pause here so the user can tie out the verified figure set
      // before any agent reasons on it (audit analog: tie out the lead schedule).
      if (options?.reviewExtraction) {
        pausedJobIdRef.current = job.id
        setAwaitingExtractionReview(true)
        return
      }

      await runDownstreamPhases(job.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed.')
      if (job) {
        const refreshed = await apiFetch<AuditJob>(`/api/audit/status/${job.id}`).catch(() => null)
        if (refreshed) setCurrentJob(refreshed)
      }
    }
  }, [currentEngagement, runDownstreamPhases, pushUrl])

  const continueAfterExtractionReview = useCallback(async () => {
    const jobId = pausedJobIdRef.current
    if (!jobId) return
    setAwaitingExtractionReview(false)
    pausedJobIdRef.current = null
    try {
      await runDownstreamPhases(jobId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed.')
      const refreshed = await apiFetch<AuditJob>(`/api/audit/status/${jobId}`).catch(() => null)
      if (refreshed) setCurrentJob(refreshed)
    }
  }, [runDownstreamPhases])

  return {
    view, engagements, currentEngagement, documents,
    selectedDocIds, currentJob, phases, uploadProgress, findingStatuses, isLoading, error,
    awaitingExtractionReview,
    createEngagement, selectEngagement, openLatestRun, uploadDocument, profileDocument, deleteDocument,
    toggleDocSelection, selectAllProfiled, clearSelection, startAudit,
    continueAfterExtractionReview, updateFindingStatus,
    setView, clearError, resetForNewRun,
  }
}
