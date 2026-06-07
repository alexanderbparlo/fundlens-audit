// Minimal, dependency-free PDF writer for synthetic fund documents.
// Supports multi-page text layout with the standard Helvetica fonts (no embedding),
// headings, paragraphs with word-wrap, and simple right-aligned amount columns.
//
// This is intentionally small: it produces clean, text-based PDFs that read well
// as Anthropic document blocks. It is not a general-purpose PDF library.

const PAGE_W = 612   // US Letter, points
const PAGE_H = 792
const MARGIN = 56

// Approximate average glyph widths (in 1/1000 em) for line-fitting and
// right-alignment. Good enough for synthetic documents; not metrically exact.
const AVG_WIDTH = { regular: 500, bold: 540, mono: 600 }

function escapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function textWidth(text, fontSize, font) {
  return (text.length * AVG_WIDTH[font] * fontSize) / 1000
}

const FONT_RES = { regular: 'F1', bold: 'F2', mono: 'F3' }

export class PdfDoc {
  constructor() {
    this.pages = []          // each: { ops: string[] }
    this._newPage()
  }

  _newPage() {
    this.page = { ops: [] }
    this.pages.push(this.page)
    this.y = PAGE_H - MARGIN
  }

  _ensureSpace(height) {
    if (this.y - height < MARGIN) this._newPage()
  }

  /** Draw a single line of text at an absolute x, current y is unchanged. */
  _drawAt(text, x, y, { size = 10, font = 'regular' } = {}) {
    this.page.ops.push(
      `BT /${FONT_RES[font]} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapeText(text)}) Tj ET`
    )
  }

  /** Word-wrapped paragraph. Advances y. */
  paragraph(text, { size = 10, font = 'regular', leading = 14, gapAfter = 6, indent = 0 } = {}) {
    const maxWidth = PAGE_W - 2 * MARGIN - indent
    const words = String(text).split(/\s+/)
    let line = ''
    const flush = () => {
      this._ensureSpace(leading)
      this._drawAt(line, MARGIN + indent, this.y, { size, font })
      this.y -= leading
      line = ''
    }
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w
      if (textWidth(candidate, size, font) > maxWidth && line) {
        flush()
        line = w
      } else {
        line = candidate
      }
    }
    if (line) flush()
    this.y -= gapAfter
  }

  heading(text, { size = 16, gapBefore = 6, gapAfter = 8 } = {}) {
    this.y -= gapBefore
    this._ensureSpace(size + 4)
    this._drawAt(text, MARGIN, this.y, { size, font: 'bold' })
    this.y -= size + gapAfter
  }

  subheading(text, { size = 11, gapBefore = 8, gapAfter = 5 } = {}) {
    this.y -= gapBefore
    this._ensureSpace(size + 2)
    this._drawAt(text, MARGIN, this.y, { size, font: 'bold' })
    this.y -= size + gapAfter
  }

  /** A label on the left and a value on the right, on one line. */
  keyValue(label, value, { size = 10, leading = 15, labelFont = 'regular', valueFont = 'mono' } = {}) {
    this._ensureSpace(leading)
    this._drawAt(label, MARGIN, this.y, { size, font: labelFont })
    const vw = textWidth(value, size, valueFont)
    this._drawAt(value, PAGE_W - MARGIN - vw, this.y, { size, font: valueFont })
    this.y -= leading
  }

  /** Table row: left description + right-aligned amount, with optional bold. */
  amountRow(label, amount, { size = 10, leading = 15, bold = false, indent = 0 } = {}) {
    this._ensureSpace(leading)
    const font = bold ? 'bold' : 'regular'
    this._drawAt(label, MARGIN + indent, this.y, { size, font })
    const aw = textWidth(amount, size, 'mono')
    this._drawAt(amount, PAGE_W - MARGIN - aw, this.y, { size, font: bold ? 'bold' : 'mono' })
    this.y -= leading
  }

  /** Horizontal rule. */
  rule({ gap = 4 } = {}) {
    this._ensureSpace(gap + 2)
    this.y -= gap
    this.page.ops.push(
      `${MARGIN} ${this.y.toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${this.y.toFixed(2)} l 0.6 w 0.7 0.7 0.7 RG S`
    )
    this.y -= gap
  }

  spacer(h = 10) { this.y -= h }

  /** Serialize all pages to a Buffer of PDF bytes. */
  toBuffer() {
    const objects = []          // index 0 unused (object numbers are 1-based)
    const add = (body) => { objects.push(body); return objects.length }

    // Fonts (standard 14 — no embedding needed)
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
    const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>')

    const fontDict =
      `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >>`

    // Reserve the Pages object number now so page objects can reference it.
    const pagesObjNum = objects.length + 1
    add('') // placeholder, filled below

    const pageObjNums = []
    for (const page of this.pages) {
      const stream = page.ops.join('\n')
      const contentNum = add(
        `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
      )
      const pageNum = add(
        `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources ${fontDict} /Contents ${contentNum} 0 R >>`
      )
      pageObjNums.push(pageNum)
    }

    objects[pagesObjNum - 1] =
      `<< /Type /Pages /Count ${pageObjNums.length} /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] >>`

    const catalogNum = add(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`)

    // Assemble file with a cross-reference table.
    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
    const offsets = []
    for (let i = 0; i < objects.length; i++) {
      offsets[i] = Buffer.byteLength(pdf, 'latin1')
      pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
    }
    const xrefOffset = Buffer.byteLength(pdf, 'latin1')
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (let i = 0; i < objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\n`
    pdf += `startxref\n${xrefOffset}\n%%EOF`

    return Buffer.from(pdf, 'latin1')
  }
}
