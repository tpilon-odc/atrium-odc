'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, BadgeCheck, Globe, Mail, Phone, Star, Pencil, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierApi, supplierComplianceApi } from '@/lib/api'
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

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'infos', label: 'Informations' },
  { key: 'verification', label: 'Vérification' },
  { key: 'evaluation', label: 'Évaluation' },
] as const

type TabKey = typeof TABS[number]['key']

// ── Page principale ────────────────────────────────────────────────────────────

export default function FournisseurDetailPage({ params }: { params: { id: string } }) {
  const { token, cabinet } = useAuthStore()
  const { id } = params
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
    <div className="space-y-6 max-w-2xl">
      {/* Retour */}
      <Link
        href="/fournisseurs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux fournisseurs
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
              <ReviewSection entityType="supplier" entityId={id} token={token!} cabinetId={cabinet?.id ?? ''} onAvgChange={setAvgRating} />
              <div className="bg-card border border-border rounded-lg p-5">
                <EntityDocuments entityType="supplier" entityId={id} readonlySupplierId={id} />
              </div>
            </>
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
