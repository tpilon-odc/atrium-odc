/**
 * Génère une chaîne CSV à partir d'un tableau d'objets.
 * Les valeurs contenant une virgule, des guillemets ou des sauts de ligne sont encadrées.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''

  const headers = Object.keys(rows[0])
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ]

  return lines.join('\n')
}

export function csvReply(
  reply: { header: (k: string, v: string) => void; send: (b: string) => unknown },
  filename: string,
  content: string
) {
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header('Content-Disposition', `attachment; filename="${filename}"`)
  return reply.send(content)
}
