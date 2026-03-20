import { Badge } from '@/components/ui/badge'

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Non commencé',
  draft: 'Brouillon',
  submitted: 'Soumis',
  expiring_soon: 'Expire bientôt',
  expired: 'Expiré',
}

const STATUS_VARIANTS: Record<string, 'muted' | 'default' | 'success' | 'warning' | 'destructive'> = {
  not_started: 'muted',
  draft: 'default',
  submitted: 'success',
  expiring_soon: 'warning',
  expired: 'destructive',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'muted'}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
