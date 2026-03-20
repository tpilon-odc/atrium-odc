'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, FileImage, File, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentApi, type Document } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatSize(bytes: string | null): string {
  if (!bytes) return '—'
  const n = Number(bytes)
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

function mimeIcon(mime: string | null) {
  if (!mime) return File
  if (mime.startsWith('image/')) return FileImage
  if (mime === 'application/pdf' || mime.startsWith('text/')) return FileText
  return File
}

function DocumentRow({ doc, onDelete }: { doc: Document; onDelete: (id: string) => void }) {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const Icon = mimeIcon(doc.mimeType)

  const handleOpen = async () => {
    setLoading(true)
    try {
      const res = await documentApi.getUrl(doc.id, token!)
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3 group">
      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">
          {doc.mimeType ?? 'Inconnu'} · {formatSize(doc.sizeBytes)} ·{' '}
          {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={handleOpen} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => confirm('Supprimer ce document ?') && onDelete(doc.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const { token } = useAuthStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      await documentApi.upload(file, token!)
      onUploaded()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return
    upload(files[0])
  }

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Envoi en cours…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Glisser un fichier ici ou cliquer pour sélectionner</p>
          <p className="text-xs text-muted-foreground">PDF, images, Word, Excel — max 10 Mo</p>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default function GEDPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [cursor, setCursor] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<Document[]>([])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['documents', token, cursor],
    queryFn: () => documentApi.list(token!, { limit: 20, cursor: cursor ?? undefined }),
    enabled: !!token,
  })

  useEffect(() => {
    if (!data) return
    const incoming = data.data.documents
    if (!cursor) {
      setAllItems(incoming)
    } else {
      setAllItems((prev) => {
        const ids = new Set(prev.map((d) => d.id))
        return [...prev, ...incoming.filter((d) => !ids.has(d.id))]
      })
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id, token!),
    onSuccess: () => {
      setCursor(null)
      setAllItems([])
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const handleUploaded = () => {
    setCursor(null)
    setAllItems([])
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold">Gestion documentaire</h2>
        <p className="text-muted-foreground mt-1">Stockez et accédez à vos documents.</p>
      </div>

      <UploadZone onUploaded={handleUploaded} />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="font-medium">Aucun document</p>
          <p className="text-sm text-muted-foreground mt-1">Importez votre premier document ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allItems.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
          {data?.data.hasMore && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" onClick={() => setCursor(data.data.nextCursor)} disabled={isFetching}>
                {isFetching ? 'Chargement…' : 'Charger plus'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
