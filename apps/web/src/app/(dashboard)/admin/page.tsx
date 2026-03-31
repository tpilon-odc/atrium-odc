'use client'

import Link from 'next/link'
import { Settings, ShieldAlert, MessagesSquare, Users, Layers, ShieldCheck, Wrench, GraduationCap, ChevronRight } from 'lucide-react'

const groups = [
  {
    title: 'Plateforme',
    items: [
      {
        href: '/admin/utilisateurs',
        icon: Users,
        label: 'Utilisateurs',
        description: 'Gérez les comptes et les rôles des utilisateurs de la plateforme.',
      },
      {
        href: '/admin/clusters',
        icon: MessagesSquare,
        label: 'Clusters',
        description: 'Modérez les espaces de discussion entre cabinets.',
      },
    ],
  },
  {
    title: 'Paramétrage métier',
    items: [
      {
        href: '/admin/produits',
        icon: Layers,
        label: 'Catégories de produits',
        description: 'Définissez la taxonomie produits utilisée dans les fiches client.',
      },
      {
        href: '/admin/gouvernance',
        icon: ShieldCheck,
        label: 'Axes de gouvernance',
        description: 'Configurez les axes de gouvernance affichés dans les dossiers clients.',
      },
      {
        href: '/admin/outils',
        icon: Wrench,
        label: "Catégories d'outils",
        description: 'Gérez les catégories disponibles dans la bibliothèque d\'outils.',
      },
      {
        href: '/admin/formations',
        icon: GraduationCap,
        label: 'Catégories de formations',
        description: 'Paramétrez les catégories réglementaires et leurs quotas d\'heures.',
      },
    ],
  },
  {
    title: 'Conformité',
    items: [
      {
        href: '/admin/conformite',
        icon: ShieldAlert,
        label: 'Référentiel conformité',
        description: 'Administrez les phases, sections et questions du référentiel de conformité.',
      },
    ],
  },
]

export default function AdminHomePage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Paramétrage de la plateforme et des référentiels.</p>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3 px-1">
            {group.title}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start gap-4 bg-card border border-border rounded-lg px-5 py-4 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 shrink-0 mt-0.5 transition-colors" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
