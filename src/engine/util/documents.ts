import path from 'node:path'
import { ToolError } from '../tools/types'

export type DocumentKind = 'pdf' | 'docx' | 'xlsx'

const BY_EXTENSION: Record<string, DocumentKind> = { '.pdf': 'pdf', '.docx': 'docx', '.xlsx': 'xlsx', '.xlsm': 'xlsx' }

const BY_TYPE: [string, DocumentKind][] = [
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.ms-excel.sheet.macroenabled.12', 'xlsx']
]

const OLD_FORMATS: Record<string, string> = {
  '.doc': 'Word 97-2003 (.doc)',
  '.xls': 'Excel 97-2003 (.xls)',
  '.ppt': 'PowerPoint 97-2003 (.ppt)',
  '.pptx': 'PowerPoint (.pptx)'
}

export function documentKind(name: string, contentType = ''): DocumentKind | null {
  const type = contentType.toLowerCase()
  for (const [prefix, kind] of BY_TYPE) if (type.startsWith(prefix)) return kind
  return BY_EXTENSION[path.extname(name.split(/[?#]/)[0]).toLowerCase()] ?? null
}

export function unreadableFormat(name: string): string | null {
  return OLD_FORMATS[path.extname(name.split(/[?#]/)[0]).toLowerCase()] ?? null
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().replace(/T00:00:00\.000Z$/, '').replace(/\.000Z$/, 'Z')
  return String(value).replace(/\s*\n\s*/g, ' ').trim()
}

async function pdfText(data: Buffer, name: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  let pages: string[]
  try {
    const pdf = await getDocumentProxy(new Uint8Array(data))
    pages = (await extractText(pdf, { mergePages: false })).text
  } catch (err) {
    if (/password/i.test(String(err))) throw new ToolError(`${name} is a password-protected PDF, so it can't be read. Ask the user for an unlocked copy.`)
    throw new ToolError(`${name} could not be opened as a PDF (${err instanceof Error ? err.message : String(err)}). It may be damaged or not really a PDF; ask the user for another copy.`)
  }
  if (!pages.some((p) => p.trim())) throw new ToolError(`${name} has no text in it; it is probably scanned pages (pictures of text). Tell the user it can't be read as text.`)
  return pages.map((p, i) => `[page ${i + 1} of ${pages.length}]\n${p.trim()}`).join('\n\n')
}

async function docxText(data: Buffer, name: string): Promise<string> {
  const mammoth = (await import('mammoth')).default
  try {
    const result = await mammoth.extractRawText({ buffer: data })
    return result.value.replace(/\n{3,}/g, '\n\n').trim()
  } catch (err) {
    throw new ToolError(`${name} could not be opened as a Word document (${err instanceof Error ? err.message : String(err)}). It may be damaged; ask the user for another copy.`)
  }
}

async function xlsxText(data: Buffer, name: string): Promise<string> {
  const readXlsxFile = (await import('read-excel-file/node')).default
  let sheets: Awaited<ReturnType<typeof readXlsxFile>>
  try {
    sheets = await readXlsxFile(data)
  } catch (err) {
    throw new ToolError(`${name} could not be opened as an Excel workbook (${err instanceof Error ? err.message : String(err)}). It may be damaged; ask the user for another copy.`)
  }
  return sheets
    .map((s) => {
      const rows = s.data.map((row) => row.map(cell))
      const width = rows.reduce((w, r) => {
        let last = r.length
        while (last > 0 && !r[last - 1]) last--
        return Math.max(w, last)
      }, 0)
      const lines = rows.filter((r) => r.some(Boolean)).map((r) => r.slice(0, width).join(' | '))
      return `[sheet "${s.sheet}", ${lines.length} rows]\n${lines.join('\n')}`
    })
    .join('\n\n')
}

export async function documentText(kind: DocumentKind, data: Buffer, name: string): Promise<string> {
  if (kind === 'pdf') return pdfText(data, name)
  if (kind === 'docx') return docxText(data, name)
  return xlsxText(data, name)
}
