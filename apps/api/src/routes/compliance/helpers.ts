import { CabinetComplianceAnswer } from '@cgp/db'

export type ItemStatus = 'not_started' | 'submitted' | 'expiring_soon' | 'expired'

const EXPIRING_SOON_DAYS = 30

export function calculateItemStatus(answer: CabinetComplianceAnswer | null): ItemStatus {
  if (!answer || answer.status !== 'submitted') return 'not_started'
  if (!answer.expiresAt) return 'submitted'

  const now = new Date()
  if (answer.expiresAt < now) return 'expired'

  const threshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
  if (answer.expiresAt <= threshold) return 'expiring_soon'

  return 'submitted'
}

// Un item est "complété" pour le calcul de progression si son statut est submitted ou expiring_soon
export function isItemCompleted(status: ItemStatus): boolean {
  return status === 'submitted' || status === 'expiring_soon'
}

export type PhaseProgressData = {
  total: number
  completed: number
  percentage: number
  status: 'not_started' | 'in_progress' | 'completed'
}

export function calculatePhaseProgress(
  items: Array<{ isRequired: boolean; status: ItemStatus }>
): PhaseProgressData {
  const required = items.filter((i) => i.isRequired)
  const total = required.length
  const completed = required.filter((i) => isItemCompleted(i.status)).length
  const percentage = total === 0 ? 100 : Math.round((completed / total) * 100)
  const status =
    percentage === 100 ? 'completed'
    : completed > 0 ? 'in_progress'
    : 'not_started'
  return { total, completed, percentage, status }
}
