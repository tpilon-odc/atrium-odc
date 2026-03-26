import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { memberApi, displayName } from '@/lib/api'
import { StepField, StepSection } from './StepField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

export interface Risque {
  id: string
  libelle: string
  consequencesSolutions: string
}

export interface AbsenceCollab {
  id: string
  nomFonction: string
  remplacant: string
}

export interface Step03Data {
  // Indisponibilité locaux
  lieuReplacement: string
  listeTelephoniqueLocalisation: string
  // Cartographie des risques
  risques: Risque[]
  // Absences prolongées
  absences: AbsenceCollab[]
}

interface Props {
  data: Partial<Step03Data>
  onChange: (data: Partial<Step03Data>) => void
}

const RISQUES_DEFAUT: Omit<Risque, 'id'>[] = [
  { libelle: 'Incident site internet', consequencesSolutions: '' },
  { libelle: 'Destruction de fichiers informatiques', consequencesSolutions: '' },
  { libelle: 'Destruction de documents papiers', consequencesSolutions: '' },
  { libelle: 'Panne du système informatique', consequencesSolutions: '' },
  { libelle: "Impossibilité d'accéder aux locaux", consequencesSolutions: '' },
  { libelle: "Absence prolongée d'un ou plusieurs collaborateurs", consequencesSolutions: '' },
]

function initRisques(): Risque[] {
  return RISQUES_DEFAUT.map((r) => ({ ...r, id: crypto.randomUUID() }))
}

export default function Step03Procedures({ data, onChange }: Props) {
  const { token } = useAuthStore()
  const set = (key: keyof Step03Data) => (v: string) => onChange({ ...data, [key]: v })

  const { data: membersRes } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
  const members = membersRes?.data.members ?? []

  // Risques
  const risques = data.risques ?? initRisques()
  const updateRisque = (id: string, field: keyof Risque, val: string) =>
    onChange({ ...data, risques: risques.map((r) => (r.id === id ? { ...r, [field]: val } : r)) })
  const addRisque = () =>
    onChange({ ...data, risques: [...risques, { id: crypto.randomUUID(), libelle: '', consequencesSolutions: '' }] })
  const removeRisque = (id: string) =>
    onChange({ ...data, risques: risques.filter((r) => r.id !== id) })

  // Absences
  const absences = data.absences ?? []
  const updateAbsence = (id: string, field: keyof AbsenceCollab, val: string) =>
    onChange({ ...data, absences: absences.map((a) => (a.id === id ? { ...a, [field]: val } : a)) })
  const addAbsence = () =>
    onChange({ ...data, absences: [...absences, { id: crypto.randomUUID(), nomFonction: '', remplacant: '' }] })
  const removeAbsence = (id: string) =>
    onChange({ ...data, absences: absences.filter((a) => a.id !== id) })

  return (
    <div className="space-y-6">
      <StepSection
        label="Indisponibilité des locaux"
        hint="En cas de sinistre rendant les locaux inaccessibles, où l'activité se poursuit-elle ?"
      >
        <StepField
          label="Lieu de repli provisoire"
          id="lieuReplacement"
          value={data.lieuReplacement ?? ''}
          onChange={set('lieuReplacement')}
          multiline
          placeholder={`Ex :\n- Dans les locaux situés à… (si vous disposez d'autres locaux)\n- Ou au domicile des salariés (télétravail)\n\nPremière personne découvrant le sinistre → alerte le Responsable PCA → informe les collaborateurs.`}
        />
        <StepField
          label="Localisation de la liste téléphonique des partenaires"
          id="listeTelephoniqueLocalisation"
          value={data.listeTelephoniqueLocalisation ?? ''}
          onChange={set('listeTelephoniqueLocalisation')}
          placeholder="Ex : conservée par le dirigeant à l'extérieur du site, sur le cloud…"
        />
      </StepSection>

      <StepSection
        label="Cartographie des risques"
        hint="Pour chaque risque, décrivez les conséquences et les solutions mises en place."
      >
        <div className="space-y-3">
          {risques.map((r, idx) => (
            <div key={r.id} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">#{idx + 1}</span>
                  <Input
                    value={r.libelle}
                    onChange={(e) => updateRisque(r.id, 'libelle', e.target.value)}
                    placeholder="Libellé du risque"
                    className="text-sm font-medium"
                  />
                </div>
                <button type="button" onClick={() => removeRisque(r.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Conséquences et solutions</label>
                <textarea
                  value={r.consequencesSolutions}
                  onChange={(e) => updateRisque(r.id, 'consequencesSolutions', e.target.value)}
                  placeholder="Décrivez les conséquences de ce risque et les mesures prises pour y faire face…"
                  rows={3}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRisque} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Ajouter un risque
          </Button>
        </div>
      </StepSection>

      <StepSection
        label="Absence prolongée d'un collaborateur"
        hint="Pour chaque poste clé, identifiez le remplaçant en cas d'absence prolongée."
      >
        <div className="space-y-2">
          {/* Ajout rapide depuis les membres */}
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Ajouter un membre :</span>
              {members.map((m) => {
                const alreadyAdded = absences.some((a) => a.nomFonction.startsWith(displayName(m.user)))
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => {
                      if (alreadyAdded) return
                      const fonction = m.role === 'owner' ? 'Dirigeant' : m.role === 'admin' ? 'Responsable' : 'Collaborateur'
                      onChange({
                        ...data,
                        absences: [
                          ...absences,
                          { id: crypto.randomUUID(), nomFonction: `${displayName(m.user)} — ${fonction}`, remplacant: '' },
                        ],
                      })
                    }}
                    className="text-xs px-2.5 py-1 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-muted hover:bg-muted/70"
                  >
                    {alreadyAdded ? '✓ ' : '+'} {displayName(m.user)}
                  </button>
                )
              })}
            </div>
          )}

          {absences.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-3">Aucun collaborateur ajouté.</p>
          )}
          {absences.map((a) => (
            <div key={a.id} className="flex gap-2 items-center">
              <Input
                value={a.nomFonction}
                onChange={(e) => updateAbsence(a.id, 'nomFonction', e.target.value)}
                placeholder="Nom / Fonction"
                className="text-sm"
              />
              <Input
                value={a.remplacant}
                onChange={(e) => updateAbsence(a.id, 'remplacant', e.target.value)}
                placeholder="Remplaçant désigné"
                className="text-sm"
              />
              <button type="button" onClick={() => removeAbsence(a.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addAbsence}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Ajouter manuellement
          </Button>
        </div>
      </StepSection>
    </div>
  )
}
