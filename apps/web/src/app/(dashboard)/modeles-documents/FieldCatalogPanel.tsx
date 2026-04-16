'use client'

import { Check, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { FieldCatalog, FieldCatalogItem, TemplateVariable } from '@/lib/api'

interface FieldCatalogPanelProps {
  catalog: FieldCatalog
  targetEntity: 'CONTACT' | 'CABINET' | 'COMPLIANCE'
  variables: TemplateVariable[]
  onAdd: (field: FieldCatalogItem) => void
}

const TYPE_LABELS: Record<string, string> = {
  text: 'Texte',
  radio: 'Choix unique',
  checkbox: 'Choix multiple',
  doc: 'Document',
}

export default function FieldCatalogPanel({ catalog, targetEntity, variables, onAdd }: FieldCatalogPanelProps) {
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({})

  const isAdded = (fieldKey: string) => variables.some((v) => v.fieldKey === fieldKey)

  const togglePhase = (phaseId: string) => {
    setOpenPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }))
  }

  const standardFields = targetEntity === 'COMPLIANCE'
    ? catalog.COMPLIANCE
    : targetEntity === 'CABINET'
      ? catalog.CABINET
      : catalog.CONTACT

  return (
    <div className="border rounded-md divide-y max-h-96 overflow-y-auto text-sm">
      {/* Champs fixes de l'entité */}
      {standardFields.map((field) => (
        <FieldRow key={field.fieldKey} field={field} added={isAdded(field.fieldKey)} onAdd={onAdd} />
      ))}

      {/* Champs conformité dynamiques (groupés par phase) */}
      {targetEntity === 'COMPLIANCE' && catalog.COMPLIANCE_PHASES.map((phase) => (
        <div key={phase.phaseId}>
          <button
            type="button"
            onClick={() => togglePhase(phase.phaseId)}
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors font-medium text-xs uppercase tracking-wide text-muted-foreground"
          >
            <span>{phase.phaseLabel}</span>
            {openPhases[phase.phaseId]
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            }
          </button>
          {openPhases[phase.phaseId] && phase.items.map((field) => (
            <FieldRow key={field.fieldKey} field={field} added={isAdded(field.fieldKey)} onAdd={onAdd} showType />
          ))}
        </div>
      ))}

      {/* Champs système — toujours visibles */}
      <div>
        <div className="px-3 py-2 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Système
        </div>
        {catalog.SYSTEM.map((field) => (
          <FieldRow key={field.fieldKey} field={field} added={isAdded(field.fieldKey)} onAdd={onAdd} />
        ))}
      </div>
    </div>
  )
}

function FieldRow({
  field,
  added,
  onAdd,
  showType = false,
}: {
  field: FieldCatalogItem
  added: boolean
  onAdd: (field: FieldCatalogItem) => void
  showType?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-accent/30 transition-colors">
      <div>
        <p className="font-medium">{field.label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground font-mono">{field.fieldKey}</p>
          {showType && field.type && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {TYPE_LABELS[field.type] ?? field.type}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(field)}
        disabled={added}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors shrink-0 ${
          added ? 'text-muted-foreground cursor-default' : 'text-primary hover:bg-primary/10'
        }`}
      >
        {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        {added ? 'Ajouté' : 'Ajouter'}
      </button>
    </div>
  )
}
