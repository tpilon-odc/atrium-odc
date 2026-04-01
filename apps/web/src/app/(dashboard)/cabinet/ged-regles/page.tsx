'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Check, X, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import {
  folderRulesApi,
  folderApi,
  type FolderRule,
  type FolderRuleEntityType,
  FOLDER_RULE_LABELS,
  type Folder,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'

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

// ── Sélecteur de dossier (arbre à plat trié) ──────────────────────────────────

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

  // Trie : parents d'abord, puis enfants — ordre alphabétique dans chaque niveau
  const sorted = [...folders].sort((a, b) => {
    const pathA = buildFolderPath(a, folders)
    const pathB = buildFolderPath(b, folders)
    return pathA.localeCompare(pathB, 'fr')
  })

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
            onClick={(e) => {
              e.stopPropagation()
              onClear()
              setOpen(false)
            }}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-popover border border-border rounded-md shadow-md py-1">
          {sorted.map((f) => {
            const path = buildFolderPath(f, folders)
            const depth = path.split(' / ').length - 1
            return (
              <button
                key={f.id}
                type="button"
                className={cn(
                  'flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors',
                  value === f.id && 'bg-primary/5 text-primary font-medium'
                )}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                onClick={() => {
                  onChange(f.id)
                  setOpen(false)
                }}
              >
                {depth > 0 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                )}
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

// ── Ligne de règle ────────────────────────────────────────────────────────────

function RuleRow({
  entityType,
  rule,
  folders,
}: {
  entityType: FolderRuleEntityType
  rule: FolderRule | undefined
  folders: Folder[]
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(rule?.folderId ?? null)
  const [dirty, setDirty] = useState(false)

  const upsert = useMutation({
    mutationFn: (folderId: string) =>
      folderRulesApi.upsert({ entityType, folderId }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] })
      setDirty(false)
    },
  })

  const remove = useMutation({
    mutationFn: () => folderRulesApi.delete(entityType, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] })
      setPendingFolderId(null)
      setDirty(false)
    },
  })

  const handleChange = (folderId: string) => {
    setPendingFolderId(folderId)
    setDirty(true)
  }

  const handleClear = () => {
    if (rule) {
      remove.mutate()
    } else {
      setPendingFolderId(null)
      setDirty(false)
    }
  }

  const handleSave = () => {
    if (pendingFolderId) upsert.mutate(pendingFolderId)
  }

  const saving = upsert.isPending || remove.isPending

  return (
    <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-4 py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{FOLDER_RULE_LABELS[entityType]}</p>
        {!rule && !pendingFolderId && (
          <p className="text-xs text-muted-foreground mt-0.5">Pas de règle — dossier "Général" par défaut</p>
        )}
      </div>

      <FolderSelect
        folders={folders}
        value={pendingFolderId}
        onChange={handleChange}
        onClear={handleClear}
      />

      <Button
        size="sm"
        disabled={!dirty || !pendingFolderId || saving}
        onClick={handleSave}
        className="shrink-0"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GedReglesPage() {
  const { token } = useAuthStore()

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
          Définissez dans quel dossier sont automatiquement rangés les documents selon leur contexte d&apos;upload.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : folders.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Aucun dossier configuré dans votre GED. Créez d&apos;abord vos dossiers.
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[1fr_2fr_auto] gap-4 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
