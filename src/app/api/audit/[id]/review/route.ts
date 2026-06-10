import { NextRequest, NextResponse } from 'next/server'
import { getAuditJob, updateAuditJobStatus, saveReviewerOutput, setAuditJobFailed } from '@/lib/db/auditJobs'
import { handleAnthropicError } from '@/lib/anthropic/errorHandler'
import { buildReviewerSystemPrompt, AGENT_CONFIGS } from '@/lib/agentConfig'
import { reviewerOutputSchema } from '@/lib/zod/schemas'
import { runAgent } from '@/lib/runAgent'
import { runDeterministicChecks, formatChecksForPrompt } from '@/lib/validations'
import { enforceRateLimit } from '@/lib/rateLimit'
import type { ReviewerOutput } from '@/types'

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
    if (!job.preparerOutput) {
      return NextResponse.json(
        { success: false, error: 'Preparer phase must complete before reviewing.' },
        { status: 422 }
      )
    }

    // Idempotent
    if (job.reviewerOutput) {
      return NextResponse.json({ success: true, data: job, cached: true })
    }

    // Only transition to 'reviewing' if we're still in 'preparing' (challenger may have already set this)
    if (job.status === 'preparing') {
      await updateAuditJobStatus(id, 'reviewing')
    }

    const deterministicBlock = formatChecksForPrompt(runDeterministicChecks(job.preparerOutput))

    const userMessage = `Here is the structured fund data extracted by the Preparer agent for a ${job.fundType} fund.

=== PREPARER OUTPUT ===
${JSON.stringify(job.preparerOutput, null, 2)}
===

${deterministicBlock}

Perform your systematic validation and return your ReviewerOutput JSON.`

    const output = await runAgent(
      AGENT_CONFIGS.reviewer,
      buildReviewerSystemPrompt(job.fundType, job.auditScope),
      userMessage,
      reviewerOutputSchema,
    )

    await saveReviewerOutput(id, output as ReviewerOutput)
    const updated = await getAuditJob(id)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    await setAuditJobFailed(id, error instanceof Error ? error.message : 'Review phase failed.').catch(() => {})
    return handleAnthropicError(error)
  }
}
