'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2, Copy, Check, Download, FileText } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentTemplateApi, type TemplateVariable, type FieldCatalogItem } from '@/lib/api'
import FieldCatalogPanel from '../FieldCatalogPanel'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import GenerateModal from '../GenerateModal'

export default function ModeleDocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [variables, setVariables] = useState<TemplateVariable[] | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const { data: templateData, isLoading } = useQuery({
    queryKey: ['document-template', id, token],
    queryFn: () => documentTemplateApi.get(id, token!),
    enabled: !!token && !!id,
  })

  const { data: generationsData } = useQuery({
    queryKey: ['document-template-generations', id, token],
    queryFn: () => documentTemplateApi.generations(id, token!),
    enabled: !!token && !!id,
  })

  const { data: fieldsData } = useQuery({
    queryKey: ['document-template-fields', token],
    queryFn: () => documentTemplateApi.fields(token!),
    enabled: !!token,
  })

  const template = templateData?.data.template
  const generations = generationsData?.data.generations ?? []
  const catalog = fieldsData?.data.catalog

  // Initialise l'état local dès que le template est chargé
  const localVariables = variables ?? template?.variables ?? []

  const updateMutation = useMutation({
    mutationFn: () =>
      documentTemplateApi.update(id, { variables: localVariables }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-template', id] })
      setVariables(null)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    },
  })

  const handleAddVariable = (field: FieldCatalogItem) => {
    if (localVariables.some((v) => v.fieldKey === field.fieldKey)) return
    setVariables([...localVariables, { label: field.label, fieldKey: field.fieldKey, placeholder: '' }])
  }

  const handleRemoveVariable = (fieldKey: string) => {
    setVariables(localVariables.filter((v) => v.fieldKey !== fieldKey))
  }

  const handlePlaceholderChange = (fieldKey: string, placeholder: string) => {
    setVariables(localVariables.map((v) => (v.fieldKey === fieldKey ? { ...v, placeholder } : v)))
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="max-w-5xl">
        <p className="text-muted-foreground">Modèle introuvable.</p>
      </div>
    )
  }

  const hasChanges = variables !== null

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            {template.description && (
              <p className="text-sm text-muted-foreground">{template.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Générer un document
        </button>
      </div>

      {/* Variables */}
      <div className="border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Variables de fusion</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Modifiez les champs et leurs placeholders correspondants dans le document Word.
            </p>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVariables(null)}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saveSuccess ? <Check className="h-4 w-4" /> : null}
                {updateMutation.isPending ? 'Enregistrement...' : saveSuccess ? 'Enregistré' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Catalogue */}
          <div>
            <p className="text-sm font-medium mb-2">Champs disponibles</p>
            {!catalog ? (
              <div className="border rounded-md p-3 text-sm text-muted-foreground">Chargement...</div>
            ) : (
              <FieldCatalogPanel
                catalog={catalog}
                targetEntity={template.targetEntity}
                variables={localVariables}
                onAdd={handleAddVariable}
              />
            )}
          </div>

          {/* Variables configurées */}
          <div>
            <p className="text-sm font-medium mb-2">
              Variables du modèle{' '}
              <span className="text-muted-foreground font-normal">({localVariables.length})</span>
            </p>
            {localVariables.length === 0 ? (
              <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                Aucune variable configurée.
              </div>
            ) : (
              <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
                {localVariables.map((variable) => (
                  <div key={variable.fieldKey} className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{variable.label}</p>
                      <button
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
                          onClick={() => handleCopy(variable.placeholder)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          title="Copier"
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

      {/* Historique des générations */}
      <div className="border rounded-lg p-5 space-y-3">
        <h2 className="font-semibold">Historique des générations</h2>
        {generations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune génération pour ce modèle.</p>
        ) : (
          <div className="divide-y">
            {generations.map((gen) => (
              <div key={gen.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">
                    {gen.contact
                      ? `${gen.contact.firstName ?? ''} ${gen.contact.lastName}`.trim()
                      : 'Document cabinet'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Généré par {gen.user.firstName ?? ''} {gen.user.lastName ?? ''} ·{' '}
                    {format(new Date(gen.generatedAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                </div>
                <a
                  href={(() => {
                    const url = new URL(gen.downloadUrl, window.location.origin)
                    url.searchParams.set('token', token!)
                    return url.toString()
                  })()}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {showGenerate && (
        <GenerateModal
          template={template}
          onClose={() => {
            setShowGenerate(false)
            queryClient.invalidateQueries({ queryKey: ['document-template-generations', id] })
          }}
        />
      )}
    </div>
  )
}
