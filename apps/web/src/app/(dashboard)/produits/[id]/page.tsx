'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, BadgeCheck, Globe, Star, Pencil, ExternalLink, Link2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { productApi, supplierApi } from '@/lib/api'
import { EntityDocuments } from '@/components/entity-documents'
import { ReviewSection } from '@/components/ReviewSection'
import { GovernanceTab } from '@/components/produits/GovernanceTab'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function CabinetSection({ productId }: { productId: string }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')

  const { data } = useQuery({
    queryKey: ['product', productId, token],
    queryFn: () => productApi.get(productId, token!),
    enabled: !!token,
  })

  const cabinetData = data?.data.cabinetData

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof productApi.upsertCabinet>[1]) =>
      productApi.upsertCabinet(productId, body, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId, token] })
      setEditing(false)
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Données privées (votre cabinet)</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mutation.mutate({ isCommercialized: !cabinetData?.isCommercialized })}
            className={cn(
              'text-xs px-3 py-1 rounded-full font-medium transition-colors',
              cabinetData?.isCommercialized
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {cabinetData?.isCommercialized ? 'Commercialisé' : 'Non commercialisé'}
          </button>
          <Button variant="ghost" size="sm" onClick={() => {
            setNote(cabinetData?.privateNote ?? '')
            setTags(cabinetData?.internalTags?.join(', ') ?? '')
            setEditing(true)
          }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Note interne</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note visible uniquement par votre cabinet…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tags internes (séparés par virgule)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex: prioritaire, retraite" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate({ privateNote: note || null, internalTags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [] })} disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {cabinetData?.privateNote
            ? <p className="text-muted-foreground">{cabinetData.privateNote}</p>
            : <p className="text-xs text-muted-foreground italic">Aucune note interne.</p>}
          {cabinetData?.internalTags?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {cabinetData.internalTags.map((tag) => (
                <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function SupplierSearch({ productId, linkedIds, onLink }: {
  productId: string
  linkedIds: string[]
  onLink: (supplierId: string) => void
}) {
  const { token } = useAuthStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['suppliers-search', token, q],
    queryFn: () => supplierApi.list(token!, { search: q, limit: 8 }),
    enabled: !!token && q.length >= 1,
  })

  const results = (data?.data.suppliers ?? []).filter((s) => !linkedIds.includes(s.id))

  return (
    <div className="relative">
      <Input
        placeholder="Rechercher un fournisseur à lier…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => q && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-md overflow-hidden">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              onMouseDown={() => { onLink(s.id); setQ(''); setOpen(false) }}
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

export default function ProduitDetailPage({ params }: { params: { id: string } }) {
  const { token, cabinet } = useAuthStore()
  const queryClient = useQueryClient()
  const { id } = params
  const searchParams = useSearchParams()
  const backHref = searchParams.get('from') ?? '/produits'
  const backLabel = backHref.startsWith('/fournisseurs') ? 'Retour au fournisseur' : 'Retour aux produits'
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'infos' | 'gouvernance'>('infos')

  const { data, isLoading } = useQuery({
    queryKey: ['product', id, token],
    queryFn: () => productApi.get(id, token!),
    enabled: !!token,
  })

  const product = data?.data.product

  const linkMutation = useMutation({
    mutationFn: (supplierId: string) => productApi.linkSupplier(id, supplierId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id, token] })
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (supplierId: string) => productApi.unlinkSupplier(id, supplierId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product', id, token] }),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      {isLoading && (
        <div className="space-y-4">
          <div className="h-24 bg-muted animate-pulse rounded-lg" />
          <div className="h-40 bg-muted animate-pulse rounded-lg" />
        </div>
      )}

      {!isLoading && !product && <p className="text-muted-foreground">Produit introuvable.</p>}

      {product && (
        <>
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {product.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">{product.name}</h2>
                    {product.isVerified && <BadgeCheck className="h-5 w-5 text-blue-500" />}
                    {avgRating !== null && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{avgRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {product.category && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{product.category}</span>
                  )}
                </div>
              </div>
              <Link href={`/produits/${id}/modifier`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Modifier
                </Button>
              </Link>
            </div>

            {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

            {product.website && (
              <a href={product.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline w-fit">
                <Globe className="h-4 w-4" />
                Site web
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {/* Fournisseurs liés */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Link2 className="h-4 w-4" />
                Fournisseurs
              </p>
              {product.supplierLinks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun fournisseur lié.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {product.supplierLinks.map((link) => (
                    <div key={link.id} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-sm">
                      <Link href={`/fournisseurs/${link.supplierId}?from=/produits/${id}`} className="hover:underline">
                        {link.supplier.name}
                      </Link>
                      <button onClick={() => unlinkMutation.mutate(link.supplierId)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <SupplierSearch
                productId={id}
                linkedIds={product.supplierLinks.map((l) => l.supplierId)}
                onLink={(supplierId) => linkMutation.mutate(supplierId)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Ajouté le {new Date(product.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>

          {/* Onglets */}
          <div className="flex gap-1 border-b border-border">
            {([
              { key: 'infos', label: 'Informations' },
              { key: 'gouvernance', label: 'Gouvernance MiFID II' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'infos' && (
            <>
              <CabinetSection productId={id} />
              <ReviewSection entityType="product" entityId={id} token={token!} cabinetId={cabinet?.id ?? ''} onAvgChange={setAvgRating} />
              <div className="bg-card border border-border rounded-lg p-5">
                <EntityDocuments entityType="product" entityId={id} />
              </div>
            </>
          )}

          {activeTab === 'gouvernance' && (
            <GovernanceTab productId={id} token={token!} />
          )}
        </>
      )}
    </div>
  )
}
