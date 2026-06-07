'use client'

import { useState, useCallback, useEffect } from 'react'
import type { AuditScope, Engagement, FundDocument, AuditJob, FundType, FindingStatus, FindingStatusRecord } from '@/types'

export type PhaseStatus = 'idle' | 'running' | 'done' | 'error'
export type AppView = 'engagement' | 'library' | 'setup' | 'pipeline' | 'report'
export type UploadStage = 'uploading' | 'profiling' | 'done' | 'error'

export interface PipelinePhases {
  prepare:   PhaseStatus
  review:    PhaseStatus
  challenge: PhaseStatus
  synthesize: PhaseStatus
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

  createEngagement:  (name: string, fundName: string, fundType: FundType, description?: string) => Promise<void>
  selectEngagement:  (e: Engagement) => void
  uploadDocument:    (file: File) => Promise<void>
  profileDocument:   (docId: string) => Promise<void>
  toggleDocSelection: (docId: string) => void
  selectAllProfiled: () => void
  clearSelection:    () => void
  startAudit:        (docIds: string[], fundType: FundType, auditScope: AuditScope) => Promise<void>
  updateFindingStatus: (findingId: string, status: FindingStatus, note?: string | null) => Promise<void>
  setView:           (v: AppView) => void
  clearError:        () => void
  resetForNewRun:    () => void
}

// ── Module-level API helpers ──────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
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

  // ── Initial data load ───────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const [engRes, docsRes] = await Promise.all([
          fetch('/api/engagements'),
          fetch('/api/documents'),
        ])
        const [engJson, docsJson] = await Promise.all([engRes.json(), docsRes.json()])
        if (engJson.success)  setEngagements(engJson.data)
        if (docsJson.success) setDocuments(docsJson.data)
      } catch {
        setError('Failed to load initial data.')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

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

  const setView      = useCallback((v: AppView) => setViewState(v), [])
  const clearError   = useCallback(() => setError(null), [])
  const resetForNewRun = useCallback(() => {
    setCurrentJob(null)
    setFindingStatuses({})
    setPhases({ prepare: 'idle', review: 'idle', challenge: 'idle', synthesize: 'idle' })
    setViewState('setup')
  }, [])

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create engagement.')
    }
  }, [])

  const selectEngagement = useCallback((engagement: Engagement) => {
    setCurrentEngagement(engagement)
    setViewState('library')
  }, [])

  const uploadDocument = useCallback(async (file: File) => {
    const key = file.name
    setUploadProgress(p => ({ ...p, [key]: 'uploading' }))
    try {
      const formData = new FormData()
      formData.append('file', file)
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
  }, [])

  const profileDocument = useCallback(async (docId: string) => {
    try {
      const doc = await apiFetch<FundDocument>(`/api/documents/profile/${docId}`, { method: 'POST' })
      setDocuments(prev => prev.map(d => d.id === doc.id ? doc : d))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profiling failed.')
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

  const startAudit = useCallback(async (docIds: string[], fundType: FundType, auditScope: AuditScope) => {
    if (!currentEngagement) return
    setError(null)
    setPhases({ prepare: 'idle', review: 'idle', challenge: 'idle', synthesize: 'idle' })

    let job: AuditJob | null = null
    try {
      job = await jsonPost<AuditJob>('/api/audit/start', {
        engagementId: currentEngagement.id,
        documentIds: docIds,
        fundType,
        auditScope,
      })
      setCurrentJob(job)
      setViewState('pipeline')

      // Phase 1: Prepare
      setPhases(p => ({ ...p, prepare: 'running' }))
      await jsonPost(`/api/audit/${job.id}/prepare`)
      setPhases(p => ({ ...p, prepare: 'done' }))

      // Phase 2: Review + Challenge in parallel
      setPhases(p => ({ ...p, review: 'running', challenge: 'running' }))
      const [reviewResult, challengeResult] = await Promise.allSettled([
        jsonPost(`/api/audit/${job.id}/review`),
        jsonPost(`/api/audit/${job.id}/challenge`),
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

      // Phase 3: Synthesize
      setPhases(p => ({ ...p, synthesize: 'running' }))
      const finalJob = await jsonPost<AuditJob>(`/api/audit/${job.id}/synthesize`)
      setPhases(p => ({ ...p, synthesize: 'done' }))
      setCurrentJob(finalJob)
      setViewState('report')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed.')
      if (job) {
        const refreshed = await apiFetch<AuditJob>(`/api/audit/status/${job.id}`).catch(() => null)
        if (refreshed) setCurrentJob(refreshed)
      }
    }
  }, [currentEngagement])

  return {
    view, engagements, currentEngagement, documents,
    selectedDocIds, currentJob, phases, uploadProgress, findingStatuses, isLoading, error,
    createEngagement, selectEngagement, uploadDocument, profileDocument,
    toggleDocSelection, selectAllProfiled, clearSelection, startAudit, updateFindingStatus,
    setView, clearError, resetForNewRun,
  }
}
