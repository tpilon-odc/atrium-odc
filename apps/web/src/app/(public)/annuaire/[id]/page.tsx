'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  MapPin,
  Globe,
  Calendar,
  Users,
  ExternalLink,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react'
import { publicCabinetApi, type CabinetMemberAnonymous } from '@/lib/api'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  member: 'Membre',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  member: 'bg-muted text-muted-foreground',
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="h-8 w-8 rounded-full object-cover" />
  }
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
      {initials}
    </div>
  )
}

function memberDisplayName(m: CabinetMemberAnonymous): string {
  if (!m.user) {
    return `${m.externalFirstName ?? ''} ${m.externalLastName ?? ''}`.trim() || 'Membre externe'
  }
  const { civility, firstName, lastName } = m.user
  return [civility, firstName, lastName].filter(Boolean).join(' ') || 'Membre'
}

export default function AnnuaireCabinetPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-cabinet', id],
    queryFn: () => publicCabinetApi.getById(id),
    staleTime: 60_000,
  })

  const cabinet = data?.data.cabinet

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Chargement…
      </div>
    )
  }

  if (isError || !cabinet) {
    return (
      <div className="space-y-4">
        <Link
          href="/annuaire"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;annuaire
        </Link>
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Cabinet introuvable.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/annuaire"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l&apos;annuaire
      </Link>

      {/* En-tête */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl border border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
            {cabinet.logoUrl ? (
              <img
                src={cabinet.logoUrl}
                alt={cabinet.name}
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <Building2 className="h-7 w-7 text-primary/60" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{cabinet.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              {cabinet.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {cabinet.city}
                </span>
              )}
              {cabinet.website && (
                <a
                  href={cabinet.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {cabinet.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Membre depuis {format(new Date(cabinet.createdAt), 'MMMM yyyy', { locale: fr })}
              </span>
            </div>
          </div>
        </div>

        {cabinet.description && (
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed border-t border-border pt-4">
            {cabinet.description}
          </p>
        )}

        {cabinet.oriasNumber && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border pt-4">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              ORIAS : <span className="font-medium text-foreground">{cabinet.oriasNumber}</span>
            </span>
          </div>
        )}
      </div>

      {/* Membres */}
      {cabinet.members.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-medium flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Équipe ({cabinet.members.length} membre{cabinet.members.length > 1 ? 's' : ''})
          </h2>
          <ul className="space-y-2">
            {cabinet.members.map((m) => {
              const name = memberDisplayName(m)
              return (
                <li key={m.id} className="flex items-center gap-3">
                  <Avatar name={name} url={m.user?.avatarUrl ?? null} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    {m.externalTitle && (
                      <p className="text-xs text-muted-foreground truncate">{m.externalTitle}</p>
                    )}
                  </div>
                  {m.user && (
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        ROLE_COLORS[m.role] ?? ROLE_COLORS.member
                      )}
                    >
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
