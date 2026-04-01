'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Plus, Trash2, X, Search, Share2, FileText, Eye, Upload, BookOpen, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { trainingApi, memberApi, documentApi, type CollaboratorTraining, type TrainingCatalogEntry, type TrainingCategory, type CabinetMember, type Document } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShareModal } from '@/components/ui/ShareModal'
import { DocumentViewer } from '@/components/ui/DocumentViewer'

// ── Formulaire d'ajout ────────────────────────────────────────────────────────

function CategoryHoursInput({ categories, value, onChange }: {
  categories: TrainingCategory[]
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}) {
  const usedIds = Object.keys(value)
  const available = categories.filter((c) => !usedIds.includes(c.id))
  const lines = usedIds.filter((id) => categories.some((c) => c.id === id))

  function addLine(catId: string) {
    onChange({ ...value, [catId]: '' })
  }

  function removeLine(catId: string) {
    const next = { ...value }
    delete next[catId]
    onChange(next)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Heures par catégorie</Label>
      <div className="space-y-1.5">
        {lines.map((catId) => {
          const cat = categories.find((c) => c.id === catId)!
          return (
            <div key={catId} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1 truncate">{cat.name}</span>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={value[catId]}
                onChange={(e) => onChange({ ...value, [catId]: e.target.value })}
                className="w-20 text-sm text-right border border-input rounded px-2 py-1 bg-background"
              />
              <span className="text-xs text-muted-foreground w-3">h</span>
              <button type="button" onClick={() => removeLine(catId)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) addLine(e.target.value) }}
          className="text-xs border border-dashed border-input rounded-md px-2 py-1.5 bg-background text-muted-foreground w-full"
        >
          <option value="">+ Ajouter une catégorie…</option>
          {available.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// memberKey: "user:{userId}" pour les membres avec compte, "member:{memberId}" pour les externes
function parseMemberKey(key: string): { userId?: string; memberId?: string } {
  if (key.startsWith('user:')) return { userId: key.slice(5) }
  if (key.startsWith('member:')) return { memberId: key.slice(7) }
  return {}
}

function memberToKey(m: CabinetMember): string {
  return m.userId ? `user:${m.userId}` : `member:${m.id}`
}

function AddTrainingForm({ members, onClose }: { members: CabinetMember[]; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const firstMember = members[0]
  const [memberKey, setMemberKey] = useState(firstMember ? memberToKey(firstMember) : '')
  const [trainingSearch, setTrainingSearch] = useState('')
  const [selectedTraining, setSelectedTraining] = useState<TrainingCatalogEntry | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateEnd, setDateEnd] = useState('')
  const [categoryHoursMap, setCategoryHoursMap] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [showCatalog, setShowCatalog] = useState(false)
  const [newName, setNewName] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [certDoc, setCertDoc] = useState<Document | null>(null)
  const [certSearch, setCertSearch] = useState('')
  const [uploading, setUploading] = useState(false)

  const { data: categoriesData } = useQuery({
    queryKey: ['training-categories'],
    queryFn: () => trainingApi.listCategories(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
  const categories = categoriesData?.data.categories ?? []

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
      const res = await documentApi.upload(file, token!, 'training')
      setCertDoc(res.data.document)
      queryClient.invalidateQueries({ queryKey: ['docs-picker', token] })
    } finally {
      setUploading(false)
    }
  }

  const categoryHours = Object.entries(categoryHoursMap)
    .filter(([, v]) => v && Number(v) > 0)
    .map(([categoryId, hours]) => ({ categoryId, hours: Number(hours) }))

  const mutation = useMutation({
    mutationFn: () => trainingApi.create({
      ...parseMemberKey(memberKey),
      trainingId: selectedTraining!.id,
      trainingDate: date,
      trainingDateEnd: dateEnd || undefined,
      categoryHours: categoryHours.length ? categoryHours : undefined,
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
          value={memberKey}
          onChange={(e) => setMemberKey(e.target.value)}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          {members.map((m) => {
            const key = memberToKey(m)
            const label = m.user
              ? ([m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email)
              : ([m.externalFirstName, m.externalLastName].filter(Boolean).join(' ') || m.externalEmail || 'Membre externe')
            return <option key={m.id} value={key}>{label}</option>
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
            <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
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

      <CategoryHoursInput categories={categories} value={categoryHoursMap} onChange={setCategoryHoursMap} />

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
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !selectedTraining || !memberKey}>
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
  const [notes, setNotes] = useState(t.notes ?? '')

  const { data: categoriesData } = useQuery({
    queryKey: ['training-categories'],
    queryFn: () => trainingApi.listCategories(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
  const categories = categoriesData?.data.categories ?? []

  const [categoryHoursMap, setCategoryHoursMap] = useState<Record<string, string>>(() =>
    Object.fromEntries((t.categoryHours ?? []).map((ch) => [ch.categoryId, String(ch.hours)]))
  )
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
      const res = await documentApi.upload(file, token!, 'training')
      setCertDoc(res.data.document)
      queryClient.invalidateQueries({ queryKey: ['docs-picker', token] })
    } finally {
      setUploading(false)
    }
  }

  const categoryHours = Object.entries(categoryHoursMap)
    .filter(([, v]) => v && Number(v) > 0)
    .map(([categoryId, hours]) => ({ categoryId, hours: Number(hours) }))

  const mutation = useMutation({
    mutationFn: () => trainingApi.update(t.id, {
      trainingDate: date,
      trainingDateEnd: dateEnd || null,
      categoryHours,
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
      <CategoryHoursInput categories={categories} value={categoryHoursMap} onChange={setCategoryHoursMap} />

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

  const userName = t.user
    ? ([t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || t.user.email)
    : ([t.member?.externalFirstName, t.member?.externalLastName].filter(Boolean).join(' ') || t.member?.externalEmail || 'Membre externe')

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
            </p>
            {t.categoryHours?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {t.categoryHours.map((ch) => (
                  <span key={ch.categoryId} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {ch.category.name} · {ch.hours}h
                  </span>
                ))}
              </div>
            )}
            {t.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{t.notes}</p>}
            {certAsDoc && (
              <button onClick={() => setViewing(true)} className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline">
                <FileText className="h-3 w-3" />
                {certAsDoc.name}
                <Eye className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
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
  const [filterYear, setFilterYear] = useState('')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [allTrainings, setAllTrainings] = useState<CollaboratorTraining[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [shareTrainingId, setShareTrainingId] = useState<string | null>(null)
  const [showCounter, setShowCounter] = useState(false)

  const { data: membersData } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
  })
  const members = membersData?.data.members ?? []

  const { data: categoriesData } = useQuery({
    queryKey: ['training-categories'],
    queryFn: () => trainingApi.listCategories(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
  const allCategories = categoriesData?.data.categories ?? []

  // filterUser est une memberKey ("user:uuid" ou "member:uuid")
  // Pour l'API, on n'envoie userId que si c'est un user avec compte
  const filterUserId = filterUser.startsWith('user:') ? filterUser.slice(5) : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['trainings', token, filterUser, cursor],
    queryFn: () => trainingApi.list(token!, { userId: filterUserId, limit: 20, cursor: cursor ?? undefined }),
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

  const handleFilterUser = (key: string) => {
    setCursor(null)
    setAllTrainings([])
    setFilterUser(key)
  }

  const trainings = allTrainings

  // Années disponibles tirées des formations chargées
  const availableYears = [...new Set(
    trainings.map((t) => new Date(t.trainingDate).getFullYear())
  )].sort((a, b) => b - a)

  const filtered = trainings.filter((t) => {
    if (filterUser) {
      const key = t.userId ? `user:${t.userId}` : t.memberId ? `member:${t.memberId}` : ''
      if (key !== filterUser) return false
    }
    const name = t.user ? [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || t.user.email : [t.member?.externalFirstName, t.member?.externalLastName].filter(Boolean).join(' ') || t.member?.externalEmail || ''
    if (search && !t.training.name.toLowerCase().includes(search.toLowerCase()) && !name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterYear && new Date(t.trainingDate).getFullYear() !== Number(filterYear)) return false
    return true
  })

  // Compteur heures par (memberKey, year, category)
  type HourKey = `${string}__${number}__${string}`
  const hoursTotals = new Map<HourKey, number>()
  for (const t of trainings) {
    const tKey = t.userId ? `user:${t.userId}` : t.memberId ? `member:${t.memberId}` : null
    if (!tKey) continue
    const year = new Date(t.trainingDate).getFullYear()
    for (const ch of t.categoryHours ?? []) {
      const key: HourKey = `${tKey}__${year}__${ch.categoryId}`
      hoursTotals.set(key, (hoursTotals.get(key) ?? 0) + ch.hours)
    }
  }

  // Filtrage du compteur selon filterUser / filterYear
  type CounterRow = { memberKey: string; userName: string; year: number; categoryId: string; categoryName: string; hours: number; requiredHours: number | null; requiredHoursPeriod: number | null }
  const counterRows: CounterRow[] = []
  for (const [key, hours] of hoursTotals) {
    const sep1 = key.indexOf('__')
    const sep2 = key.lastIndexOf('__')
    const mKey = key.slice(0, sep1)
    const year = Number(key.slice(sep1 + 2, sep2))
    const categoryId = key.slice(sep2 + 2)
    if (filterUser && mKey !== filterUser) continue
    if (filterYear && year !== Number(filterYear)) continue
    const m = members.find((mb) => memberToKey(mb) === mKey)
    const userName = m
      ? (m.user
          ? ([m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email || mKey)
          : ([m.externalFirstName, m.externalLastName].filter(Boolean).join(' ') || m.externalEmail || 'Membre externe'))
      : mKey
    const cat = allCategories.find((c) => c.id === categoryId)
    let categoryName = cat?.name ?? categoryId
    if (!cat) {
      // fallback: chercher dans les trainings chargés
      outer: for (const t of trainings) {
        for (const ch of t.categoryHours ?? []) {
          if (ch.categoryId === categoryId) { categoryName = ch.category.name; break outer }
        }
      }
    }
    counterRows.push({ memberKey: mKey, userName, year, categoryId, categoryName, hours, requiredHours: cat?.requiredHours ?? null, requiredHoursPeriod: cat?.requiredHoursPeriod ?? null })
  }
  counterRows.sort((a, b) => b.year - a.year || a.userName.localeCompare(b.userName) || a.categoryName.localeCompare(b.categoryName))

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trainingApi.delete(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainings'] }),
  })

  return (
    <div className="space-y-6 max-w-7xl">
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
            const key = memberToKey(m)
            const label = m.user
              ? ([m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email)
              : ([m.externalFirstName, m.externalLastName].filter(Boolean).join(' ') || m.externalEmail || 'Membre externe')
            return <option key={m.id} value={key}>{label}</option>
          })}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="">Toutes les années</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Compteur heures par catégorie — accordéon */}
      {counterRows.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCounter((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-medium">Récapitulatif des heures par catégorie</span>
            {showCounter ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showCounter && (
            <div className="border-t border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Collaborateur</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Année</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Catégorie</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Heures</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Quota annuel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {counterRows.map((row) => (
                    <tr key={`${row.memberKey}-${row.year}-${row.categoryId}`} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-sm">{row.userName}</td>
                      <td className="px-4 py-2 text-sm">{row.year}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">{row.categoryName}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{row.hours}h</td>
                      <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                        {row.requiredHours != null
                          ? `${row.requiredHours}h / ${row.requiredHoursPeriod === 1 ? 'an' : `${row.requiredHoursPeriod} ans`}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
                sublabel: `${t.user?.email ?? t.member?.externalEmail ?? ''} · ${new Date(t.trainingDate).toLocaleDateString('fr-FR')}${t.hoursCompleted ? ` · ${t.hoursCompleted}h` : ''}`,
              }))
            : trainings.map((t) => ({
                id: t.id,
                label: t.training.name,
                sublabel: `${t.user?.email ?? t.member?.externalEmail ?? ''} · ${new Date(t.trainingDate).toLocaleDateString('fr-FR')}${t.hoursCompleted ? ` · ${t.hoursCompleted}h` : ''}`,
              }))
          }
          onClose={() => { setShareOpen(false); setShareTrainingId(null) }}
        />
      )}
    </div>
  )
}
