import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { memberApi, displayName } from '@/lib/api'
import { StepField, StepSection } from './StepField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, UserCheck } from 'lucide-react'

export interface PersonneAcces {
  id: string
  nom: string
  prenom: string
  fonction: string
  typeAcces: string
}

export interface Step01Data {
  // Responsable PCA
  responsableCivilite: string
  responsablePrenom: string
  responsableNom: string
  responsableFonction: string
  // Locaux
  locauxRue: string
  locauxCodePostal: string
  locauxVille: string
  locauxControleAcces: string
  personnesAcces: PersonneAcces[]
  videoSurveillanceSociete: string
  // Ressources humaines
  reglesPresence: string
  // Prévention incendie
  preventionIncendie: string
}

interface Props {
  data: Partial<Step01Data>
  onChange: (data: Partial<Step01Data>) => void
}

function newPersonne(): PersonneAcces {
  return { id: crypto.randomUUID(), nom: '', prenom: '', fonction: '', typeAcces: '' }
}

export default function Step01Organisation({ data, onChange }: Props) {
  const { token, user } = useAuthStore()
  const userRef = useRef(user)
  userRef.current = user
  const set = (key: keyof Step01Data) => (v: string) => onChange({ ...data, [key]: v })
  const list = data.personnesAcces ?? []

  const { data: membersRes } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
  const members = membersRes?.data.members ?? []

  // Pré-remplit depuis un membre sélectionné
  const fillFromMember = (memberId: string) => {
    const m = members.find((m) => m.userId === memberId)
    if (!m || !m.user) return
    onChange({
      ...data,
      responsableCivilite: m.user!.civility ?? '',
      responsablePrenom: m.user!.firstName ?? '',
      responsableNom: m.user!.lastName ?? '',
      responsableFonction: m.role === 'owner' ? 'Dirigeant' : m.role === 'admin' ? 'Responsable' : 'Collaborateur',
    })
  }

  const fillFromSelf = () => {
    const u = userRef.current
    if (!u) return
    onChange({
      ...data,
      responsableCivilite: u.civility ?? '',
      responsablePrenom: u.firstName ?? '',
      responsableNom: u.lastName ?? '',
      responsableFonction: '',
    })
  }

  const addPersonne = () => onChange({ ...data, personnesAcces: [...list, newPersonne()] })
  const removePersonne = (id: string) => onChange({ ...data, personnesAcces: list.filter((p) => p.id !== id) })
  const updatePersonne = (id: string, field: keyof PersonneAcces, val: string) =>
    onChange({ ...data, personnesAcces: list.map((p) => (p.id === id ? { ...p, [field]: val } : p)) })

  return (
    <div className="space-y-6">
      <StepSection
        label="Responsable de la continuité de l'activité"
        hint="Est en charge de la mise en œuvre du plan de continuité d'activité et d'instruire les collaborateurs des mesures de sécurité."
      >
        {/* Sélection rapide depuis les membres */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Choisir parmi les membres du cabinet :</span>
          <button
            type="button"
            onClick={fillFromSelf}
            className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-full transition-colors"
          >
            <UserCheck className="h-3 w-3" />
            Moi-même
          </button>
          {members
            .filter((m) => m.user !== null && m.userId !== userRef.current?.id)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => fillFromMember(m.userId)}
                className="text-xs bg-muted hover:bg-muted/80 px-2.5 py-1 rounded-full transition-colors"
              >
                {displayName(m.user!)}
              </button>
            ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="responsableCivilite">Civilité</label>
            <select
              id="responsableCivilite"
              value={data.responsableCivilite ?? ''}
              onChange={(e) => set('responsableCivilite')(e.target.value)}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">—</option>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
            </select>
          </div>
          <StepField
            label="Prénom"
            id="responsablePrenom"
            value={data.responsablePrenom ?? ''}
            onChange={set('responsablePrenom')}
            placeholder="Prénom"
          />
          <StepField
            label="Nom"
            id="responsableNom"
            value={data.responsableNom ?? ''}
            onChange={set('responsableNom')}
            placeholder="Nom"
          />
        </div>
        <StepField
          label="Exerçant la fonction de"
          id="responsableFonction"
          value={data.responsableFonction ?? ''}
          onChange={set('responsableFonction')}
          placeholder="Ex : Dirigeant, Responsable administratif…"
        />
      </StepSection>

      <StepSection label="Sécurité des locaux">
        <StepField
          label="Rue et numéro"
          id="locauxRue"
          value={data.locauxRue ?? ''}
          onChange={set('locauxRue')}
          placeholder="Ex : 12 rue de la Paix"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StepField
            label="Code postal"
            id="locauxCodePostal"
            value={data.locauxCodePostal ?? ''}
            onChange={set('locauxCodePostal')}
            placeholder="75001"
          />
          <div className="sm:col-span-2">
            <StepField
              label="Ville"
              id="locauxVille"
              value={data.locauxVille ?? ''}
              onChange={set('locauxVille')}
              placeholder="Paris"
            />
          </div>
        </div>
        <StepField
          label="Contrôle d'accès"
          id="locauxControleAcces"
          value={data.locauxControleAcces ?? ''}
          onChange={set('locauxControleAcces')}
          placeholder="Ex : digicode, interphone, accès biométriques…"
        />

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Personnes ayant accès aux locaux</p>

          {/* Ajout rapide depuis les membres */}
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Ajouter un membre :</span>
              {members.filter((m) => m.user !== null).map((m) => {
                const alreadyAdded = list.some(
                  (p) => p.nom === m.user!.lastName && p.prenom === m.user!.firstName
                )
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => {
                      if (alreadyAdded) return
                      onChange({
                        ...data,
                        personnesAcces: [
                          ...list,
                          {
                            id: crypto.randomUUID(),
                            nom: m.user!.lastName ?? '',
                            prenom: m.user!.firstName ?? '',
                            fonction: m.role === 'owner' ? 'Dirigeant' : m.role === 'admin' ? 'Responsable' : 'Collaborateur',
                            typeAcces: '',
                          },
                        ],
                      })
                    }}
                    className="text-xs px-2.5 py-1 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-muted hover:bg-muted/70"
                  >
                    {alreadyAdded ? '✓ ' : '+'} {displayName(m.user!)}
                  </button>
                )
              })}
            </div>
          )}

          {/* En-têtes colonnes */}
          {list.length > 0 && (
            <div className="hidden sm:grid grid-cols-4 gap-2 px-0.5">
              {['Nom', 'Prénom', 'Fonction', "Type d'accès"].map((h) => (
                <span key={h} className="text-xs text-muted-foreground">{h}</span>
              ))}
            </div>
          )}

          {list.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2">Aucune personne ajoutée.</p>
          )}
          {list.map((p) => (
            <div key={p.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
              <Input value={p.nom} onChange={(e) => updatePersonne(p.id, 'nom', e.target.value)} placeholder="Nom" className="text-sm" />
              <Input value={p.prenom} onChange={(e) => updatePersonne(p.id, 'prenom', e.target.value)} placeholder="Prénom" className="text-sm" />
              <Input value={p.fonction} onChange={(e) => updatePersonne(p.id, 'fonction', e.target.value)} placeholder="Fonction" className="text-sm" />
              <div className="flex gap-1">
                <Input value={p.typeAcces} onChange={(e) => updatePersonne(p.id, 'typeAcces', e.target.value)} placeholder="Type d'accès" className="text-sm" />
                <button type="button" onClick={() => removePersonne(p.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addPersonne}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Ajouter manuellement
          </Button>
        </div>

        <StepField
          label="Vidéosurveillance — société prestataire"
          id="videoSurveillanceSociete"
          value={data.videoSurveillanceSociete ?? ''}
          onChange={set('videoSurveillanceSociete')}
          placeholder="Nom de la société (ou 'Aucune')"
        />
      </StepSection>

      <StepSection
        label="Ressources humaines"
        hint="Règles de permanence des moyens humains et gestion des absences."
      >
        <StepField
          label="Règles de présence et suppléance"
          id="reglesPresence"
          value={data.reglesPresence ?? ''}
          onChange={set('reglesPresence')}
          multiline
          placeholder={`Ex :\n- Au moins un gérant / dirigeant doit être présent\n- Au moins un conseiller en investissements financiers doit être présent\n- Minimum X salariés présents en permanence`}
        />
      </StepSection>

      <StepSection label="Mesures de prévention incendie et accident">
        <StepField
          label="Dispositifs en place"
          id="preventionIncendie"
          value={data.preventionIncendie ?? ''}
          onChange={set('preventionIncendie')}
          multiline
          placeholder={`Ex :\n- Extincteurs avec contrat de maintenance\n- Détecteurs incendie\n- Plan d'évacuation affiché\n- Exercice d'évacuation annuel`}
        />
      </StepSection>
    </div>
  )
}
