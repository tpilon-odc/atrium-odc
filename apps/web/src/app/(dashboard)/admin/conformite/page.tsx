'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, ChevronRight, X, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminComplianceApi, type CompliancePhase } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Ligne phase ───────────────────────────────────────────────────────────────

function PhaseRow({
  phase,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  phase: CompliancePhase
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(phase.label)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (d: { label?: string; isActive?: boolean }) =>
      adminComplianceApi.updatePhase(phase.id, d, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-phases', token] })
      setEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminComplianceApi.deletePhase(phase.id, token!),
    onSuccess: () => {
      setConfirmDelete(false)
      queryClient.invalidateQueries({ queryKey: ['admin-phases', token] })
    },
  })

  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-hidden', !phase.isActive && 'opacity-60')}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Réordering */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={isFirst} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Label */}
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="text-sm h-8 flex-1" autoFocus />
            <Button size="sm" className="h-8" onClick={() => updateMutation.mutate({ label })} disabled={updateMutation.isPending || !label}>OK</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditing(false); setLabel(phase.label) }}>✕</Button>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{phase.label}</span>
              <span className="text-xs text-muted-foreground">({phase.items.length} item{phase.items.length !== 1 ? 's' : ''})</span>
              {!phase.isActive && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle actif/inactif */}
            <button
              onClick={() => updateMutation.mutate({ isActive: !phase.isActive })}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                phase.isActive ? 'bg-primary' : 'bg-muted'
              )}
              title={phase.isActive ? 'Désactiver' : 'Activer'}
            >
              <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', phase.isActive ? 'translate-x-4' : 'translate-x-1')} />
            </button>

            <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-muted-foreground hover:text-destructive p-1 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {/* Lien vers le détail */}
            <Link href={`/admin/conformite/${phase.id}`} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Confirmation suppression */}
      {confirmDelete && (
        <div className="flex items-center gap-3 bg-destructive/5 border-t border-destructive/20 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive flex-1">
            Supprimer définitivement &laquo;{phase.label}&raquo; et ses {phase.items.length} item(s) ?
            {phase.items.length > 0 && ' Toutes les réponses des cabinets seront perdues.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 h-7 text-xs shrink-0"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Suppression…' : 'Confirmer'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs shrink-0"
            onClick={() => setConfirmDelete(false)}
          >
            Annuler
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConformiteAdminPage() {
  const { token, user } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [addingPhase, setAddingPhase] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-phases', token],
    queryFn: () => adminComplianceApi.getPhases(token!, true),
    enabled: !!token && user?.globalRole === 'platform_admin',
  })

  const phases = [...(data?.data.phases ?? [])].sort((a, b) => a.order - b.order)

  const createMutation = useMutation({
    mutationFn: () => adminComplianceApi.createPhase({
      label: newLabel,
      description: newDescription || undefined,
      order: phases.length,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-phases', token] })
      setAddingPhase(false)
      setNewLabel('')
      setNewDescription('')
    },
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      adminComplianceApi.updatePhase(id, { order }, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-phases', token] }),
  })

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const a = phases[index]
    const b = phases[swapIndex]
    reorderMutation.mutate({ id: a.id, order: b.order })
    reorderMutation.mutate({ id: b.id, order: a.order })
  }

  if (!user) return null
  if (user.globalRole !== 'platform_admin') {
    router.replace('/dashboard')
    return null
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Référentiel de conformité</h2>
          <p className="text-muted-foreground mt-1">
            {phases.length} phase{phases.length !== 1 ? 's' : ''} · {phases.reduce((acc, p) => acc + p.items.length, 0)} items au total
          </p>
        </div>
        {!addingPhase && (
          <Button size="sm" onClick={() => setAddingPhase(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle phase
          </Button>
        )}
      </div>

      {/* Formulaire nouvelle phase */}
      {addingPhase && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Nouvelle phase</span>
            <button onClick={() => setAddingPhase(false)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Libellé <span className="text-destructive">*</span></Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex: Devoir de conseil"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optionnelle)</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description courte…"
              />
            </div>
          </div>
          {createMutation.isError && (
            <p className="text-xs text-destructive">{(createMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newLabel}>
              {createMutation.isPending ? 'Création…' : 'Créer la phase'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddingPhase(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {/* Liste des phases */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : phases.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="font-medium">Aucune phase de conformité</p>
          <p className="text-sm text-muted-foreground mt-1">Créez la première phase via le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {phases.map((phase, index) => (
            <PhaseRow
              key={phase.id}
              phase={phase}
              isFirst={index === 0}
              isLast={index === phases.length - 1}
              onMoveUp={() => handleMove(index, 'up')}
              onMoveDown={() => handleMove(index, 'down')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
