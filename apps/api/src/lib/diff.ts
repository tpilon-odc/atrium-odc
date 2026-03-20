// Calcule le diff avant/après — ne compare que les champs du payload entrant
export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, [unknown, unknown]> {
  const diff: Record<string, [unknown, unknown]> = {}
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      diff[key] = [before[key] ?? null, after[key] ?? null]
    }
  }
  return diff
}
