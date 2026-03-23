import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { STATUS_LABELS } from '@/lib/design-tokens'

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  not_started: 'muted',
  draft: 'info',
  submitted: 'success',
  expiring_soon: 'warning',
  expired: 'danger',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'muted'}>
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
    </Badge>
  )
}
