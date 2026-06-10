import { NextRequest, NextResponse } from 'next/server'
import { getAuditJob, updateAuditJobStatus, saveChallengerOutput, setAuditJobFailed } from '@/lib/db/auditJobs'
import { handleAnthropicError } from '@/lib/anthropic/errorHandler'
import { buildChallengerSystemPrompt, AGENT_CONFIGS } from '@/lib/agentConfig'
import { challengerOutputSchema } from '@/lib/zod/schemas'
import { runAgent } from '@/lib/runAgent'
import { runDeterministicChecks, formatChecksForPrompt } from '@/lib/validations'
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

    const deterministicBlock = formatChecksForPrompt(runDeterministicChecks(job.preparerOutput))

    const userMessage = `Here is the structured fund data extracted by the Preparer agent for a ${job.fundType} fund.

=== PREPARER OUTPUT ===
${JSON.stringify(job.preparerOutput, null, 2)}
===

${deterministicBlock}

Apply your adversarial lens and return your ChallengerOutput JSON.`

    const output = await runAgent(
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
