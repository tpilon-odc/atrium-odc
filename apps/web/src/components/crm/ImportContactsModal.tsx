'use client'

import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, X, ChevronRight, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { cabinetApi, type ImportContact } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImportMergeRow, type MergeDecision } from './ImportMergeRow'

const TOOL_LABELS: Record<string, string> = {
  O2S: 'O2S (Harvest)',
  QUANTALYS: 'Quantalys',
  WEALTHCOME: 'Wealthcome',
}

type Step = 'select' | 'preview' | 'done'

interface ImportContactsModalProps {
  tools: string[]
  token: string
  onClose: () => void
  onDone: () => void
}

export function ImportContactsModal({ tools, token, onClose, onDone }: ImportContactsModalProps) {
  const [step, setStep] = useState<Step>('select')
  const [selectedTool, setSelectedTool] = useState<string>(tools[0] ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{
    toCreate: ImportContact[]
    conflicts: Array<{ incoming: ImportContact; existing: ImportContact & { id: string } }>
    total: number
  } | null>(null)
  const [mergeDecisions, setMergeDecisions] = useState<MergeDecision[]>([])
  const [result, setResult] = useState<{ created: number; merged: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const previewMutation = useMutation({
    mutationFn: () => cabinetApi.previewImport(selectedTool, file!, token),
    onSuccess: (res) => {
      const p = res.data
      setPreview(p)
      // Décision par défaut : garder l'existant pour les conflits
      setMergeDecisions(
        p.conflicts.map((c) => ({
          ...c.existing,
          existingId: c.existing.id,
        }))
      )
      setStep('preview')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () =>
      cabinetApi.confirmImport(preview!.toCreate, mergeDecisions, token),
    onSuccess: (res) => {
      setResult(res.data)
      setStep('done')
      onDone()
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  function updateMerge(index: number, decision: MergeDecision) {
    setMergeDecisions((prev) => prev.map((d, i) => (i === index ? decision : d)))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Importer des contacts</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Indicateur d'étapes */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border text-xs text-muted-foreground">
          {['Fichier', 'Vérification', 'Résultat'].map((label, i) => {
            const stepIndex = step === 'select' ? 0 : step === 'preview' ? 1 : 2
            return (
              <span key={label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <span className={cn(i === stepIndex && 'text-foreground font-medium')}>{label}</span>
              </span>
            )
          })}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Étape 1 : sélection outil + fichier */}
          {step === 'select' && (
            <div className="space-y-5">
              {tools.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Depuis quel outil ?</p>
                  <div className="flex flex-wrap gap-2">
                    {tools.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={cn(
                          'px-3 py-1.5 rounded-md border text-sm transition-colors',
                          selectedTool === t
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border hover:bg-muted/40'
                        )}
                        onClick={() => setSelectedTool(t)}
                      >
                        {TOOL_LABELS[t] ?? t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Fichier d'export ({TOOL_LABELS[selectedTool] ?? selectedTool})</p>
                <p className="text-xs text-muted-foreground">Formats acceptés : XLS, XLSX, CSV</p>
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  {file ? (
                    <p className="text-sm font-medium">{file.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Cliquer pour sélectionner un fichier</p>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {previewMutation.isError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {(previewMutation.error as Error).message}
                </div>
              )}
            </div>
          )}

          {/* Étape 2 : preview + merge */}
          {step === 'preview' && preview && (
            <div className="space-y-5">
              {/* Résumé */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="border border-border rounded-lg p-3">
                  <p className="text-2xl font-bold text-primary">{preview.toCreate.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">À créer</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <p className="text-2xl font-bold text-amber-600">{preview.conflicts.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Conflits</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <p className="text-2xl font-bold">{preview.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total fichier</p>
                </div>
              </div>

              {/* Conflits à résoudre */}
              {preview.conflicts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    Conflits à résoudre — cliquez sur une valeur pour la sélectionner
                  </p>
                  {preview.conflicts.map((c, i) => (
                    <ImportMergeRow
                      key={c.existing.id}
                      incoming={c.incoming}
                      existing={c.existing}
                      value={mergeDecisions[i]}
                      onChange={(d) => updateMerge(i, d)}
                    />
                  ))}
                </div>
              )}

              {preview.conflicts.length === 0 && preview.toCreate.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Aucun contact à importer dans ce fichier.
                </div>
              )}

              {confirmMutation.isError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {(confirmMutation.error as Error).message}
                </div>
              )}
            </div>
          )}

          {/* Étape 3 : résultat */}
          {step === 'done' && result && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-semibold">Import terminé</p>
              <p className="text-sm text-muted-foreground">
                {result.created} contact{result.created > 1 ? 's' : ''} créé{result.created > 1 ? 's' : ''}
                {result.merged > 0 && `, ${result.merged} mis à jour`}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          {step === 'done' ? (
            <Button onClick={onClose}>Fermer</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
              {step === 'select' && (
                <Button
                  disabled={!file || !selectedTool || previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  {previewMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Analyser le fichier
                </Button>
              )}
              {step === 'preview' && (
                <Button
                  disabled={confirmMutation.isPending || (preview?.toCreate.length === 0 && preview?.conflicts.length === 0)}
                  onClick={() => confirmMutation.mutate()}
                >
                  {confirmMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Confirmer l'import
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
