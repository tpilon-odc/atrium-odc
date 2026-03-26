'use client'

import { useState } from 'react'
import { History, X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pcaApi, PcaHistoryEntry } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

const FIELD_LABELS: Record<string, string> = {
  // Step 01
  organisation: 'Organisation',
  responsableCivilite: 'Civilité du responsable',
  responsablePrenom: 'Prénom du responsable',
  responsableNom: 'Nom du responsable',
  responsableFonction: 'Fonction du responsable',
  locauxRue: 'Rue',
  locauxCodePostal: 'Code postal',
  locauxVille: 'Ville',
  locauxControleAcces: "Contrôle d'accès",
  personnesAcces: "Personnes ayant accès aux locaux",
  videoSurveillanceSociete: 'Vidéosurveillance',
  reglesPresence: 'Règles de présence',
  preventionIncendie: 'Prévention incendie',
  // Step 02
  donnees: 'Données',
  systemeInformatique: 'Système informatique',
  prestataireMaintenance: 'Prestataire maintenance',
  politiqueMotDePasse: 'Politique mots de passe',
  antivirus: 'Antivirus',
  urlMessagerie: 'URL messagerie',
  responsableSupervisionCivilite: 'Civilité superviseur',
  responsableSupervisionPrenom: 'Prénom superviseur',
  responsableSupervisionNom: 'Nom superviseur',
  missionsSupervision: 'Missions supervision',
  conservationDocuments: 'Conservation documents',
  // Step 03
  procedures: 'Procédures',
  lieuReplacement: 'Lieu de repli',
  listeTelephoniqueLocalisation: 'Liste téléphonique',
  risques: 'Cartographie des risques',
  absences: 'Absences collaborateurs',
}

// Top-level step keys whose value is an object containing sub-fields
const STEP_KEYS = new Set(['organisation', 'donnees', 'procedures'])

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

function formatValue(val: unknown): string {
  if (val === undefined || val === null) return '(vide)'
  if (Array.isArray(val)) return `${val.length} élément${val.length !== 1 ? 's' : ''}`
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function countChangedFields(data: Record<string, { old: unknown; new: unknown }>): number {
  let count = 0
  for (const [key, entry] of Object.entries(data)) {
    if (STEP_KEYS.has(key)) {
      // entry.old and entry.new are objects — count sub-field differences
      const oldObj = (entry.old ?? {}) as Record<string, unknown>
      const newObj = (entry.new ?? {}) as Record<string, unknown>
      const allSubKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
      for (const subKey of allSubKeys) {
        if (JSON.stringify(oldObj[subKey]) !== JSON.stringify(newObj[subKey])) {
          count++
        }
      }
    } else {
      count++
    }
  }
  return count
}

interface DiffLine {
  label: string
  old: unknown
  new: unknown
}

function buildDiffLines(data: Record<string, { old: unknown; new: unknown }>): DiffLine[] {
  const lines: DiffLine[] = []
  for (const [key, entry] of Object.entries(data)) {
    if (STEP_KEYS.has(key)) {
      const oldObj = (entry.old ?? {}) as Record<string, unknown>
      const newObj = (entry.new ?? {}) as Record<string, unknown>
      const allSubKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
      for (const subKey of allSubKeys) {
        if (JSON.stringify(oldObj[subKey]) !== JSON.stringify(newObj[subKey])) {
          lines.push({ label: fieldLabel(subKey), old: oldObj[subKey], new: newObj[subKey] })
        }
      }
    } else {
      lines.push({ label: fieldLabel(key), old: entry.old, new: entry.new })
    }
  }
  return lines
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' à ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  )
}

function displayAuthor(user: PcaHistoryEntry['user']): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || user.email.split('@')[0]
}

interface HistoryEntryRowProps {
  entry: PcaHistoryEntry
}

function HistoryEntryRow({ entry }: HistoryEntryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const changedCount = countChangedFields(entry.data)
  const diffLines = buildDiffLines(entry.data)

  return (
    <li className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{displayAuthor(entry.user)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(entry.createdAt)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {changedCount} champ{changedCount !== 1 ? 's' : ''} modifié{changedCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="shrink-0 mt-0.5 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {diffLines.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun détail disponible.</p>
          ) : (
            diffLines.map((line, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium text-foreground">{line.label}</span>
                {Array.isArray(line.old) || Array.isArray(line.new) ? (
                  <span className="text-muted-foreground ml-1">
                    {formatValue(line.old)} → {formatValue(line.new)}
                  </span>
                ) : (
                  <span className="text-muted-foreground ml-1">
                    Ancien&nbsp;: {formatValue(line.old)} → Nouveau&nbsp;: {formatValue(line.new)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </li>
  )
}

interface PcaHistoryProps {
  token: string
}

export default function PcaHistory({ token }: PcaHistoryProps) {
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['pca-history', token],
    queryFn: () => pcaApi.history(token),
    enabled: open && !!token,
    staleTime: 30 * 1000,
  })

  const history = data?.data.history ?? []

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <History className="h-3.5 w-3.5 mr-1.5" />
        Historique
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Historique des modifications</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Aucune modification enregistrée pour le moment.
                </p>
              ) : (
                <ul className="space-y-3">
                  {history.map(entry => (
                    <HistoryEntryRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
