'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Search, Star, BadgeCheck, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierApi, type Supplier } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function SupplierCard({ supplier }: { supplier: Supplier }) {
  return (
    <Link
      href={`/fournisseurs/${supplier.id}`}
      className="flex items-center gap-4 bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors group"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
        {supplier.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{supplier.name}</span>
          {supplier.isVerified && (
            <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />
          )}
          {supplier.category && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
              {supplier.category}
            </span>
          )}
          {supplier.cabinetData?.isActive && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">
              Partenaire
            </span>
          )}
        </div>
        {supplier.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{supplier.description}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {supplier.avgPublicRating ? (
          <span className="flex items-center gap-0.5">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium">{supplier.avgPublicRating.toFixed(1)}</span>
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}

export default function FournisseursPage() {
  const { token } = useAuthStore()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<Supplier[]>([])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['suppliers', token, search, cursor],
    queryFn: () => supplierApi.list(token!, { search: search || undefined, cursor: cursor ?? undefined, limit: 20 }),
    enabled: !!token,
  })

  useEffect(() => {
    if (!data) return
    const incoming = data.data.suppliers
    if (!cursor) {
      setAllItems(incoming)
    } else {
      setAllItems((prev) => {
        const ids = new Set(prev.map((s) => s.id))
        return [...prev, ...incoming.filter((s) => !ids.has(s.id))]
      })
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setCursor(null)
    setAllItems([])
    setSearch(searchInput)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Fournisseurs</h2>
          <p className="text-muted-foreground mt-1">Base communautaire — visible par tous les cabinets.</p>
        </div>
        <Link href="/fournisseurs/nouveau">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter
          </Button>
        </Link>
      </div>

      {/* Recherche */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un fournisseur…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>Rechercher</Button>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="font-medium">Aucun fournisseur trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? 'Aucun résultat pour cette recherche.' : 'Soyez le premier à ajouter un fournisseur.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {allItems.map((s) => (
            <SupplierCard key={s.id} supplier={s} />
          ))}
          {data?.data.hasMore && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCursor(data.data.nextCursor)}
                disabled={isFetching}
              >
                {isFetching ? 'Chargement…' : 'Charger plus'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
