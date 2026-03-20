'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, ExternalLink, X, Plus, Loader2, Upload, FileText, FileImage, File } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentApi, type Document } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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

// ── Document picker (search existing + detach) ────────────────────────────────

function DocumentPicker({
  entityType,
  entityId,
  linkedDocIds,
  onPick,
  onClose,
}: {
  entityType: EntityType
  entityId: string
  linkedDocIds: Set<string>
  onPick: (doc: Document) => void
  onClose: () => void
}) {
  const { token } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['documents-all', token],
    queryFn: () => documentApi.list(token!, { limit: 100 }),
    enabled: !!token,
  })

  const results = (data?.data.documents ?? []).filter((d) => {
    if (linkedDocIds.has(d.id)) return false
    if (!search) return true
    return d.name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="border border-border rounded-lg bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Rattacher un document existant</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        placeholder="Rechercher…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
        className="text-sm"
      />
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun document disponible.</p>
      ) : (
        <ul className="max-h-52 overflow-y-auto space-y-1">
          {results.map((doc) => {
            const Icon = mimeIcon(doc.mimeType)
            return (
              <li key={doc.id}>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
                  onClick={() => onPick(doc)}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{doc.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatSize(doc.sizeBytes)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Upload inline ─────────────────────────────────────────────────────────────

function InlineUpload({
  entityType,
  entityId,
  onDone,
  onClose,
}: {
  entityType: EntityType
  entityId: string
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
      const res = await documentApi.upload(files[0], token!)
      onDone(res.data.document)
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

export function EntityDocuments({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [picker, setPicker] = useState<'existing' | 'upload' | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const qKey = ['documents', token, entityType, entityId]

  const { data, isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => documentApi.list(token!, { limit: 100, entityType, entityId }),
    enabled: !!token,
  })

  const docs = data?.data.documents ?? []
  const linkedDocIds = new Set(docs.map((d) => d.id))

  const linkMutation = useMutation({
    mutationFn: (doc: Document) => {
      const existingLink = doc.links.find(
        (l) => l.entityType === entityType && l.entityId === entityId
      )
      if (existingLink) return Promise.resolve()
      return documentApi.addLink(doc.id, entityType, entityId, token!)
    },
    onSuccess: () => {
      setPicker(null)
      queryClient.invalidateQueries({ queryKey: qKey })
      queryClient.invalidateQueries({ queryKey: ['documents-all'] })
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (doc: Document) => {
      const link = doc.links.find((l) => l.entityType === entityType && l.entityId === entityId)
      if (!link) return Promise.resolve()
      return documentApi.removeLink(doc.id, link.id, token!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey })
      queryClient.invalidateQueries({ queryKey: ['documents-all'] })
    },
  })

  const handleUploadDone = async (doc: Document) => {
    setPicker(null)
    await documentApi.addLink(doc.id, entityType, entityId, token!)
    queryClient.invalidateQueries({ queryKey: qKey })
    queryClient.invalidateQueries({ queryKey: ['documents', token] })
    queryClient.invalidateQueries({ queryKey: ['documents-all'] })
  }

  const handleOpen = async (doc: Document) => {
    setOpeningId(doc.id)
    try {
      const res = await documentApi.getUrl(doc.id, token!)
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2 text-sm">
          <FolderOpen className="h-4 w-4" />
          Documents ({docs.length})
        </h3>
        {picker === null && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPicker('existing')}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Rattacher
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPicker('upload')}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Importer
            </Button>
          </div>
        )}
      </div>

      {picker === 'existing' && (
        <DocumentPicker
          entityType={entityType}
          entityId={entityId}
          linkedDocIds={linkedDocIds}
          onPick={(doc) => linkMutation.mutate(doc)}
          onClose={() => setPicker(null)}
        />
      )}

      {picker === 'upload' && (
        <InlineUpload
          entityType={entityType}
          entityId={entityId}
          onDone={handleUploadDone}
          onClose={() => setPicker(null)}
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
                  <button
                    onClick={() => unlinkMutation.mutate(doc)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
