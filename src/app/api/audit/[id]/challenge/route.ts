import { NextRequest, NextResponse } from 'next/server'
import { getAuditJob, updateAuditJobStatus, saveChallengerOutput, setAuditJobFailed } from '@/lib/db/auditJobs'
import { handleAnthropicError } from '@/lib/anthropic/errorHandler'
import { anthropicFromRequest } from '@/lib/anthropic/client'
import { buildChallengerSystemPrompt, AGENT_CONFIGS } from '@/lib/agentConfig'
import { challengerOutputSchema } from '@/lib/zod/schemas'
import { runAgent } from '@/lib/runAgent'
import { runVerification, formatVerificationForPrompt } from '@/lib/validations'
import { enforceRateLimit } from '@/lib/rateLimit'
import type { ChallengerOutput } from '@/types'

export const maxDuration = 300

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await enforceRateLimit(req, 'agent')
  if (limited) return limited

  const { id } = await params

  try {
    const client = anthropicFromRequest(req)

    const job = await getAuditJob(id)
    if (!job) {
      return NextResponse.json({ success: false, error: 'Audit job not found.' }, { status: 404 })
    }
    if (!job.preparerOutput) {
      return NextResponse.json(
        { success: false, error: 'Preparer phase must complete before challenging.' },
        { status: 422 }
      )
    }

    // Idempotent
    if (job.challengerOutput) {
      return NextResponse.json({ success: true, data: job, cached: true })
    }

    // Challenger and Reviewer run in parallel — both set status to 'reviewing'
    if (job.status === 'preparing') {
      await updateAuditJobStatus(id, 'reviewing')
    }

    // Verification is computed once in the prepare phase and persisted with the
    // run; recompute only for legacy jobs that predate persistence.
    const verification = job.verification ?? runVerification(job.preparerOutput)
    const deterministicBlock = formatVerificationForPrompt(verification)

    const userMessage = `Here is the structured fund data extracted by the Preparer agent for a ${job.fundType} fund.

=== PREPARER OUTPUT ===
${JSON.stringify(job.preparerOutput, null, 2)}
===

${deterministicBlock}

Apply your adversarial lens and return your ChallengerOutput JSON.`

    const output = await runAgent(
      client,
      AGENT_CONFIGS.challenger,
      buildChallengerSystemPrompt(job.fundType, job.auditScope),
      userMessage,
      challengerOutputSchema,
    )

    await saveChallengerOutput(id, output as ChallengerOutput)
    const updated = await getAuditJob(id)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    await setAuditJobFailed(id, error instanceof Error ? error.message : 'Challenge phase failed.').catch(() => {})
    return handleAnthropicError(error)
  }
}
