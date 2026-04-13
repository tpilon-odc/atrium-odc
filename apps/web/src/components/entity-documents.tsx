'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, ExternalLink, X, Loader2, Upload, FileText, FileImage, File, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentApi, supplierPortalApi, supplierPublicApi, type Document } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn, withToken } from '@/lib/utils'

type EntityType = 'contact' | 'product' | 'supplier'

function mimeIcon(mime: string | null) {
  if (!mime) return File
  if (mime.startsWith('image/')) return FileImage
  if (mime === 'application/pdf' || mime.startsWith('text/')) return FileText
  return File
}

function formatSize(bytes: string | null): string {
  if (!bytes) return ''
  const n = Number(bytes)
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

// ── Upload inline ─────────────────────────────────────────────────────────────

function InlineUpload({
  entityType,
  entityId,
  supplierId,
  onDone,
  onClose,
}: {
  entityType: EntityType
  entityId: string
  supplierId?: string
  onDone: (doc: Document) => void
  onClose: () => void
}) {
  const { token } = useAuthStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    try {
      let doc: Document
      if (supplierId) {
        const res = await supplierPortalApi.uploadDocument(supplierId, files[0], token!)
        doc = res.data.document
      } else {
        const res = await documentApi.upload(files[0], token!, entityType, entityId)
        doc = res.data.document
      }
      onDone(doc)
    } catch (e: unknown) {
      setError((e as Error).message)
      setUploading(false)
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Importer un nouveau document</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => handle(e.target.files)} />
      <button
        className="w-full border-2 border-dashed border-border rounded-lg py-6 text-center hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Envoi…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Cliquer pour sélectionner</span>
          </div>
        )}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function EntityDocuments({
  entityType,
  entityId,
  supplierId,
  readonlySupplierId,
  title,
}: {
  entityType: EntityType
  entityId: string
  supplierId?: string
  readonlySupplierId?: string
  title?: string
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const isSupplierMode = !!supplierId
  const isReadonlySupplier = !!readonlySupplierId
  const qKey = isSupplierMode
    ? ['supplier-docs', token, supplierId]
    : isReadonlySupplier
      ? ['supplier-docs-public', token, readonlySupplierId]
      : ['documents', token, entityType, entityId]

  const { data, isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => isSupplierMode
      ? supplierPortalApi.listDocuments(supplierId!, token!)
      : isReadonlySupplier
        ? supplierPublicApi.listDocuments(readonlySupplierId!, token!)
        : documentApi.list(token!, { limit: 100, entityType, entityId }),
    enabled: !!token,
  })

  const docs = data?.data.documents ?? []

  const deleteMutation = useMutation({
    mutationFn: (doc: Document): Promise<unknown> => {
      if (isSupplierMode) {
        return supplierPortalApi.deleteDocument(supplierId!, doc.id, token!)
      }
      const link = doc.links?.find((l) => l.entityType === entityType && l.entityId === entityId)
      if (!link) return Promise.resolve()
      return documentApi.removeLink(doc.id, link.id, token!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey })
      if (!isSupplierMode) queryClient.invalidateQueries({ queryKey: ['documents-all'] })
    },
  })

  const handleUploadDone = async (doc: Document) => {
    setUploading(false)
    if (!isSupplierMode) {
      await documentApi.addLink(doc.id, entityType, entityId, token!)
      queryClient.invalidateQueries({ queryKey: ['documents', token] })
      queryClient.invalidateQueries({ queryKey: ['documents-all'] })
    }
    queryClient.invalidateQueries({ queryKey: qKey })
  }

  const toggleMutation = useMutation({
    mutationFn: (doc: Document) =>
      supplierPortalApi.toggleDocumentPublic(supplierId!, doc.id, !doc.isPublic, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  })

  const handleOpen = async (doc: Document) => {
    setOpeningId(doc.id)
    try {
      const res = isSupplierMode
        ? await supplierPortalApi.getDocumentUrl(supplierId!, doc.id, token!)
        : isReadonlySupplier
          ? await supplierPublicApi.getDocumentUrl(readonlySupplierId!, doc.id, token!)
          : await documentApi.getUrl(doc.id, token!)
      window.open(withToken(res.data.url, token) ?? res.data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setOpeningId(null)
    }
  }

  const handleDelete = (doc: Document) => {
    setConfirmState({ message: `Supprimer "${doc.name}" ?`, onConfirm: () => deleteMutation.mutate(doc) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2 text-sm">
          <FolderOpen className="h-4 w-4" />
          {title ?? 'Documents'} ({docs.length})
        </h3>
        {!isReadonlySupplier && !uploading && (
          <Button variant="outline" size="sm" onClick={() => setUploading(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            Importer
          </Button>
        )}
      </div>

      {uploading && (
        <InlineUpload
          entityType={entityType}
          entityId={entityId}
          supplierId={supplierId}
          onDone={handleUploadDone}
          onClose={() => setUploading(false)}
        />
      )}

      {isLoading ? (
        <div className="h-12 bg-muted animate-pulse rounded-lg" />
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun document rattaché.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => {
            const Icon = mimeIcon(doc.mimeType)
            return (
              <li key={doc.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2.5 group">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{doc.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(doc.sizeBytes)}</span>
                {isSupplierMode && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full shrink-0', doc.isPublic ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>
                    {doc.isPublic ? 'Public' : 'Privé'}
                  </span>
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpen(doc)}
                    disabled={openingId === doc.id}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {openingId === doc.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <ExternalLink className="h-3.5 w-3.5" />
                    }
                  </button>
                  {isSupplierMode && (
                    <button
                      onClick={() => toggleMutation.mutate(doc)}
                      title={doc.isPublic ? 'Rendre privé' : 'Rendre public'}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {doc.isPublic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {!isReadonlySupplier && (
                    <button
                      onClick={() => handleDelete(doc)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}
