'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Plus, Pencil, Trash2, Check, X, GripVertical, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminTrainingCategoryApi, type TrainingCategory } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function AdminFormationCategoriesPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-training-categories', token],
    queryFn: () => adminTrainingCategoryApi.list(token!),
    enabled: !!token,
  })
  const categories = data?.data.categories ?? []

  // ── Ajout ──────────────────────────────────────────────────────────────────
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newHours, setNewHours] = useState('')
  const [newPeriod, setNewPeriod] = useState('1')
  const [codeManual, setCodeManual] = useState(false)

  const createMutation = useMutation({
    mutationFn: () => adminTrainingCategoryApi.create({
      name: newName.trim(),
      code: newCode.trim(),
      requiredHours: newHours ? Number(newHours) : undefined,
      requiredHoursPeriod: newHours ? Number(newPeriod) : undefined,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-categories'] })
      setAdding(false)
      setNewName('')
      setNewCode('')
      setNewHours('')
      setNewPeriod('1')
      setCodeManual(false)
    },
  })

  function handleNewNameChange(v: string) {
    setNewName(v)
    if (!codeManual) setNewCode(slugify(v))
  }

  // ── Édition ────────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editHours, setEditHours] = useState('')
  const [editPeriod, setEditPeriod] = useState('1')

  function startEdit(cat: TrainingCategory) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditCode(cat.code)
    setEditHours(cat.requiredHours != null ? String(cat.requiredHours) : '')
    setEditPeriod(cat.requiredHoursPeriod != null ? String(cat.requiredHoursPeriod) : '1')
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; code?: string; isActive?: boolean; order?: number; requiredHours?: number | null; requiredHoursPeriod?: number | null } }) =>
      adminTrainingCategoryApi.update(id, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-categories'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminTrainingCategoryApi.remove(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-training-categories'] }),
  })

  // ── Réordonnancement ───────────────────────────────────────────────────────
  function moveUp(cat: TrainingCategory, idx: number) {
    if (idx === 0) return
    const prev = categories[idx - 1]
    updateMutation.mutate({ id: cat.id, data: { order: prev.order } })
    updateMutation.mutate({ id: prev.id, data: { order: cat.order } })
  }
  function moveDown(cat: TrainingCategory, idx: number) {
    if (idx === categories.length - 1) return
    const next = categories[idx + 1]
    updateMutation.mutate({ id: cat.id, data: { order: next.order } })
    updateMutation.mutate({ id: next.id, data: { order: cat.order } })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Catégories de formations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérez les catégories réglementaires utilisées pour classer les formations (IAS, CIF, DDA…).
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-4 w-4 mr-1.5" />
          Ajouter
        </Button>
      </div>

      {/* Formulaire ajout */}
      {adding && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">Nouvelle catégorie</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom</Label>
              <Input
                value={newName}
                onChange={(e) => handleNewNameChange(e.target.value)}
                placeholder="ex: IAS (Intermédiaire en Assurance)"
                className="text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Code (identifiant technique)</Label>
              <Input
                value={newCode}
                onChange={(e) => { setNewCode(e.target.value); setCodeManual(true) }}
                placeholder="ex: ias"
                className="text-sm font-mono"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quota d'heures <span className="text-muted-foreground">— optionnel</span></Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={newHours}
                onChange={(e) => setNewHours(e.target.value)}
                placeholder="ex: 14"
                className="text-sm w-28"
              />
              <span className="text-sm text-muted-foreground shrink-0">h tous les</span>
              <Input
                type="number"
                min="1"
                step="1"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                disabled={!newHours}
                className="text-sm w-20"
              />
              <span className="text-sm text-muted-foreground shrink-0">an(s)</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newName.trim() || !newCode.trim()}>
              {createMutation.isPending ? 'Création…' : 'Créer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewName(''); setNewCode(''); setNewHours(''); setCodeManual(false) }}>
              Annuler
            </Button>
          </div>
          {createMutation.isError && (
            <p className="text-xs text-destructive">{(createMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/40 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <GraduationCap className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucune catégorie définie.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {categories.map((cat, idx) => (
            <div key={cat.id} className={cn('flex items-center gap-3 px-4 py-3', !cat.isActive && 'opacity-50')}>
              {/* Grip + ordre */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(cat, idx)}
                  disabled={idx === 0 || updateMutation.isPending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  title="Monter"
                >
                  <GripVertical className="h-3.5 w-3.5 rotate-180" />
                </button>
                <button
                  onClick={() => moveDown(cat, idx)}
                  disabled={idx === categories.length - 1 || updateMutation.isPending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  title="Descendre"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
              </div>

              {editingId === cat.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-sm h-8 flex-1"
                    autoFocus
                  />
                  <Input
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="text-sm h-8 w-28 font-mono"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      placeholder="h"
                      title="Quota d'heures"
                      className="text-sm h-8 w-16 border border-input rounded px-2 bg-background text-right"
                    />
                    <span className="text-xs text-muted-foreground">h /</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={editPeriod}
                      onChange={(e) => setEditPeriod(e.target.value)}
                      disabled={!editHours}
                      title="Période (années)"
                      className="text-sm h-8 w-12 border border-input rounded px-2 bg-background text-right disabled:opacity-40"
                    />
                    <span className="text-xs text-muted-foreground">an(s)</span>
                  </div>
                  <button
                    onClick={() => updateMutation.mutate({
                      id: cat.id,
                      data: {
                        name: editName,
                        code: editCode,
                        requiredHours: editHours ? Number(editHours) : null,
                        requiredHoursPeriod: editHours ? Number(editPeriod) : null,
                      },
                    })}
                    className="text-green-600 hover:text-green-700 p-1"
                    title="Valider"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground p-1" title="Annuler">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {cat.code}
                      {cat.requiredHours != null && (
                        <span className="ml-2 not-italic font-sans text-muted-foreground">
                          · {cat.requiredHours}h nécessaires / {cat.requiredHoursPeriod === 1 ? 'an' : `${cat.requiredHoursPeriod} ans`}
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => updateMutation.mutate({ id: cat.id, data: { isActive: !cat.isActive } })}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title={cat.isActive ? 'Masquer' : 'Afficher'}
                  >
                    {cat.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Renommer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer "${cat.name}" ?`)) deleteMutation.mutate(cat.id)
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
