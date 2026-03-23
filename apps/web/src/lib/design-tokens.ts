/**
 * Design tokens — CGP Platform
 *
 * Source de vérité pour les choix de design.
 * Toutes les valeurs correspondant à des CSS variables dans globals.css.
 * Utiliser les classes Tailwind (`bg-primary`, `text-success`, etc.) en priorité.
 * Ce fichier sert de référence et pour les cas où du CSS dynamique est nécessaire.
 */

// ── Couleurs sémantiques ────────────────────────────────────────────────────

export const STATUS_COLORS = {
  /** Item soumis, valide */
  submitted: {
    bg: 'bg-success-subtle',
    text: 'text-success-subtle-foreground',
    badge: 'bg-success-subtle text-success-subtle-foreground',
    dot: 'bg-success',
  },
  /** Item expirant dans les 30 jours */
  expiring_soon: {
    bg: 'bg-warning-subtle',
    text: 'text-warning-subtle-foreground',
    badge: 'bg-warning-subtle text-warning-subtle-foreground',
    dot: 'bg-warning',
  },
  /** Item expiré */
  expired: {
    bg: 'bg-danger-subtle',
    text: 'text-danger-subtle-foreground',
    badge: 'bg-danger-subtle text-danger-subtle-foreground',
    dot: 'bg-danger',
  },
  /** Non commencé */
  not_started: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  /** Brouillon / en cours de saisie */
  draft: {
    bg: 'bg-info-subtle',
    text: 'text-info-subtle-foreground',
    badge: 'bg-info-subtle text-info-subtle-foreground',
    dot: 'bg-info',
  },
} as const

export type ComplianceStatus = keyof typeof STATUS_COLORS

// ── Libellés statuts conformité ─────────────────────────────────────────────

export const STATUS_LABELS: Record<ComplianceStatus, string> = {
  submitted: 'Conforme',
  expiring_soon: 'Expire bientôt',
  expired: 'Expiré',
  not_started: 'Non démarré',
  draft: 'En cours',
}

// ── Typographie ─────────────────────────────────────────────────────────────

export const TEXT_SIZES = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
} as const

export const FONT_WEIGHTS = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
} as const

// ── Spacing ─────────────────────────────────────────────────────────────────

export const CARD_PADDING = 'px-6 py-5'
export const CARD_PADDING_SM = 'px-4 py-3'
export const LIST_GAP = 'space-y-2'
export const SECTION_GAP = 'space-y-6'

// ── Composants récurrents ────────────────────────────────────────────────────

export const CARD_BASE = 'bg-card border border-border rounded-lg'
export const CARD_INTERACTIVE = `${CARD_BASE} hover:shadow-card transition-shadow`

export const EMPTY_STATE_BASE = `${CARD_BASE} ${CARD_PADDING} text-center`

export const SKELETON_BASE = 'bg-muted animate-pulse rounded-lg'
