'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { chamberApi, type ChamberOwnPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { OwnPostCard } from '@/components/chamber/PostCard'
import { PostEditor } from '@/components/chamber/PostEditor'
import { cn } from '@/lib/utils'

const DEFAULT_CATEGORY_ID = '00000000-0000-0000-0000-000000000001'

type FormState = {
  title: string
  content: string
  categoryId: string
  status: 'draft' | 'published'
}

export default function CommunicationsPage() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editingPost, setEditingPost] = useState<ChamberOwnPost | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState<FormState>({ title: '', content: '', categoryId: DEFAULT_CATEGORY_ID, status: 'draft' })

  const { data, isLoading } = useQuery({
    queryKey: ['chamber-posts', token],
    queryFn: () => chamberApi.getPosts(token!),
    enabled: !!token,
  })

  const { data: catData } = useQuery({
    queryKey: ['chamber-categories', token],
    queryFn: () => chamberApi.getCategories(token!),
    enabled: !!token,
  })
  const categories = catData?.data.categories ?? []

  const createMutation = useMutation({
    mutationFn: (d: FormState) => chamberApi.createPost(d, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamber-posts'] })
      setIsCreating(false)
      setForm({ title: '', content: '', categoryId: DEFAULT_CATEGORY_ID, status: 'draft' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (d: { id: string } & Partial<FormState>) => {
      const { id, ...rest } = d
      return chamberApi.updatePost(id, rest, token!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamber-posts'] })
      setEditingPost(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chamberApi.deletePost(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chamber-posts'] }),
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => chamberApi.updatePost(id, { status: 'published' }, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chamber-posts'] }),
  })

  const posts = data?.data.posts ?? []
  const published = posts.filter((p) => p.status === 'published')
  const drafts = posts.filter((p) => p.status === 'draft')

  function openEdit(post: ChamberOwnPost) {
    setEditingPost(post)
    setForm({ title: post.title, content: post.content, categoryId: post.categoryId, status: post.status })
    setIsCreating(false)
  }

  function openCreate() {
    setIsCreating(true)
    setEditingPost(null)
    setForm({ title: '', content: '', categoryId: DEFAULT_CATEGORY_ID, status: 'draft' })
  }

  const showForm = isCreating || !!editingPost

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Communications</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Publiez des communications à destination de tous les cabinets.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle communication
          </Button>
        )}
      </div>

      {/* Formulaire création / édition */}
      {showForm && (
        <div className="border rounded-lg p-5 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{editingPost ? 'Modifier la communication' : 'Nouvelle communication'}</h3>
            <button
              onClick={() => { setIsCreating(false); setEditingPost(null) }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

          {/* Catégorie */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Catégorie <span className="text-destructive">*</span></label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setForm((f) => ({ ...f, categoryId: cat.id }))}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                    form.categoryId === cat.id
                      ? 'border-transparent text-white'
                      : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                  )}
                  style={form.categoryId === cat.id ? { backgroundColor: cat.color } : {}}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: form.categoryId === cat.id ? 'rgba(255,255,255,0.7)' : cat.color }}
                  />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Titre</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Titre de la communication"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Contenu</label>
            <PostEditor
              content={form.content}
              onChange={(html) => setForm((f) => ({ ...f, content: html }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (editingPost) {
                  updateMutation.mutate({ id: editingPost.id, ...form, status: 'draft' })
                } else {
                  createMutation.mutate({ ...form, status: 'draft' })
                }
              }}
            >
              Enregistrer en brouillon
            </Button>
            <Button
              size="sm"
              disabled={!form.title.trim() || !form.content.trim() || !form.categoryId || createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (editingPost) {
                  updateMutation.mutate({ id: editingPost.id, ...form, status: 'published' })
                } else {
                  createMutation.mutate({ ...form, status: 'published' })
                }
              }}
            >
              Publier
            </Button>
          </div>
        </div>
      )}

      {/* Brouillons */}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Brouillons</h3>
          <div className="space-y-2">
            {drafts.map((post) => (
              <OwnPostCard
                key={post.id}
                post={post}
                onEdit={openEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onPublish={(id) => publishMutation.mutate(id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Publiés */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Publiées ({published.length})
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : published.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg">
            Aucune communication publiée pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-2">
            {published.map((post) => (
              <OwnPostCard
                key={post.id}
                post={post}
                onEdit={openEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onPublish={(id) => publishMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
