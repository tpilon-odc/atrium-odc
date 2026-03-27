'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileDown, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type Governance, type GovernanceInput } from '@/lib/api'
import { GOVERNANCE_AXES, type MarcheCibleValue } from '@/lib/governance-axes'
import { useProductGovernance } from '@/hooks/useProductGovernance'

// ── MarcheCible badge & picker ────────────────────────────────────────────────

function MarcheBadge({ value }: { value: MarcheCibleValue | null | undefined }) {
  if (!value) return <span className="text-xs text-muted-foreground italic">—</span>
  const cfg = {
    positif: 'bg-green-100 text-green-700',
    neutre: 'bg-yellow-100 text-yellow-700',
    negatif: 'bg-red-100 text-red-700',
  }
  const label = { positif: 'Positif', neutre: 'Neutre', negatif: 'Négatif' }
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg[value])}>
      {label[value]}
    </span>
  )
}

function MarcheRadio({
  value,
  onChange,
  disabled,
}: {
  value: MarcheCibleValue | null | undefined
  onChange: (v: MarcheCibleValue) => void
  disabled?: boolean
}) {
  const options: { v: MarcheCibleValue; label: string; cls: string; active: string }[] = [
    { v: 'positif', label: 'Positif', cls: 'border-green-300 text-green-700', active: 'bg-green-100 border-green-500' },
    { v: 'neutre', label: 'Neutre', cls: 'border-yellow-300 text-yellow-700', active: 'bg-yellow-100 border-yellow-500' },
    { v: 'negatif', label: 'Négatif', cls: 'border-red-300 text-red-700', active: 'bg-red-100 border-red-500' },
  ]
  return (
    <div className="flex gap-1.5">
      {options.map(({ v, label, cls, active }) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
            value === v ? active : cn('bg-background', cls, 'hover:opacity-80'),
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Axis block ────────────────────────────────────────────────────────────────

function AxisBlock({
  axis,
  form,
  onChange,
  readOnly,
}: {
  axis: typeof GOVERNANCE_AXES[number]
  form: Record<string, MarcheCibleValue | null>
  onChange: (field: string, value: MarcheCibleValue) => void
  readOnly?: boolean
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2.5 border-b border-border">
        <p className="text-sm font-medium">{axis.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{axis.description}</p>
      </div>
      <div className="divide-y divide-border">
        {axis.criteria.map((c) => (
          <div key={c.field} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <div className="min-w-0">
              <span className="text-sm">{c.label}</span>
              {c.sublabel && (
                <span className="text-xs text-muted-foreground ml-1.5">— {c.sublabel}</span>
              )}
            </div>
            {readOnly ? (
              <MarcheBadge value={form[c.field] as MarcheCibleValue | null} />
            ) : (
              <MarcheRadio
                value={form[c.field] as MarcheCibleValue | null}
                onChange={(v) => onChange(c.field, v)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Durabilité block ──────────────────────────────────────────────────────────

function DurabiliteBlock({
  form,
  onChange,
  readOnly,
}: {
  form: Partial<Governance>
  onChange: (patch: Partial<GovernanceInput>) => void
  readOnly?: boolean
}) {
  const communique = form.durabiliteCommuniquee !== false

  const paiSocietes = [
    { field: 'paiGesSocietes', label: 'Émissions de gaz à effet de serre' },
    { field: 'paiBiodiversite', label: 'Biodiversité' },
    { field: 'paiEau', label: 'Eau' },
    { field: 'paiDechets', label: 'Déchets' },
    { field: 'paiSocialPersonnel', label: 'Questions sociales et de personnel' },
  ]
  const paiSouverains = [
    { field: 'paiGesSouverains', label: 'Intensité des gaz à effet de serre' },
    { field: 'paiNormesSociales', label: 'Pays connaissant des violations de normes sociales' },
  ]
  const paiImmobilier = [
    { field: 'paiCombustiblesFossiles', label: 'Exposition à des combustibles fossiles' },
    { field: 'paiImmobilierEnergetique', label: 'Actifs immobiliers inefficaces sur le plan énergétique' },
  ]

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2.5 border-b border-border">
        <p className="text-sm font-medium">Préférences en matière de durabilité</p>
      </div>
      <div className="p-4 space-y-4">
        {/* Communiqué par producteur */}
        <div className="flex items-center justify-between">
          <span className="text-sm">Ces données ont-elles été communiquées par le producteur ?</span>
          {readOnly ? (
            <MarcheBadge value={communique ? undefined : undefined} />
          ) : (
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => onChange({ durabiliteCommuniquee: v })}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full border font-medium transition-colors',
                    (form.durabiliteCommuniquee ?? true) === v
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {v ? 'Oui' : 'Non communiqué'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pourcentages */}
        <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3', !communique && 'opacity-40 pointer-events-none')}>
          {[
            { field: 'pctTaxonomie', label: '% Taxonomie (env.)' },
            { field: 'pctSfdrEnvironnemental', label: '% SFDR environnemental' },
            { field: 'pctSfdrSocial', label: '% SFDR social' },
          ].map(({ field, label }) => (
            <div key={field} className="space-y-1">
              <label className="text-xs text-muted-foreground">{label}</label>
              {readOnly ? (
                <p className="text-sm">
                  {(form as Record<string, unknown>)[field] != null
                    ? `${Math.round(((form as Record<string, unknown>)[field] as number) * 100)} %`
                    : '—'}
                </p>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={
                      (form as Record<string, unknown>)[field] != null
                        ? Math.round(((form as Record<string, unknown>)[field] as number) * 100)
                        : ''
                    }
                    onChange={(e) =>
                      onChange({ [field]: e.target.value === '' ? null : Number(e.target.value) / 100 } as Partial<GovernanceInput>)
                    }
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* PAI */}
        <div className={cn('space-y-3', !communique && 'opacity-40 pointer-events-none')}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Principales incidences négatives (PAI) prises en compte
          </p>
          {[
            { title: 'Sociétés', items: paiSocietes },
            { title: 'Actifs souverains', items: paiSouverains },
            { title: 'Actifs immobiliers', items: paiImmobilier },
          ].map(({ title, items }) => (
            <div key={title}>
              <p className="text-xs text-muted-foreground mb-1.5">{title} :</p>
              <div className="space-y-1.5">
                {items.map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={!!(form as Record<string, unknown>)[field]}
                      onChange={(e) => onChange({ [field]: e.target.checked } as Partial<GovernanceInput>)}
                      className="rounded"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Contexte (source, notes) ──────────────────────────────────────────────────

function ContexteBlock({
  form,
  onChange,
  readOnly,
}: {
  form: Partial<Governance>
  onChange: (patch: Partial<GovernanceInput>) => void
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 text-left"
      >
        <span className="text-sm font-medium">Contexte de la gouvernance</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Producteur soumis à MiFID II ?</span>
            {readOnly ? (
              <span className="text-sm">{form.producteurSoumisMif2 !== false ? 'Oui' : 'Non'}</span>
            ) : (
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => onChange({ producteurSoumisMif2: v })}
                    className={cn(
                      'text-xs px-3 py-1 rounded-full border font-medium transition-colors',
                      (form.producteurSoumisMif2 ?? true) === v
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {v ? 'Oui' : 'Non'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Source du marché cible</label>
            {readOnly ? (
              <p className="text-sm">{form.marcheCibleSource ?? '—'}</p>
            ) : (
              <select
                value={form.marcheCibleSource ?? ''}
                onChange={(e) => onChange({ marcheCibleSource: e.target.value || null })}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Sélectionner —</option>
                <option value="producteur">Communiqué par le producteur</option>
                <option value="distributeur_intermediaire">Via distributeur intermédiaire</option>
                <option value="determine_par_cabinet">Déterminé par le cabinet</option>
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes de révision</label>
            {readOnly ? (
              <p className="text-sm text-muted-foreground">{form.notesRevision ?? '—'}</p>
            ) : (
              <textarea
                value={form.notesRevision ?? ''}
                onChange={(e) => onChange({ notesRevision: e.target.value || null })}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Notes internes sur cette révision…"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal historique ──────────────────────────────────────────────────────────

function HistoryModal({ gov, onClose }: { gov: Governance; onClose: () => void }) {
  const form = gov as unknown as Record<string, MarcheCibleValue | null>
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Révision du {new Date(gov.revisionDate).toLocaleDateString('fr-FR')}</h3>
            <p className="text-xs text-muted-foreground">
              Statut : {gov.status} · Source : {gov.marcheCibleSource ?? '—'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {GOVERNANCE_AXES.map((axis) => (
            <AxisBlock key={axis.id} axis={axis} form={form} onChange={() => {}} readOnly />
          ))}
          <DurabiliteBlock form={gov} onChange={() => {}} readOnly />
          <ContexteBlock form={gov} onChange={() => {}} readOnly />
        </div>
      </div>
    </div>
  )
}

// ── Modal confirmation activation ─────────────────────────────────────────────

function ActivationModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold">Activer ce marché cible ?</h3>
        <p className="text-sm text-muted-foreground">
          Cette action remplacera le marché cible actif et archivera l'ancienne version. La prochaine révision sera dans 1 an.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button onClick={onConfirm}>Activer</Button>
        </div>
      </div>
    </div>
  )
}

// ── Main GovernanceTab ────────────────────────────────────────────────────────

export function GovernanceTab({ productId, token }: { productId: string; token: string }) {
  const {
    isLoading,
    active,
    draft,
    history,
    completionPercent,
    isDueForRevision,
    createDraft,
    updateDraft,
    activateGovernance,
    createRevision,
    isPending,
    error,
  } = useProductGovernance(productId, token)

  const [formData, setFormData] = useState<Record<string, MarcheCibleValue | null | number | boolean | string>>({})
  const [editing, setEditing] = useState(false)
  const [showActivationModal, setShowActivationModal] = useState(false)
  const [historyGov, setHistoryGov] = useState<Governance | null>(null)

  // Merge saved draft + local edits
  const baseGov = draft ?? active
  const effectiveForm = baseGov ? { ...baseGov, ...formData } : formData

  const handleChange = (patch: Partial<Record<string, unknown>>) => {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  const handleMarcheChange = (field: string, value: MarcheCibleValue) => {
    handleChange({ [field]: value })
  }

  const handleSave = async () => {
    const data = effectiveForm as unknown as GovernanceInput
    if (!draft) {
      await createDraft(data)
    } else {
      await updateDraft(data)
    }
    setFormData({})
    setEditing(false)
  }

  const handleActivate = async () => {
    if (!draft) return
    await activateGovernance(draft.id)
    setFormData({})
    setEditing(false)
    setShowActivationModal(false)
  }

  const handleRevise = async () => {
    await createRevision()
    setEditing(true)
  }

  const handleStartEditing = () => {
    setFormData({})
    setEditing(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* En-tête état */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium">Gouvernance MiFID II</h3>
              {active && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  ● Active
                </span>
              )}
              {draft && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  ○ Brouillon ({completionPercent}%)
                </span>
              )}
              {!active && !draft && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  ⚪ Non définie
                </span>
              )}
              {isDueForRevision && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3" />
                  Révision due
                </span>
              )}
            </div>
            {active && (
              <p className="text-xs text-muted-foreground">
                Dernière révision : {new Date(active.revisionDate).toLocaleDateString('fr-FR')}
                {active.nextRevisionDate && (
                  <> · Prochaine : {new Date(active.nextRevisionDate).toLocaleDateString('fr-FR')}</>
                )}
                {active.marcheCibleSource && (
                  <> · Source :{' '}
                    {active.marcheCibleSource === 'producteur'
                      ? 'Producteur'
                      : active.marcheCibleSource === 'distributeur_intermediaire'
                      ? 'Distributeur intermédiaire'
                      : 'Déterminé par le cabinet'}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {active && !draft && (
              <Button size="sm" variant="outline" onClick={handleRevise} disabled={isPending}>
                Créer une révision annuelle
              </Button>
            )}
            {draft && !editing && (
              <Button size="sm" variant="outline" onClick={handleStartEditing}>
                Modifier le brouillon
              </Button>
            )}
            {!draft && !active && !editing && (
              <Button size="sm" onClick={handleStartEditing}>
                Commencer la définition du marché cible
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Info si rien défini */}
      {!active && !draft && !editing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-medium">La gouvernance des produits financiers est une obligation MiFID II.</p>
            <p>Pour chaque produit distribué, vous devez définir le marché cible (positif / neutre / négatif) sur 5 axes réglementaires.</p>
            <p className="text-xs text-blue-600">Source : Procédure de gouvernance des produits financiers — CNCGP</p>
          </div>
        </div>
      )}

      {/* Formulaire / lecture seule */}
      {(editing || (!editing && (active || draft))) && (
        <div className="space-y-3">
          {/* Axes */}
          {GOVERNANCE_AXES.map((axis) => (
            <AxisBlock
              key={axis.id}
              axis={axis}
              form={effectiveForm as Record<string, MarcheCibleValue | null>}
              onChange={handleMarcheChange}
              readOnly={!editing}
            />
          ))}

          {/* Durabilité */}
          <DurabiliteBlock
            form={effectiveForm as Partial<Governance>}
            onChange={handleChange}
            readOnly={!editing}
          />

          {/* Contexte */}
          <ContexteBlock
            form={effectiveForm as Partial<Governance>}
            onChange={handleChange}
            readOnly={!editing}
          />

          {/* Boutons */}
          {editing && (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? 'Enregistrement…' : 'Enregistrer en brouillon'}
              </Button>
              {draft && (
                <Button
                  variant="outline"
                  onClick={() => setShowActivationModal(true)}
                  disabled={isPending}
                  className="text-green-700 border-green-300 hover:bg-green-50"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Activer ce marché cible
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => { setEditing(false); setFormData({}) }}
                disabled={isPending}
              >
                Annuler
              </Button>
              {error && (
                <span className="text-xs text-destructive self-center">
                  {(error as Error).message}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historique des révisions */}
      {history.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2.5 border-b border-border">
            <p className="text-sm font-medium">Historique des révisions</p>
          </div>
          <div className="divide-y divide-border">
            {[...(active ? [active] : []), ...(draft ? [draft] : []), ...history].map((gov) => (
              <div key={gov.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm">{new Date(gov.revisionDate).toLocaleDateString('fr-FR')}</span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    gov.status === 'active' ? 'bg-green-100 text-green-700' :
                    gov.status === 'draft' ? 'bg-blue-100 text-blue-700' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {gov.status === 'active' ? '● Active' : gov.status === 'draft' ? '○ Brouillon' : 'Archivée'}
                  </span>
                  {gov.marcheCibleSource && (
                    <span className="text-xs text-muted-foreground">{gov.marcheCibleSource}</span>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setHistoryGov(gov)}>Voir</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showActivationModal && (
        <ActivationModal onConfirm={handleActivate} onCancel={() => setShowActivationModal(false)} />
      )}
      {historyGov && (
        <HistoryModal gov={historyGov} onClose={() => setHistoryGov(null)} />
      )}
    </div>
  )
}
