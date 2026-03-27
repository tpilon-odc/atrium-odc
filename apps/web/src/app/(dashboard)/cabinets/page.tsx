'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, Building2, MapPin, Globe, Users, ShieldCheck, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { cabinetApi, type CabinetDirectoryItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Card cabinet ──────────────────────────────────────────────────────────────

function CabinetCard({ cabinet }: { cabinet: CabinetDirectoryItem }) {
  const initials = cabinet.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Link
      href={`/cabinets/${cabinet.id}`}
      className="group bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/30 transition-all"
    >
      {/* En-tête */}
      <div className="flex items-start gap-3">
        {cabinet.logoUrl ? (
          <img
            src={cabinet.logoUrl}
            alt={cabinet.name}
            className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border"
          />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0 select-none">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors leading-tight">
            {cabinet.name}
          </h3>
          {cabinet.oriasNumber && (
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck className="h-3 w-3 text-green-500 shrink-0" />
              <span className="text-xs text-muted-foreground">ORIAS {cabinet.oriasNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {cabinet.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {cabinet.description}
        </p>
      )}

      {/* Métadonnées */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-auto">
        {cabinet.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {cabinet.city}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3 shrink-0" />
          {cabinet._count.members} collaborateur{cabinet._count.members > 1 ? 's' : ''}
        </span>
        <span className="ml-auto text-[11px]">
          Depuis {format(new Date(cabinet.createdAt), 'MMM yyyy', { locale: fr })}
        </span>
      </div>

      {/* Site web */}
      {cabinet.website && (
        <div
          className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
          onClick={(e) => { e.preventDefault(); window.open(cabinet.website!, '_blank') }}
        >
          <Globe className="h-3 w-3 shrink-0" />
          <span className="truncate">{cabinet.website.replace(/^https?:\/\//, '')}</span>
          <ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
        </div>
      )}
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CabinetsDirectoryPage() {
  const { token } = useAuthStore()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<CabinetDirectoryItem[]>([])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['cabinets-directory', token, search, cursor],
    queryFn: () => cabinetApi.list(token!, { search: search || undefined, cursor: cursor ?? undefined, limit: 24 }),
    enabled: !!token,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!data) return
    const incoming = data.data.cabinets
    if (!cursor) {
      setAllItems(incoming)
    } else {
      setAllItems((prev) => {
        const ids = new Set(prev.map((c) => c.id))
        return [...prev, ...incoming.filter((c) => !ids.has(c.id))]
      })
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setCursor(null)
    setAllItems([])
    setSearch(searchInput)
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Annuaire des cabinets
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Découvrez les cabinets CGP inscrits sur la plateforme.
          </p>
        </div>
        {!isLoading && allItems.length > 0 && (
          <span className="text-sm text-muted-foreground shrink-0 self-center">
            {allItems.length} cabinet{allItems.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Barre de recherche */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nom, ville, description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>Rechercher</Button>
        {search && (
          <Button variant="ghost" onClick={() => { setSearchInput(''); setSearch(''); setCursor(null); setAllItems([]) }}>
            Effacer
          </Button>
        )}
      </div>

      {/* Grille */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={cn('h-44 bg-muted/40 rounded-xl animate-pulse', i > 5 && 'hidden lg:block')} />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium">Aucun cabinet trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Aucun résultat pour cette recherche." : "Aucun cabinet inscrit pour l'instant."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allItems.map((c) => (
              <CabinetCard key={c.id} cabinet={c} />
            ))}
          </div>
          {data?.data.hasMore && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                onClick={() => setCursor(data.data.nextCursor)}
                disabled={isFetching}
              >
                {isFetching ? 'Chargement…' : 'Charger plus'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
