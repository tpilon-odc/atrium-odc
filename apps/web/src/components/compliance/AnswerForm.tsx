'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, FileText, X, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { complianceApi, documentApi, type AnswerValue, type PhaseProgress, type Document } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

type Item = PhaseProgress['items'][number]

// ── Schémas Zod ────────────────────────────────────────────────────────────

const textSchema     = z.object({ text: z.string().min(1, 'Ce champ est requis') })
const radioSchema    = z.object({ selected: z.string().min(1, 'Sélectionnez une option') })
const checkboxSchema = z.object({ selected: z.array(z.string()).min(1, 'Sélectionnez au moins une option') })

// ── Sous-formulaires ────────────────────────────────────────────────────────

function TextForm({ item, onSave, saving }: { item: Item; onSave: (v: AnswerValue, s: 'draft' | 'submitted') => void; saving: boolean }) {
  const existing = item.answer?.status !== undefined && 'text' in (item.answer as object) ? (item.answer as { text?: string }).text : ''
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(textSchema),
    defaultValues: { text: existing ?? '' },
  })
  return (
    <form className="space-y-4">
      <div className="space-y-1.5">
        <Label>Réponse</Label>
        <Input {...register('text')} placeholder="Saisissez votre réponse…" />
        {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={saving} onClick={handleSubmit((d) => onSave({ text: d.text }, 'draft'))}>
          Enregistrer brouillon
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSubmit((d) => onSave({ text: d.text }, 'submitted'))}>
          {saving ? 'Envoi…' : 'Soumettre'}
        </Button>
      </div>
    </form>
  )
}

function RadioForm({ item, onSave, saving }: { item: Item; onSave: (v: AnswerValue, s: 'draft' | 'submitted') => void; saving: boolean }) {
  const options: string[] = (item as unknown as { config?: { options?: string[] } }).config?.options ?? []
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(radioSchema),
    defaultValues: { selected: '' },
  })
  return (
    <form className="space-y-4">
      <div className="space-y-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" value={opt} {...register('selected')} className="accent-primary" />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
        {errors.selected && <p className="text-xs text-destructive">{errors.selected.message}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={saving} onClick={handleSubmit((d) => onSave({ selected: [d.selected] }, 'draft'))}>
          Enregistrer brouillon
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSubmit((d) => onSave({ selected: [d.selected] }, 'submitted'))}>
          {saving ? 'Envoi…' : 'Soumettre'}
        </Button>
      </div>
    </form>
  )
}

function CheckboxForm({ item, onSave, saving }: { item: Item; onSave: (v: AnswerValue, s: 'draft' | 'submitted') => void; saving: boolean }) {
  const options: string[] = (item as unknown as { config?: { options?: string[] } }).config?.options ?? []
  const { register, handleSubmit, formState: { errors } } = useForm<{ selected: string[] }>({
    resolver: zodResolver(checkboxSchema),
    defaultValues: { selected: [] },
  })
  return (
    <form className="space-y-4">
      <div className="space-y-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value={opt} {...register('selected')} className="accent-primary" />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
        {errors.selected && <p className="text-xs text-destructive">{errors.selected.message}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={saving} onClick={handleSubmit((d) => onSave({ selected: d.selected }, 'draft'))}>
          Enregistrer brouillon
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSubmit((d) => onSave({ selected: d.selected }, 'submitted'))}>
          {saving ? 'Envoi…' : 'Soumettre'}
        </Button>
      </div>
    </form>
  )
}

// ── Document form — picker GED ──────────────────────────────────────────────

function DocForm({ item, onSave, saving }: { item: Item; onSave: (v: AnswerValue, s: 'draft' | 'submitted') => void; saving: boolean }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['docs-picker', token],
    queryFn: () => documentApi.list(token!, { limit: 50 }),
    enabled: !!token,
    staleTime: 30 * 1000,
  })

  const allDocs = data?.data.documents ?? []
  const filtered = search
    ? allDocs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : allDocs

  const handleUpload = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const res = await documentApi.upload(file, token!)
      setSelectedDoc(res.data.document)
      queryClient.invalidateQueries({ queryKey: ['docs-picker', token] })
    } catch (err) {
      setUploadError((err as Error).message ?? 'Erreur lors de l\'import')
    } finally {
      setUploading(false)
    }
  }

  // Doc sélectionné → afficher confirmation + boutons de soumission
  if (selectedDoc) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 bg-success-subtle border border-success/20 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedDoc.name}</p>
            <p className="text-xs text-muted-foreground">Document sélectionné</p>
          </div>
          <button
            onClick={() => setSelectedDoc(null)}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onSave({ document_id: selectedDoc.id }, 'draft')}
          >
            Enregistrer brouillon
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => onSave({ document_id: selectedDoc.id }, 'submitted')}
          >
            {saving ? 'Envoi…' : 'Soumettre'}
          </Button>
        </div>
      </div>
    )
  }

  // Picker
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher dans vos documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Liste de documents */}
      {isLoading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {search ? 'Aucun document correspondant.' : 'Aucun document dans la GED.'}
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {filtered.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{doc.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Upload */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <label className={cn(
          'flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors',
          uploading ? 'text-muted-foreground' : 'text-primary hover:underline'
        )}>
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Import en cours…' : 'Importer un nouveau document'}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleUpload(f)
            }}
          />
        </label>
      </div>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  )
}

// ── Composant principal ─────────────────────────────────────────────────────

export function AnswerForm({ item, phaseId }: { item: Item; phaseId: string }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ value, status }: { value: AnswerValue; status: 'draft' | 'submitted' }) =>
      complianceApi.submitAnswer(item.id, value, status, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-progress', token] })
      queryClient.invalidateQueries({ queryKey: ['compliance-progress-detail', phaseId, token] })
    },
  })

  const handleSave = (value: AnswerValue, status: 'draft' | 'submitted') => {
    mutation.mutate({ value, status })
  }

  const props = { item, onSave: handleSave, saving: mutation.isPending }

  if (item.type === 'text')     return <TextForm {...props} />
  if (item.type === 'radio')    return <RadioForm {...props} />
  if (item.type === 'checkbox') return <CheckboxForm {...props} />
  if (item.type === 'doc')      return <DocForm {...props} />
  return <p className="text-sm text-muted-foreground">Type d&apos;item inconnu : {item.type}</p>
}
