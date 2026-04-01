'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Check, X, ChevronRight, Plus, Tag } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import {
  folderRulesApi,
  folderApi,
  type FolderRule,
  type FolderRuleEntityType,
  type FolderRuleTag,
  type FolderRuleTagType,
  FOLDER_RULE_LABELS,
  FOLDER_RULE_TAG_LABELS,
  ENTITY_TAG_TYPES,
  type Folder,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const ENTITY_TYPES: FolderRuleEntityType[] = [
  'contact',
  'supplier',
  'product',
  'training',
  'compliance_answer',
]

// ── Utilitaire : chemin lisible d'un dossier ─────────────────────────────────

function buildFolderPath(folder: Folder, all: Folder[]): string {
  const parts: string[] = [folder.name]
  let current = folder
  while (current.parentId) {
    const parent = all.find((f) => f.id === current.parentId)
    if (!parent) break
    parts.unshift(parent.name)
    current = parent
  }
  return parts.join(' / ')
}

// ── Sélecteur de dossier ──────────────────────────────────────────────────────

function FolderSelect({
  folders,
  value,
  onChange,
  onClear,
}: {
  folders: Folder[]
  value: string | null
  onChange: (id: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? folders.find((f) => f.id === value) : null

  const sorted = [...folders].sort((a, b) =>
    buildFolderPath(a, folders).localeCompare(buildFolderPath(b, folders), 'fr')
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 w-full text-left px-3 py-2 rounded-md border text-sm transition-colors',
          'bg-background hover:border-primary/50',
          open ? 'border-primary ring-1 ring-primary/20' : 'border-border'
        )}
      >
        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={cn('flex-1 truncate', !selected && 'text-muted-foreground')}>
          {selected ? buildFolderPath(selected, folders) : 'Choisir un dossier…'}
        </span>
        {selected && (
          <span
            role="button"
            className="p-0.5 rounded hover:bg-muted"
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false) }}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-zinc-900 border border-border rounded-md shadow-lg py-1">
          {sorted.map((f) => {
            const depth = buildFolderPath(f, folders).split(' / ').length - 1
            return (
              <button
                key={f.id}
                type="button"
                className={cn(
                  'flex items-center gap-2 w-full text-left py-1.5 text-sm hover:bg-muted transition-colors',
                  value === f.id && 'bg-primary/5 text-primary font-medium'
                )}
                style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: '12px' }}
                onClick={() => { onChange(f.id); setOpen(false) }}
              >
                {depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                <span className="truncate">{f.name}</span>
                {value === f.id && <Check className="h-3.5 w-3.5 ml-auto shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Badge tag rule ────────────────────────────────────────────────────────────

function TagRuleBadge({
  tagRule,
  entityType,
  onDelete,
}: {
  tagRule: FolderRuleTag
  entityType: FolderRuleEntityType
  onDelete: () => void
}) {
  const label =
    tagRule.type === 'fixed'
      ? tagRule.fixedValue ?? ''
      : FOLDER_RULE_TAG_LABELS[tagRule.type]

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted border border-border text-foreground">
      <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
      {label}
      <button
        type="button"
        onClick={onDelete}
        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// ── Ajout d'un tag rule ───────────────────────────────────────────────────────

function AddTagRuleInline({
  entityType,
  onAdd,
  onClose,
}: {
  entityType: FolderRuleEntityType
  onAdd: (type: FolderRuleTagType, fixedValue?: string) => void
  onClose: () => void
}) {
  const [selectedType, setSelectedType] = useState<FolderRuleTagType | ''>('')
  const [fixedValue, setFixedValue] = useState('')
  const availableTypes = ENTITY_TAG_TYPES[entityType]

  const canSubmit =
    selectedType !== '' &&
    (selectedType !== 'fixed' || fixedValue.trim().length > 0)

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      <select
        className="text-xs border border-border rounded px-2 py-1 bg-white dark:bg-zinc-900"
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value as FolderRuleTagType | '')}
      >
        <option value="">Type de tag…</option>
        {availableTypes.map((t) => (
          <option key={t} value={t}>{FOLDER_RULE_TAG_LABELS[t]}</option>
        ))}
      </select>

      {selectedType === 'fixed' && (
        <Input
          className="h-7 text-xs w-36"
          placeholder="Valeur du tag…"
          value={fixedValue}
          onChange={(e) => setFixedValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canSubmit && onAdd('fixed', fixedValue.trim())}
          autoFocus
        />
      )}

      <Button
        size="sm"
        className="h-7 text-xs px-2"
        disabled={!canSubmit}
        onClick={() => onAdd(selectedType as FolderRuleTagType, selectedType === 'fixed' ? fixedValue.trim() : undefined)}
      >
        Ajouter
      </Button>
      <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Ligne de règle ────────────────────────────────────────────────────────────

function RuleRow({
  entityType,
  rule,
  folders,
  onDirtyChange,
}: {
  entityType: FolderRuleEntityType
  rule: FolderRule | undefined
  folders: Folder[]
  onDirtyChange: (entityType: FolderRuleEntityType, dirty: boolean) => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [addingTag, setAddingTag] = useState(false)

  // État local — tout ce qui peut être modifié avant enregistrement
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(rule?.folderId ?? null)
  const [subEntity, setSubEntity] = useState(rule?.subfolderEntity ?? false)
  const [subYear, setSubYear] = useState(rule?.subfolderYear ?? false)
  const [subOrder, setSubOrder] = useState<'entity_year' | 'year_entity'>(rule?.subfolderOrder ?? 'entity_year')

  const hasEntityName = entityType !== 'compliance_answer'

  // Calcul dirty : comparaison avec les valeurs sauvegardées
  const dirty =
    pendingFolderId !== (rule?.folderId ?? null) ||
    subEntity !== (rule?.subfolderEntity ?? false) ||
    subYear !== (rule?.subfolderYear ?? false) ||
    subOrder !== (rule?.subfolderOrder ?? 'entity_year')

  useEffect(() => {
    onDirtyChange(entityType, dirty)
  }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const upsert = useMutation({
    mutationFn: (data: { folderId: string; subfolderEntity: boolean; subfolderYear: boolean; subfolderOrder: 'entity_year' | 'year_entity' }) =>
      folderRulesApi.upsert({ entityType, ...data }, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folder-rules'] }),
  })

  const removeRule = useMutation({
    mutationFn: () => folderRulesApi.delete(entityType, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] })
      setPendingFolderId(null)
    },
  })

  const addTagRule = useMutation({
    mutationFn: ({ type, fixedValue }: { type: FolderRuleTagType; fixedValue?: string }) =>
      folderRulesApi.addTagRule(entityType, { type, fixedValue }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] })
      setAddingTag(false)
    },
  })

  const deleteTagRule = useMutation({
    mutationFn: (tagRuleId: string) =>
      folderRulesApi.deleteTagRule(entityType, tagRuleId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folder-rules'] }),
  })

  const handleSave = () => {
    if (!pendingFolderId) return
    upsert.mutate({ folderId: pendingFolderId, subfolderEntity: subEntity, subfolderYear: subYear, subfolderOrder: subOrder })
  }

  const handleDiscard = () => {
    setPendingFolderId(rule?.folderId ?? null)
    setSubEntity(rule?.subfolderEntity ?? false)
    setSubYear(rule?.subfolderYear ?? false)
    setSubOrder(rule?.subfolderOrder ?? 'entity_year')
  }

  const handleFolderClear = () => {
    if (rule) removeRule.mutate()
    else setPendingFolderId(null)
  }

  const saving = upsert.isPending || removeRule.isPending

  // Aperçu de la structure
  const previewBase = pendingFolderId ? (folders.find((f) => f.id === pendingFolderId)?.name ?? '…') : '…'
  const previewParts: string[] = [previewBase]
  const ordered =
    subOrder === 'entity_year'
      ? [subEntity && hasEntityName ? 'Dupont Jean' : null, subYear ? '2025' : null]
      : [subYear ? '2025' : null, subEntity && hasEntityName ? 'Dupont Jean' : null]
  ordered.filter(Boolean).forEach((p) => previewParts.push(p!))

  return (
    <div className="py-4 border-b border-border last:border-0 space-y-3">
      {/* Ligne dossier + boutons */}
      <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-4">
        <div>
          <p className="text-sm font-medium">{FOLDER_RULE_LABELS[entityType]}</p>
          {!rule && !pendingFolderId && (
            <p className="text-xs text-muted-foreground mt-0.5">Aucun dossier — non classé par défaut</p>
          )}
        </div>

        <FolderSelect
          folders={folders}
          value={pendingFolderId}
          onChange={setPendingFolderId}
          onClear={handleFolderClear}
        />

        <div className="flex items-center gap-2 shrink-0">
          {dirty && (
            <button
              type="button"
              onClick={handleDiscard}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuler
            </button>
          )}
          <Button
            size="sm"
            disabled={!dirty || !pendingFolderId || saving}
            onClick={handleSave}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Indicateur non-sauvegardé */}
      {dirty && pendingFolderId && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
          Modifications non enregistrées
        </p>
      )}

      {/* Options sous-dossiers + tags */}
      {(rule || pendingFolderId) && (
        <div className="pl-4 border-l-2 border-border space-y-3">

          {/* Sous-dossiers automatiques */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sous-dossiers automatiques :</p>
            <div className="flex flex-wrap items-center gap-4">
              {hasEntityName && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={subEntity}
                    onChange={(e) => setSubEntity(e.target.checked)}
                  />
                  Par {entityType === 'contact' ? 'contact' : entityType === 'supplier' ? 'fournisseur' : entityType === 'product' ? 'produit' : 'collaborateur'}
                </label>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={subYear}
                  onChange={(e) => setSubYear(e.target.checked)}
                />
                Par année
              </label>

              {subEntity && subYear && hasEntityName && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ordre :</span>
                  <select
                    className="text-xs border border-border rounded px-2 py-1 bg-white dark:bg-zinc-900"
                    value={subOrder}
                    onChange={(e) => setSubOrder(e.target.value as 'entity_year' | 'year_entity')}
                  >
                    <option value="entity_year">Entité / Année</option>
                    <option value="year_entity">Année / Entité</option>
                  </select>
                </div>
              )}
            </div>

            {(subEntity || subYear) && (
              <p className="text-xs text-muted-foreground font-mono bg-muted/40 px-3 py-1.5 rounded">
                📁 {previewParts.join(' / ')} / 📄 document.pdf
              </p>
            )}
          </div>

          {/* Tags automatiques — seulement si règle déjà sauvegardée */}
          {rule && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">Tags auto :</span>

                {rule.tagRules.length === 0 && !addingTag && (
                  <span className="text-xs text-muted-foreground italic">aucun</span>
                )}

                {rule.tagRules.map((tr) => (
                  <TagRuleBadge
                    key={tr.id}
                    tagRule={tr}
                    entityType={entityType}
                    onDelete={() => deleteTagRule.mutate(tr.id)}
                  />
                ))}

                {!addingTag && (
                  <button
                    type="button"
                    onClick={() => setAddingTag(true)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter un tag
                  </button>
                )}
              </div>

              {addingTag && (
                <AddTagRuleInline
                  entityType={entityType}
                  onAdd={(type, fixedValue) => addTagRule.mutate({ type, fixedValue })}
                  onClose={() => setAddingTag(false)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GedReglesPage() {
  const { token } = useAuthStore()
  const [dirtyRows, setDirtyRows] = useState<Set<FolderRuleEntityType>>(new Set())

  const handleDirtyChange = useCallback((et: FolderRuleEntityType, dirty: boolean) => {
    setDirtyRows((prev) => {
      const s = new Set(prev)
      dirty ? s.add(et) : s.delete(et)
      return s
    })
  }, [])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRows.size > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirtyRows])

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['folder-rules'],
    queryFn: () => folderRulesApi.list(token!),
    enabled: !!token,
  })

  const { data: foldersData, isLoading: foldersLoading } = useQuery({
    queryKey: ['folders', token],
    queryFn: () => folderApi.list(token!),
    enabled: !!token,
  })

  const rules = rulesData?.data.rules ?? []
  const folders = foldersData?.data.folders ?? []
  const isLoading = rulesLoading || foldersLoading

  const ruleByType = Object.fromEntries(rules.map((r) => [r.entityType, r])) as Record<
    FolderRuleEntityType,
    FolderRule | undefined
  >

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold">Règles de classement GED</h2>
        <p className="text-muted-foreground mt-1">
          Définissez dans quel dossier sont rangés les documents et quels tags leur sont automatiquement appliqués selon le contexte d&apos;upload.
        </p>
      </div>

      {dirtyRows.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="font-medium">Modifications non enregistrées</span>
          <span className="text-amber-700 dark:text-amber-400">— pensez à sauvegarder avant de quitter la page.</span>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : folders.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Aucun dossier dans votre GED.{' '}
            <a href="/ged" className="text-primary hover:underline">Créez d&apos;abord vos dossiers.</a>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[1fr_2fr_auto] gap-4 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70 border-b border-border mb-1">
              <span>Contexte</span>
              <span>Dossier de destination</span>
              <span />
            </div>
            {ENTITY_TYPES.map((et) => (
              <RuleRow
                key={et}
                entityType={et}
                rule={ruleByType[et]}
                folders={folders}
                onDirtyChange={handleDirtyChange}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-muted/40 border border-border rounded-lg p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Comment fonctionne le classement automatique ?</p>
        <p><strong>Sous-dossiers automatiques</strong> — créent la structure à la volée si elle n&apos;existe pas encore. Ex : <span className="font-mono">Contacts / Dupont Jean / 2025 /</span></p>
        <p><strong>Tag fixe</strong> — une valeur saisie, posée sur tous les docs de ce contexte. Ex : &quot;Client&quot;, &quot;Contrat&quot;.</p>
        <p><strong>Année d&apos;upload</strong> — l&apos;année en cours au moment de l&apos;upload. Ex : &quot;2025&quot;.</p>
        <p><strong>Nom de l&apos;entité</strong> — le nom du contact, fournisseur ou produit lié au document.</p>
      </div>
    </div>
  )
}
