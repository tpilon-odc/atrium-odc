'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronUp, ChevronDown, Pencil, Plus, Trash2, X, Check, GripVertical } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminGovernanceAxesApi, type GovernanceAxisConfig } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Criterion = { field: string; label: string; sublabel?: string }

const MAIN_CATEGORIES = [
  { value: 'assurance' as const, label: 'Assurance', color: 'bg-blue-100 text-blue-700' },
  { value: 'cif' as const, label: 'Conseil en investissement financier (CIF)', color: 'bg-violet-100 text-violet-700' },
]

// ── Éditeur de critères ───────────────────────────────────────────────────────

function CriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: Criterion[]
  onChange: (c: Criterion[]) => void
}) {
  const [newField, setNewField] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newSublabel, setNewSublabel] = useState('')

  const update = (idx: number, patch: Partial<Criterion>) => {
    const next = criteria.map((c, i) => i === idx ? { ...c, ...patch } : c)
    onChange(next)
  }
  const remove = (idx: number) => onChange(criteria.filter((_, i) => i !== idx))
  const move = (idx: number, dir: 'up' | 'down') => {
    const next = [...criteria]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }
  const add = () => {
    if (!newField.trim() || !newLabel.trim()) return
    onChange([...criteria, { field: newField.trim(), label: newLabel.trim(), sublabel: newSublabel.trim() || undefined }])
    setNewField(''); setNewLabel(''); setNewSublabel('')
  }

  return (
    <div className="space-y-2">
      {criteria.map((c, idx) => (
        <div key={c.field} className="flex items-center gap-2 bg-muted/30 rounded-md p-2 group">
          <div className="flex flex-col gap-0.5">
            <button onClick={() => move(idx, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
            <button onClick={() => move(idx, 'down')} disabled={idx === criteria.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
          </div>
          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{c.field}</code>
          <Input
            value={c.label}
            onChange={(e) => update(idx, { label: e.target.value })}
            className="h-7 text-xs flex-1"
            placeholder="Label"
          />
          <Input
            value={c.sublabel ?? ''}
            onChange={(e) => update(idx, { sublabel: e.target.value || undefined })}
            className="h-7 text-xs w-36"
            placeholder="Sous-label (optionnel)"
          />
          <button onClick={() => remove(idx)} className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Ajouter un critère */}
      <div className="flex items-center gap-2 pt-1">
        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
        <Input value={newField} onChange={(e) => setNewField(e.target.value)} className="h-7 text-xs w-40" placeholder="field (camelCase)" />
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="h-7 text-xs flex-1" placeholder="Label affiché" />
        <Input value={newSublabel} onChange={(e) => setNewSublabel(e.target.value)} className="h-7 text-xs w-36" placeholder="Sous-label" />
        <button
          onClick={add}
          disabled={!newField.trim() || !newLabel.trim()}
          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Ligne axe ─────────────────────────────────────────────────────────────────

function AxisRow({
  axis,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  axis: GovernanceAxisConfig
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ label: axis.label, description: axis.description, criteria: axis.criteria })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-governance-axes', token] })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminGovernanceAxesApi.update>[1]) =>
      adminGovernanceAxesApi.update(axis.id, data, token!),
    onSuccess: () => { invalidate(); setEditing(false) },
  })

  const handleEdit = () => {
    setForm({ label: axis.label, description: axis.description, criteria: axis.criteria })
    setEditing(true)
  }

  return (
    <div className={cn(
      'border border-border rounded-lg overflow-hidden',
      !axis.isEnabled && 'opacity-60'
    )}>
      {/* En-tête axe */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
        <div className="flex flex-col gap-0.5">
          <button onClick={onMoveUp} disabled={isFirst} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button onClick={onMoveDown} disabled={isLast} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown className="h-3.5 w-3.5" /></button>
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={form.label}
              onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
              className="h-7 text-sm font-medium"
              autoFocus
            />
          ) : (
            <p className="text-sm font-medium truncate">{axis.label}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => updateMutation.mutate({ isEnabled: !axis.isEnabled })}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
              axis.isEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {axis.isEnabled ? 'Actif' : 'Inactif'}
          </button>
          {editing ? (
            <>
              <button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} className="p-1.5 text-green-600 hover:text-green-700">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button onClick={handleEdit} className="p-1.5 text-muted-foreground hover:text-foreground">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Détail (description + critères) — visible en mode édition */}
      {editing && (
        <div className="px-4 py-3 space-y-3 border-t border-border">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="text-sm"
              placeholder="Description affichée dans la fiche produit…"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Critères</label>
            <CriteriaEditor
              criteria={form.criteria}
              onChange={(criteria) => setForm(f => ({ ...f, criteria }))}
            />
          </div>
        </div>
      )}

      {/* Aperçu des critères (lecture seule) */}
      {!editing && axis.criteria.length > 0 && (
        <div className="px-4 py-2 border-t border-border flex flex-wrap gap-1.5">
          {axis.criteria.map((c) => (
            <span key={c.field} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {c.sublabel ? `${c.label} — ${c.sublabel}` : c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section par catégorie ─────────────────────────────────────────────────────

function CategorySection({
  mainCategory,
  label,
  color,
  axes,
}: {
  mainCategory: 'assurance' | 'cif'
  label: string
  color: string
  axes: GovernanceAxisConfig[]
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-governance-axes', token] })

  const moveMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      adminGovernanceAxesApi.update(id, { order }, token!),
    onSuccess: invalidate,
  })

  const handleMove = (idx: number, dir: 'up' | 'down') => {
    const swap = dir === 'up' ? idx - 1 : idx + 1
    moveMutation.mutate({ id: axes[idx].id, order: axes[swap].order })
    moveMutation.mutate({ id: axes[swap].id, order: axes[idx].order })
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', color)}>
          {mainCategory === 'assurance' ? 'Assurance' : 'CIF'}
        </span>
        <h3 className="font-medium text-sm">{label}</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {axes.filter(a => a.isEnabled).length}/{axes.length} axes actifs
        </span>
      </div>

      <div className="space-y-2">
        {axes.map((axis, idx) => (
          <AxisRow
            key={axis.id}
            axis={axis}
            isFirst={idx === 0}
            isLast={idx === axes.length - 1}
            onMoveUp={() => handleMove(idx, 'up')}
            onMoveDown={() => handleMove(idx, 'down')}
          />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminGouvernancePage() {
  const { token } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-governance-axes', token],
    queryFn: () => adminGovernanceAxesApi.list(token!),
    enabled: !!token,
  })

  const axes = data?.data.axes ?? []

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-semibold">Axes de gouvernance produits</h2>
        <p className="text-muted-foreground mt-1">
          Configurez les axes MiFID II / DDA affichés dans la fiche de gouvernance de chaque produit, selon sa catégorie principale.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Note :</strong> Les champs (<code className="text-xs bg-amber-100 px-1 rounded">field</code>) correspondent aux colonnes de la base de données.
        Ne modifiez pas les noms de champs existants — seuls les labels et l'activation/désactivation sont sans risque.
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {MAIN_CATEGORIES.map((mc) => (
            <CategorySection
              key={mc.value}
              mainCategory={mc.value}
              label={mc.label}
              color={mc.color}
              axes={axes.filter(a => a.mainCategory === mc.value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
