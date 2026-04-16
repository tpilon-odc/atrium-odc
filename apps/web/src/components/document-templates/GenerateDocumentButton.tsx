'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentTemplateApi, type DocumentTemplate } from '@/lib/api'
import GenerateModal from '@/app/(dashboard)/modeles-documents/GenerateModal'

interface GenerateDocumentButtonProps {
  targetEntity: 'CONTACT' | 'CABINET' | 'COMPLIANCE'
  preselectedContactId?: string
  label?: string
  /** Si fourni, n'affiche que les templates ayant au moins une variable liée à ces IDs d'items conformité */
  complianceItemIds?: string[]
}

export function GenerateDocumentButton({ targetEntity, preselectedContactId, label = 'Générer un document', complianceItemIds }: GenerateDocumentButtonProps) {
  const { token } = useAuthStore()
  const [generateTemplate, setGenerateTemplate] = useState<DocumentTemplate | null>(null)
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['document-templates', token],
    queryFn: () => documentTemplateApi.list(token!),
    enabled: !!token,
    select: (res) => {
      let filtered = res.data.templates.filter((t) => t.targetEntity === targetEntity)
      // Si des IDs d'items conformité sont fournis, ne garder que les templates
      // qui ont au moins une variable pointant vers un de ces items
      if (complianceItemIds && complianceItemIds.length > 0) {
        const itemFieldKeys = new Set(complianceItemIds.map((id) => `compliance_item_${id}`))
        filtered = filtered.filter((t) =>
          t.variables.some((v) => itemFieldKeys.has(v.fieldKey))
        )
      }
      return filtered
    },
    staleTime: 60_000,
  })

  const templates = data ?? []

  if (templates.length === 0) return null

  const handleClick = () => {
    if (templates.length === 1) {
      setGenerateTemplate(templates[0])
    } else {
      setOpen((o) => !o)
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={handleClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          {label}
          {templates.length > 1 && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {open && templates.length > 1 && (
          <>
            {/* Overlay pour fermer */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-background border rounded-lg shadow-lg py-1 min-w-48">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setGenerateTemplate(t); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {generateTemplate && (
        <GenerateModal
          template={generateTemplate}
          preselectedContactId={preselectedContactId}
          onClose={() => setGenerateTemplate(null)}
        />
      )}
    </>
  )
}
