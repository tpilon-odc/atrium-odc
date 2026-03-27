'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AlertTriangle, Download, FileSpreadsheet } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { productApi, type Governance } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GOVERNANCE_AXES } from '@/lib/governance-axes'

type MarcheCible = 'positif' | 'neutre' | 'negatif'

function MarcheBadge({ value }: { value: MarcheCible | null | undefined }) {
  if (!value) return <span className="text-muted-foreground/40 text-xs">—</span>
  const cfg: Record<MarcheCible, string> = {
    positif: 'bg-green-100 text-green-700',
    neutre: 'bg-yellow-100 text-yellow-700',
    negatif: 'bg-red-100 text-red-700',
  }
  const short: Record<MarcheCible, string> = { positif: 'P', neutre: 'N', negatif: '✗' }
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold', cfg[value])}>
      {short[value]}
    </span>
  )
}

const ALL_FIELDS = GOVERNANCE_AXES.flatMap((a) => a.criteria.map((c) => ({ field: c.field, group: a.label, label: c.sublabel ?? c.label })))

const CATEGORIES = ['Assurance-vie', 'SCPI', 'PER', 'Immobilier', 'Actions', 'Obligations', 'OPCVM', 'Défiscalisation']

export default function GovernanceTableauPage() {
  const { token } = useAuthStore()
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [onlyDue, setOnlyDue] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Fetch all active governances
  const { data, isLoading } = useQuery({
    queryKey: ['governance-export-list', token],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/products/governance/due-revision`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error('Erreur chargement')
      return res.json() as Promise<{ data: { items: (Governance & { product: { id: string; name: string; category: string | null } })[] } }>
    },
    enabled: !!token,
  })

  const { data: tableData, isLoading: tableLoading } = useQuery({
    queryKey: ['governance-table', token],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/products/governance/list`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      return json.data as { items: (Governance & { product: { id: string; name: string; category: string | null } })[] }
    },
    enabled: !!token,
  })

  const dueItems = data?.data.items ?? []
  const allItems = tableData?.items ?? []

  const filtered = allItems.filter((gov) => {
    if (filterCategory && gov.product.category !== filterCategory) return false
    if (onlyDue) {
      const isDue = gov.nextRevisionDate && new Date(gov.nextRevisionDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      if (!isDue) return false
    }
    return true
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await productApi.exportGovernance(token!)
      if (!res.ok) throw new Error("Erreur export")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const cd = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      a.href = url
      a.download = match?.[1] ?? 'gouvernance.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Tableau de gouvernance</h2>
          <p className="text-muted-foreground mt-1">Marché cible MiFID II — gouvernances actives de votre cabinet.</p>
        </div>
        <Button onClick={handleExport} disabled={exporting} variant="outline">
          <Download className="h-4 w-4 mr-1.5" />
          {exporting ? 'Export…' : 'Exporter le tableau XLSX'}
        </Button>
      </div>

      {/* Alertes révisions dues */}
      {!isLoading && dueItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800">
              {dueItems.length} produit{dueItems.length > 1 ? 's' : ''} nécessite{dueItems.length > 1 ? 'nt' : ''} une révision dans les 30 prochains jours
            </p>
            <div className="flex flex-wrap gap-2">
              {dueItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/produits/${item.productId}#gouvernance`}
                  className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors"
                >
                  {item.product.name}
                  {item.nextRevisionDate && (
                    <> — {new Date(item.nextRevisionDate).toLocaleDateString('fr-FR')}</>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory((prev) => prev === cat ? null : cat)}
              className={cn(
                'text-xs px-3 py-1 rounded-full font-medium transition-colors',
                filterCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOnlyDue((v) => !v)}
          className={cn(
            'text-xs px-3 py-1 rounded-full font-medium transition-colors border',
            onlyDue
              ? 'bg-amber-100 text-amber-700 border-amber-300'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Révisions dues uniquement
        </button>
      </div>

      {/* Tableau */}
      {tableLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center space-y-2">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-medium">Aucun produit avec une gouvernance active</p>
          <p className="text-sm text-muted-foreground">
            Définissez le marché cible depuis la fiche d'un produit, onglet "Gouvernance MiFID II".
          </p>
          <Link href="/produits">
            <Button variant="outline" size="sm" className="mt-2">Voir les produits</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Ligne groupes */}
              <tr className="bg-muted/60">
                <th className="text-left px-3 py-2 font-medium border-r border-border sticky left-0 bg-muted/60 min-w-[180px]">
                  Produit
                </th>
                {GOVERNANCE_AXES.map((axis) => (
                  <th
                    key={axis.id}
                    colSpan={axis.criteria.length}
                    className="text-center px-2 py-2 font-medium border-r border-border text-xs whitespace-nowrap"
                  >
                    {axis.label}
                  </th>
                ))}
              </tr>
              {/* Ligne critères */}
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-3 py-1.5 text-xs font-normal text-muted-foreground border-r border-border sticky left-0 bg-muted/30">
                  Catégorie
                </th>
                {ALL_FIELDS.map(({ field, label }) => (
                  <th key={field} className="px-1 py-1.5 text-xs font-normal text-muted-foreground text-center min-w-[80px] border-r border-border last:border-r-0">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((gov) => (
                <tr key={gov.id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 border-r border-border sticky left-0 bg-card">
                    <Link
                      href={`/produits/${gov.productId}`}
                      className="font-medium hover:underline text-sm"
                    >
                      {gov.product.name}
                    </Link>
                    {gov.product.category && (
                      <p className="text-xs text-muted-foreground">{gov.product.category}</p>
                    )}
                    {gov.nextRevisionDate && new Date(gov.nextRevisionDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 mt-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        Révision due
                      </span>
                    )}
                  </td>
                  {ALL_FIELDS.map(({ field }) => (
                    <td key={field} className="px-1 py-2 text-center border-r border-border last:border-r-0">
                      <MarcheBadge value={(gov as unknown as Record<string, MarcheCible | null>)[field]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border pt-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 font-semibold">P</span>
          Positif — vente autorisée
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">N</span>
          Neutre — hors marché cible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 font-semibold">✗</span>
          Négatif — vente interdite
        </span>
        <span className="text-muted-foreground/50">— Non renseigné</span>
      </div>
    </div>
  )
}
