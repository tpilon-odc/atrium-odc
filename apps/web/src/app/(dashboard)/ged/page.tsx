'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, FileText, FileImage, File, Trash2, Eye, Loader2, Pencil,
  Folder as FolderIcon, FolderOpen, Tag, Plus, X, ChevronDown, ChevronRight, Share2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentApi, folderApi, tagApi, type Document, type Folder, type Tag as TagType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DocumentViewer } from '@/components/ui/DocumentViewer'
import { ShareModal } from '@/components/ui/ShareModal'

// ── Palette couleurs tags ──────────────────────────────────────────────────────

const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
  '#6B7280', '#111827',
]

// ── Helpers arborescence ───────────────────────────────────────────────────────

interface FolderNode extends Folder {
  children: FolderNode[]
}

function buildTree(folders: Folder[]): FolderNode[] {
  const map = new Map<string, FolderNode>()
  folders.forEach((f) => map.set(f.id, { ...f, children: [] }))
  const roots: FolderNode[] = []
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function flattenForSelect(nodes: FolderNode[], depth = 0): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, depth },
    ...flattenForSelect(n.children, depth + 1),
  ])
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Upload Modal ───────────────────────────────────────────────────────────────

function UploadModal({
  folders,
  tags,
  defaultFolderId,
  onClose,
  onDone,
}: {
  folders: Folder[]
  tags: TagType[]
  defaultFolderId?: string | null
  onClose: () => void
  onDone: () => void
}) {
  const { token } = useAuthStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleTag = (id: string) =>
    setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])

  const handleDrop = (files: FileList | null) => {
    if (files?.[0]) setFile(files[0])
  }

  const handleSubmit = async () => {
    if (!file || !token) return
    setError(null)
    setUploading(true)
    try {
      const res = await documentApi.upload(file, token)
      const docId = res.data.document.id

      // Appliquer le dossier et les tags en parallèle après l'upload
      await Promise.all([
        folderId ? documentApi.patch(docId, { folderId }, token) : Promise.resolve(),
        ...selectedTagIds.map((tagId) => documentApi.addTag(docId, tagId, token)),
      ])

      onDone()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Ajouter un document</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {/* Zone de dépôt */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            file && 'border-green-500 bg-green-50 dark:bg-green-950/20',
          )}
          onClick={() => !file && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleDrop(e.dataTransfer.files) }}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleDrop(e.target.files)}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
          />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
              <button onClick={(e) => { e.stopPropagation(); setFile(null) }}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Glisser ou cliquer pour sélectionner</p>
              <p className="text-xs text-muted-foreground">PDF, images, Word, Excel — max 10 Mo</p>
            </div>
          )}
        </div>

        {/* Dossier */}
        <div className="space-y-1.5">
          <Label className="text-xs">Dossier</Label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="">— Aucun dossier —</option>
            {flattenForSelect(buildTree(folders)).map((o) => (
              <option key={o.id} value={o.id}>
                {'  '.repeat(o.depth)}{o.depth > 0 ? '↳ ' : ''}{o.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    selectedTagIds.includes(tag.id)
                      ? 'border-transparent text-white'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                  style={selectedTagIds.includes(tag.id) && tag.color ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={uploading}>Annuler</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!file || uploading}>
            {uploading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Envoi…</> : <>Envoyer</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Document Modal ────────────────────────────────────────────────────────

function EditDocumentModal({
  doc,
  folders,
  tags,
  onClose,
  onDone,
}: {
  doc: Document
  folders: Folder[]
  tags: TagType[]
  onClose: () => void
  onDone: () => void
}) {
  const { token } = useAuthStore()
  const currentTagIds = doc.tags?.map(({ tag }) => tag.id) ?? []
  const [folderId, setFolderId] = useState<string>(doc.folderId ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleTag = (id: string) =>
    setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      // Mettre à jour le dossier si changé
      const newFolderId = folderId || null
      if (newFolderId !== (doc.folderId ?? null)) {
        await documentApi.patch(doc.id, { folderId: newFolderId }, token)
      }

      // Tags à ajouter
      const toAdd = selectedTagIds.filter((id) => !currentTagIds.includes(id))
      // Tags à retirer
      const toRemove = currentTagIds.filter((id) => !selectedTagIds.includes(id))

      await Promise.all([
        ...toAdd.map((tagId) => documentApi.addTag(doc.id, tagId, token)),
        ...toRemove.map((tagId) => documentApi.removeTag(doc.id, tagId, token)),
      ])

      onDone()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Modifier le document</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{doc.name}</p>
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Dossier</Label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="">— Aucun dossier —</option>
            {flattenForSelect(buildTree(folders)).map((o) => (
              <option key={o.id} value={o.id}>
                {'  '.repeat(o.depth)}{o.depth > 0 ? '↳ ' : ''}{o.name}
              </option>
            ))}
          </select>
        </div>

        {tags.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Étiquettes</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    selectedTagIds.includes(tag.id)
                      ? 'border-transparent text-white'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                  style={selectedTagIds.includes(tag.id) && tag.color ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Enregistrement…</> : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Document Row ───────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  onDelete,
  onView,
  onShare,
  onEdit,
}: {
  doc: Document
  onDelete: (id: string) => void
  onView: (doc: Document) => void
  onShare: (doc: Document) => void
  onEdit: (doc: Document) => void
}) {
  const Icon = mimeIcon(doc.mimeType)

  return (
    <div
      className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 group cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => onView(doc)}
    >
      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {formatSize(doc.sizeBytes)} · {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
          </p>
          {doc.tags?.map(({ tag }) => (
            <span
              key={tag.id}
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={tag.color ? { backgroundColor: tag.color + '22', color: tag.color } : undefined}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" onClick={() => onView(doc)} title="Visualiser">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(doc)} title="Modifier">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onShare(doc)} title="Partager">
          <Share2 className="h-3.5 w-3.5" />
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

// ── New Folder Modal ───────────────────────────────────────────────────────────

function NewFolderModal({
  folders,
  defaultParentId,
  onClose,
  onDone,
}: {
  folders: Folder[]
  defaultParentId?: string
  onClose: () => void
  onDone: () => void
}) {
  const { token } = useAuthStore()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState(defaultParentId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tree = buildTree(folders)
  const selectOptions = flattenForSelect(tree)

  const handleCreate = async () => {
    if (!name.trim() || !token) return
    setLoading(true)
    setError(null)
    try {
      await folderApi.create({ name: name.trim(), parentId: parentId || undefined }, token)
      onDone()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background border border-border rounded-xl shadow-xl w-80 mx-4 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Nouveau dossier</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nom</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mon dossier" className="text-sm" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Dossier parent</Label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="">— Aucun (racine) —</option>
            {selectOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {'  '.repeat(o.depth)}{o.depth > 0 ? '↳ ' : ''}{o.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Folder Tree Node ───────────────────────────────────────────────────────────

function FolderTreeNode({
  node,
  selectedFolderId,
  onSelect,
  onDelete,
  onCreateChild,
  depth = 0,
}: {
  node: FolderNode
  selectedFolderId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string, name: string) => void
  onCreateChild: (parentId: string) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = selectedFolderId === node.id

  return (
    <div>
      <div className={cn('group flex items-center gap-0.5', depth > 0 && 'ml-3')}>
        <button
          className="w-4 h-6 flex items-center justify-center shrink-0 text-muted-foreground"
          onClick={() => hasChildren && setExpanded((v) => !v)}
        >
          {hasChildren
            ? (expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)
            : <span className="w-3" />}
        </button>
        <button
          onClick={() => onSelect(node.id)}
          className={cn(
            'flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
            isSelected
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {isSelected
            ? <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            : <FolderIcon className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>

        <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 transition-opacity">
          <button
            title="Créer un sous-dossier"
            onClick={() => onCreateChild(node.id)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
          {!node.isSystem && (
            <button
              onClick={() => onDelete(node.id, node.name)}
              className="p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onDelete={onDelete}
              onCreateChild={onCreateChild}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function GEDPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>()
  const [docCursor, setDocCursor] = useState<string | null>(null)
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareDoc, setShareDoc] = useState<Document | null>(null)
  const [editDoc, setEditDoc] = useState<Document | null>(null)

  // ── Création de tag inline ────────────────────────────────────────────────
  const [addingTag, setAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  const createTag = useMutation({
    mutationFn: () => tagApi.create({ name: newTagName.trim(), color: newTagColor }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setNewTagName('')
      setNewTagColor(TAG_COLORS[0])
      setAddingTag(false)
    },
  })

  const deleteTag = useMutation({
    mutationFn: (id: string) => tagApi.delete(id, token!),
    onSuccess: () => {
      if (selectedTagId === deleteTag.variables) setSelectedTagId(null)
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  const { data: foldersData } = useQuery({
    queryKey: ['folders', token],
    queryFn: () => folderApi.list(token!),
    enabled: !!token,
  })
  const folders = foldersData?.data.folders ?? []

  const { data: tagsData } = useQuery({
    queryKey: ['tags', token],
    queryFn: () => tagApi.list(token!),
    enabled: !!token,
  })
  const tags = tagsData?.data.tags ?? []

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents', token, selectedFolderId, selectedTagId, docCursor],
    queryFn: () =>
      documentApi.list(token!, {
        limit: 20,
        cursor: docCursor ?? undefined,
        folderId: selectedFolderId ?? undefined,
        tagId: selectedTagId ?? undefined,
      }),
    enabled: !!token,
  })

  useEffect(() => {
    if (!docsData) return
    const incoming = docsData.data.documents
    if (!docCursor) {
      setAllDocuments(incoming)
    } else {
      setAllDocuments((prev) => {
        const ids = new Set(prev.map((d) => d.id))
        return [...prev, ...incoming.filter((d) => !ids.has(d.id))]
      })
    }
  }, [docsData]) // eslint-disable-line react-hooks/exhaustive-deps

  const documents = allDocuments

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const deleteFolder = useMutation({
    mutationFn: (id: string) => folderApi.delete(id, token!),
    onSuccess: () => {
      if (selectedFolderId === deleteFolder.variables) setSelectedFolderId(null)
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="text-2xl font-semibold">Gestion documentaire</h2>
        <p className="text-muted-foreground mt-1">Organisez et accédez à vos documents.</p>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Sidebar gauche ── */}
        <aside className="w-52 shrink-0 space-y-5">
          {/* Dossiers */}
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dossiers</span>
              <button
                onClick={() => { setNewFolderParentId(undefined); setNewFolderOpen(true) }}
                title="Nouveau dossier"
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={() => { setSelectedFolderId(null); setSelectedTagId(null); setDocCursor(null); setAllDocuments([]) }}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left mb-0.5',
                !selectedFolderId && !selectedTagId
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <File className="h-3.5 w-3.5 shrink-0" />
              Tous les documents
            </button>

            {buildTree(folders).map((node) => (
              <FolderTreeNode
                key={node.id}
                node={node}
                selectedFolderId={selectedFolderId}
                onSelect={(id) => { setSelectedFolderId(id); setSelectedTagId(null); setDocCursor(null); setAllDocuments([]) }}
                onDelete={(id, name) => confirm(`Supprimer "${name}" ?`) && deleteFolder.mutate(id)}
                onCreateChild={(parentId) => { setNewFolderParentId(parentId); setNewFolderOpen(true) }}
              />
            ))}
          </div>

          {/* Tags */}
          <div className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</span>
              <button
                onClick={() => setAddingTag((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
              >
                {addingTag ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>

            {addingTag && (
              <div className="space-y-2 pt-1">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Nom du tag…"
                  className="text-xs h-7"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && newTagName.trim() && createTag.mutate()}
                />
                <div className="flex flex-wrap gap-1">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={cn(
                        'h-5 w-5 rounded-full border-2 transition-transform',
                        newTagColor === color ? 'border-foreground scale-110' : 'border-transparent',
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs w-full"
                  onClick={() => createTag.mutate()}
                  disabled={!newTagName.trim() || createTag.isPending}
                >
                  {createTag.isPending ? 'Création…' : 'Créer'}
                </Button>
                {createTag.isError && (
                  <p className="text-xs text-destructive">{(createTag.error as Error).message}</p>
                )}
              </div>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <div key={tag.id} className="group relative">
                    <button
                      onClick={() => { setSelectedTagId(selectedTagId === tag.id ? null : tag.id); setDocCursor(null); setAllDocuments([]) }}
                      className={cn(
                        'flex items-center gap-1 pl-2 pr-5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                        selectedTagId === tag.id
                          ? 'border-transparent text-white'
                          : 'border-border text-muted-foreground hover:border-primary/40',
                      )}
                      style={selectedTagId === tag.id && tag.color ? { backgroundColor: tag.color } : undefined}
                    >
                      <Tag className="h-2.5 w-2.5 shrink-0" />
                      {tag.name}
                    </button>
                    {!tag.isSystem && (
                      <button
                        onClick={() => deleteTag.mutate(tag.id)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tags.length === 0 && !addingTag && (
              <p className="text-xs text-muted-foreground px-1">Aucun tag.</p>
            )}
          </div>
        </aside>

        {/* ── Contenu principal ── */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedFolderId
                ? folders.find((f) => f.id === selectedFolderId)?.name
                : selectedTagId
                ? tags.find((t) => t.id === selectedTagId)?.name
                : 'Tous les documents'}
              {!isLoading && <span className="ml-1.5">({documents.length})</span>}
            </p>
            <div className="flex items-center gap-2">
              {documents.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
                  <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  Partager
                </Button>
              )}
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Ajouter
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-10 text-center">
              <p className="font-medium">Aucun document</p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedFolderId || selectedTagId
                  ? 'Aucun document ne correspond à ce filtre.'
                  : 'Ajoutez votre premier document.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onView={(d) => setViewerDoc(d)}
                  onShare={(d) => setShareDoc(d)}
                  onEdit={(d) => setEditDoc(d)}
                />
              ))}
              {docsData?.data.hasMore && (
                <div className="pt-2 text-center">
                  <Button variant="outline" size="sm" onClick={() => setDocCursor(docsData.data.nextCursor)} disabled={isLoading}>
                    {isLoading ? 'Chargement…' : 'Charger plus'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {uploadOpen && (
        <UploadModal
          folders={folders}
          tags={tags}
          defaultFolderId={selectedFolderId}
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            setUploadOpen(false)
            queryClient.invalidateQueries({ queryKey: ['documents'] })
          }}
        />
      )}
      {newFolderOpen && (
        <NewFolderModal
          folders={folders}
          defaultParentId={newFolderParentId}
          onClose={() => setNewFolderOpen(false)}
          onDone={() => {
            setNewFolderOpen(false)
            queryClient.invalidateQueries({ queryKey: ['folders'] })
          }}
        />
      )}
      {viewerDoc && (
        <DocumentViewer
          document={viewerDoc}
          onClose={() => setViewerDoc(null)}
        />
      )}
      {editDoc && (
        <EditDocumentModal
          doc={editDoc}
          folders={folders}
          tags={tags}
          onClose={() => setEditDoc(null)}
          onDone={() => {
            setEditDoc(null)
            setDocCursor(null)
            setAllDocuments([])
            queryClient.invalidateQueries({ queryKey: ['documents'] })
          }}
        />
      )}
      {(shareOpen || shareDoc) && (
        <ShareModal
          title="Partager des documents"
          description="Sélectionnez les documents et les destinataires"
          entityType="document"
          entities={shareDoc
            ? [{ id: shareDoc.id, label: shareDoc.name, sublabel: shareDoc.mimeType ?? undefined }]
            : documents.map((doc) => ({ id: doc.id, label: doc.name, sublabel: doc.mimeType ?? undefined }))
          }
          recipientRoles={['chamber', 'regulator', 'platform_admin', 'cabinet_user']}
          onClose={() => { setShareOpen(false); setShareDoc(null) }}
        />
      )}
    </div>
  )
}
