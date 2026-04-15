'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronUp, ChevronDown, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminChamberCategoryApi, type ChamberPostCategory } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#374151',
]

const DEFAULT_CATEGORY_ID = '00000000-0000-0000-0000-000000000001'

function CategoryRow({
  category,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  category: ChamberPostCategory
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isDefault = category.id === DEFAULT_CATEGORY_ID

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-chamber-categories'] })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminChamberCategoryApi.update>[1]) =>
      adminChamberCategoryApi.update(category.id, data, token!),
    onSuccess: () => { invalidate(); setEditing(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminChamberCategoryApi.delete(category.id, token!),
    onSuccess: invalidate,
  })

  return (
    <div className={cn(
      'flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-card',
      !category.isActive && 'opacity-60'
    )}>
      <div className="flex flex-col gap-0.5">
        <button onClick={onMoveUp} disabled={isFirst} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={isLast} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Color dot */}
      {editing ? (
        <div className="flex flex-wrap gap-1 shrink-0">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              className={cn(
                'h-5 w-5 rounded-full border-2 transition-transform',
                color === c ? 'border-foreground scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      ) : (
        <span
          className="h-4 w-4 rounded-full shrink-0"
          style={{ backgroundColor: category.color }}
        />
      )}

      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-sm"
            autoFocus
          />
        ) : (
          <span className="text-sm font-medium">{category.name}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isDefault && (
          <button
            onClick={() => updateMutation.mutate({ isActive: !category.isActive })}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
              category.isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {category.isActive ? 'Active' : 'Inactive'}
          </button>
        )}

        {editing ? (
          <>
            <button
              onClick={() => updateMutation.mutate({ name: name.trim(), color })}
              disabled={!name.trim() || updateMutation.isPending}
              className="p-1.5 text-green-600 hover:text-green-700 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => { setName(category.name); setColor(category.color); setEditing(false) }} className="p-1.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : confirmDelete ? (
          <>
            <span className="text-xs text-destructive">Supprimer ?</span>
            <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="text-xs text-destructive hover:underline font-medium">Oui</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:underline">Non</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="p-1.5 text-muted-foreground hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!isDefault && (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminCommunicationsPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-chamber-categories'],
    queryFn: () => adminChamberCategoryApi.getAll(token!),
    enabled: !!token,
  })

  const categories = data?.data.categories ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-chamber-categories'] })

  const createMutation = useMutation({
    mutationFn: () => adminChamberCategoryApi.create({ name: newName.trim(), color: newColor, order: categories.length * 10 }, token!),
    onSuccess: () => { invalidate(); setNewName(''); setNewColor(DEFAULT_COLORS[0]) },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      adminChamberCategoryApi.update(id, { order }, token!),
    onSuccess: invalidate,
  })

  const handleMove = (idx: number, dir: 'up' | 'down') => {
    const swap = dir === 'up' ? idx - 1 : idx + 1
    moveMutation.mutate({ id: categories[idx].id, order: categories[swap].order })
    moveMutation.mutate({ id: categories[swap].id, order: categories[idx].order })
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-semibold">Catégories de communications</h2>
        <p className="text-muted-foreground mt-1">
          Gérez les catégories utilisées pour classer les publications de la chambre.
          La catégorie <strong>Général</strong> est la catégorie par défaut et ne peut pas être supprimée.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="space-y-2">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucune catégorie configurée.</p>
            )}
            {categories.map((cat, idx) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                isFirst={idx === 0}
                isLast={idx === categories.length - 1}
                onMoveUp={() => handleMove(idx, 'up')}
                onMoveDown={() => handleMove(idx, 'down')}
              />
            ))}
          </div>

          {/* Ajouter une catégorie */}
          <div className="pt-2 border-t border-border space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nouvelle catégorie</p>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-transform',
                    newColor === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: newColor }} />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de la catégorie (ex: Réglementation)"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && newName.trim() && createMutation.mutate()}
              />
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
