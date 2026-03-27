'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierPortalApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NouvellesFichePage() {
  const { token } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const mutation = useMutation({
    mutationFn: () => supplierPortalApi.createSupplier(
      { name, description: description || undefined, category: category || undefined, website: website || undefined, email: email || undefined, phone: phone || undefined },
      token!
    ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-portal-me'] })
      router.push(`/supplier-portal/${res.data.supplier.id}`)
    },
  })

  return (
    <div className="space-y-6 max-w-xl">
      <Link href="/supplier-portal" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Mes fiches
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Nouvelle fiche fournisseur</h2>
        <p className="text-muted-foreground mt-1">Cette fiche sera visible par tous les cabinets CGP de la plateforme.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Nom de la société <span className="text-destructive">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : AXA Investissement" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Catégorie</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex : Assurance, Immobilier, SCPI…" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez votre société, vos produits et services…"
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Site web</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email de contact</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@société.fr" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Téléphone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+33 1 23 45 67 89" />
        </div>

        {mutation.isError && (
          <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Création…' : 'Créer la fiche'}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>Annuler</Button>
        </div>
      </div>
    </div>
  )
}
