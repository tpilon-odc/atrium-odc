'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Search, Building2, Clock, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { trainingApi, type TrainingCatalogEntry } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

function AddCatalogForm({ onClose }: { onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [organizer, setOrganizer] = useState('')
  const [category, setCategory] = useState('')
  const [hours, setHours] = useState('')

  const mutation = useMutation({
    mutationFn: () => trainingApi.createCatalogEntry({
      name,
      organizer: organizer || undefined,
      category: category || undefined,
      defaultHours: hours ? Number(hours) : undefined,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-catalog'] })
      onClose()
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Ajouter au catalogue</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Nom <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Formation AMF" className="text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Organisateur</Label>
          <Input value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="ex: ANACOFI" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Catégorie</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex: Réglementation" className="text-sm" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Heures par défaut</Label>
        <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="ex: 7" className="text-sm" />
      </div>
      {mutation.isError && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
          {mutation.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}

function CatalogRow({ entry }: { entry: TrainingCatalogEntry }) {
  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3">
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <BookOpen className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {entry.organizer && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {entry.organizer}
            </span>
          )}
          {entry.defaultHours && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {entry.defaultHours}h
            </span>
          )}
        </div>
      </div>
      {entry.category && (
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
          {entry.category}
        </span>
      )}
      {entry.isVerified && (
        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full shrink-0">
          Vérifié
        </span>
      )}
    </div>
  )
}

export default function CataloguePage() {
  const { token } = useAuthStore()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['training-catalog', token, search],
    queryFn: () => trainingApi.listCatalog(token!, search || undefined),
    enabled: !!token,
  })

  const catalog = data?.data.catalog ?? []

  // Grouper par catégorie
  const categories = [...new Set(catalog.map((e) => e.category ?? 'Autre'))].sort()
  const byCategory = new Map(
    categories.map((cat) => [
      cat,
      catalog.filter((e) => (e.category ?? 'Autre') === cat),
    ])
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/formations" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold">Catalogue de formations</h2>
          <p className="text-muted-foreground mt-1">
            {catalog.length} formation{catalog.length > 1 ? 's' : ''} disponible{catalog.length > 1 ? 's' : ''}
          </p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter
          </Button>
        )}
      </div>

      {adding && <AddCatalogForm onClose={() => setAdding(false)} />}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher une formation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : catalog.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucune formation trouvée</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? 'Aucun résultat pour cette recherche.' : 'Le catalogue est vide.'}
          </p>
        </div>
      ) : search ? (
        <div className="space-y-2">
          {catalog.map((e) => <CatalogRow key={e.id} entry={e} />)}
        </div>
      ) : (
        <div className="space-y-6">
          {[...byCategory.entries()].map(([cat, entries]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-2">
                {entries.map((e) => <CatalogRow key={e.id} entry={e} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
