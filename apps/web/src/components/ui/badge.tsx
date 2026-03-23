import { cn } from '@/lib/utils'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'destructive'

const variants: Record<BadgeVariant, string> = {
  default:     'bg-primary/10 text-primary',
  success:     'bg-success-subtle text-success-subtle-foreground',
  warning:     'bg-warning-subtle text-warning-subtle-foreground',
  danger:      'bg-danger-subtle text-danger-subtle-foreground',
  destructive: 'bg-danger-subtle text-danger-subtle-foreground',
  info:        'bg-info-subtle text-info-subtle-foreground',
  muted:       'bg-muted text-muted-foreground',
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
