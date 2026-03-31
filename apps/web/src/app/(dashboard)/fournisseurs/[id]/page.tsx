'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, BadgeCheck, Globe, Mail, Phone, Star, Pencil, ExternalLink, CheckCircle2, AlertTriangle, Plus, Trash2, UserRound } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierApi, supplierComplianceApi, type Product, type SupplierCommercialContact } from '@/lib/api'
import { EntityDocuments } from '@/components/entity-documents'
import { ReviewSection } from '@/components/ReviewSection'
import { VerificationTab } from '@/components/fournisseurs/VerificationTab'
import { EvaluationTab } from '@/components/fournisseurs/EvaluationTab'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ── Section données cabinet ───────────────────────────────────────────────────

function CabinetSection({ supplierId }: { supplierId: string }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')

  const { data } = useQuery({
    queryKey: ['supplier', supplierId, token],
    queryFn: () => supplierApi.get(supplierId, token!),
    enabled: !!token,
  })

  const cabinetData = data?.data.cabinetData

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof supplierApi.upsertCabinet>[1]) =>
      supplierApi.upsertCabinet(supplierId, body, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId, token] })
      setEditing(false)
    },
  })

  const handleSave = () => {
    mutation.mutate({
      privateNote: note || null,
      internalTags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    })
  }

  const handleToggleActive = () => {
    mutation.mutate({ isActive: !cabinetData?.isActive })
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Données privées (votre cabinet)</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleActive}
            className={cn(
              'text-xs px-3 py-1 rounded-full font-medium transition-colors',
              cabinetData?.isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {cabinetData?.isActive ? 'Partenaire actif' : 'Non partenaire'}
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
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note visible uniquement par votre cabinet…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tags internes (séparés par virgule)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ex: prioritaire, assurance-vie"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {cabinetData?.privateNote ? (
            <p className="text-muted-foreground">{cabinetData.privateNote}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Aucune note interne.</p>
          )}
          {cabinetData?.internalTags?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {cabinetData.internalTags.map((tag) => (
                <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Section contacts commerciaux ──────────────────────────────────────────────

const REGIONS = [
  'Île-de-France', 'Auvergne-Rhône-Alpes', 'Nouvelle-Aquitaine', 'Occitanie',
  'Hauts-de-France', 'Grand Est', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur',
  'Normandie', 'Bretagne', 'Bourgogne-Franche-Comté', 'Centre-Val de Loire',
  'Corse', 'Guadeloupe', 'Martinique', 'Guyane', 'La Réunion', 'Mayotte',
]

type ContactForm = { firstName: string; lastName: string; phone: string; email: string; region: string }
const emptyForm: ContactForm = { firstName: '', lastName: '', phone: '', email: '', region: '' }

function ContactFormFields({
  form,
  setForm,
  onSubmit,
  onCancel,
  isPending,
}: {
  form: ContactForm
  setForm: React.Dispatch<React.SetStateAction<ContactForm>>
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Prénom *</label>
          <Input value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Jean" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nom *</label>
          <Input value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Dupont" className="h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Téléphone</label>
          <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="06 00 00 00 00" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Email</label>
          <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jean@fournisseur.fr" className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Région</label>
        <select
          value={form.region}
          onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
          className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
        >
          <option value="">— Sélectionner —</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button size="sm" onClick={onSubmit} disabled={isPending || !form.firstName.trim() || !form.lastName.trim()}>
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}

function CommercialContactsSection({ supplierId }: { supplierId: string }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyForm)

  const { data } = useQuery({
    queryKey: ['supplier-commercial-contacts', supplierId, token],
    queryFn: () => supplierApi.listCommercialContacts(supplierId, token!),
    enabled: !!token,
  })
  const contacts: SupplierCommercialContact[] = data?.data.contacts ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['supplier-commercial-contacts', supplierId, token] })

  const createMutation = useMutation({
    mutationFn: () => supplierApi.createCommercialContact(supplierId, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      region: form.region || undefined,
    }, token!),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm) },
  })

  const updateMutation = useMutation({
    mutationFn: (contactId: string) => supplierApi.updateCommercialContact(supplierId, contactId, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      region: form.region || null,
    }, token!),
    onSuccess: () => { invalidate(); setEditingId(null); setForm(emptyForm) },
  })

  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => supplierApi.deleteCommercialContact(supplierId, contactId, token!),
    onSuccess: invalidate,
  })

  const startEdit = (c: SupplierCommercialContact) => {
    setEditingId(c.id)
    setForm({ firstName: c.firstName, lastName: c.lastName, phone: c.phone ?? '', email: c.email ?? '', region: c.region ?? '' })
    setShowForm(false)
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <UserRound className="h-4 w-4" />
          Contacts commerciaux
        </h3>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {showForm && (
        <ContactFormFields
          form={form}
          setForm={setForm}
          onSubmit={() => createMutation.mutate()}
          onCancel={() => setShowForm(false)}
          isPending={createMutation.isPending}
        />
      )}

      {contacts.length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground italic">Aucun contact commercial enregistré.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id}>
              {editingId === c.id ? (
                <ContactFormFields
                  form={form}
                  setForm={setForm}
                  onSubmit={() => updateMutation.mutate(c.id)}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                />
              ) : (
                <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20 group">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{c.email}</a>}
                      {c.region && <span>{c.region}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => startEdit(c)} className="p-1 text-muted-foreground hover:text-foreground rounded">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(c.id)} className="p-1 text-muted-foreground hover:text-destructive rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'infos', label: 'Informations' },
  { key: 'produits', label: 'Produits' },
  { key: 'verification', label: 'Vérification' },
  { key: 'evaluation', label: 'Évaluation' },
] as const

type TabKey = typeof TABS[number]['key']

// ── Page principale ────────────────────────────────────────────────────────────

export default function FournisseurDetailPage({ params }: { params: { id: string } }) {
  const { token, cabinet } = useAuthStore()
  const { id } = params
  const searchParams = useSearchParams()
  const backHref = searchParams.get('from') ?? '/fournisseurs'
  const backLabel = backHref.startsWith('/produits') ? 'Retour au produit' : 'Retour aux fournisseurs'
  const [activeTab, setActiveTab] = useState<TabKey>('infos')

  const { data, isLoading } = useQuery({
    queryKey: ['supplier', id, token],
    queryFn: () => supplierApi.get(id, token!),
    enabled: !!token,
  })

  // Badges conformité dans l'en-tête
  const { data: verifData } = useQuery({
    queryKey: ['supplier-verification', id, token],
    queryFn: () => supplierComplianceApi.getVerification(id, token!),
    enabled: !!token,
  })
  const { data: evalData } = useQuery({
    queryKey: ['supplier-evaluations', id, token],
    queryFn: () => supplierComplianceApi.listEvaluations(id, token!),
    enabled: !!token,
  })

  const { data: productsData } = useQuery({
    queryKey: ['supplier-products', id, token],
    queryFn: () => supplierApi.listProducts(id, token!),
    enabled: !!token && activeTab === 'produits',
  })
  const supplierProducts: Product[] = productsData?.data.products ?? []

  const supplier = data?.data.supplier
  const [avgRating, setAvgRating] = useState<number | null>(null)

  const verification = verifData?.data.verification
  const evaluations = evalData?.data.evaluations ?? []
  const latestEval = evaluations[0] ?? null
  const isDueForReview = latestEval?.nextReviewDate
    ? new Date(latestEval.nextReviewDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : false

  const DECISION_COLORS = {
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Retour */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      {isLoading && (
        <div className="space-y-4">
          <div className="h-24 bg-muted animate-pulse rounded-lg" />
          <div className="h-40 bg-muted animate-pulse rounded-lg" />
        </div>
      )}

      {!isLoading && !supplier && (
        <p className="text-muted-foreground">Fournisseur introuvable.</p>
      )}

      {supplier && (
        <>
          {/* En-tête */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                  {supplier.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">{supplier.name}</h2>
                    {supplier.isVerified && <BadgeCheck className="h-5 w-5 text-blue-500" />}
                    {avgRating !== null && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{avgRating.toFixed(1)}</span>
                      </div>
                    )}
                    {/* Badges conformité */}
                    {verification?.decision && (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', DECISION_COLORS[verification.decision as keyof typeof DECISION_COLORS])}>
                        {verification.decision === 'approved' ? '✓ Vérifié' : verification.decision === 'rejected' ? '✗ Rejeté' : '⏳ En attente'}
                      </span>
                    )}
                    {isDueForReview && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        Révision due
                      </span>
                    )}
                    {latestEval?.scoreGlobal !== null && latestEval?.scoreGlobal !== undefined && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        {Number(latestEval.scoreGlobal).toFixed(1)}/5
                      </span>
                    )}
                  </div>
                  {supplier.category && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {supplier.category}
                    </span>
                  )}
                </div>
              </div>
              <Link href={`/fournisseurs/${id}/modifier`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Modifier
                </Button>
              </Link>
            </div>

            {supplier.description && (
              <p className="text-sm text-muted-foreground">{supplier.description}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              {supplier.website && (
                <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                  <Globe className="h-4 w-4" />Site web<ExternalLink className="h-3 w-3" />
                </a>
              )}
              {supplier.email && (
                <a href={`mailto:${supplier.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Mail className="h-4 w-4" />{supplier.email}
                </a>
              )}
              {supplier.phone && (
                <a href={`tel:${supplier.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Phone className="h-4 w-4" />{supplier.phone}
                </a>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {data?.data.editsCount ?? 0} modification(s) · Ajouté le {new Date(supplier.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>

          {/* Navigation onglets */}
          <div className="flex gap-1 border-b border-border">
            {TABS.map((tab) => (
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

          {/* Contenu onglets */}
          {activeTab === 'infos' && (
            <>
              <CabinetSection supplierId={id} />
              <CommercialContactsSection supplierId={id} />
              <div className="bg-card border border-border rounded-lg p-5">
                <EntityDocuments entityType="supplier" entityId={id} title="Documents privés (convention, contrats…)" />
              </div>
              <ReviewSection entityType="supplier" entityId={id} token={token!} cabinetId={cabinet?.id ?? ''} onAvgChange={setAvgRating} />
              <div className="bg-card border border-border rounded-lg p-5">
                <EntityDocuments entityType="supplier" entityId={id} readonlySupplierId={id} title="Documents fournisseur (publics)" />
              </div>
            </>
          )}

          {activeTab === 'produits' && (
            <div className="space-y-3">
              {supplierProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun produit lié à ce fournisseur.</p>
              ) : (
                supplierProducts.map((p) => (
                  <Link key={p.id} href={`/produits/${p.id}?from=/fournisseurs/${id}`} className="flex items-start justify-between gap-4 bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.name}</span>
                        {p.isVerified && <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />}
                        {p.category && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.category}</span>
                        )}
                        {p.cabinetData?.isCommercialized && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Commercialisé</span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    {p.avgPublicRating !== null && (
                      <div className="flex items-center gap-1 text-sm shrink-0">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{p.avgPublicRating.toFixed(1)}</span>
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === 'verification' && (
            <VerificationTab supplierId={id} />
          )}

          {activeTab === 'evaluation' && (
            <EvaluationTab supplierId={id} />
          )}
        </>
      )}
    </div>
  )
}
