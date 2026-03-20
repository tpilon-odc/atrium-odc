'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { complianceApi, type AnswerValue, type PhaseProgress } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

type Item = PhaseProgress['items'][number]

// ── Schémas Zod par type ──────────────────────────────────────────────────────

const textSchema = z.object({ text: z.string().min(1, 'Ce champ est requis') })
const radioSchema = z.object({ selected: z.string().min(1, 'Sélectionnez une option') })
const checkboxSchema = z.object({
  selected: z.array(z.string()).min(1, 'Sélectionnez au moins une option'),
})
const docSchema = z.object({ document_id: z.string().uuid('Sélectionnez un document') })

// ── Sous-formulaires ──────────────────────────────────────────────────────────

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

function DocForm({ item, onSave, saving }: { item: Item; onSave: (v: AnswerValue, s: 'draft' | 'submitted') => void; saving: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(docSchema),
    defaultValues: { document_id: '' },
  })
  return (
    <form className="space-y-4">
      <div className="space-y-1.5">
        <Label>ID du document</Label>
        <Input {...register('document_id')} placeholder="UUID du document dans la GED…" />
        <p className="text-xs text-muted-foreground">
          Uploadez d&apos;abord le document dans la GED, puis copiez son identifiant ici.
        </p>
        {errors.document_id && <p className="text-xs text-destructive">{errors.document_id.message}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={saving} onClick={handleSubmit((d) => onSave({ document_id: d.document_id }, 'draft'))}>
          Enregistrer brouillon
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSubmit((d) => onSave({ document_id: d.document_id }, 'submitted'))}>
          {saving ? 'Envoi…' : 'Soumettre'}
        </Button>
      </div>
    </form>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

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

  if (item.type === 'text') return <TextForm {...props} />
  if (item.type === 'radio') return <RadioForm {...props} />
  if (item.type === 'checkbox') return <CheckboxForm {...props} />
  if (item.type === 'doc') return <DocForm {...props} />
  return <p className="text-sm text-muted-foreground">Type d&apos;item inconnu : {item.type}</p>
}
