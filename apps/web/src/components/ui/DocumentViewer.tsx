'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Download, FileText, File, ExternalLink, Loader2 } from 'lucide-react'
import { documentApi, type Document } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

function isImage(mime: string | null): boolean {
  return !!mime?.startsWith('image/')
}

function isPdf(mime: string | null): boolean {
  return mime === 'application/pdf'
}

function isText(mime: string | null): boolean {
  return !!mime?.startsWith('text/')
}

function formatSize(bytes: string | null): string {
  if (!bytes) return ''
  const n = Number(bytes)
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

interface DocumentViewerProps {
  document: Document
  onClose: () => void
}

export function DocumentViewer({ document: doc, onClose }: DocumentViewerProps) {
  const { token } = useAuthStore()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!token || doc.storageMode !== 'hosted') {
      setLoading(false)
      return
    }
    documentApi.getUrl(doc.id, token)
      .then((res) => setUrl(res.data.url))
      .catch(() => setError('Impossible de charger le document.'))
      .finally(() => setLoading(false))
  }, [doc.id, doc.storageMode, token])

  const canPreview = isImage(doc.mimeType) || isPdf(doc.mimeType) || isText(doc.mimeType)

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Visionneuse — ${doc.name}`}
      className="fixed inset-0 z-[9990] flex flex-col bg-black/80"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-background/95 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{doc.name}</p>
          {(doc.mimeType || doc.sizeBytes) && (
            <p className="text-xs text-muted-foreground">
              {doc.mimeType ?? 'Type inconnu'}{doc.sizeBytes ? ` · ${formatSize(doc.sizeBytes)}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {url && (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir
              </a>
              <a
                href={url}
                download={doc.name}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </a>
            </>
          )}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="ml-1 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Corps */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
        {loading && (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        )}

        {!loading && error && (
          <div className="text-center space-y-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && url && isImage(doc.mimeType) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={doc.name}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
        )}

        {!loading && !error && url && isPdf(doc.mimeType) && (
          <iframe
            src={url}
            title={doc.name}
            className="w-full h-full rounded-lg"
            style={{ minHeight: 0 }}
          />
        )}

        {!loading && !error && url && isText(doc.mimeType) && (
          <TextPreview url={url} />
        )}

        {!loading && !error && url && !canPreview && (
          <div className="text-center space-y-4 bg-card border border-border rounded-xl p-8">
            <File className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">{doc.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Aperçu non disponible pour ce type de fichier ({doc.mimeType ?? 'type inconnu'})
              </p>
            </div>
            <a href={url} download={doc.name}>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
            </a>
          </div>
        )}

        {!loading && !error && doc.storageMode === 'external' && (
          <div className="text-center space-y-4 bg-card border border-border rounded-xl p-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">{doc.name}</p>
              <p className="text-sm text-muted-foreground mt-1">Document externe — ouvrir via le lien d&apos;origine</p>
            </div>
            {doc.links?.[0] && (
              <a href={doc.links[0].label ?? '#'} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir le document
                </Button>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Prévisualisation texte brut
function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent('Impossible de charger le fichier texte.'))
  }, [url])

  if (!content) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />

  return (
    <pre className="w-full h-full overflow-auto bg-card border border-border rounded-lg p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-words">
      {content}
    </pre>
  )
}
