'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminComplianceApi, type ComplianceItem, type ComplianceCondition } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Types config par type d'item ──────────────────────────────────────────────

type DocConfig = { formats?: string[]; maxSizeMb?: number }
type TextConfig = { placeholder?: string; maxLength?: number }
type ChoiceConfig = { options?: string[] }

const ACCEPTED_FORMATS = ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx', 'csv']

const OPERATOR_LABELS: Record<string, string> = {
  eq: 'est égal à',
  not_eq: 'est différent de',
  in: 'contient',
  not_in: 'ne contient pas',
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function AlertDaysInput({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const n = parseInt(input)
    if (!n || n <= 0 || value.includes(n)) return
    onChange([...value, n].sort((a, b) => b - a))
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="ex: 30"
          className="text-sm w-28"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={!input}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {value.map((d) => (
            <span key={d} className="flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
              {d}j
              <button type="button" onClick={() => onChange(value.filter((x) => x !== d))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function OptionsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Ajouter une option…"
          className="text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={!input.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((opt, i) => (
            <li key={i} className="flex items-center gap-2 bg-muted/50 rounded px-3 py-1.5 text-sm">
              <span className="text-muted-foreground text-xs shrink-0">{i + 1}.</span>
              <span className="flex-1">{opt}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── ItemForm ──────────────────────────────────────────────────────────────────

export function ItemForm({
  phaseId,
  phaseItems,
  item,
  nextOrder,
  onClose,
}: {
  phaseId: string
  phaseItems: ComplianceItem[]
  item?: ComplianceItem
  nextOrder: number
  onClose: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  // Champs communs
  const [label, setLabel] = useState(item?.label ?? '')
  const [type, setType] = useState<string>(item?.type ?? 'doc')
  const [isRequired, setIsRequired] = useState(item?.isRequired ?? true)
  const [validityMonths, setValidityMonths] = useState(item?.validityMonths?.toString() ?? '')
  const [alertBeforeDays, setAlertBeforeDays] = useState<number[]>(item?.alertBeforeDays ?? [])
  const [dueDaysAfterSignup, setDueDaysAfterSignup] = useState(item?.dueDaysAfterSignup?.toString() ?? '')

  // Config dynamique
  const initialConfig = (item?.config ?? {}) as Record<string, unknown>
  const [docFormats, setDocFormats] = useState<string[]>((initialConfig.formats as string[]) ?? [])
  const [docMaxSize, setDocMaxSize] = useState((initialConfig.maxSizeMb as number)?.toString() ?? '')
  const [textPlaceholder, setTextPlaceholder] = useState((initialConfig.placeholder as string) ?? '')
  const [textMaxLength, setTextMaxLength] = useState((initialConfig.maxLength as number)?.toString() ?? '')
  const [options, setOptions] = useState<string[]>((initialConfig.options as string[]) ?? [])

  // Conditions
  const existingCondition = item?.conditions?.[0] ?? null
  const [conditional, setConditional] = useState(!!existingCondition)
  const [dependsOnItemId, setDependsOnItemId] = useState(existingCondition?.dependsOnItemId ?? '')
  const [operator, setOperator] = useState(existingCondition?.operator ?? 'eq')
  const [expectedValue, setExpectedValue] = useState(existingCondition?.expectedValue ?? '')

  const otherItems = phaseItems.filter((i) => i.id !== item?.id)

  function buildConfig(): Record<string, unknown> {
    if (type === 'doc') return { formats: docFormats, maxSizeMb: docMaxSize ? Number(docMaxSize) : undefined }
    if (type === 'text') return { placeholder: textPlaceholder, maxLength: textMaxLength ? Number(textMaxLength) : undefined }
    if (type === 'radio' || type === 'checkbox') return { options }
    return {}
  }

  const invalidateKey = ['admin-phase', phaseId, token]

  const conditionMutation = useMutation({
    mutationFn: async (itemId: string) => {
      // Supprimer l'ancienne condition si elle existe
      if (existingCondition) {
        await adminComplianceApi.removeCondition(existingCondition.id, token!)
      }
      // Créer la nouvelle si toggle activé
      if (conditional && dependsOnItemId) {
        await adminComplianceApi.addCondition({ itemId, dependsOnItemId, operator, expectedValue }, token!)
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await adminComplianceApi.createItem(phaseId, {
        label,
        type,
        config: buildConfig(),
        isRequired,
        order: nextOrder,
        validityMonths: validityMonths ? Number(validityMonths) : null,
        alertBeforeDays,
        dueDaysAfterSignup: dueDaysAfterSignup ? Number(dueDaysAfterSignup) : null,
      }, token!)
      await conditionMutation.mutateAsync(res.data.item.id)
      return res
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: invalidateKey }); onClose() },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      await adminComplianceApi.updateItem(item!.id, {
        label,
        type,
        config: buildConfig(),
        isRequired,
        validityMonths: validityMonths ? Number(validityMonths) : null,
        alertBeforeDays,
        dueDaysAfterSignup: dueDaysAfterSignup ? Number(dueDaysAfterSignup) : null,
      }, token!)
      await conditionMutation.mutateAsync(item!.id)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: invalidateKey }); onClose() },
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const error = (createMutation.error || updateMutation.error || conditionMutation.error) as Error | null

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <p className="font-medium text-sm">{item ? 'Modifier l\'item' : 'Nouvel item'}</p>

      {/* Champs communs */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Libellé <span className="text-destructive">*</span></Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Attestation ORIAS" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="doc">Document</option>
              <option value="text">Texte libre</option>
              <option value="radio">Choix unique</option>
              <option value="checkbox">Choix multiple</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Validité (mois — vide = illimitée)</Label>
            <Input type="number" value={validityMonths} onChange={(e) => setValidityMonths(e.target.value)} placeholder="ex: 12" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Délai après inscription (jours)</Label>
            <Input type="number" value={dueDaysAfterSignup} onChange={(e) => setDueDaysAfterSignup(e.target.value)} placeholder="ex: 30" />
          </div>

          <div className="flex items-center gap-2 pt-5">
            <button
              type="button"
              onClick={() => setIsRequired(!isRequired)}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                isRequired ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', isRequired ? 'translate-x-4' : 'translate-x-1')} />
            </button>
            <Label className="text-xs cursor-pointer" onClick={() => setIsRequired(!isRequired)}>
              {isRequired ? 'Obligatoire' : 'Optionnel'}
            </Label>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Alertes avant expiration (jours)</Label>
          <AlertDaysInput value={alertBeforeDays} onChange={setAlertBeforeDays} />
        </div>
      </div>

      {/* Champs dynamiques par type */}
      {type === 'doc' && (
        <div className="border border-border rounded-lg p-4 space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configuration — Document</p>
          <div className="space-y-2">
            <Label className="text-xs">Formats acceptés</Label>
            <div className="flex flex-wrap gap-2">
              {ACCEPTED_FORMATS.map((fmt) => (
                <label key={fmt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={docFormats.includes(fmt)}
                    onChange={(e) => setDocFormats(e.target.checked ? [...docFormats, fmt] : docFormats.filter((f) => f !== fmt))}
                    className="rounded"
                  />
                  .{fmt}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Taille max (Mo)</Label>
            <Input type="number" value={docMaxSize} onChange={(e) => setDocMaxSize(e.target.value)} placeholder="ex: 10" className="w-32" />
          </div>
        </div>
      )}

      {type === 'text' && (
        <div className="border border-border rounded-lg p-4 space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configuration — Texte</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Placeholder</Label>
              <Input value={textPlaceholder} onChange={(e) => setTextPlaceholder(e.target.value)} placeholder="Texte indicatif…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Longueur max (caractères)</Label>
              <Input type="number" value={textMaxLength} onChange={(e) => setTextMaxLength(e.target.value)} placeholder="ex: 500" />
            </div>
          </div>
        </div>
      )}

      {(type === 'radio' || type === 'checkbox') && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Options — {type === 'radio' ? 'Choix unique' : 'Choix multiple'}
          </p>
          <OptionsInput value={options} onChange={setOptions} />
        </div>
      )}

      {/* Conditions */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConditional(!conditional)}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              conditional ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', conditional ? 'translate-x-4' : 'translate-x-1')} />
          </button>
          <Label className="text-xs cursor-pointer" onClick={() => setConditional(!conditional)}>
            Cet item est conditionnel (s'affiche selon la réponse à un autre item)
          </Label>
        </div>

        {conditional && (
          <div className="grid grid-cols-1 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Dépend de l'item</Label>
              <select
                value={dependsOnItemId}
                onChange={(e) => setDependsOnItemId(e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Sélectionner un item…</option>
                {otherItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Opérateur</Label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                >
                  {Object.entries(OPERATOR_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valeur attendue</Label>
                <Input value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} placeholder="ex: oui" />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error.message}</p>}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          onClick={() => item ? updateMutation.mutate() : createMutation.mutate()}
          disabled={isPending || !label}
        >
          {isPending ? 'Enregistrement…' : item ? 'Enregistrer' : 'Créer l\'item'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}
