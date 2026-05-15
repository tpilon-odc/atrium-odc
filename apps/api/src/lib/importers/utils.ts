import * as XLSX from 'xlsx'

export function parseFileToRows(buffer: Buffer, filename: string): Record<string, string>[] {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    const wb = XLSX.read(buffer, { type: 'buffer', raw: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  }

  if (ext === 'xls' || ext === 'xlsx') {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  }

  throw new Error('Format non supporté. Utilisez XLS, XLSX ou CSV.')
}

export function normalizeDate(val: string | undefined): string | null {
  if (!val) return null
  // Excel stocke les dates comme numéros de série
  if (/^\d{5}$/.test(val.trim())) {
    const d = XLSX.SSF.parse_date_code(Number(val))
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  // Formats texte courants : DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const dmY = val.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (dmY) return `${dmY[3]}-${dmY[2]}-${dmY[1]}`
  const Ymd = val.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (Ymd) return val
  return null
}

export function col(row: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]?.trim()
    if (v) return v
  }
  return null
}
