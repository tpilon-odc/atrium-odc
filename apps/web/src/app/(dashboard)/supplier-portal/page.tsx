'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Building2, BadgeCheck, Pencil } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supplierPortalApi } from '@/lib/api'
import { Button } from '@/components/ui/button'

export default function SupplierPortalPage() {
  const { token } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-portal-me', token],
    queryFn: () => supplierPortalApi.getMySuppliers(token!),
    enabled: !!token,
  })

  const suppliers = data?.data.suppliers ?? []

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Mes fiches fournisseur</h2>
          <p className="text-muted-foreground mt-1">Gérez vos fiches visibles par la communauté CGP.</p>
        </div>
        <Link href="/supplier-portal/nouveau">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle fiche
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      {!isLoading && suppliers.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Aucune fiche pour le moment</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre première fiche fournisseur.</p>
          <Link href="/supplier-portal/nouveau">
            <Button size="sm" className="mt-4">
              <Plus className="h-4 w-4 mr-1.5" />
              Créer une fiche
            </Button>
          </Link>
        </div>
      )}

      {!isLoading && suppliers.length > 0 && (
        <div className="space-y-3">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                {s.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{s.name}</p>
                  {s.isVerified && <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />}
                </div>
                {s.category && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{s.category}</span>
                )}
                {s.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{s.description}</p>
                )}
              </div>
              <Link href={`/supplier-portal/${s.id}`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Gérer
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
