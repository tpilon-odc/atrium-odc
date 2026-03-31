'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronUp, ChevronDown, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminToolCategoryApi, type ToolCategory } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function CategoryRow({
  category,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  category: ToolCategory
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(category.label)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-tool-categories', token] })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminToolCategoryApi.update>[1]) =>
      adminToolCategoryApi.update(category.id, data, token!),
    onSuccess: () => { invalidate(); setEditing(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminToolCategoryApi.delete(category.id, token!),
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

      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-7 text-sm"
            autoFocus
          />
        ) : (
          <span className="text-sm font-medium">{category.label}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => updateMutation.mutate({ isActive: !category.isActive })}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
            category.isActive
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {category.isActive ? 'Actif' : 'Inactif'}
        </button>

        {editing ? (
          <>
            <button
              onClick={() => updateMutation.mutate({ label })}
              disabled={!label.trim() || updateMutation.isPending}
              className="p-1.5 text-green-600 hover:text-green-700 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => { setLabel(category.label); setEditing(false) }} className="p-1.5 text-muted-foreground hover:text-foreground">
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
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminOutilsPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [newLabel, setNewLabel] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tool-categories', token],
    queryFn: () => adminToolCategoryApi.list(token!),
    enabled: !!token,
  })

  const categories = data?.data.categories ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-tool-categories', token] })

  const createMutation = useMutation({
    mutationFn: () => adminToolCategoryApi.create(newLabel.trim(), token!),
    onSuccess: () => { invalidate(); setNewLabel('') },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      adminToolCategoryApi.update(id, { order }, token!),
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
        <h2 className="text-2xl font-semibold">Catégories d&apos;outils</h2>
        <p className="text-muted-foreground mt-1">
          Gérez les catégories affichées dans la base communautaire d&apos;outils (logiciels, plateformes, services).
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
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
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nouvelle catégorie (ex: Signature électronique)"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && newLabel.trim() && createMutation.mutate()}
            />
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!newLabel.trim() || createMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
