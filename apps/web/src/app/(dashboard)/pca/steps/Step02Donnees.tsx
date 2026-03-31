import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { memberApi, displayName } from '@/lib/api'
import { useRef } from 'react'
import { StepField, StepSection } from './StepField'
import { UserCheck } from 'lucide-react'

export interface Step02Data {
  // Système informatique
  systemeInformatique: string
  prestataireMaintenance: string
  // Gestion des accès
  politiqueMotDePasse: string
  antivirus: string
  // Accès courriels
  urlMessagerie: string
  // Supervision
  responsableSupervisionCivilite: string
  responsableSupervisionNom: string
  responsableSupervisionPrenom: string
  missionsSupervision: string
  // Conservation documents
  conservationDocuments: string
}

interface Props {
  data: Partial<Step02Data>
  onChange: (data: Partial<Step02Data>) => void
}

export default function Step02Donnees({ data, onChange }: Props) {
  const { token, user } = useAuthStore()
  const userRef = useRef(user)
  userRef.current = user
  const set = (key: keyof Step02Data) => (v: string) => onChange({ ...data, [key]: v })

  const { data: membersRes } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
  const members = membersRes?.data.members ?? []

  return (
    <div className="space-y-6">
      <StepSection
        label="Système informatique et sauvegarde"
        hint="Décrivez le dispositif de sauvegarde des données (serveur local, cloud, fréquence…)."
      >
        <StepField
          label="Organisation et sauvegarde des données"
          id="systemeInformatique"
          value={data.systemeInformatique ?? ''}
          onChange={set('systemeInformatique')}
          multiline
          placeholder={`Ex :\nL'ensemble des fichiers est centralisé sur un serveur. Les sauvegardes sont réalisées quotidiennement sur disque dur externe et sur un hébergeur cloud (prestataire : …).\n\nOu : Les données sont sauvegardées uniquement sur serveur distant accessible par internet. Prestataire : …`}
        />
        <StepField
          label="Prestataire de maintenance informatique"
          id="prestataireMaintenance"
          value={data.prestataireMaintenance ?? ''}
          onChange={set('prestataireMaintenance')}
          placeholder="Nom de la société — téléphone / email de contact"
        />
      </StepSection>

      <StepSection
        label="Gestion des accès et sécurité informatique"
      >
        <StepField
          label="Politique de mots de passe"
          id="politiqueMotDePasse"
          value={data.politiqueMotDePasse ?? ''}
          onChange={set('politiqueMotDePasse')}
          placeholder="Ex : mots de passe personnalisés changés tous les trimestres / semestres / ans"
        />
        <StepField
          label="Antivirus et pare-feu"
          id="antivirus"
          value={data.antivirus ?? ''}
          onChange={set('antivirus')}
          placeholder="Ex : solution antivirus + pare-feu couvrant le serveur et les postes (nom de la solution)"
        />
      </StepSection>

      <StepSection
        label="Accès aux courriels"
        hint="En cas d'incident, comment les collaborateurs accèdent-ils à leurs messageries ?"
      >
        <StepField
          label="URL d'accès aux messageries"
          id="urlMessagerie"
          value={data.urlMessagerie ?? ''}
          onChange={set('urlMessagerie')}
          placeholder="https://… (webmail, Outlook en ligne, etc.)"
        />
      </StepSection>

      <StepSection
        label="Supervision informatique"
        hint="Responsable chargé de la supervision du système d'information."
      >
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Choisir parmi les membres du cabinet :</span>
          <button
            type="button"
            onClick={() => onChange({ ...data, responsableSupervisionCivilite: userRef.current?.civility ?? '', responsableSupervisionPrenom: userRef.current?.firstName ?? '', responsableSupervisionNom: userRef.current?.lastName ?? '' })}
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
                onClick={() => onChange({ ...data, responsableSupervisionCivilite: m.user!.civility ?? '', responsableSupervisionPrenom: m.user!.firstName ?? '', responsableSupervisionNom: m.user!.lastName ?? '' })}
                className="text-xs bg-muted hover:bg-muted/80 px-2.5 py-1 rounded-full transition-colors"
              >
                {displayName(m.user!)}
              </button>
            ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="responsableSupervisionCivilite">Civilité</label>
            <select
              id="responsableSupervisionCivilite"
              value={data.responsableSupervisionCivilite ?? ''}
              onChange={(e) => set('responsableSupervisionCivilite')(e.target.value)}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">—</option>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
            </select>
          </div>
          <StepField
            label="Prénom"
            id="responsableSupervisionPrenom"
            value={data.responsableSupervisionPrenom ?? ''}
            onChange={set('responsableSupervisionPrenom')}
            placeholder="Prénom"
          />
          <StepField
            label="Nom"
            id="responsableSupervisionNom"
            value={data.responsableSupervisionNom ?? ''}
            onChange={set('responsableSupervisionNom')}
            placeholder="Nom"
          />
        </div>
        <StepField
          label="Missions et responsabilités"
          id="missionsSupervision"
          value={data.missionsSupervision ?? ''}
          onChange={set('missionsSupervision')}
          multiline
          placeholder={`Ex :\n- Identifier les besoins de la société\n- Sélectionner les prestataires informatiques\n- Gérer les droits d'accès\n- Vérifier le bon déroulé des sauvegardes (hebdomadaire)\n- Réaliser un test de restauration mensuel / trimestriel\n- Constituer des archives informatiques physiques si nécessaire`}
        />
      </StepSection>

      <StepSection
        label="Enregistrement et conservation des informations"
      >
        <StepField
          label="Politique de conservation des données et documents"
          id="conservationDocuments"
          value={data.conservationDocuments ?? ''}
          onChange={set('conservationDocuments')}
          multiline
          placeholder={`Ex :\n- Données informatiques et documents papiers conservés selon les délais réglementaires\n- Documents nécessitant une conservation papier archivés dans les locaux / chez le prestataire…\n- Numérisation systématique des dossiers clients`}
        />
      </StepSection>
    </div>
  )
}
