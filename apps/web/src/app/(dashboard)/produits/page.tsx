'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Search, Star, BadgeCheck, ChevronRight, X, Table2, AlertTriangle, ShieldCheck, PackageX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { productApi, supplierApi, productSubcategoryApi, type Product } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating)
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= rounded
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted-foreground/30'
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1 tabular-nums">{rating.toFixed(1)}</span>
    </span>
  )
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/produits/${product.id}`}
      className="flex items-center gap-4 bg-card border border-border rounded-lg p-4 hover:bg-accent/40 transition-colors group"
    >
      <div className="h-10 w-10 rounded-lg bg-info-subtle text-info flex items-center justify-center font-semibold text-sm shrink-0">
        {product.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{product.name}</span>
          {!product.isActive && (
              <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                <PackageX className="h-3 w-3" />
                Retiré du marché
              </span>
            )}
          {product.mainCategory && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                product.mainCategory === 'assurance' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
              )}>
                {product.mainCategory === 'assurance' ? 'Assurance' : 'CIF'}
              </span>
            )}
          {product.isVerified && (
            <span className="inline-flex items-center gap-1 text-xs bg-info-subtle text-info-subtle-foreground px-2 py-0.5 rounded-full font-medium shrink-0">
              <BadgeCheck className="h-3 w-3" />
              Vérifié
            </span>
          )}
          {product.category && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
              {product.category}
            </span>
          )}
          {product.cabinetData?.isCommercialized && (
            <span className="text-xs bg-success-subtle text-success-subtle-foreground px-2 py-0.5 rounded-full font-medium shrink-0">
              Commercialisé
            </span>
          )}
          {product.governanceStatus?.isDueForRevision && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
              <AlertTriangle className="h-3 w-3" />
              Révision due
            </span>
          )}
          {product.governanceStatus?.status === 'active' && !product.governanceStatus.isDueForRevision && (
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">
              <ShieldCheck className="h-3 w-3" />
              MiFID II
            </span>
          )}
          {product.governanceStatus?.status === 'draft' && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">
              MiFID brouillon
            </span>
          )}
        </div>
        {product.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>
        )}
        {product.avgPublicRating ? (
          <div className="mt-1">
            <StarRating rating={product.avgPublicRating} />
          </div>
        ) : null}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  )
}

function SupplierPicker({
  value,
  onChange,
}: {
  value: { id: string; name: string } | null
  onChange: (s: { id: string; name: string } | null) => void
}) {
  const { token } = useAuthStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['suppliers-search', token, q],
    queryFn: () => supplierApi.list(token!, { search: q, limit: 8 }),
    enabled: !!token && q.length >= 1,
  })

  const results = data?.data.suppliers ?? []

  if (value) {
    return (
      <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 text-sm">
        <span className="text-sm">{value.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        placeholder="Filtrer par fournisseur…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => q && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="text-sm h-9"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-md overflow-hidden">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              onMouseDown={() => { onChange({ id: s.id, name: s.name }); setQ(''); setOpen(false) }}
            >
              <span className="font-medium">{s.name}</span>
              {s.category && <span className="text-xs text-muted-foreground">{s.category}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const MAIN_CATEGORIES = [
  { value: 'assurance' as const, label: 'Assurance', color: 'bg-blue-100 text-blue-700', activeColor: 'bg-blue-600 text-white' },
  { value: 'cif' as const, label: 'CIF', color: 'bg-violet-100 text-violet-700', activeColor: 'bg-violet-600 text-white' },
]

export default function ProduitsPage() {
  const { token } = useAuthStore()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [mainCategory, setMainCategory] = useState<'assurance' | 'cif' | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(null)
  const [isActive, setIsActive] = useState<'true' | 'false' | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<Product[]>([])

  const { data: subcatData } = useQuery({
    queryKey: ['product-subcategories', mainCategory],
    queryFn: () => productSubcategoryApi.list(token!, mainCategory ?? undefined),
    enabled: !!token && !!mainCategory,
  })
  const subcategories = subcatData?.data.subcategories ?? []

  const resetPagination = () => {
    setCursor(null)
    setAllItems([])
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', token, search, mainCategory, category, supplier?.id, isActive, cursor],
    queryFn: () =>
      productApi.list(token!, {
        search: search || undefined,
        cursor: cursor ?? undefined,
        limit: 20,
        mainCategory: mainCategory ?? undefined,
        category: category ?? undefined,
        supplierId: supplier?.id ?? undefined,
        isActive: isActive ?? undefined,
      }),
    enabled: !!token,
  })

  useEffect(() => {
    if (!data) return
    const incoming = data.data.products
    if (!cursor) {
      setAllItems(incoming)
    } else {
      setAllItems((prev) => {
        const ids = new Set(prev.map((p) => p.id))
        return [...prev, ...incoming.filter((p) => !ids.has(p.id))]
      })
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    resetPagination()
    setSearch(searchInput)
  }

  const handleMainCategoryToggle = (val: 'assurance' | 'cif') => {
    setMainCategory((prev) => {
      if (prev === val) { setCategory(null); return null }
      setCategory(null)
      return val
    })
    resetPagination()
  }

  const handleSubcategoryToggle = (cat: string) => {
    setCategory((prev) => (prev === cat ? null : cat))
    resetPagination()
  }

  const handleSupplierChange = (s: { id: string; name: string } | null) => {
    setSupplier(s)
    resetPagination()
  }

  const handleIsActiveToggle = (val: 'true' | 'false') => {
    setIsActive((prev) => (prev === val ? null : val))
    resetPagination()
  }

  const hasFilters = !!search || !!mainCategory || !!category || !!supplier || !!isActive

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Produits</h2>
          <p className="text-muted-foreground mt-1">Base communautaire — visible par tous les cabinets.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/produits/gouvernance">
            <Button size="sm" variant="outline">
              <Table2 className="h-4 w-4 mr-1.5" />
              Tableau MiFID II
            </Button>
          </Link>
          <Link href="/produits/nouveau">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Ajouter
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher un produit…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>Rechercher</Button>
        </div>

        {/* Catégorie principale */}
        <div className="flex flex-wrap gap-1.5">
          {MAIN_CATEGORIES.map((mc) => (
            <button
              key={mc.value}
              type="button"
              onClick={() => handleMainCategoryToggle(mc.value)}
              className={cn(
                'text-xs px-3 py-1 rounded-full font-medium transition-colors',
                mainCategory === mc.value ? mc.activeColor : mc.color
              )}
            >
              {mc.label}
            </button>
          ))}
        </div>

        {/* Sous-catégories dynamiques */}
        {mainCategory && subcategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {subcategories.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSubcategoryToggle(s.label)}
                className={cn(
                  'text-xs px-3 py-1 rounded-full font-medium transition-colors',
                  category === s.label
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Statut fournisseur */}
        <div className="flex items-center gap-2">
          {(['true', 'false'] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handleIsActiveToggle(val)}
              className={cn(
                'text-xs px-3 py-1 rounded-full font-medium transition-colors border',
                isActive === val
                  ? val === 'true'
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-red-100 text-red-700 border-red-300'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {val === 'true' ? 'Toujours commercialisé' : 'Retiré du marché'}
            </button>
          ))}
        </div>

        {/* Fournisseur */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Fournisseur :</span>
          <SupplierPicker value={supplier} onChange={handleSupplierChange} />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setSearchInput('')
              setMainCategory(null)
              setCategory(null)
              setSupplier(null)
              setIsActive(null)
              resetPagination()
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <p className="font-medium">Aucun produit trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? 'Aucun résultat pour ces filtres.' : 'Soyez le premier à ajouter un produit.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {allItems.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {data?.data.hasMore && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" onClick={() => setCursor(data.data.nextCursor!)} disabled={isFetching}>
                {isFetching ? 'Chargement…' : 'Charger plus'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
