'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, X, GripVertical } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminComplianceApi, type CompliancePhase, type ComplianceItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ITEM_TYPE_LABELS: Record<string, string> = {
  doc: 'Document',
  text: 'Texte libre',
  radio: 'Choix unique',
  checkbox: 'Choix multiple',
}

// ── Formulaire item ────────────────────────────────────────────────────────────

function ItemForm({
  phaseId,
  item,
  nextOrder,
  onClose,
}: {
  phaseId: string
  item?: ComplianceItem
  nextOrder: number
  onClose: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState(item?.label ?? '')
  const [type, setType] = useState(item?.type ?? 'doc')
  const [isRequired, setIsRequired] = useState(item?.isRequired ?? true)
  const [validityMonths, setValidityMonths] = useState(item?.validityMonths?.toString() ?? '')
  const [order, setOrder] = useState(item?.order?.toString() ?? String(nextOrder))

  const createMutation = useMutation({
    mutationFn: () => adminComplianceApi.createItem(phaseId, {
      label,
      type,
      config: {},
      isRequired,
      order: Number(order),
      validityMonths: validityMonths ? Number(validityMonths) : null,
    }, token!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-phases'] }); onClose() },
  })

  const updateMutation = useMutation({
    mutationFn: () => adminComplianceApi.updateItem(item!.id, {
      label,
      type,
      isRequired,
      order: Number(order),
      validityMonths: validityMonths ? Number(validityMonths) : null,
    }, token!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-phases'] }); onClose() },
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const error = (createMutation.error || updateMutation.error) as Error | null

  return (
    <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Libellé <span className="text-destructive">*</span></Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Attestation ORIAS" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
            {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Validité (mois)</Label>
          <Input type="number" value={validityMonths} onChange={(e) => setValidityMonths(e.target.value)} placeholder="Ex: 12 (laisser vide = illimité)" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ordre</Label>
          <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="text-sm" />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input type="checkbox" id="required" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="rounded" />
          <label htmlFor="required" className="text-sm cursor-pointer">Obligatoire</label>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error.message}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => item ? updateMutation.mutate() : createMutation.mutate()} disabled={isPending || !label}>
          {isPending ? 'Enregistrement…' : item ? 'Modifier' : 'Ajouter'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}

// ── Phase accordion ────────────────────────────────────────────────────────────

function PhaseCard({ phase }: { phase: CompliancePhase }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingPhase, setEditingPhase] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [phaseLabel, setPhaseLabel] = useState(phase.label)

  const updatePhaseMutation = useMutation({
    mutationFn: () => adminComplianceApi.updatePhase(phase.id, { label: phaseLabel }, token!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-phases'] }); setEditingPhase(false) },
  })

  const deletePhaseMutation = useMutation({
    mutationFn: () => adminComplianceApi.deletePhase(phase.id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-phases'] }),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => adminComplianceApi.deleteItem(itemId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-phases'] }),
  })

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden', !phase.isActive && 'opacity-60')}>
      {/* En-tête phase */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card">
        <button onClick={() => setOpen(!open)} className="text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {editingPhase ? (
          <div className="flex items-center gap-2 flex-1">
            <Input value={phaseLabel} onChange={(e) => setPhaseLabel(e.target.value)} className="text-sm h-8 flex-1" />
            <Button size="sm" className="h-8" onClick={() => updatePhaseMutation.mutate()} disabled={updatePhaseMutation.isPending}>OK</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditingPhase(false); setPhaseLabel(phase.label) }}>✕</Button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <span className="font-medium">{phase.label}</span>
            <span className="text-xs text-muted-foreground">({phase.items.length} items)</span>
            {!phase.isActive && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Inactif</span>}
          </div>
        )}
        {!editingPhase && (
          <div className="flex gap-1">
            <button onClick={() => setEditingPhase(true)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => confirm(`Désactiver la phase "${phase.label}" ?`) && deletePhaseMutation.mutate()}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Items */}
      {open && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-3">
          {phase.items.length === 0 && !addingItem && (
            <p className="text-sm text-muted-foreground">Aucun item dans cette phase.</p>
          )}

          {phase.items.map((item) => (
            <div key={item.id}>
              {editingItem === item.id ? (
                <ItemForm
                  phaseId={phase.id}
                  item={item}
                  nextOrder={item.order}
                  onClose={() => setEditingItem(null)}
                />
              ) : (
                <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2.5 group">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{item.label}</span>
                    <div className="flex gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        {ITEM_TYPE_LABELS[item.type]}
                      </span>
                      {item.isRequired && (
                        <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Requis</span>
                      )}
                      {item.validityMonths && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{item.validityMonths} mois</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingItem(item.id)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => confirm(`Supprimer l'item "${item.label}" ?`) && deleteItemMutation.mutate(item.id)}
                      className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingItem ? (
            <ItemForm
              phaseId={phase.id}
              nextOrder={phase.items.length}
              onClose={() => setAddingItem(false)}
            />
          ) : (
            <button
              onClick={() => setAddingItem(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <Plus className="h-4 w-4" />
              Ajouter un item
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [addingPhase, setAddingPhase] = useState(false)
  const [phaseLabel, setPhaseLabel] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-phases', token],
    queryFn: () => adminComplianceApi.getPhases(token!),
    enabled: !!token && user?.globalRole === 'platform_admin',
  })
  const phases = data?.data.phases ?? []

  const createPhaseMutation = useMutation({
    mutationFn: () => adminComplianceApi.createPhase({ label: phaseLabel, order: phases.length }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-phases'] })
      setAddingPhase(false)
      setPhaseLabel('')
    },
  })

  if (user?.globalRole !== 'platform_admin') {
    return (
      <div className="max-w-xl">
        <p className="text-muted-foreground">Accès réservé aux administrateurs de la plateforme.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Administration</h2>
          <p className="text-muted-foreground mt-1">Gestion des phases et items de conformité.</p>
        </div>
        {!addingPhase && (
          <Button size="sm" onClick={() => setAddingPhase(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle phase
          </Button>
        )}
      </div>

      {addingPhase && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Nouvelle phase</span>
            <button onClick={() => setAddingPhase(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Libellé</Label>
            <Input value={phaseLabel} onChange={(e) => setPhaseLabel(e.target.value)} placeholder="Ex: Devoir de conseil" className="text-sm" autoFocus />
          </div>
          {createPhaseMutation.isError && <p className="text-xs text-destructive">{(createPhaseMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createPhaseMutation.mutate()} disabled={createPhaseMutation.isPending || !phaseLabel}>
              {createPhaseMutation.isPending ? 'Création…' : 'Créer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddingPhase(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : phases.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="font-medium">Aucune phase de conformité</p>
          <p className="text-sm text-muted-foreground mt-1">Créez la première phase via le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase) => <PhaseCard key={phase.id} phase={phase} />)}
        </div>
      )}
    </div>
  )
}
