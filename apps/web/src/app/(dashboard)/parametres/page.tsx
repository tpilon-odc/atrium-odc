'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { ShieldCheck, User, CalendarDays, Copy, Eye, EyeOff, RefreshCw, Download, Loader2, PackageOpen, Database, AlertTriangle, CheckCircle2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { cabinetApi, storageConfigApi, userApi, eventApi, exportJobApi, gdprApi, consentApi, type StorageConfig, type ExportJob, type GdprRequest, type ConsentRecord } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, withToken } from '@/lib/utils'

const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS S3',
  gdrive: 'Google Drive',
  sharepoint: 'SharePoint',
  other: 'Autre',
}

// ── Section profil ────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})
type ProfileForm = z.infer<typeof profileSchema>

function ProfileSection() {
  const { token, user, setAuth } = useAuthStore()
  const [editing, setEditing] = useState(false)

  const { register, handleSubmit, reset } = useForm<ProfileForm>({
    values: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' },
  })

  const mutation = useMutation({
    mutationFn: (d: ProfileForm) => userApi.updateProfile(d, token!),
    onSuccess: (res) => {
      const updated = res.data.user
      setAuth(token!, { ...user!, firstName: updated.firstName, lastName: updated.lastName })
      setEditing(false)
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Mon profil
        </h3>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prénom</Label>
              <Input {...register('firstName')} placeholder="Jean" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom</Label>
              <Input {...register('lastName')} placeholder="Dupont" className="text-sm" />
            </div>
          </div>
          {mutation.isError && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { reset(); setEditing(false) }}>Annuler</Button>
          </div>
        </form>
      ) : (
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nom complet</dt>
            <dd>{user?.firstName || user?.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : <span className="text-muted-foreground italic">Non renseigné</span>}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

// ── Section configs de stockage externe ───────────────────────────────────────

function StorageSection() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [provider, setProvider] = useState('aws')
  const [label, setLabel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  const { data } = useQuery({
    queryKey: ['storage-configs', token],
    queryFn: () => storageConfigApi.list(token!),
    enabled: !!token,
  })
  const configs = data?.data.configs ?? []

  const createMutation = useMutation({
    mutationFn: () => storageConfigApi.create({ provider, label, baseUrl }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-configs'] })
      setAdding(false)
      setLabel('')
      setBaseUrl('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storageConfigApi.delete(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-configs'] }),
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Stockage externe
        </h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Configurez des accès vers vos espaces de stockage existants (GDrive, SharePoint…) pour référencer des documents externes.
      </p>

      {adding && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Nouvelle config</span>
            <button onClick={() => setAdding(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fournisseur</Label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                {Object.entries(PROVIDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Libellé</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: GDrive Cabinet" className="text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL de base</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://drive.google.com/..." className="text-sm" />
          </div>
          {createMutation.isError && <p className="text-xs text-destructive">{(createMutation.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !label || !baseUrl}>
              {createMutation.isPending ? 'Création…' : 'Créer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {configs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune configuration de stockage externe.</p>
      ) : (
        <ul className="space-y-2">
          {configs.map((c) => (
            <li key={c.id} className="flex items-center gap-3 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{PROVIDER_LABELS[c.provider] ?? c.provider} · {c.baseUrl}</p>
              </div>
              <button
                onClick={() => confirm(`Supprimer "${c.label}" ?`) && deleteMutation.mutate(c.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Section synchronisation ICS ───────────────────────────────────────────────

function IcsSection() {
  const { token, cabinet } = useAuthStore()
  const queryClient = useQueryClient()
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data } = useQuery({
    queryKey: ['cabinet-ics', token],
    queryFn: () => cabinetApi.getMe(token!),
    enabled: !!token,
  })
  const cabinetData = data?.data.cabinet as any
  const icsUrl = cabinetData && cabinet
    ? eventApi.getIcsUrl(cabinet.id, cabinetData.icsToken)
    : null

  const regenMutation = useMutation({
    mutationFn: () => eventApi.regenerateToken(token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet-ics'] }),
  })

  function handleCopy() {
    if (!icsUrl) return
    navigator.clipboard.writeText(icsUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [platform, setPlatform] = useState<'google' | 'outlook' | 'apple'>('google')

  const instructions = {
    google: 'Ouvrir Google Calendar → "Autres agendas" → "+" → "Via une URL" → coller le lien → "Ajouter un agenda"',
    outlook: 'Ouvrir Outlook → "Ajouter un agenda" → "S\'abonner depuis le web" → coller le lien → "Importer"',
    apple: 'Ouvrir l\'app Calendrier → "Fichier" → "Nouvel abonnement de calendrier…" → coller le lien',
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <CalendarDays className="h-4 w-4" />
        Synchronisation de l'agenda
      </h3>

      <p className="text-xs text-muted-foreground">
        Abonnez-vous à votre agenda depuis Google Calendar, Outlook ou Apple Calendar via ce lien ICS.
      </p>

      <div className="space-y-2">
        <Label className="text-xs">Lien ICS</Label>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 relative">
            <Input
              readOnly
              value={visible && icsUrl ? icsUrl : (icsUrl ? '••••••••••••••••••••••••••••••' : 'Chargement…')}
              className="text-xs font-mono pr-10"
            />
            <button
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={handleCopy} disabled={!icsUrl}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            {copied ? 'Copié !' : 'Copier'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 text-destructive hover:bg-destructive/10"
            onClick={() => confirm('Régénérer le lien ? L\'ancien lien sera invalidé.') && regenMutation.mutate()}
            disabled={regenMutation.isPending}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', regenMutation.isPending && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <Label className="text-xs">Instructions d'abonnement</Label>
        <div className="flex gap-1">
          {(['google', 'outlook', 'apple'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                platform === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {p === 'google' ? 'Google' : p === 'outlook' ? 'Outlook' : 'Apple'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
          {instructions[platform]}
        </p>
      </div>
    </div>
  )
}

// ── Section export données ────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  DONE: 'Terminé',
  FAILED: 'Erreur',
  EXPIRED: 'Expiré',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-muted text-muted-foreground',
}

function JobRow({ job, downloadUrl, token }: { job: ExportJob; downloadUrl?: string | null; token?: string | null }) {
  return (
    <li className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          Export du {new Date(job.createdAt).toLocaleString('fr-FR')}
        </p>
        {job.completedAt && (
          <p className="text-xs text-muted-foreground">
            Terminé le {new Date(job.completedAt).toLocaleString('fr-FR')}
          </p>
        )}
        {job.error && <p className="text-xs text-destructive mt-0.5">{job.error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[job.status] ?? 'bg-muted text-muted-foreground')}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
        {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {job.status === 'DONE' && downloadUrl && (
          <a href={withToken(downloadUrl, token) ?? downloadUrl} download className="text-primary hover:underline text-xs flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            Télécharger
          </a>
        )}
      </div>
    </li>
  )
}

function ExportSection() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['export-jobs', token],
    queryFn: () => exportJobApi.list(token!),
    enabled: !!token,
    refetchInterval: (query) => {
      const jobs = query.state.data?.data.jobs ?? []
      return jobs.some((j) => j.status === 'PENDING' || j.status === 'PROCESSING') ? 5000 : false
    },
  })
  const jobs = data?.data.jobs ?? []
  const hasPending = jobs.some((j) => j.status === 'PENDING' || j.status === 'PROCESSING')

  // Récupère les URLs de téléchargement pour les jobs DONE
  const doneJobs = jobs.filter((j) => j.status === 'DONE')
  const { data: urlsData } = useQuery({
    queryKey: ['export-job-urls', token, doneJobs.map((j) => j.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(doneJobs.map((j) => exportJobApi.get(j.id, token!)))
      return Object.fromEntries(results.map((r) => [r.data.job.id, r.data.downloadUrl]))
    },
    enabled: !!token && doneJobs.length > 0,
  })

  const createMutation = useMutation({
    mutationFn: () => exportJobApi.create(token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['export-jobs'] }),
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <PackageOpen className="h-4 w-4" />
          Export des données
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || hasPending}
        >
          {createMutation.isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Demande…</>
          ) : (
            <><Download className="h-3.5 w-3.5 mr-1.5" />Lancer un export</>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Exportez l'ensemble des données de votre cabinet (documents, contacts, fournisseurs, conformité, formations) en JSON compressé. Le fichier est disponible pendant 7 jours.
      </p>

      {createMutation.isError && (
        <p className="text-xs text-destructive">{(createMutation.error as Error).message}</p>
      )}

      {isLoading ? (
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun export.</p>
      ) : (
        <ul className="space-y-0">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} downloadUrl={urlsData?.[job.id]} token={token} />
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Section Mes données (RGPD) ────────────────────────────────────────────────

const GDPR_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  DONE: 'Traitée',
  REJECTED: 'Refusée',
}

const GDPR_STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600 bg-amber-50 border-amber-200',
  PROCESSING: 'text-blue-600 bg-blue-50 border-blue-200',
  DONE: 'text-green-600 bg-green-50 border-green-200',
  REJECTED: 'text-red-600 bg-red-50 border-red-200',
}

function MesDonneesSection() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [confirmType, setConfirmType] = useState<'ACCESS' | 'ERASURE' | null>(null)
  const [message, setMessage] = useState('')

  const { data: requestsData } = useQuery({
    queryKey: ['gdpr-requests'],
    queryFn: () => gdprApi.listRequests(token!),
    enabled: !!token,
  })

  const { data: consentData } = useQuery({
    queryKey: ['consent-records'],
    queryFn: () => consentApi.list(token!),
    enabled: !!token,
  })

  const requests = (requestsData?.data ?? []) as GdprRequest[]
  const consents = (consentData?.data ?? []) as ConsentRecord[]

  const hasPendingAccess = requests.some((r) => r.type === 'ACCESS' && ['PENDING', 'PROCESSING'].includes(r.status))
  const hasPendingErasure = requests.some((r) => r.type === 'ERASURE' && ['PENDING', 'PROCESSING'].includes(r.status))

  const createMutation = useMutation({
    mutationFn: ({ type, msg }: { type: 'ACCESS' | 'ERASURE'; msg: string }) =>
      gdprApi.createRequest(type, msg || undefined, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] })
      setConfirmType(null)
      setMessage('')
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <h3 className="font-medium flex items-center gap-2">
        <Database className="h-4 w-4" />
        Mes données
      </h3>

      {/* Droits RGPD */}
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground text-xs">
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès à vos données et d&apos;un droit à l&apos;effacement.
        </p>

        {/* Droit d'accès */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Droit d&apos;accès</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recevez une archive ZIP complète de toutes les données de votre cabinet (délai légal : 30 jours).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={hasPendingAccess}
              onClick={() => setConfirmType('ACCESS')}
              className="shrink-0"
            >
              {hasPendingAccess ? 'En cours...' : 'Demander'}
            </Button>
          </div>
        </div>

        {/* Droit à l'effacement */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <p className="font-medium text-sm text-destructive">Droit à l&apos;effacement</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suppression définitive de toutes vos données privées. Action irréversible.
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              disabled={hasPendingErasure}
              onClick={() => setConfirmType('ERASURE')}
              className="shrink-0"
            >
              {hasPendingErasure ? 'En cours...' : 'Demander'}
            </Button>
          </div>
        </div>
      </div>

      {/* Historique des demandes */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demandes en cours</p>
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-md border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{req.type === 'ACCESS' ? 'Accès' : 'Effacement'}</span>
                  <span className="text-muted-foreground">{new Date(req.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-medium', GDPR_STATUS_COLORS[req.status])}>
                  {GDPR_STATUS_LABELS[req.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique consentements */}
      {consents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consentements</p>
          <div className="space-y-1.5">
            {consents.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <span>CGU version <strong className="text-foreground">{c.version}</strong> acceptée le {new Date(c.acceptedAt).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {confirmType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h4 className="font-semibold">
              {confirmType === 'ACCESS' ? 'Demande d\'accès aux données' : 'Demande d\'effacement des données'}
            </h4>
            {confirmType === 'ERASURE' && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Cette action est <strong>irréversible</strong>. Toutes vos données privées seront définitivement supprimées.</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message (optionnel)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={confirmType === 'ACCESS' ? 'Précisez votre demande si nécessaire...' : 'Motif de la demande...'}
                rows={3}
                className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {createMutation.isError && (
              <p className="text-xs text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setConfirmType(null); setMessage('') }}>
                Annuler
              </Button>
              <Button
                size="sm"
                variant={confirmType === 'ERASURE' ? 'destructive' : 'default'}
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate({ type: confirmType, msg: message })}
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Confirmer la demande
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ParametresPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-semibold">Paramètres</h2>
        <p className="text-muted-foreground mt-1">Votre profil, configurations techniques et données personnelles.</p>
      </div>
      <ProfileSection />
      <StorageSection />
      <IcsSection />
      <ExportSection />
      <MesDonneesSection />
    </div>
  )
}
