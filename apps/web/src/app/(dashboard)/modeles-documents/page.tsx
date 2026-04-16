'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Trash2, Settings, Users, Building2, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentTemplateApi, type DocumentTemplate } from '@/lib/api'
import GenerateModal from './GenerateModal'

const ENTITY_LABELS: Record<DocumentTemplate['targetEntity'], string> = {
  CONTACT: 'Contact',
  CABINET: 'Cabinet',
  COMPLIANCE: 'Conformité',
}

const ENTITY_ICONS: Record<DocumentTemplate['targetEntity'], React.ElementType> = {
  CONTACT: Users,
  CABINET: Building2,
  COMPLIANCE: ShieldCheck,
}

export default function ModelesDocumentsPage() {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [generateTemplate, setGenerateTemplate] = useState<DocumentTemplate | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['document-templates', token],
    queryFn: () => documentTemplateApi.list(token!),
    enabled: !!token,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentTemplateApi.delete(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] })
    },
  })

  const templates = data?.data.templates ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Modèles de documents</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Créez des modèles Word avec variables pour générer des documents pré-remplis.
          </p>
        </div>
        <button
          onClick={() => router.push('/modeles-documents/nouveau')}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau modèle
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucun modèle de document</p>
          <p className="text-sm text-muted-foreground mt-1">
            Créez votre premier modèle pour générer des documents Word pré-remplis.
          </p>
          <button
            onClick={() => router.push('/modeles-documents/nouveau')}
            className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Créer un modèle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const EntityIcon = ENTITY_ICONS[template.targetEntity]
            return (
              <div
                key={template.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{template.name}</p>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        <EntityIcon className="h-3 w-3" />
                        {ENTITY_LABELS[template.targetEntity]}
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground truncate">{template.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {template.variables.length} variable{template.variables.length !== 1 ? 's' : ''} · {template._count?.generations ?? 0} génération{(template._count?.generations ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => setGenerateTemplate(template)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
                  >
                    Générer
                  </button>
                  <button
                    onClick={() => router.push(`/modeles-documents/${template.id}`)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    title="Configurer"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer le modèle "${template.name}" ?`)) {
                        deleteMutation.mutate(template.id)
                      }
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {generateTemplate && (
        <GenerateModal
          template={generateTemplate}
          onClose={() => setGenerateTemplate(null)}
        />
      )}
    </div>
  )
}
