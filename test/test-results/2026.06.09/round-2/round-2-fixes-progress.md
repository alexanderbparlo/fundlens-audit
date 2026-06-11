● Phase 5 — Track D surfacing + Track E navigation. Reading EngagementView
  first:

  Read 1 file (ctrl+o to expand)

● Now Track E — URL-synced client-side navigation in the hook, plus the
  latest-run opener (Track D surfacing):

● Update(src/hooks/useAuditRun.ts)
  ⎿  Added 1 line
      1  'use client'
      2
      3  import { useState, useCallback, useEffect, useRef } from 're
         act'
      4 +import { useRouter, useSearchParams } from 'next/navigation'
      5  import type { AuditScope, Engagement, FundDocument, AuditJob
         , FundType, FindingStatus, FindingStatusRecord, PreparerOutp
         ut } from '@/types'
      6
      7  export type PhaseStatus = 'idle' | 'running' | 'done' | 'err
         or'

● Update(src/hooks/useAuditRun.ts)
  ⎿  Added 1 line
      38
      39    createEngagement:  (name: string, fundName: string, fundT
          ype: FundType, description?: string) => Promise<void>
      40    selectEngagement:  (e: Engagement) => void
      41 +  openLatestRun:     (e: Engagement) => Promise<void>
      42    uploadDocument:    (file: File) => Promise<void>
      43    profileDocument:   (docId: string) => Promise<void>
      44    deleteDocument:    (docId: string) => Promise<void>

● Update(src/hooks/useAuditRun.ts)
  ⎿  Added 2 lines
      91  // ── Hook ────────────────────────────────────────────────
          ──────────────────────
      92
      93  export function useAuditRun(): AuditRunHook {
      94 +  const router = useRouter()
      95 +  const searchParams = useSearchParams()
      96    const [view,              setViewState]      = useState<A
          ppView>('engagement')
      97    const [engagements,       setEngagements]    = useState<E
          ngagement[]>([])
      98    const [currentEngagement, setCurrentEngagement] = useStat
          e<Engagement | null>(null)
  ⎿  You've hit your monthly spend limit.
     /usage-credits to adjust your monthly spend limit.

✻ Churned for 21m 31s

❯ I added more usage credits. Does it reflect here?
  ⎿  You've hit your monthly spend limit.
     /usage-credits to adjust your monthly spend limit.

✻ Crunched for 0s

❯ Please continue
  ⎿  You've hit your monthly spend limit.
     /usage-credits to adjust your monthly spend limit.

✻ Crunched for 0s

  7 tasks (5 done, 1 in progress, 1 open)
  ◼ Phase 5: Track D persistence + Track E navigation
  ◻ Verify, commit, migrate Neon, deploy to prod
  ✔ Phase 0: extraction schema expansion + sign normalization mo…
  ✔ Phase 1: rewrite validations.ts as C1–C10 verification layer
  ✔ Phase 2: vitest regression suite from §6 fixtures
   … +2 completed
