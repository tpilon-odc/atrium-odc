'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, ExternalLink, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierComplianceApi, type SupplierVerification, type ChecklistItemState } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SUPPLIER_TYPES, initChecklist } from '@cgp/shared'

const DECISION_LABELS = {
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-700' },
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
}

export function VerificationTab({ supplierId }: { supplierId: string }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const qKey = ['supplier-verification', supplierId, token]

  const { data, isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => supplierComplianceApi.getVerification(supplierId, token!),
    enabled: !!token,
  })

  const verification = data?.data.verification
  const [supplierType, setSupplierType] = useState(verification?.supplierType ?? '')
  const [checklist, setChecklist] = useState<ChecklistItemState[]>(
    (verification?.checklist as ChecklistItemState[]) ?? []
  )
  const [benefVerifies, setBenefVerifies] = useState(verification?.beneficiairesVerifies ?? false)
  const [benefSource, setBenefSource] = useState(verification?.beneficiairesSource ?? '')
  const [decision, setDecision] = useState<string>(verification?.decision ?? '')
  const [decisionNote, setDecisionNote] = useState(verification?.decisionNote ?? '')
  const [showDecisionForm, setShowDecisionForm] = useState(false)
  const [typeChangeWarning, setTypeChangeWarning] = useState<string | null>(null)

  // Sync état depuis query (une seule fois à la réception des données)
  useEffect(() => {
    if (verification) {
      setSupplierType(verification.supplierType ?? '')
      setChecklist((verification.checklist as ChecklistItemState[]) ?? [])
      setBenefVerifies(verification.beneficiairesVerifies ?? false)
      setBenefSource(verification.beneficiairesSource ?? '')
      setDecision(verification.decision ?? '')
      setDecisionNote(verification.decisionNote ?? '')
    }
  }, [verification?.id])

  const upsertMutation = useMutation({
    mutationFn: (data: object) => supplierComplianceApi.upsertVerification(supplierId, data, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  const decideMutation = useMutation({
    mutationFn: (data: object) => supplierComplianceApi.decide(supplierId, data as any, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey })
      setShowDecisionForm(false)
    },
  })

  const handleTypeChange = (newType: string) => {
    const hasCompleted = checklist.some((i) => i.completed)
    if (hasCompleted && verification?.supplierType && verification.supplierType !== newType) {
      setTypeChangeWarning(newType)
    } else {
      applyTypeChange(newType)
    }
  }

  const applyTypeChange = (newType: string) => {
    setSupplierType(newType)
    setChecklist(initChecklist(newType as any))
    setTypeChangeWarning(null)
    upsertMutation.mutate({ supplierType: newType })
  }

  const updateChecklistItem = (idx: number, patch: Partial<ChecklistItemState>) => {
    const updated = checklist.map((item, i) => i === idx ? { ...item, ...patch } : item)
    setChecklist(updated)
    upsertMutation.mutate({ supplierType, checklist: updated, beneficiairesVerifies: benefVerifies, beneficiairesSource: benefSource || null })
  }

  const saveBenef = () => {
    upsertMutation.mutate({ supplierType, checklist, beneficiairesVerifies: benefVerifies, beneficiairesSource: benefSource || null })
  }

  // Calcul de la progression
  const totalRequired = checklist.filter((i) => i.requires_document).length
  const completedRequired = checklist.filter((i) => i.requires_document && i.completed).length
  const canDecide = completedRequired >= totalRequired && totalRequired > 0

  if (isLoading) {
    return <div className="h-48 bg-muted animate-pulse rounded-lg" />
  }

  return (
    <div className="space-y-6">

      {/* Badge statut */}
      <div className="flex items-center gap-3">
        <h3 className="font-medium">Vérification documentaire</h3>
        {verification?.decision ? (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', DECISION_LABELS[verification.decision as keyof typeof DECISION_LABELS]?.color)}>
            {DECISION_LABELS[verification.decision as keyof typeof DECISION_LABELS]?.label}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Non commencé</span>
        )}
      </div>

      {/* Sélection du type */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <Label className="text-xs font-medium">Type de fournisseur <span className="text-destructive">*</span></Label>
        <select
          value={supplierType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">— Sélectionner un type —</option>
          {SUPPLIER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {typeChangeWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
            <p className="text-sm text-yellow-800">Changer le type réinitialisera la checklist. Continuer ?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => applyTypeChange(typeChangeWarning)}>Confirmer</Button>
              <Button size="sm" variant="ghost" onClick={() => setTypeChangeWarning(null)}>Annuler</Button>
            </div>
          </div>
        )}
      </div>

      {/* Checklist */}
      {supplierType && checklist.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Documents à collecter</h4>
            <span className="text-xs text-muted-foreground">{completedRequired}/{totalRequired} requis complétés</span>
          </div>
          <div className="space-y-4">
            {checklist.map((item, idx) => (
              <div key={item.key} className={cn('rounded-lg border p-4 space-y-3', item.completed ? 'border-green-200 bg-green-50/50' : 'border-border')}>
                <div className="flex items-start gap-3">
                  {item.completed
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                    {item.verification_url && (
                      <a href={item.verification_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                        <ExternalLink className="h-3 w-3" />
                        Vérifier en ligne
                      </a>
                    )}
                  </div>
                </div>

                {/* Mode de vérification */}
                <div className="flex flex-wrap gap-2 ml-7">
                  <button
                    onClick={() => updateChecklistItem(idx, { mode: 'document', completed: true })}
                    className={cn('text-xs px-3 py-1 rounded-full border transition-colors', item.mode === 'document' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent')}
                  >
                    Document fourni
                  </button>
                  {item.allows_online_verification && (
                    <button
                      onClick={() => updateChecklistItem(idx, { mode: 'online', completed: true })}
                      className={cn('text-xs px-3 py-1 rounded-full border transition-colors', item.mode === 'online' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent')}
                    >
                      Vérifié en ligne
                    </button>
                  )}
                  {item.allows_online_verification && (
                    <button
                      onClick={() => updateChecklistItem(idx, { mode: 'na', completed: false })}
                      className={cn('text-xs px-3 py-1 rounded-full border transition-colors', item.mode === 'na' ? 'bg-muted text-muted-foreground border-border' : 'border-border hover:bg-accent')}
                    >
                      Non applicable
                    </button>
                  )}
                </div>

                {/* URL si vérifié en ligne */}
                {item.mode === 'online' && (
                  <div className="ml-7">
                    <Input
                      value={item.verified_url ?? ''}
                      onChange={(e) => updateChecklistItem(idx, { verified_url: e.target.value })}
                      placeholder="URL de vérification…"
                      className="text-xs h-8"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bénéficiaires effectifs */}
      {supplierType && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h4 className="text-sm font-medium">Bénéficiaires effectifs</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={benefVerifies}
              onChange={(e) => { setBenefVerifies(e.target.checked); }}
              className="rounded"
            />
            <span className="text-sm">Bénéficiaires effectifs vérifiés</span>
          </label>
          {benefVerifies && (
            <div className="space-y-1.5">
              <Label className="text-xs">Source de vérification</Label>
              <Input
                value={benefSource}
                onChange={(e) => setBenefSource(e.target.value)}
                placeholder="Document fourni ou URL RBE…"
              />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={saveBenef} disabled={upsertMutation.isPending}>
            Enregistrer
          </Button>
        </div>
      )}

      {/* Décision */}
      {supplierType && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Décision d'entrée en relation</h4>
            {!canDecide && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                Documents requis manquants
              </div>
            )}
          </div>

          {verification?.decision && !showDecisionForm ? (
            <div className="space-y-2">
              <span className={cn('text-sm font-medium px-2 py-1 rounded-full', DECISION_LABELS[verification.decision as keyof typeof DECISION_LABELS]?.color)}>
                {DECISION_LABELS[verification.decision as keyof typeof DECISION_LABELS]?.label}
              </span>
              {verification.decisionNote && <p className="text-sm text-muted-foreground">{verification.decisionNote}</p>}
              {verification.verificationDate && (
                <p className="text-xs text-muted-foreground">
                  Vérifié le {new Date(verification.verificationDate).toLocaleDateString('fr-FR')}
                </p>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowDecisionForm(true)}>Modifier</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                {(['approved', 'rejected', 'pending'] as const).map((d) => (
                  <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} />
                    <span className="text-sm">{DECISION_LABELS[d].label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Note (optionnelle)</Label>
                <Input
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Motif ou commentaire…"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!decision || decideMutation.isPending}
                  onClick={() => decideMutation.mutate({ decision, decisionNote: decisionNote || null })}
                >
                  {decideMutation.isPending ? 'Enregistrement…' : 'Enregistrer la décision'}
                </Button>
                {showDecisionForm && (
                  <Button size="sm" variant="outline" onClick={() => setShowDecisionForm(false)}>Annuler</Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
