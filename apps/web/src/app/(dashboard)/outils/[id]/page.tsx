'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronLeft, BadgeCheck, ExternalLink, Star, Pencil } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { toolApi } from '@/lib/api'
import { ReviewSection } from '@/components/ReviewSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function CabinetSection({ toolId }: { toolId: string }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')

  const { data } = useQuery({
    queryKey: ['tool', toolId, token],
    queryFn: () => toolApi.get(toolId, token!),
    enabled: !!token,
  })

  const cabinetData = data?.data.cabinetData

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof toolApi.upsertCabinet>[1]) =>
      toolApi.upsertCabinet(toolId, body, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool', toolId, token] })
      setEditing(false)
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Données privées (votre cabinet)</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mutation.mutate({ isActive: !cabinetData?.isActive })}
            className={cn(
              'text-xs px-3 py-1 rounded-full font-medium transition-colors',
              cabinetData?.isActive
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {cabinetData?.isActive ? 'Utilisé' : 'Non utilisé'}
          </button>
          <Button variant="ghost" size="sm" onClick={() => {
            setNote(cabinetData?.privateNote ?? '')
            setTags(cabinetData?.internalTags?.join(', ') ?? '')
            setEditing(true)
          }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Note interne</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note visible uniquement par votre cabinet…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tags internes (séparés par virgule)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex: CRM, reporting" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate({ privateNote: note || null, internalTags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [] })} disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {cabinetData?.privateNote
            ? <p className="text-muted-foreground">{cabinetData.privateNote}</p>
            : <p className="text-xs text-muted-foreground italic">Aucune note interne.</p>}
          {cabinetData?.internalTags?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {cabinetData.internalTags.map((tag) => (
                <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function OutilDetailPage({ params }: { params: { id: string } }) {
  const { token, cabinet } = useAuthStore()
  const queryClient = useQueryClient()
  const { id } = params
  const [avgRating, setAvgRating] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tool', id, token],
    queryFn: () => toolApi.get(id, token!),
    enabled: !!token,
  })

  const tool = data?.data.tool

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/outils" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Retour aux outils
      </Link>

      {isLoading && (
        <div className="space-y-4">
          <div className="h-24 bg-muted animate-pulse rounded-lg" />
          <div className="h-40 bg-muted animate-pulse rounded-lg" />
        </div>
      )}

      {!isLoading && !tool && <p className="text-muted-foreground">Outil introuvable.</p>}

      {tool && (
        <>
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {tool.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">{tool.name}</h2>
                    {tool.isVerified && <BadgeCheck className="h-5 w-5 text-blue-500" />}
                    {avgRating !== null && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{avgRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {tool.category && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{tool.category}</span>
                  )}
                </div>
              </div>
              <Link href={`/outils/${id}/modifier`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Modifier
                </Button>
              </Link>
            </div>

            {tool.description && <p className="text-sm text-muted-foreground">{tool.description}</p>}

            {tool.url && (
              <a href={tool.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline w-fit">
                <ExternalLink className="h-4 w-4" />
                Accéder à l&apos;outil
              </a>
            )}

            <p className="text-xs text-muted-foreground">
              Ajouté le {new Date(tool.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>

          <CabinetSection toolId={id} />

          <ReviewSection entityType="tool" entityId={id} token={token!} cabinetId={cabinet?.id ?? ''} onAvgChange={setAvgRating} />
        </>
      )}
    </div>
  )
}
