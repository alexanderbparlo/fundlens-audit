'use client'

/** Trigger a client-side file download from a string payload. */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Open a fully-formed HTML document in a new window and invoke the print dialog,
 * letting the user "Save as PDF". Returns false if the popup was blocked.
 */
export function printHtmlDocument(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()

  let printed = false
  const doPrint = () => {
    if (printed) return
    printed = true
    try { win.focus(); win.print() } catch { /* window may have been closed */ }
  }
  // Print once layout/fonts are ready; fall back to a timer since onload is
  // unreliable after document.write across browsers.
  win.onload = doPrint
  setTimeout(doPrint, 600)
  return true
}

/** Sanitize a string into a safe filename slug. */
export function slugifyFilename(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'fundlens-audit'
}
