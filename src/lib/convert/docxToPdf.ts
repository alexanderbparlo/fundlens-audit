import CloudConvert from 'cloudconvert'

// Word document MIME types we accept and convert to PDF before ingestion.
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const DOC_MIME = 'application/msword'

export function isWordDocument(mimeType: string): boolean {
  return mimeType === DOCX_MIME || mimeType === DOC_MIME
}

let client: CloudConvert | null = null
function getClient(): CloudConvert {
  const key = process.env.CLOUDCONVERT_API_KEY
  if (!key) throw new Error('CLOUDCONVERT_API_KEY is not set — DOCX conversion is unavailable.')
  if (!client) client = new CloudConvert(key)
  return client
}

/** Whether DOCX conversion is configured in this environment. */
export function isConversionAvailable(): boolean {
  return Boolean(process.env.CLOUDCONVERT_API_KEY)
}

function inputFormatFor(mimeType: string): 'docx' | 'doc' {
  return mimeType === DOC_MIME ? 'doc' : 'docx'
}

/**
 * Convert a Word document buffer to a PDF buffer via CloudConvert.
 * Flow: import/upload → convert → export/url → fetch the result.
 * Requires CLOUDCONVERT_API_KEY with task.read + task.write scopes.
 */
export async function convertWordToPdf(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<Buffer> {
  const cc = getClient()

  const job = await cc.jobs.create({
    tasks: {
      'import-file': { operation: 'import/upload' },
      'convert-file': {
        operation: 'convert',
        input: 'import-file',
        input_format: inputFormatFor(mimeType),
        output_format: 'pdf',
      },
      'export-file': { operation: 'export/url', input: 'convert-file' },
    },
  })

  const importTask = job.tasks.find(t => t.name === 'import-file')
  if (!importTask) throw new Error('CloudConvert: import task was not created.')

  await cc.tasks.upload(importTask, buffer, filename)

  const completed = await cc.jobs.wait(job.id)
  if (completed.status === 'error') {
    const failed = completed.tasks.find(t => t.status === 'error')
    throw new Error(`CloudConvert conversion failed: ${failed?.message ?? 'unknown error'}`)
  }

  const exportTask = completed.tasks.find(t => t.name === 'export-file')
  const fileUrl = exportTask?.result?.files?.[0]?.url
  if (!fileUrl) throw new Error('CloudConvert did not return a converted file URL.')

  const res = await fetch(fileUrl)
  if (!res.ok) throw new Error(`Failed to download converted PDF (${res.status}).`)
  return Buffer.from(await res.arrayBuffer())
}
