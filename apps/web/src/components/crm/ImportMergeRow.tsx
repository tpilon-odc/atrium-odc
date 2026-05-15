'use client'

import { ImportContact } from '@/lib/api'
import { cn } from '@/lib/utils'

const FIELDS: Array<{ key: keyof ImportContact; label: string }> = [
  { key: 'firstName', label: 'Prénom' },
  { key: 'lastName', label: 'Nom' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'birthDate', label: 'Date de naissance' },
  { key: 'address', label: 'Adresse' },
  { key: 'city', label: 'Ville' },
  { key: 'postalCode', label: 'Code postal' },
  { key: 'country', label: 'Pays' },
  { key: 'type', label: 'Type' },
]

export type MergeDecision = ImportContact & { existingId: string }

interface ImportMergeRowProps {
  incoming: ImportContact
  existing: ImportContact & { id: string }
  value: MergeDecision
  onChange: (decision: MergeDecision) => void
}

export function ImportMergeRow({ incoming, existing, value, onChange }: ImportMergeRowProps) {
  function pickAll(source: 'incoming' | 'existing') {
    const base = source === 'incoming' ? incoming : existing
    onChange({ ...base, existingId: existing.id })
  }

  function pickField(key: keyof ImportContact, source: 'incoming' | 'existing') {
    const val = source === 'incoming' ? incoming[key] : existing[key]
    onChange({ ...value, [key]: val })
  }

  function isFromIncoming(key: keyof ImportContact) {
    return value[key] === incoming[key]
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* En-tête avec actions rapides */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
        <span className="text-sm font-medium">
          {existing.firstName} {existing.lastName}
        </span>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground underline underline-offset-2"
            onClick={() => pickAll('existing')}
          >
            Tout garder
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground underline underline-offset-2"
            onClick={() => pickAll('incoming')}
          >
            Tout remplacer
          </button>
        </div>
      </div>

      {/* Colonnes : libellé | existant | import */}
      <div className="grid grid-cols-[1fr_1fr_1fr] text-xs border-b border-border bg-muted/20">
        <div className="px-3 py-1.5 font-medium text-muted-foreground">Champ</div>
        <div className="px-3 py-1.5 font-medium text-muted-foreground border-l border-border">Valeur actuelle</div>
        <div className="px-3 py-1.5 font-medium text-muted-foreground border-l border-border">Valeur importée</div>
      </div>

      {FIELDS.map(({ key, label }) => {
        const existingVal = String(existing[key] ?? '—')
        const incomingVal = String(incoming[key] ?? '—')
        const isDiff = existingVal !== incomingVal
        const currentIsIncoming = isFromIncoming(key)

        return (
          <div
            key={key}
            className={cn(
              'grid grid-cols-[1fr_1fr_1fr] text-sm border-b border-border last:border-0',
              isDiff && 'bg-amber-50/40 dark:bg-amber-950/20'
            )}
          >
            <div className="px-3 py-2 text-muted-foreground text-xs flex items-center">{label}</div>

            {/* Valeur existante */}
            <button
              type="button"
              className={cn(
                'px-3 py-2 text-left border-l border-border transition-colors',
                !currentIsIncoming && isDiff
                  ? 'bg-primary/10 font-medium'
                  : 'hover:bg-muted/40'
              )}
              onClick={() => isDiff && pickField(key, 'existing')}
              disabled={!isDiff}
            >
              {existingVal}
            </button>

            {/* Valeur importée */}
            <button
              type="button"
              className={cn(
                'px-3 py-2 text-left border-l border-border transition-colors',
                currentIsIncoming && isDiff
                  ? 'bg-primary/10 font-medium'
                  : 'hover:bg-muted/40'
              )}
              onClick={() => isDiff && pickField(key, 'incoming')}
              disabled={!isDiff}
            >
              {incomingVal}
            </button>
          </div>
        )
      })}
    </div>
  )
}
