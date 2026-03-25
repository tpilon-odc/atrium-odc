'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Plus, Trash2, X, Search, Share2, FileText, Eye, Upload, BookOpen, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { trainingApi, memberApi, documentApi, type CollaboratorTraining, type TrainingCatalogEntry, type CabinetMember, type Document } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShareModal } from '@/components/ui/ShareModal'
import { DocumentViewer } from '@/components/ui/DocumentViewer'

// ── Formulaire d'ajout ────────────────────────────────────────────────────────

function AddTrainingForm({ members, onClose }: { members: CabinetMember[]; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState(members[0]?.userId ?? '')
  const [trainingSearch, setTrainingSearch] = useState('')
  const [selectedTraining, setSelectedTraining] = useState<TrainingCatalogEntry | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateEnd, setDateEnd] = useState('')
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [showCatalog, setShowCatalog] = useState(false)
  const [newName, setNewName] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [certDoc, setCertDoc] = useState<Document | null>(null)
  const [certSearch, setCertSearch] = useState('')
  const [uploading, setUploading] = useState(false)

  const { data: catalogData } = useQuery({
    queryKey: ['training-catalog', token, trainingSearch],
    queryFn: () => trainingApi.listCatalog(token!, trainingSearch || undefined),
    enabled: !!token,
  })
  const catalog = catalogData?.data.catalog ?? []

  const createCatalogMutation = useMutation({
    mutationFn: (name: string) => trainingApi.createCatalogEntry({ name }, token!),
    onSuccess: (res) => {
      setSelectedTraining(res.data.entry)
      setTrainingSearch(res.data.entry.name)
      setAddingNew(false)
      setNewName('')
      queryClient.invalidateQueries({ queryKey: ['training-catalog'] })
    },
  })

  const { data: docsData } = useQuery({
    queryKey: ['docs-picker', token],
    queryFn: () => documentApi.list(token!, { limit: 50 }),
    enabled: !!token,
    staleTime: 30 * 1000,
  })
  const allDocs = docsData?.data.documents ?? []
  const filteredDocs = certSearch
    ? allDocs.filter((d) => d.name.toLowerCase().includes(certSearch.toLowerCase()))
    : allDocs

  const handleCertUpload = async (file: File) => {
    setUploading(true)
    try {
      const res = await documentApi.upload(file, token!)
      setCertDoc(res.data.document)
      queryClient.invalidateQueries({ queryKey: ['docs-picker', token] })
    } finally {
      setUploading(false)
    }
  }

  const mutation = useMutation({
    mutationFn: () => trainingApi.create({
      userId,
      trainingId: selectedTraining!.id,
      trainingDate: date,
      trainingDateEnd: dateEnd || undefined,
      hoursCompleted: hours ? Number(hours) : undefined,
      certificateDocumentId: certDoc?.id,
      notes: notes || undefined,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] })
      onClose()
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Ajouter une formation</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Collaborateur */}
      <div className="space-y-1.5">
        <Label className="text-xs">Collaborateur</Label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          {members.map((m) => {
            const fullName = [m.user.firstName, m.user.lastName].filter(Boolean).join(' ')
            return (
              <option key={m.id} value={m.userId}>
                {fullName ? `${fullName} (${m.user.email})` : m.user.email}
              </option>
            )
          })}
        </select>
      </div>

      {/* Formation (catalog search) */}
      <div className="space-y-1.5">
        <Label className="text-xs">Formation</Label>
        <div className="relative">
          <Input
            value={trainingSearch}
            onChange={(e) => { setTrainingSearch(e.target.value); setSelectedTraining(null); setShowCatalog(true) }}
            onFocus={() => setShowCatalog(true)}
            onBlur={() => setTimeout(() => setShowCatalog(false), 150)}
            placeholder="Rechercher dans le catalogue…"
            className="text-sm"
          />
          {showCatalog && (
            <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-md overflow-hidden max-h-48 overflow-y-auto">
              {catalog.filter((e) => !trainingSearch || e.name.toLowerCase().includes(trainingSearch.toLowerCase())).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                  onMouseDown={() => { setSelectedTraining(e); setTrainingSearch(e.name); setShowCatalog(false) }}
                >
                  <span className="flex-1">{e.name}</span>
                  {e.organizer && <span className="text-xs text-muted-foreground">{e.organizer}</span>}
                </button>
              ))}
              {trainingSearch && !catalog.find((e) => e.name.toLowerCase() === trainingSearch.toLowerCase()) && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent text-primary flex items-center gap-2"
                  onMouseDown={() => setAddingNew(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Créer "{trainingSearch}"
                </button>
              )}
            </div>
          )}
        </div>
        {addingNew && (
          <div className="flex gap-2 mt-1">
            <Input value={newName || trainingSearch} onChange={(e) => setNewName(e.target.value)} placeholder="Nom de la formation" className="text-sm flex-1" />
            <Button size="sm" onClick={() => createCatalogMutation.mutate(newName || trainingSearch)} disabled={createCatalogMutation.isPending}>
              Créer
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddingNew(false)}>Annuler</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Date de début</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date de fin <span className="text-muted-foreground">(optionnel)</span></Label>
          <Input type="date" value={dateEnd} min={date} onChange={(e) => setDateEnd(e.target.value)} className="text-sm" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Heures</Label>
        <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="ex: 7" className="text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire optionnel…" className="text-sm" />
      </div>

      {/* Attestation */}
      <div className="space-y-1.5">
        <Label className="text-xs">Attestation de formation</Label>
        {certDoc ? (
          <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate flex-1">{certDoc.name}</span>
            <button onClick={() => setCertDoc(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 text-sm"
                placeholder="Rechercher dans la GED…"
                value={certSearch}
                onChange={(e) => setCertSearch(e.target.value)}
              />
            </div>
            {filteredDocs.length > 0 && (
              <div className="max-h-32 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => { setCertDoc(doc); setCertSearch('') }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{doc.name}</span>
                  </button>
                ))}
              </div>
            )}
            <label className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${uploading ? 'text-muted-foreground' : 'text-primary hover:underline'}`}>
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Import en cours…' : 'Importer une attestation'}
              <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCertUpload(f) }} />
            </label>
          </div>
        )}
      </div>

      {mutation.isError && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !selectedTraining || !userId}>
          {mutation.isPending ? 'Ajout…' : 'Ajouter'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}

// ── Formulaire d'édition ──────────────────────────────────────────────────────

function EditTrainingForm({ t, onClose }: { t: CollaboratorTraining; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(t.trainingDate.slice(0, 10))
  const [dateEnd, setDateEnd] = useState(t.trainingDateEnd ? t.trainingDateEnd.slice(0, 10) : '')
  const [hours, setHours] = useState(t.hoursCompleted ? String(t.hoursCompleted) : '')
  const [notes, setNotes] = useState(t.notes ?? '')
  const [certDoc, setCertDoc] = useState<Document | null>(
    t.certificate ? { id: t.certificate.id, name: t.certificate.name, mimeType: t.certificate.mimeType ?? null, description: null, storageMode: 'hosted', sizeBytes: null, folderId: null, createdAt: '', links: [], tags: [] } : null
  )
  const [certSearch, setCertSearch] = useState('')
  const [uploading, setUploading] = useState(false)

  const { data: docsData } = useQuery({
    queryKey: ['docs-picker', token],
    queryFn: () => documentApi.list(token!, { limit: 50 }),
    enabled: !!token,
    staleTime: 30 * 1000,
  })
  const filteredDocs = (docsData?.data.documents ?? []).filter((d) =>
    !certSearch || d.name.toLowerCase().includes(certSearch.toLowerCase())
  )

  const handleCertUpload = async (file: File) => {
    setUploading(true)
    try {
      const res = await documentApi.upload(file, token!)
      setCertDoc(res.data.document)
      queryClient.invalidateQueries({ queryKey: ['docs-picker', token] })
    } finally {
      setUploading(false)
    }
  }

  const mutation = useMutation({
    mutationFn: () => trainingApi.update(t.id, {
      trainingDate: date,
      trainingDateEnd: dateEnd || null,
      hoursCompleted: hours ? Number(hours) : null,
      certificateDocumentId: certDoc?.id ?? null,
      notes: notes || null,
    }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] })
      onClose()
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Date de début</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date de fin <span className="text-muted-foreground">(optionnel)</span></Label>
          <Input type="date" value={dateEnd} min={date} onChange={(e) => setDateEnd(e.target.value)} className="text-sm" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Heures</Label>
        <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="ex: 7" className="text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire optionnel…" className="text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Attestation</Label>
        {certDoc ? (
          <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate flex-1">{certDoc.name}</span>
            <button onClick={() => setCertDoc(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 text-sm" placeholder="Rechercher dans la GED…" value={certSearch} onChange={(e) => setCertSearch(e.target.value)} />
            </div>
            {filteredDocs.length > 0 && (
              <div className="max-h-28 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {filteredDocs.map((doc) => (
                  <button key={doc.id} type="button" onClick={() => { setCertDoc(doc); setCertSearch('') }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{doc.name}</span>
                  </button>
                ))}
              </div>
            )}
            <label className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${uploading ? 'text-muted-foreground' : 'text-primary hover:underline'}`}>
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Import en cours…' : 'Importer une attestation'}
              <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCertUpload(f) }} />
            </label>
          </div>
        )}
      </div>
      {mutation.isError && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !date}>
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  )
}

// ── Ligne formation ────────────────────────────────────────────────────────────

function TrainingRow({ t, onDelete, onShare }: { t: CollaboratorTraining; onDelete: () => void; onShare: () => void }) {
  const [viewing, setViewing] = useState(false)
  const [editing, setEditing] = useState(false)
  const cert = t.certificate ?? null
  const certAsDoc: Document | null = cert
    ? { id: cert.id, name: cert.name, mimeType: cert.mimeType ?? null, description: null, storageMode: 'hosted', sizeBytes: null, folderId: null, createdAt: '', links: [], tags: [] }
    : null

  const userName = [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || t.user.email

  return (
    <>
      {viewing && certAsDoc && <DocumentViewer document={certAsDoc} onClose={() => setViewing(false)} />}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 group">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{t.training.name}</p>
            <p className="text-xs text-muted-foreground">
              {userName} · {new Date(t.trainingDate).toLocaleDateString('fr-FR')}
              {t.trainingDateEnd ? ` → ${new Date(t.trainingDateEnd).toLocaleDateString('fr-FR')}` : ''}
              {t.hoursCompleted ? ` · ${t.hoursCompleted}h` : ''}
            </p>
            {t.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{t.notes}</p>}
            {certAsDoc && (
              <button onClick={() => setViewing(true)} className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline">
                <FileText className="h-3 w-3" />
                {certAsDoc.name}
                <Eye className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {t.training.category && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
              {t.training.category}
            </span>
          )}
          <button
            onClick={() => setEditing((v) => !v)}
            title="Modifier"
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onShare}
            title="Partager"
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => confirm('Supprimer cette formation ?') && onDelete()}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {editing && (
          <div className="border-t border-border px-4 pb-4">
            <EditTrainingForm t={t} onClose={() => setEditing(false)} />
          </div>
        )}
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FormationsPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [filterUser, setFilterUser] = useState('')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [allTrainings, setAllTrainings] = useState<CollaboratorTraining[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [shareTrainingId, setShareTrainingId] = useState<string | null>(null)

  const { data: membersData } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
  })
  const members = membersData?.data.members ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['trainings', token, filterUser, cursor],
    queryFn: () => trainingApi.list(token!, { userId: filterUser || undefined, limit: 20, cursor: cursor ?? undefined }),
    enabled: !!token,
  })

  useEffect(() => {
    if (!data) return
    const incoming = data.data.trainings
    if (!cursor) {
      setAllTrainings(incoming)
    } else {
      setAllTrainings((prev) => {
        const ids = new Set(prev.map((t) => t.id))
        return [...prev, ...incoming.filter((t) => !ids.has(t.id))]
      })
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterUser = (userId: string) => {
    setCursor(null)
    setAllTrainings([])
    setFilterUser(userId)
  }

  const trainings = allTrainings

  const filtered = search
    ? trainings.filter((t) => t.training.name.toLowerCase().includes(search.toLowerCase()) || t.user.email.includes(search))
    : trainings

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trainingApi.delete(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainings'] }),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Formations</h2>
          <p className="text-muted-foreground mt-1">Suivi des formations des collaborateurs.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/formations/catalogue">
            <Button size="sm" variant="ghost">
              <BookOpen className="h-4 w-4 mr-1.5" />
              Catalogue
            </Button>
          </Link>
          {!adding && trainings.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              Partager
            </Button>
          )}
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {adding && members.length > 0 && (
        <AddTrainingForm members={members} onClose={() => setAdding(false)} />
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterUser}
          onChange={(e) => handleFilterUser(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="">Tous les collaborateurs</option>
          {members.map((m) => {
            const fullName = [m.user.firstName, m.user.lastName].filter(Boolean).join(' ')
            return (
              <option key={m.id} value={m.userId}>
                {fullName ? `${fullName} (${m.user.email})` : m.user.email}
              </option>
            )
          })}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="font-medium">Aucune formation enregistrée</p>
          <p className="text-sm text-muted-foreground mt-1">Ajoutez la première formation via le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TrainingRow key={t.id} t={t} onDelete={() => deleteMutation.mutate(t.id)} onShare={() => setShareTrainingId(t.id)} />
          ))}
          {!search && data?.data.hasMore && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" onClick={() => setCursor(data.data.nextCursor)} disabled={isLoading}>
                {isLoading ? 'Chargement…' : 'Charger plus'}
              </Button>
            </div>
          )}
        </div>
      )}

      {(shareOpen || shareTrainingId) && (
        <ShareModal
          title="Partager des formations"
          description="Sélectionnez les formations et les destinataires (chambres / régulateurs)"
          entityType="collaborator_training"
          entities={shareTrainingId
            ? trainings.filter((t) => t.id === shareTrainingId).map((t) => ({
                id: t.id,
                label: t.training.name,
                sublabel: `${t.user.email} · ${new Date(t.trainingDate).toLocaleDateString('fr-FR')}${t.hoursCompleted ? ` · ${t.hoursCompleted}h` : ''}`,
              }))
            : trainings.map((t) => ({
                id: t.id,
                label: t.training.name,
                sublabel: `${t.user.email} · ${new Date(t.trainingDate).toLocaleDateString('fr-FR')}${t.hoursCompleted ? ` · ${t.hoursCompleted}h` : ''}`,
              }))
          }
          onClose={() => { setShareOpen(false); setShareTrainingId(null) }}
        />
      )}
    </div>
  )
}
