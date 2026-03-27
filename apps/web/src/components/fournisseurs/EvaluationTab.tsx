'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierComplianceApi, type SupplierEvaluation, type EvaluationNote } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const CRITERIA = [
  {
    key: 'solvabilite' as const,
    label: 'Solvabilité et pérennité',
    help: "La solidité financière du fournisseur est un élément prépondérant. L'existence de procédures judiciaires ou de contentieux permet également d'évaluer sa pérennité.",
  },
  {
    key: 'reputation' as const,
    label: 'Réputation, expérience et ancienneté',
    help: 'Sanctions des autorités de tutelle, historique de la structure et ancienneté dans le secteur.',
  },
  {
    key: 'moyens' as const,
    label: 'Moyens humains et techniques',
    help: 'Taille de la structure, effectif, organigramme, extranet et outils mis à disposition.',
  },
  {
    key: 'relation' as const,
    label: 'Qualité de la relation',
    help: 'Qualité des interlocuteurs, délais de réponse, transparence et réactivité.',
  },
  {
    key: 'remuneration' as const,
    label: 'Rémunération',
    help: 'Conformité aux commissions usuelles du marché, exactitude du calcul et délais de paiement.',
  },
] as const

type CriteriaKey = typeof CRITERIA[number]['key']

function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="transition-colors"
        >
          <Star
            className={cn(
              'h-5 w-5 transition-colors',
              (hovered ? s <= hovered : s <= (value ?? 0))
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  )
}

function computeLiveScore(notes: Record<CriteriaKey, number | null>): number | null {
  const vals = Object.values(notes).filter((v): v is number => v !== null && v > 0)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
}

function notesToRecord(evaluationNotes: EvaluationNote[]): Record<CriteriaKey, number | null> {
  const map: Record<CriteriaKey, number | null> = {
    solvabilite: null, reputation: null, moyens: null, relation: null, remuneration: null,
  }
  for (const n of evaluationNotes) {
    map[n.critere_id] = n.note
  }
  return map
}

function commentsToRecord(evaluationNotes: EvaluationNote[]): Record<CriteriaKey, string> {
  const map: Record<CriteriaKey, string> = {
    solvabilite: '', reputation: '', moyens: '', relation: '', remuneration: '',
  }
  for (const n of evaluationNotes) {
    map[n.critere_id] = n.commentaire ?? ''
  }
  return map
}

function buildNotes(
  scores: Record<CriteriaKey, number | null>,
  comments: Record<CriteriaKey, string>
): EvaluationNote[] {
  return CRITERIA
    .filter((c) => scores[c.key] !== null)
    .map((c) => ({
      critere_id: c.key,
      note: scores[c.key]!,
      commentaire: comments[c.key] || undefined,
    }))
}

function EvaluationForm({
  supplierId,
  evaluation,
  onClose,
}: {
  supplierId: string
  evaluation?: SupplierEvaluation
  onClose: () => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const [scores, setScores] = useState<Record<CriteriaKey, number | null>>(
    evaluation ? notesToRecord(evaluation.evaluationNotes) : {
      solvabilite: null, reputation: null, moyens: null, relation: null, remuneration: null,
    }
  )
  const [comments, setComments] = useState<Record<CriteriaKey, string>>(
    evaluation ? commentsToRecord(evaluation.evaluationNotes) : {
      solvabilite: '', reputation: '', moyens: '', relation: '', remuneration: '',
    }
  )
  const [evaluateurs, setEvaluateurs] = useState(evaluation?.evaluateurs?.join(', ') ?? '')
  const [showContrat, setShowContrat] = useState(false)
  const [contratDuree, setContratDuree] = useState(evaluation?.contratDuree ?? '')
  const [contratPreavis, setContratPreavis] = useState(evaluation?.contratPreavis ?? '')
  const [confirmComplete, setConfirmComplete] = useState(false)

  const liveScore = computeLiveScore(scores)

  const buildPayload = () => ({
    evaluationNotes: buildNotes(scores, comments),
    evaluateurs: evaluateurs.split(',').map((e) => e.trim()).filter(Boolean),
    contratDuree: contratDuree || null,
    contratPreavis: contratPreavis || null,
  })

  const saveMutation = useMutation({
    mutationFn: () => evaluation
      ? supplierComplianceApi.updateEvaluation(supplierId, evaluation.id, buildPayload(), token!)
      : supplierComplianceApi.createEvaluation(supplierId, buildPayload(), token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-evaluations', supplierId, token] })
      onClose()
    },
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      const saved = evaluation
        ? await supplierComplianceApi.updateEvaluation(supplierId, evaluation.id, buildPayload(), token!)
        : await supplierComplianceApi.createEvaluation(supplierId, buildPayload(), token!)
      await supplierComplianceApi.completeEvaluation(supplierId, saved.data.evaluation.id, token!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-evaluations', supplierId, token] })
      onClose()
    },
  })

  return (
    <div className="space-y-4">
      {/* Score global live */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
        <span className="text-sm font-medium">Score global en cours</span>
        {liveScore !== null ? (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={cn('h-4 w-4', s <= Math.round(liveScore) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
              ))}
            </div>
            <span className="text-sm font-semibold">{liveScore.toFixed(1)} / 5</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Saisir au moins une note</span>
        )}
      </div>

      {/* Critères */}
      {CRITERIA.map((criterion) => (
        <div key={criterion.key} className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">{criterion.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{criterion.help}</p>
          </div>
          <StarPicker
            value={scores[criterion.key]}
            onChange={(v) => setScores((prev) => ({ ...prev, [criterion.key]: v }))}
          />
          <textarea
            value={comments[criterion.key]}
            onChange={(e) => setComments((prev) => ({ ...prev, [criterion.key]: e.target.value }))}
            placeholder="Commentaire…"
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>
      ))}

      {/* Évaluateurs */}
      <div className="space-y-1.5">
        <Label className="text-xs">Évaluateurs (séparés par virgule)</Label>
        <Input
          value={evaluateurs}
          onChange={(e) => setEvaluateurs(e.target.value)}
          placeholder="Dupont, Martin…"
        />
      </div>

      {/* Informations contractuelles (rétractable) */}
      <button
        type="button"
        onClick={() => setShowContrat(!showContrat)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {showContrat ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Informations contractuelles (optionnel)
      </button>

      {showContrat && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Durée du contrat</Label>
              <Input value={contratDuree} onChange={(e) => setContratDuree(e.target.value)} placeholder="Ex : 1 an renouvelable" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Préavis de résiliation</Label>
              <Input value={contratPreavis} onChange={(e) => setContratPreavis(e.target.value)} placeholder="Ex : 3 mois" />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation finalisation */}
      {confirmComplete && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
          <p className="text-sm text-yellow-800">Finaliser l'évaluation ? Cette action est irréversible.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? 'Finalisation…' : 'Confirmer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmComplete(false)}>Annuler</Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer en brouillon'}
        </Button>
        {!confirmComplete && (
          <Button size="sm" onClick={() => setConfirmComplete(true)}>
            Finaliser l'évaluation
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}

export function EvaluationTab({ supplierId }: { supplierId: string }) {
  const { token } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [editingEval, setEditingEval] = useState<SupplierEvaluation | undefined>(undefined)

  const qKey = ['supplier-evaluations', supplierId, token]
  const { data, isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => supplierComplianceApi.listEvaluations(supplierId, token!),
    enabled: !!token,
  })

  const evaluations = data?.data.evaluations ?? []
  const latest = evaluations[0] ?? null
  const draftEval = evaluations.find((e) => e.status === 'draft')

  const isDueForReview = latest?.nextReviewDate
    ? new Date(latest.nextReviewDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : false

  if (isLoading) return <div className="h-48 bg-muted animate-pulse rounded-lg" />

  if (showForm) {
    return (
      <EvaluationForm
        supplierId={supplierId}
        evaluation={editingEval}
        onClose={() => { setShowForm(false); setEditingEval(undefined) }}
      />
    )
  }

  return (
    <div className="space-y-6">

      {/* Résumé dernière évaluation */}
      {latest && (
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Dernière évaluation : {new Date(latest.evaluationDate).toLocaleDateString('fr-FR')}
              </p>
              {latest.nextReviewDate && (
                <p className="text-sm text-muted-foreground">
                  Prochaine révision : {new Date(latest.nextReviewDate).toLocaleDateString('fr-FR')}
                </p>
              )}
              {latest.scoreGlobal !== null && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={cn('h-4 w-4', s <= Math.round(Number(latest.scoreGlobal)) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold">{Number(latest.scoreGlobal).toFixed(1)} / 5</span>
                </div>
              )}
            </div>
            {isDueForReview && (
              <div className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                Révision due
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {draftEval ? (
          <Button size="sm" onClick={() => { setEditingEval(draftEval); setShowForm(true) }}>
            Reprendre le brouillon
          </Button>
        ) : (
          <Button size="sm" onClick={() => { setEditingEval(undefined); setShowForm(true) }}>
            {evaluations.length === 0 ? 'Créer une évaluation' : 'Nouvelle évaluation annuelle'}
          </Button>
        )}
      </div>

      {/* Historique */}
      {evaluations.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h4 className="text-sm font-medium">Historique des évaluations</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Score</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Évaluateurs</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {evaluations.map((ev) => (
                <tr key={ev.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">{new Date(ev.evaluationDate).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2.5">
                    {ev.scoreGlobal !== null ? (
                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={cn('h-3 w-3', s <= Math.round(Number(ev.scoreGlobal)) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
                          ))}
                        </div>
                        <span className="text-xs">{Number(ev.scoreGlobal).toFixed(1)}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{ev.evaluateurs.join(', ') || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', ev.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>
                      {ev.status === 'completed' ? 'Complété' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {ev.status === 'draft' && (
                      <button
                        onClick={() => { setEditingEval(ev); setShowForm(true) }}
                        className="text-xs text-primary hover:underline"
                      >
                        Modifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
