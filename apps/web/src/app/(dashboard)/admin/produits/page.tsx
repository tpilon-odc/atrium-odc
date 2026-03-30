'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { adminProductSubcategoryApi, type ProductSubcategory } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const MAIN_CATEGORIES = [
  { value: 'assurance' as const, label: 'Assurance', color: 'bg-blue-100 text-blue-700' },
  { value: 'cif' as const, label: 'Conseil en investissement financier (CIF)', color: 'bg-violet-100 text-violet-700' },
]

function SubcategoryRow({
  sub,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  sub: ProductSubcategory
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(sub.label)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-product-subcategories', token] })

  const updateMutation = useMutation({
    mutationFn: (data: { label?: string; isActive?: boolean; order?: number }) =>
      adminProductSubcategoryApi.update(sub.id, data, token!),
    onSuccess: () => { invalidate(); setEditing(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminProductSubcategoryApi.delete(sub.id, token!),
    onSuccess: invalidate,
  })

  return (
    <li className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg border', sub.isActive ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60')}>
      {/* Ordre */}
      <div className="flex flex-col gap-0.5">
        <button onClick={onMoveUp} disabled={isFirst} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
          <ChevronUp className="h-3 w-3" />
        </button>
        <button onClick={onMoveDown} disabled={isLast} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {editing ? (
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          className="h-7 text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateMutation.mutate({ label })
            if (e.key === 'Escape') { setEditing(false); setLabel(sub.label) }
          }}
        />
      ) : (
        <span className="text-sm flex-1">{sub.label}</span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={() => updateMutation.mutate({ label })} disabled={updateMutation.isPending || !label.trim()} className="p-1 text-green-600 hover:text-green-700">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setEditing(false); setLabel(sub.label) }} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => updateMutation.mutate({ isActive: !sub.isActive })}
              className={cn('text-xs px-2 py-0.5 rounded-full font-medium transition-colors', sub.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
            >
              {sub.isActive ? 'Actif' : 'Inactif'}
            </button>
            <button onClick={() => setEditing(true)} className="p-1 text-muted-foreground hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {confirmDelete ? (
              <>
                <button onClick={() => deleteMutation.mutate()} className="text-xs text-destructive hover:underline">Confirmer</button>
                <button onClick={() => setConfirmDelete(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </li>
  )
}

function CategorySection({ mainCategory, label, color, subcategories }: {
  mainCategory: 'assurance' | 'cif'
  label: string
  color: string
  subcategories: ProductSubcategory[]
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-product-subcategories', token] })

  const createMutation = useMutation({
    mutationFn: () => adminProductSubcategoryApi.create({ mainCategory, label: newLabel.trim() }, token!),
    onSuccess: () => { invalidate(); setNewLabel(''); setAdding(false) },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      adminProductSubcategoryApi.update(id, { order }, token!),
    onSuccess: invalidate,
  })

  const handleMove = (idx: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const a = subcategories[idx]
    const b = subcategories[swapIdx]
    moveMutation.mutate({ id: a.id, order: b.order })
    moveMutation.mutate({ id: b.id, order: a.order })
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', color)}>{mainCategory === 'assurance' ? 'Assurance' : 'CIF'}</span>
          <h3 className="font-medium text-sm">{label}</h3>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nom de la sous-catégorie…"
            autoFocus
            className="text-sm h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newLabel.trim()) createMutation.mutate()
              if (e.key === 'Escape') { setAdding(false); setNewLabel('') }
            }}
          />
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newLabel.trim() || createMutation.isPending}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewLabel('') }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {subcategories.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune sous-catégorie.</p>
      ) : (
        <ul className="space-y-1.5">
          {subcategories.map((sub, idx) => (
            <SubcategoryRow
              key={sub.id}
              sub={sub}
              isFirst={idx === 0}
              isLast={idx === subcategories.length - 1}
              onMoveUp={() => handleMove(idx, 'up')}
              onMoveDown={() => handleMove(idx, 'down')}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AdminProduitsPage() {
  const { token } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-product-subcategories', token],
    queryFn: () => adminProductSubcategoryApi.list(token!),
    enabled: !!token,
  })

  const subcategories = data?.data.subcategories ?? []

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-semibold">Sous-catégories produits</h2>
        <p className="text-muted-foreground mt-1">Configurez les sous-catégories disponibles par catégorie principale.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-40 bg-muted animate-pulse rounded-lg" />
          <div className="h-40 bg-muted animate-pulse rounded-lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {MAIN_CATEGORIES.map((mc) => (
            <CategorySection
              key={mc.value}
              mainCategory={mc.value}
              label={mc.label}
              color={mc.color}
              subcategories={subcategories.filter((s) => s.mainCategory === mc.value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
