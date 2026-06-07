import { NextRequest, NextResponse } from 'next/server'
import { getAuditJob, updateAuditJobStatus, saveFinalReport, setAuditJobFailed } from '@/lib/db/auditJobs'
import { handleAnthropicError } from '@/lib/anthropic/errorHandler'
import { buildSynthesizerSystemPrompt, AGENT_CONFIGS } from '@/lib/agentConfig'
import { synthesisReportSchema } from '@/lib/zod/schemas'
import { runAgent } from '@/lib/runAgent'
import { enforceRateLimit } from '@/lib/rateLimit'
import type { SynthesisReport } from '@/types'

export const maxDuration = 300

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await enforceRateLimit(req, 'agent')
  if (limited) return limited

  const { id } = await params

  try {
    const job = await getAuditJob(id)
    if (!job) {
      return NextResponse.json({ success: false, error: 'Audit job not found.' }, { status: 404 })
    }
    if (!job.reviewerOutput || !job.challengerOutput) {
      return NextResponse.json(
        { success: false, error: 'Both review and challenge phases must complete before synthesizing.' },
        { status: 422 }
      )
    }

    // Idempotent
    if (job.finalReport) {
      return NextResponse.json({ success: true, data: job, cached: true })
    }

    await updateAuditJobStatus(id, 'synthesizing')

    const userMessage = `You have three prior agent outputs for this ${job.fundType} fund audit to synthesize into the final report.

=== PREPARER OUTPUT ===
${JSON.stringify(job.preparerOutput, null, 2)}

=== REVIEWER OUTPUT ===
${JSON.stringify(job.reviewerOutput, null, 2)}

=== CHALLENGER OUTPUT ===
${JSON.stringify(job.challengerOutput, null, 2)}

Produce the final SynthesisReport JSON.`

    const output = await runAgent(
      AGENT_CONFIGS.synthesizer,
      buildSynthesizerSystemPrompt(job.fundType, job.auditScope),
      userMessage,
      synthesisReportSchema,
    )

    const updated = await saveFinalReport(id, output as SynthesisReport)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    await setAuditJobFailed(id, error instanceof Error ? error.message : 'Synthesize phase failed.').catch(() => {})
    return handleAnthropicError(error)
  }
}
