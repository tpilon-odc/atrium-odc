'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Upload, Plus, Trash2, Copy, Check, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentTemplateApi, type TemplateVariable, type FieldCatalogItem } from '@/lib/api'

type TargetEntity = 'CONTACT' | 'CABINET' | 'COMPLIANCE'

const ENTITY_OPTIONS: { value: TargetEntity; label: string; description: string }[] = [
  { value: 'CONTACT', label: 'Contact', description: 'Données du client / prospect' },
  { value: 'CABINET', label: 'Cabinet', description: 'Données du cabinet' },
  { value: 'COMPLIANCE', label: 'Conformité', description: 'Données de conformité du cabinet' },
]

export default function NouveauModeleDocumentPage() {
  const { token } = useAuthStore()
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetEntity, setTargetEntity] = useState<TargetEntity>('CONTACT')
  const [file, setFile] = useState<File | null>(null)
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: fieldsData } = useQuery({
    queryKey: ['document-template-fields', token],
    queryFn: () => documentTemplateApi.fields(token!),
    enabled: !!token,
  })

  const catalog = fieldsData?.data.catalog

  const availableFields: FieldCatalogItem[] = [
    ...(catalog?.[targetEntity] ?? []),
    ...(catalog?.SYSTEM ?? []),
  ]

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Fichier requis')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name.trim())
      formData.append('description', description.trim())
      formData.append('targetEntity', targetEntity)
      formData.append('variables', JSON.stringify(variables))
      return documentTemplateApi.create(formData, token!)
    },
    onSuccess: () => {
      router.push('/modeles-documents')
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleAddVariable = (field: FieldCatalogItem) => {
    if (variables.some((v) => v.fieldKey === field.fieldKey)) return
    setVariables((prev) => [
      ...prev,
      { label: field.label, fieldKey: field.fieldKey, placeholder: '' },
    ])
  }

  const handleRemoveVariable = (fieldKey: string) => {
    setVariables((prev) => prev.filter((v) => v.fieldKey !== fieldKey))
  }

  const handlePlaceholderChange = (fieldKey: string, placeholder: string) => {
    setVariables((prev) =>
      prev.map((v) => (v.fieldKey === fieldKey ? { ...v, placeholder } : v))
    )
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Le nom est requis')
    if (!file) return setError('Le fichier .docx est requis')
    const incomplete = variables.filter((v) => !v.placeholder.trim())
    if (incomplete.length > 0) return setError('Tous les placeholders doivent être renseignés')
    createMutation.mutate()
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Nouveau modèle de document</h1>
          <p className="text-sm text-muted-foreground">Uploadez un .docx et configurez les variables de fusion</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations générales */}
        <div className="border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">Informations générales</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nom du modèle *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Contrat de mandat, Lettre de bienvenue..."
              className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description <span className="text-muted-foreground">(optionnel)</span></label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Courte description du modèle"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Entité cible *</label>
            <div className="grid grid-cols-3 gap-3">
              {ENTITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetEntity(opt.value)}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    targetEntity === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent'
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fichier Word (.docx) *</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-3 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/30 transition-colors ${
                file ? 'border-primary/50 bg-primary/5' : ''
              }`}
            >
              <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Cliquez pour sélectionner un fichier .docx</p>
                )}
              </div>
              {file && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="ml-auto p-1 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {/* Configuration des variables */}
        <div className="border rounded-lg p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Variables de fusion</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sélectionnez les champs à utiliser et définissez le placeholder correspondant dans votre document Word.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Catalogue des champs */}
            <div>
              <p className="text-sm font-medium mb-2">Champs disponibles</p>
              <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                {availableFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">Chargement...</p>
                ) : (
                  availableFields.map((field) => {
                    const added = variables.some((v) => v.fieldKey === field.fieldKey)
                    return (
                      <div key={field.fieldKey} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/30">
                        <div>
                          <p className="font-medium">{field.label}</p>
                          <p className="text-xs text-muted-foreground font-mono">{field.fieldKey}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddVariable(field)}
                          disabled={added}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                            added
                              ? 'text-muted-foreground cursor-default'
                              : 'text-primary hover:bg-primary/10'
                          }`}
                        >
                          {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {added ? 'Ajouté' : 'Ajouter'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Variables configurées */}
            <div>
              <p className="text-sm font-medium mb-2">
                Variables du modèle{' '}
                <span className="text-muted-foreground font-normal">({variables.length})</span>
              </p>
              {variables.length === 0 ? (
                <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                  <p>Aucune variable ajoutée.</p>
                  <p className="mt-1">Sélectionnez des champs à gauche.</p>
                </div>
              ) : (
                <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                  {variables.map((variable) => (
                    <div key={variable.fieldKey} className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{variable.label}</p>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariable(variable.fieldKey)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={variable.placeholder}
                          onChange={(e) => handlePlaceholderChange(variable.fieldKey, e.target.value)}
                          placeholder="Ex: ###NOM_CLIENT###"
                          className="flex-1 px-2.5 py-1.5 border rounded text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        {variable.placeholder && (
                          <button
                            type="button"
                            onClick={() => handleCopy(variable.placeholder)}
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            title="Copier le placeholder"
                          >
                            {copiedKey === variable.placeholder ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Enregistrement...' : 'Créer le modèle'}
          </button>
        </div>
      </form>
    </div>
  )
}
