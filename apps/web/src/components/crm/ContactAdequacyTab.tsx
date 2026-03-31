'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { type AdequacyVerdict, contactApi, type ContactProduct } from '@/lib/api'
import { useContactAdequacy, type AdequacyRow } from '@/hooks/useContactAdequacy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Helpers visuels ───────────────────────────────────────────────────────────

function VerdictDot({ verdict }: { verdict: AdequacyVerdict }) {
  return (
    <span
      title={VERDICT_LABELS[verdict]}
      className={cn(
        'inline-block h-3 w-3 rounded-full',
        verdict === 'positif' ? 'bg-green-500' :
        verdict === 'neutre' ? 'bg-yellow-400' :
        verdict === 'negatif' ? 'bg-red-500' :
        'bg-muted border border-border'
      )}
    />
  )
}

const VERDICT_LABELS: Record<AdequacyVerdict, string> = {
  positif: 'Positif — marché cible',
  neutre: 'Neutre — hors marché cible',
  negatif: 'Négatif — marché cible négatif',
  non_evalue: 'Non évalué',
}

const VERDICT_GLOBAL_LABEL: Record<AdequacyVerdict, string> = {
  positif: 'Marché cible positif',
  neutre: 'Hors marché cible',
  negatif: 'Marché cible négatif',
  non_evalue: 'Non évalué',
}

type FilterMode = 'all' | 'positif' | 'exclude_negative'

// ── Formulaire ajout/édition produit vendu ────────────────────────────────────

function SoldProductForm({
  contactId,
  token,
  adequacyResults,
  initialProductId,
  entry,
  onClose,
}: {
  contactId: string
  token: string
  adequacyResults: AdequacyRow[]
  initialProductId?: string
  entry?: ContactProduct
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [productId, setProductId] = useState(entry?.productId ?? initialProductId ?? '')
  const [soldAt, setSoldAt] = useState(entry?.soldAt ? entry.soldAt.slice(0, 10) : '')
  const [amount, setAmount] = useState(entry?.amount != null ? String(entry.amount) : '')
  const [notes, setNotes] = useState(entry?.notes ?? '')

  const isEdit = !!entry

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? contactApi.updateProduct(contactId, entry.id, {
          soldAt,
          amount: amount ? parseFloat(amount) : null,
          notes: notes || null,
        }, token)
      : contactApi.addProduct(contactId, {
          productId,
          soldAt,
          amount: amount ? parseFloat(amount) : null,
          notes: notes || null,
        }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-sold-products', contactId] })
      onClose()
    },
  })

  const canSubmit = productId && soldAt

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{isEdit ? 'Modifier la vente' : 'Enregistrer une vente'}</span>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>

      {!isEdit && (
        <div className="space-y-1.5">
          <Label className="text-xs">Produit <span className="text-destructive">*</span></Label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Sélectionner un produit —</option>
            {adequacyResults.map((r) => (
              <option key={r.product.id} value={r.product.id}>
                {r.product.name}{r.product.category ? ` — ${r.product.category}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Date de vente <span className="text-destructive">*</span></Label>
          <Input type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} className="text-sm h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Montant investi (€)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ex: 10000"
            className="text-sm h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes libres…" className="text-sm h-9" />
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
          {mutation.isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}

// ── Section produits vendus ───────────────────────────────────────────────────

function SoldProductsSection({
  contactId,
  token,
  adequacyResults,
  soldProductIds,
}: {
  contactId: string
  token: string
  adequacyResults: AdequacyRow[]
  soldProductIds: Set<string>
}) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['contact-sold-products', contactId],
    queryFn: () => contactApi.listProducts(contactId, token),
    enabled: !!token,
  })
  const items = data?.data.items ?? []

  const removeMutation = useMutation({
    mutationFn: (id: string) => contactApi.removeProduct(contactId, id, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-sold-products', contactId] }),
  })

  // Trouver l'adéquation courante d'un produit vendu
  const getAdequacy = (productId: string) =>
    adequacyResults.find((r) => r.product.id === productId)?.adequacy

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Produits vendus ({items.length})</h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Enregistrer une vente
          </Button>
        )}
      </div>

      {adding && (
        <SoldProductForm
          contactId={contactId}
          token={token}
          adequacyResults={adequacyResults}
          onClose={() => setAdding(false)}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : items.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground italic">Aucun produit vendu enregistré.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const adequacy = getAdequacy(item.productId)
            return (
              <div key={item.id}>
                {editingId === item.id ? (
                  <SoldProductForm
                    contactId={contactId}
                    token={token}
                    adequacyResults={adequacyResults}
                    entry={item}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/produits/${item.productId}`} className="text-sm font-medium hover:underline truncate">
                          {item.product.name}
                        </Link>
                        {item.product.category && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                            {item.product.category}
                          </span>
                        )}
                        {adequacy && adequacy.global !== 'non_evalue' && (
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                            adequacy.global === 'positif' ? 'bg-green-100 text-green-700' :
                            adequacy.global === 'neutre' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          )}>
                            {VERDICT_GLOBAL_LABEL[adequacy.global]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>Vendu le {format(new Date(item.soldAt), 'd MMM yyyy', { locale: fr })}</span>
                        {item.amount != null && (
                          <span className="font-medium text-foreground">
                            {item.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          </span>
                        )}
                        {item.notes && <span className="truncate max-w-xs">{item.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setEditingId(item.id)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => confirm(`Retirer ${item.product.name} des produits vendus ?`) && removeMutation.mutate(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export function ContactAdequacyTab({
  contactId,
  token,
}: {
  contactId: string
  token: string
}) {
  const { results, isLoading, hasProfile, summary } = useContactAdequacy(contactId, token)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [addingFromRow, setAddingFromRow] = useState<string | null>(null)

  const { data: soldData } = useQuery({
    queryKey: ['contact-sold-products', contactId],
    queryFn: () => contactApi.listProducts(contactId, token),
    enabled: !!token,
  })
  const soldProductIds = new Set((soldData?.data.items ?? []).map((i) => i.productId))

  if (isLoading) {
    return <div className="h-40 bg-muted animate-pulse rounded-lg" />
  }

  const filtered: AdequacyRow[] =
    filter === 'positif'
      ? results.filter((r) => r.adequacy.global === 'positif')
      : filter === 'exclude_negative'
      ? results.filter((r) => r.adequacy.global !== 'negatif')
      : results

  return (
    <div className="space-y-6">

      {/* ── Section produits vendus ── */}
      <SoldProductsSection
        contactId={contactId}
        token={token}
        adequacyResults={results}
        soldProductIds={soldProductIds}
      />

      <div className="border-t border-border" />

      {/* ── Section adéquation ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Adéquation produits</h3>

        {!hasProfile ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex flex-col items-start gap-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Aucun profil MiFID défini pour ce contact.</p>
                <p className="text-blue-700 mt-0.5">Renseignez le profil MiFID pour calculer l&apos;adéquation des produits.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Avertissement réglementaire */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <p>
                L&apos;adéquation calculée ici est un <strong>outil d&apos;aide à la recommandation</strong>. Elle ne remplace pas
                la déclaration d&apos;adéquation réglementaire au sens de l&apos;article 25 MiFID II.
              </p>
            </div>

            {/* Résumé */}
            {results.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{summary.positive}</p>
                  <p className="text-xs text-green-700 mt-0.5">Marché cible positif</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{summary.neutral}</p>
                  <p className="text-xs text-yellow-700 mt-0.5">Hors marché cible</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{summary.negative}</p>
                  <p className="text-xs text-red-700 mt-0.5">Marché cible négatif</p>
                </div>
              </div>
            )}

            {/* Filtres */}
            <div className="flex gap-2">
              {([
                { key: 'all', label: 'Tous' },
                { key: 'positif', label: 'Positif uniquement' },
                { key: 'exclude_negative', label: 'Exclure négatif' },
              ] as { key: FilterMode; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full font-medium border transition-colors',
                    filter === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tableau */}
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun produit correspondant.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Produit</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Type client</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Connaissance</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Pertes</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Risque</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Objectifs</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Verdict</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const alreadySold = soldProductIds.has(row.product.id)
                      return (
                        <>
                          <tr
                            key={row.product.id}
                            className={cn(
                              'border-t border-border transition-colors',
                              row.adequacy.global === 'negatif' ? 'bg-red-50' : 'hover:bg-muted/30'
                            )}
                          >
                            <td className="px-3 py-2.5">
                              <Link href={`/produits/${row.product.id}`} className="font-medium text-foreground hover:underline">
                                {row.product.name}
                              </Link>
                              {row.product.category && (
                                <p className="text-muted-foreground">{row.product.category}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <VerdictDot verdict={row.adequacy.axes.type_client.verdict} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <VerdictDot verdict={row.adequacy.axes.connaissance_experience.verdict} />
                                {row.adequacy.axes.connaissance_experience.detail && (
                                  <span className="text-muted-foreground" title={row.adequacy.axes.connaissance_experience.detail}>ⓘ</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <VerdictDot verdict={row.adequacy.axes.capacite_pertes.verdict} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <VerdictDot verdict={row.adequacy.axes.tolerance_risque.verdict} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <VerdictDot verdict={row.adequacy.axes.objectifs.verdict} />
                                {row.adequacy.axes.objectifs.detail && (
                                  <span className="text-muted-foreground" title={row.adequacy.axes.objectifs.detail}>ⓘ</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={cn(
                                'inline-flex items-center gap-1.5 font-medium',
                                row.adequacy.global === 'positif' ? 'text-green-600' :
                                row.adequacy.global === 'neutre' ? 'text-yellow-600' :
                                row.adequacy.global === 'negatif' ? 'text-red-600' :
                                'text-muted-foreground'
                              )}>
                                {row.adequacy.global === 'negatif' && <AlertTriangle className="h-3 w-3" />}
                                {VERDICT_GLOBAL_LABEL[row.adequacy.global]}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {alreadySold ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                                  <Check className="h-3 w-3" />
                                  Vendu
                                </span>
                              ) : (
                                <button
                                  onClick={() => setAddingFromRow(addingFromRow === row.product.id ? null : row.product.id)}
                                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
                                >
                                  + Vente
                                </button>
                              )}
                            </td>
                          </tr>
                          {addingFromRow === row.product.id && (
                            <tr key={`${row.product.id}-form`} className="border-t border-border">
                              <td colSpan={8} className="px-3 py-3">
                                <SoldProductForm
                                  contactId={contactId}
                                  token={token}
                                  adequacyResults={results}
                                  initialProductId={row.product.id}
                                  onClose={() => setAddingFromRow(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Légende */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
              {[
                { color: 'bg-green-500', label: 'Positif — dans le marché cible' },
                { color: 'bg-yellow-400', label: 'Neutre — hors marché cible' },
                { color: 'bg-red-500', label: 'Négatif — vente interdite sauf exception' },
                { color: 'bg-muted border border-border', label: 'Non évalué — profil ou gouvernance incomplet' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={cn('h-3 w-3 rounded-full shrink-0', color)} />
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
