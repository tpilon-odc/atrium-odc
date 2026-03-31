'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown, GitBranch, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminComplianceApi, type ComplianceItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ItemForm } from './_components/ItemForm'

// ── Badges ────────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  doc: 'bg-blue-100 text-blue-700',
  text: 'bg-purple-100 text-purple-700',
  radio: 'bg-orange-100 text-orange-700',
  checkbox: 'bg-green-100 text-green-700',
}
const TYPE_LABELS: Record<string, string> = {
  doc: 'Document',
  text: 'Texte',
  radio: 'Choix unique',
  checkbox: 'Choix multiple',
}

// ── Ligne item ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  isFirst,
  isLast,
  phaseItems,
  phaseId,
  onEdit,
  onMoveUp,
  onMoveDown,
}: {
  item: ComplianceItem
  isFirst: boolean
  isLast: boolean
  phaseItems: ComplianceItem[]
  phaseId: string
  onEdit: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [answerCount, setAnswerCount] = useState<number | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => adminComplianceApi.deleteItem(item.id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-phase', phaseId, token] }),
  })

  const handleDeleteClick = async () => {
    if (!confirmDelete) {
      const res = await adminComplianceApi.getItemAnswerCount(item.id, token!)
      setAnswerCount(res.data.count)
      setConfirmDelete(true)
      return
    }
    deleteMutation.mutate()
  }

  const hasCondition = item.conditions?.length > 0

  return (
    <div className="flex items-start gap-3 bg-card border border-border rounded-lg px-4 py-3 group">
      {/* Réordering */}
      <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{item.label}</span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_STYLES[item.type])}>
            {TYPE_LABELS[item.type]}
          </span>
          {item.isRequired ? (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Requis</span>
          ) : (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Optionnel</span>
          )}
          {hasCondition && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              Conditionnel
            </span>
          )}
        </div>
        <div className="flex gap-3 mt-1 flex-wrap">
          {item.validityMonths ? (
            <span className="text-xs text-muted-foreground">Validité : {item.validityMonths} mois</span>
          ) : (
            <span className="text-xs text-muted-foreground">Pas d'expiration</span>
          )}
          {item.alertBeforeDays?.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Alertes : {item.alertBeforeDays.join('j, ')}j
            </span>
          )}
          {item.dueDaysAfterSignup && (
            <span className="text-xs text-muted-foreground">Délai : {item.dueDaysAfterSignup}j après inscription</span>
          )}
        </div>

        {/* Confirmation suppression */}
        {confirmDelete && (
          <div className="mt-2 flex items-center gap-3 bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive flex-1">
              {answerCount && answerCount > 0
                ? `${answerCount} cabinet(s) ont répondu à cet item. La suppression est irréversible.`
                : 'Aucun cabinet n\'a encore répondu à cet item.'}
            </p>
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 h-7 text-xs" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Suppression…' : 'Confirmer'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>
              Annuler
            </Button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {!confirmDelete && (
          <button onClick={handleDeleteClick} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PhaseDetailPage({ params }: { params: { phaseId: string } }) {
  const { token, user } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { phaseId } = params

  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [editingPhaseLabel, setEditingPhaseLabel] = useState(false)
  const [phaseLabel, setPhaseLabel] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-phase', phaseId, token],
    queryFn: async () => {
      const res = await adminComplianceApi.getPhases(token!, true)
      const phase = res.data.phases.find((p) => p.id === phaseId)
      if (!phase) throw new Error('Phase introuvable')
      return phase
    },
    enabled: !!token && user?.globalRole === 'platform_admin',
  })

  const items = [...(data?.items ?? [])].sort((a, b) => a.order - b.order)

  const updatePhaseMutation = useMutation({
    mutationFn: (d: { label?: string; isActive?: boolean }) => adminComplianceApi.updatePhase(phaseId, d, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-phase', phaseId, token] })
      queryClient.invalidateQueries({ queryKey: ['admin-phases', token] })
      setEditingPhaseLabel(false)
    },
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      adminComplianceApi.updateItem(id, { order }, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-phase', phaseId, token] }),
  })

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const a = items[index]
    const b = items[swapIndex]
    reorderMutation.mutate({ id: a.id, order: b.order })
    reorderMutation.mutate({ id: b.id, order: a.order })
  }

  if (!user) return null
  if (user.globalRole !== 'platform_admin') {
    router.replace('/dashboard')
    return null
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Breadcrumb */}
      <Link
        href="/admin/conformite"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux phases
      </Link>

      {/* En-tête phase */}
      {isLoading ? (
        <div className="h-16 bg-muted animate-pulse rounded-lg" />
      ) : data && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {editingPhaseLabel ? (
              <div className="flex items-center gap-2">
                <Input
                  value={phaseLabel}
                  onChange={(e) => setPhaseLabel(e.target.value)}
                  className="text-lg font-semibold h-9 max-w-xs"
                  autoFocus
                />
                <Button size="sm" onClick={() => updatePhaseMutation.mutate({ label: phaseLabel })} disabled={updatePhaseMutation.isPending}>OK</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingPhaseLabel(false)}>✕</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold">{data.label}</h2>
                <button onClick={() => { setPhaseLabel(data.label); setEditingPhaseLabel(true) }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">{items.length} item(s)</p>
          </div>
          <button
            onClick={() => updatePhaseMutation.mutate({ isActive: !data.isActive })}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              data.isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {data.isActive ? 'Active' : 'Inactive'}
          </button>
        </div>
      )}

      {/* Bouton ajouter */}
      {!addingItem && (
        <Button size="sm" onClick={() => setAddingItem(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Ajouter un item
        </Button>
      )}

      {/* Formulaire nouvel item */}
      {addingItem && (
        <ItemForm
          phaseId={phaseId}
          phaseItems={items}
          nextOrder={items.length}
          onClose={() => setAddingItem(false)}
        />
      )}

      {/* Liste des items */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : items.length === 0 && !addingItem ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="font-medium">Aucun item dans cette phase</p>
          <p className="text-sm text-muted-foreground mt-1">Créez le premier item via le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            editingItem === item.id ? (
              <ItemForm
                key={item.id}
                phaseId={phaseId}
                phaseItems={items}
                item={item}
                nextOrder={item.order}
                onClose={() => setEditingItem(null)}
              />
            ) : (
              <ItemRow
                key={item.id}
                item={item}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                phaseItems={items}
                phaseId={phaseId}
                onEdit={() => setEditingItem(item.id)}
                onMoveUp={() => handleMove(index, 'up')}
                onMoveDown={() => handleMove(index, 'down')}
              />
            )
          ))}
        </div>
      )}
    </div>
  )
}
