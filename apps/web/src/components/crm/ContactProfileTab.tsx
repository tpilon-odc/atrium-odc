'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ContactProfile, type ContactProfileObjectif } from '@/lib/api'
import { useContactProfile } from '@/hooks/useContactProfile'
import { Button } from '@/components/ui/button'

// ── Types locaux ──────────────────────────────────────────────────────────────

type ProfileForm = {
  classificationMifid: ContactProfile['classificationMifid']
  connaissance: ContactProfile['connaissance']
  experience: ContactProfile['experience']
  capacitePertes: ContactProfile['capacitePertes']
  sri: number | null
  horizon: ContactProfile['horizon']
  objectifs: ContactProfileObjectif[]
  aPreferencesDurabilite: boolean
  pctTaxonomieSouhaite: number | null
  pctSfdrEnvSouhaite: number | null
  pctSfdrSocialSouhaite: number | null
  paiGesSocietes: boolean
  paiBiodiversite: boolean
  paiEau: boolean
  paiDechets: boolean
  paiSocialPersonnel: boolean
  paiGesSouverains: boolean
  paiNormesSociales: boolean
  paiCombustiblesFossiles: boolean
  paiImmobilierEnergetique: boolean
  notes: string
}

const defaultForm = (): ProfileForm => ({
  classificationMifid: null,
  connaissance: null,
  experience: null,
  capacitePertes: null,
  sri: null,
  horizon: null,
  objectifs: [],
  aPreferencesDurabilite: false,
  pctTaxonomieSouhaite: null,
  pctSfdrEnvSouhaite: null,
  pctSfdrSocialSouhaite: null,
  paiGesSocietes: false,
  paiBiodiversite: false,
  paiEau: false,
  paiDechets: false,
  paiSocialPersonnel: false,
  paiGesSouverains: false,
  paiNormesSociales: false,
  paiCombustiblesFossiles: false,
  paiImmobilierEnergetique: false,
  notes: '',
})

function profileToForm(p: ContactProfile): ProfileForm {
  return {
    classificationMifid: p.classificationMifid,
    connaissance: p.connaissance,
    experience: p.experience,
    capacitePertes: p.capacitePertes,
    sri: p.sri,
    horizon: p.horizon,
    objectifs: p.objectifs as ContactProfileObjectif[],
    aPreferencesDurabilite: p.aPreferencesDurabilite,
    pctTaxonomieSouhaite: p.pctTaxonomieSouhaite,
    pctSfdrEnvSouhaite: p.pctSfdrEnvSouhaite,
    pctSfdrSocialSouhaite: p.pctSfdrSocialSouhaite,
    paiGesSocietes: p.paiGesSocietes,
    paiBiodiversite: p.paiBiodiversite,
    paiEau: p.paiEau,
    paiDechets: p.paiDechets,
    paiSocialPersonnel: p.paiSocialPersonnel,
    paiGesSouverains: p.paiGesSouverains,
    paiNormesSociales: p.paiNormesSociales,
    paiCombustiblesFossiles: p.paiCombustiblesFossiles,
    paiImmobilierEnergetique: p.paiImmobilierEnergetique,
    notes: p.notes ?? '',
  }
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function AxisBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-left hover:bg-muted/40 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </div>
  )
}

function RadioRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium border transition-colors',
              value === o.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SriSelector({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const colors = ['', 'bg-green-500', 'bg-green-400', 'bg-orange-400', 'bg-orange-500', 'bg-red-500', 'bg-red-600', 'bg-red-800']
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Indicateur SRI (1 = très faible · 7 = très élevé)</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'h-9 w-9 rounded-lg text-sm font-bold transition-all border-2',
              value === n
                ? `${colors[n]} text-white border-transparent`
                : 'border-border text-muted-foreground hover:border-primary'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      {label}
    </label>
  )
}

function PctInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value !== null ? Math.round(value * 100) : ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))) / 100
            onChange(v)
          }}
          className="w-16 rounded border border-border px-2 py-1 text-sm text-right"
          placeholder="0"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export function ContactProfileTab({ contactId, token }: { contactId: string; token: string }) {
  const hook = useContactProfile(contactId, token)
  const { profile, history, isLoading, isDueForReview, isPending } = hook
  const [form, setForm] = useState<ProfileForm>(defaultForm())
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) setForm(profileToForm(profile))
  }, [profile])

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleObjectif = (obj: ContactProfileObjectif) => {
    setForm((f) => ({
      ...f,
      objectifs: f.objectifs.includes(obj)
        ? f.objectifs.filter((o) => o !== obj)
        : [...f.objectifs, obj],
    }))
  }

  const handleSave = async () => {
    await hook.saveProfile({
      ...form,
      notes: form.notes || null,
    } as Partial<ContactProfile>)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRevise = async () => {
    if (!confirm('Réviser ce profil ? L\'historique sera conservé.')) return
    await hook.reviseProfile({
      ...form,
      notes: form.notes || null,
    } as Partial<ContactProfile>)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isLoading) {
    return <div className="h-40 bg-muted animate-pulse rounded-lg" />
  }

  return (
    <div className="space-y-4">
      {/* En-tête statut */}
      {profile && (
        <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">
                Profil actif depuis le{' '}
                {new Date(profile.profilDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            {profile.nextReviewDate && (
              <p className="text-xs text-muted-foreground pl-6">
                Prochaine révision : {new Date(profile.nextReviewDate).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
          {isDueForReview && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Révision recommandée
            </span>
          )}
        </div>
      )}

      {/* Axe 1 — Classification MiFID */}
      <AxisBlock title="1. Type de client (classification MiFID)">
        <RadioRow
          options={[
            { value: 'non_professionnel', label: 'Client non professionnel' },
            { value: 'professionnel', label: 'Client professionnel' },
            { value: 'contrepartie_eligible', label: 'Contrepartie éligible' },
          ]}
          value={form.classificationMifid}
          onChange={(v) => set('classificationMifid', v)}
        />
      </AxisBlock>

      {/* Axe 2 — Connaissance & expérience */}
      <AxisBlock title="2. Connaissance & expérience">
        <RadioRow
          label="Niveau de connaissance :"
          options={[
            { value: 'basique', label: 'Basique' },
            { value: 'informe', label: 'Informé' },
            { value: 'expert', label: 'Expert' },
          ]}
          value={form.connaissance}
          onChange={(v) => set('connaissance', v)}
        />
        <RadioRow
          label="Niveau d'expérience :"
          options={[
            { value: 'faible', label: 'Faible' },
            { value: 'moyenne', label: 'Moyenne' },
            { value: 'elevee', label: 'Élevée' },
          ]}
          value={form.experience}
          onChange={(v) => set('experience', v)}
        />
      </AxisBlock>

      {/* Axe 3 — Capacité pertes */}
      <AxisBlock title="3. Capacité à supporter des pertes">
        <RadioRow
          options={[
            { value: 'aucune', label: 'Aucune perte en capital' },
            { value: 'limitee', label: 'Pertes limitées' },
            { value: 'capital', label: 'Perte du capital investi' },
            { value: 'superieure', label: 'Pertes supérieures au capital' },
          ]}
          value={form.capacitePertes}
          onChange={(v) => set('capacitePertes', v)}
        />
      </AxisBlock>

      {/* Axe 4 — SRI */}
      <AxisBlock title="4. Tolérance au risque (SRI)">
        <SriSelector value={form.sri} onChange={(v) => set('sri', v)} />
      </AxisBlock>

      {/* Axe 5 — Objectifs */}
      <AxisBlock title="5. Objectifs et besoins">
        <RadioRow
          label="Horizon de placement :"
          options={[
            { value: 'moins_2_ans', label: '< 2 ans' },
            { value: '2_5_ans', label: '2 – 5 ans' },
            { value: 'plus_5_ans', label: '> 5 ans' },
          ]}
          value={form.horizon}
          onChange={(v) => set('horizon', v)}
        />
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Objectifs d'investissement :</p>
          <div className="space-y-1.5">
            {([
              { value: 'preservation', label: 'Préservation du capital' },
              { value: 'croissance', label: 'Croissance du capital' },
              { value: 'revenus', label: 'Revenus complémentaires' },
              { value: 'fiscal', label: 'Avantage fiscal' },
            ] as { value: ContactProfileObjectif; label: string }[]).map((o) => (
              <CheckRow
                key={o.value}
                label={o.label}
                checked={form.objectifs.includes(o.value)}
                onChange={() => toggleObjectif(o.value)}
              />
            ))}
          </div>
        </div>
      </AxisBlock>

      {/* Bloc durabilité */}
      <AxisBlock title="6. Préférences de durabilité">
        <CheckRow
          label="Ce client a des préférences de durabilité"
          checked={form.aPreferencesDurabilite}
          onChange={(v) => set('aPreferencesDurabilite', v)}
        />
        {form.aPreferencesDurabilite && (
          <div className="space-y-3 mt-2">
            <PctInput
              label="Proportion min. Taxonomie"
              value={form.pctTaxonomieSouhaite}
              onChange={(v) => set('pctTaxonomieSouhaite', v)}
            />
            <PctInput
              label="Proportion min. SFDR environnemental"
              value={form.pctSfdrEnvSouhaite}
              onChange={(v) => set('pctSfdrEnvSouhaite', v)}
            />
            <PctInput
              label="Proportion min. SFDR social"
              value={form.pctSfdrSocialSouhaite}
              onChange={(v) => set('pctSfdrSocialSouhaite', v)}
            />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">PAI souhaités :</p>
              {[
                { key: 'paiGesSocietes', label: 'GES sociétés' },
                { key: 'paiBiodiversite', label: 'Biodiversité' },
                { key: 'paiEau', label: 'Eau' },
                { key: 'paiDechets', label: 'Déchets' },
                { key: 'paiSocialPersonnel', label: 'Personnel et social' },
                { key: 'paiGesSouverains', label: 'GES souverains' },
                { key: 'paiNormesSociales', label: 'Normes sociales' },
                { key: 'paiCombustiblesFossiles', label: 'Combustibles fossiles' },
                { key: 'paiImmobilierEnergetique', label: 'Immobilier énergétique' },
              ].map(({ key, label }) => (
                <CheckRow
                  key={key}
                  label={label}
                  checked={form[key as keyof ProfileForm] as boolean}
                  onChange={(v) => set(key as keyof ProfileForm, v as never)}
                />
              ))}
            </div>
          </div>
        )}
      </AxisBlock>

      {/* Notes */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-2">
        <p className="text-sm font-semibold">Notes</p>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="Observations complémentaires…"
          className="w-full rounded border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 items-center">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer le profil'}
        </Button>
        {profile && (
          <Button variant="outline" onClick={handleRevise} disabled={isPending}>
            Réviser (nouvelle version)
          </Button>
        )}
      </div>

      {/* Historique */}
      {history.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Historique des révisions ({history.length})
            </span>
            {historyOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {historyOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-t border-border bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Connaissance</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">SRI</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Capacité pertes</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        {new Date(h.profilDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 capitalize">{h.connaissance ?? '—'}</td>
                      <td className="px-4 py-2">{h.sri ?? '—'}</td>
                      <td className="px-4 py-2 capitalize">{h.capacitePertes ?? '—'}</td>
                      <td className="px-4 py-2">
                        {h.status === 'active' ? (
                          <span className="text-green-600 font-medium">● Actif</span>
                        ) : (
                          <span className="text-muted-foreground">Archivé</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
