'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  LayoutDashboard,
  ShieldCheck,
  Building2,
  Package,
  Wrench,
  Users,
  FolderOpen,
  GraduationCap,
  Share2,
  Settings,
  LogOut,
  ShieldAlert,
  Bell,
  ChevronRight,
  MoreHorizontal,
  User,
  X,
  AlertTriangle,
  AlertCircle,
  Sun,
  Moon,
  CalendarDays,
  MessagesSquare,
  ClipboardList,
  BookUser,
  Layers,
  Newspaper,
  Radio,
  FileText,
} from 'lucide-react'
import { cn, withToken } from '@/lib/utils'

import { useAuthStore } from '@/stores/auth'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { authApi, memberApi, complianceApi, notificationApi, channelApi, consentApi, cabinetApi, chamberApi, displayName, type AppNotification, type CabinetMember } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { usePushNotifications } from '@/hooks/usePushNotifications'

// ── Nav groups (desktop sidebar) ───────────────────────────────────────────

type NavItem = { href: string; label: string; icon: React.ElementType; showProgress?: boolean; permission?: keyof CabinetMember }

function buildNavGroups(member: CabinetMember | null, hasCabinet: boolean, globalRole?: string) {
  // Navigation dédiée pour les chambres
  if (globalRole === 'chamber') {
    return [
      {
        label: 'Espace Chambre',
        items: [
          { href: '/communications', label: 'Communications', icon: Radio },
          { href: '/partage', label: 'Données partagées', icon: Share2 },
          { href: '/conformite-partagee', label: 'Conformité partagée', icon: ShieldCheck },
        ] as NavItem[],
      },
    ]
  }

  // Navigation dédiée pour les fournisseurs
  if (globalRole === 'supplier') {
    return [
      {
        label: 'Mes fiches',
        items: [
          { href: '/supplier-portal', label: 'Mes fiches fournisseur', icon: Building2 },
          { href: '/supplier-portal/nouveau', label: 'Nouvelle fiche', icon: Package },
        ] as NavItem[],
      },
    ]
  }

  const canAll = !member || member.role === 'owner' || member.role === 'admin'
  const allow = (perm: keyof CabinetMember) => canAll || !!member?.[perm]

  return [
    {
      label: 'Mon Cabinet',
      items: ([
        { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
        hasCabinet && { href: '/cabinet', label: 'Mon Cabinet', icon: Building2 },
        hasCabinet && { href: '/conformite', label: 'Conformité', icon: ShieldCheck, showProgress: true },
        hasCabinet && canAll && { href: '/pca', label: 'PCA', icon: ClipboardList },
        { href: '/formations', label: 'Formations', icon: GraduationCap },
        { href: '/actualites', label: 'Actualités', icon: Newspaper },
        { href: '/parametres', label: 'Paramètres', icon: Settings },
      ] as (NavItem | false)[]).filter(Boolean) as NavItem[],
    },
    {
      label: 'Mon Activité',
      items: ([
        allow('canManageContacts') && { href: '/crm', label: 'CRM', icon: Users },
        { href: '/agenda', label: 'Agenda', icon: CalendarDays },
        { href: '/ged', label: 'Documents', icon: FolderOpen },
        { href: '/modeles-documents', label: 'Modèles de documents', icon: FileText },
        { href: '/partage', label: 'Partage', icon: Share2 },
      ] as (NavItem | false)[]).filter(Boolean) as NavItem[],
    },
    {
      label: 'Communauté',
      items: ([
        allow('canManageSuppliers') && { href: '/fournisseurs', label: 'Fournisseurs', icon: Building2 },
        allow('canManageProducts') && { href: '/produits', label: 'Produits', icon: Package },
        { href: '/outils', label: 'Outils', icon: Wrench },
        { href: '/cabinets', label: 'Annuaire', icon: BookUser },
        { href: '/clusters', label: 'Clusters', icon: MessagesSquare },
      ] as (NavItem | false)[]).filter(Boolean) as NavItem[],
    },
  ]
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  cabinet: 'Mon Cabinet',
  'ged-regles': 'Règles de classement GED',
  conformite: 'Conformité',
  fournisseurs: 'Fournisseurs',
  produits: 'Produits',
  gouvernance: 'Tableau de gouvernance',
  outils: 'Outils',
  crm: 'CRM',
  agenda: 'Agenda',
  ged: 'Documents',
  formations: 'Formations',
  partage: 'Partage',
  parametres: 'Paramètres',
  pca: 'PCA',
  cabinets: 'Annuaire des cabinets',
  clusters: 'Clusters',
  'supplier-portal': 'Mes fiches fournisseur',
  notifications: 'Notifications',
  actualites: 'Actualités',
  communications: 'Communications',
  'modeles-documents': 'Modèles de documents',
  'contacts-partages': 'Contacts partagés',
  profil: 'Mon profil',
  admin: 'Admin',
  nouveau: 'Nouveau',
  modifier: 'Modifier',
}

const UUID_RE = /^[0-9a-f-]{36}$/i

function getBreadcrumbs(pathname: string) {
  const crumbs: { label: string; href: string }[] = []
  let path = ''
  for (const seg of pathname.split('/').filter(Boolean)) {
    path += `/${seg}`
    if (UUID_RE.test(seg)) continue
    const label = SEGMENT_LABELS[seg]
    if (label) crumbs.push({ label, href: path })
  }
  return crumbs
}

// ── Theme toggle — Littoral · Jour ↔ Littoral · Nuit ───────────────────────

function ThemeToggle() {
  const [isNuit, setIsNuit] = useState(false)

  useEffect(() => {
    setIsNuit(document.documentElement.dataset.theme === 'nuit')
  }, [])

  const toggle = () => {
    const next = !isNuit
    document.documentElement.dataset.theme = next ? 'nuit' : ''
    setIsNuit(next)
  }

  return (
    <button
      onClick={toggle}
      style={{
        width: 24, height: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none',
        background: 'transparent',
        color: 'var(--gaia-faint)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      title={isNuit ? 'Passer en jour' : 'Passer en nuit'}
    >
      {isNuit
        ? <Sun style={{ width: 14, height: 14 }} />
        : <Moon style={{ width: 14, height: 14 }} />
      }
    </button>
  )
}

// ── Avatar initiales ────────────────────────────────────────────────────────

function UserAvatar({ name, avatarUrl, token }: { name: string; avatarUrl?: string | null; token?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={withToken(avatarUrl, token) ?? avatarUrl}
        alt={name}
        className="h-7 w-7 rounded-full object-cover shrink-0"
      />
    )
  }
  const initials = name.includes(' ')
    ? name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-[11px] font-semibold flex items-center justify-center shrink-0 select-none">
      {initials}
    </div>
  )
}

// ── Progress bar conformité ─────────────────────────────────────────────────

function ComplianceProgressBar({ token }: { token: string }) {
  const { data } = useQuery({
    queryKey: ['compliance-progress-sidebar', token],
    queryFn: () => complianceApi.getProgress(token),
    staleTime: 5 * 60 * 1000,
  })

  const pct = data?.data.globalProgress ?? null
  if (pct === null) return null

  const barColor = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-danger'

  return (
    <div className="ml-[26px] mt-1 pr-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">{pct}%</span>
      </div>
    </div>
  )
}

// ── Chamber feed unread count ────────────────────────────────────────────────

function useChamberUnread(token: string | null) {
  return useQuery({
    queryKey: ['chamber-feed-unread', token],
    queryFn: async () => {
      const res = await chamberApi.getFeed(token!)
      return res.data.posts.filter((p) => !p.isRead).length
    },
    enabled: !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

// ── Notifications bell ───────────────────────────────────────────────────────

function useNotifications(token: string | null) {
  return useQuery({
    queryKey: ['notifications', token],
    queryFn: () => notificationApi.list(token!),
    enabled: !!token,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}

function NotificationBell({ token }: { token: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data } = useNotifications(token)
  const notifications = data?.data.notifications ?? []
  const unreadCount = data?.data.unreadCount ?? 0

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleNotifClick(n: AppNotification) {
    markRead.mutate(n.id)
    setOpen(false)
    if (n.type === 'cluster_reply') {
      try {
        const { data } = await channelApi.get(n.entityId, token!)
        router.push(`/clusters/${data.channel.clusterId}/channels/${n.entityId}`)
      } catch {
        router.push('/clusters')
      }
      return
    }
    if (n.type === 'chamber_post_published') {
      router.push('/actualites')
      return
    }
    if (n.type === 'share_received') {
      router.push('/partage')
      return
    }
    const target = n.entityType === 'compliance_phase'
      ? `/conformite/${n.entityId}`
      : '/conformite'
    router.push(target)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-danger rounded-full text-[10px] text-white font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-card-md z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-primary hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune notification</p>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-accent transition-colors flex gap-3',
                    !n.isRead && 'bg-primary/5'
                  )}
                >
                  {n.type === 'cluster_reply'
                    ? <MessagesSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    : n.type === 'chamber_post_published'
                    ? <Newspaper className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    : n.type === 'compliance_expired'
                    ? <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                    : n.type === 'share_received'
                    ? <Share2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline"
            >
              Voir toutes les notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Palette sidebar (via variables CSS — s'adapte au mode nuit automatiquement) ─

const S = {
  paper:    'var(--gaia-paper)',
  card:     'var(--gaia-card)',
  ink:      'var(--gaia-ink)',
  muted:    'var(--gaia-muted)',
  faint:    'var(--gaia-faint)',
  rule:     'var(--gaia-rule)',
  ruleSoft: 'var(--gaia-rule-soft)',
  layer1:   'var(--gaia-layer-1)',
  layer2:   'var(--gaia-layer-2)',
  layer3:   'var(--gaia-layer-3)',
  accent:   'var(--gaia-accent)',
  accent2:  'var(--gaia-accent-2)',
  onAccent: 'var(--gaia-on-accent)',
}

// ── NavLink helper ──────────────────────────────────────────────────────────

function SidebarLink({
  href,
  label,
  icon: Icon,
  isActive,
  badge,
}: {
  href: string
  label: string
  icon: React.ElementType
  isActive: boolean
  badge?: number
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 18px',
        margin: '1px 8px',
        borderRadius: 10,
        background: isActive ? S.accent : 'transparent',
        color: isActive ? S.onAccent : S.muted,
        fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
        fontSize: 13.5,
        fontWeight: isActive ? 600 : 400,
        textDecoration: 'none',
        transition: 'background 0.15s',
      }}
    >
      <Icon style={{ width: 15, height: 15, flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          height: 16, minWidth: 16, padding: '0 4px',
          borderRadius: 999,
          background: isActive ? S.onAccent : S.accent,
          color: isActive ? S.accent : S.onAccent,
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, user, cabinet, hydrate, logout, setCabinet } = useAuthStore()
  const [ready, setReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { data: notifData } = useNotifications(token)
  const alertCount = notifData?.data.unreadCount ?? 0
  const breadcrumbs = getBreadcrumbs(pathname)
  usePushNotifications(token)

  const { data: membersData } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })

  useQuery({
    queryKey: ['cabinet-me', token],
    queryFn: async () => {
      const res = await cabinetApi.getMe(token!)
      setCabinet({ id: res.data.cabinet.id, name: res.data.cabinet.name })
      return res
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
  const currentMember = membersData?.data.members.find((m) => m.userId === user?.id) ?? null
  // hasCabinet = l'utilisateur est membre d'un cabinet (quel que soit son globalRole)
  const hasCabinet = currentMember !== null
  const globalRole = user?.globalRole
  const navGroups = buildNavGroups(currentMember, hasCabinet, globalRole)
  const [drawerSection, setDrawerSection] = useState<string | null>(null)
  const { data: chamberUnread } = useChamberUnread(globalRole !== 'chamber' ? token : null)

  useEffect(() => {
    hydrate()

    const { token: accessToken, refreshToken, user } = useAuthStore.getState()

    if (!accessToken) {
      router.replace('/login')
      return
    }

    const supabase = createSupabaseClient()

    const init = async () => {
      // Restaure la session Supabase depuis les tokens stockés
      if (refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }

      // Vérifie si le token est encore valide — retry une fois si erreur réseau
      let session = null
      let error = null
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await supabase.auth.getSession()
        error = result.error
        session = result.data.session
        if (session) break
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000))
      }

      if (error || !session) {
        // Tentative de refresh explicite avant abandon
        const { data: refreshData } = await supabase.auth.refreshSession({
          refresh_token: refreshToken ?? '',
        })
        if (!refreshData.session) {
          useAuthStore.getState().logout()
          router.replace('/login?reason=session_expired')
          return
        }
        session = refreshData.session
      }

      // Met à jour le store si le token a été renouvelé
      if (user && session.access_token !== accessToken) {
        useAuthStore.getState().setAuth(session.access_token, user, session.refresh_token)
      }

      setReady(true)
    }

    init()

    // Écoute les renouvellements automatiques (TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        const { user } = useAuthStore.getState()
        if (user) {
          useAuthStore.getState().setAuth(session.access_token, user, session.refresh_token)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [hydrate, router])

  // Vérifie le consentement CGU — redirige vers /consent si version non acceptée
  useEffect(() => {
    if (!token || !ready) return
    const cguVersion = process.env.NEXT_PUBLIC_CGU_VERSION ?? '1.0'
    consentApi.list(token).then((res) => {
      const records = Array.isArray(res.data) ? res.data : []
      const hasConsent = records.some((r: { version: string }) => r.version === cguVersion)
      if (!hasConsent) {
        router.replace('/consent')
      }
    }).catch(() => {
      // En cas d'erreur réseau on laisse passer — l'API bloquera si nécessaire
    })
  }, [token, ready, router])

  // Ferme le drawer si navigation
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    if (token) {
      try { await authApi.logout(token) } catch { /* ignore */ }
    }
    logout()
    router.push('/login')
  }

  if (!ready) return null

  return (
    <div className="flex h-screen overflow-x-hidden" style={{ background: 'linear-gradient(180deg, var(--gaia-bg) 0%, var(--gaia-bg-deep) 100%)' }}>

      {/* ── Icon rail (tablet 768–1024px) ────────────────────────────────── */}
      <aside className="hidden md:flex lg:hidden flex-col shrink-0 items-center py-5 gap-2" style={{
        width: 64,
        background: S.paper,
        borderRight: `1px solid ${S.rule}`,
      }}>
        {/* Logo anneau seul */}
        <Link href="/dashboard" style={{ textDecoration: 'none', marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `conic-gradient(${S.layer1} 0deg 120deg, ${S.accent} 120deg 240deg, ${S.layer2} 240deg 360deg)`,
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', inset: 9, borderRadius: '50%', background: S.paper }} />
          </div>
        </Link>

        {/* Items nav — icône + tooltip natif */}
        {navGroups.flatMap((g) => g.items).slice(0, 8).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const conformitePct = item.href === '/conformite' && token
            ? null  // affiché via ComplianceProgressBar, pas ici
            : null
          return (
            <Link key={item.href} href={item.href} title={item.label} style={{ textDecoration: 'none' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: isActive ? S.accent : 'transparent',
                color: isActive ? S.onAccent : S.muted,
                display: 'grid', placeItems: 'center',
                cursor: 'pointer',
                position: 'relative',
              }}>
                <Icon style={{ width: 18, height: 18 }} />
              </div>
            </Link>
          )
        })}

        <div style={{ flex: 1 }} />

        {/* Avatar utilisateur en bas */}
        <button onClick={handleLogout} title="Déconnexion" style={{
          width: 36, height: 36, borderRadius: '50%',
          background: S.accent2, color: S.onAccent,
          display: 'grid', placeItems: 'center',
          border: 'none', cursor: 'pointer',
          fontFamily: "'Fraunces', ui-serif, Georgia, serif",
          fontSize: 13, fontWeight: 500,
        }}>
          {user ? displayName(user).split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'U'}
        </button>
      </aside>

      {/* ── Sidebar (desktop ≥1024px) ─────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col shrink-0" style={{
        width: 234,
        background: S.paper,
        borderRight: `1px solid ${S.rule}`,
      }}>
        {/* Logo myGaïa */}
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '24px 22px 20px',
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: `1px solid ${S.rule}`,
          }}>
            {/* Anneau tricolore */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: `conic-gradient(${S.layer1} 0deg 120deg, ${S.accent} 120deg 240deg, ${S.layer2} 240deg 360deg)`,
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: S.paper }} />
            </div>
            <div>
              <div style={{ lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <span style={{
                  fontFamily: "'Inter Tight', system-ui, sans-serif",
                  fontSize: 13, fontWeight: 400, color: S.muted, fontStyle: 'italic',
                }}>my</span>
                <span style={{
                  fontFamily: "'Fraunces', ui-serif, Georgia, serif",
                  fontSize: 22, fontWeight: 400, color: S.ink, letterSpacing: '-0.01em',
                }}>Gaïa</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Nav groupée */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                letterSpacing: '0.18em', color: S.faint,
                marginBottom: 10, paddingLeft: 18,
              }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = item.href === '/actualites' ? (chamberUnread ?? 0) : undefined
                return (
                  <div key={item.href}>
                    <SidebarLink
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      isActive={isActive}
                      badge={badge}
                    />
                    {'showProgress' in item && item.showProgress && token && (
                      <ComplianceProgressBar token={token} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {user?.globalRole === 'platform_admin' && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                letterSpacing: '0.18em', color: S.faint,
                marginBottom: 10, paddingLeft: 18,
              }}>
                Administration
              </div>
              <SidebarLink
                href="/admin"
                label="Administration"
                icon={Settings}
                isActive={pathname.startsWith('/admin')}
              />
            </div>
          )}
        </nav>

        {/* User card */}
        <div style={{ padding: '8px 12px 16px' }}>
          <div style={{
            background: S.card,
            border: `1px solid ${S.rule}`,
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {/* Avatar initiales */}
            {user?.avatarUrl ? (
              <img
                src={withToken(user.avatarUrl, token) ?? user.avatarUrl}
                alt={displayName(user)}
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: S.accent2, color: S.onAccent,
                display: 'grid', placeItems: 'center',
                fontFamily: "'Fraunces', ui-serif, Georgia, serif",
                fontSize: 13, fontWeight: 500,
              }}>
                {user ? displayName(user).split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'U'}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href="/profil" style={{ textDecoration: 'none' }}>
                <div style={{
                  fontFamily: "'Inter Tight', system-ui, sans-serif",
                  fontSize: 12.5, color: S.ink, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user ? displayName(user) : '…'}
                </div>
                <div style={{
                  fontFamily: "'Inter Tight', system-ui, sans-serif",
                  fontSize: 11, color: S.faint,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.email}
                </div>
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                title="Déconnexion"
                style={{
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, border: 'none', background: 'transparent',
                  color: S.faint, cursor: 'pointer',
                }}
              >
                <LogOut style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Zone principale ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header mobile — sticky top bar (<768px) */}
        <header className="lg:hidden h-14 flex items-center justify-between px-4 shrink-0" style={{
          background: S.paper,
          borderBottom: `1px solid ${S.rule}`,
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: `conic-gradient(${S.layer1} 0deg 120deg, ${S.accent} 120deg 240deg, ${S.layer2} 240deg 360deg)`,
                  position: 'relative',
                }}>
                  <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: S.paper }} />
                </div>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <span style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 13, fontWeight: 400, color: S.muted, fontStyle: 'italic' }}>my</span>
                  <span style={{ fontFamily: "'Fraunces', ui-serif, Georgia, serif", fontSize: 18, fontWeight: 400, color: S.ink, letterSpacing: '-0.01em' }}>Gaïa</span>
                </span>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {token && <NotificationBell token={token} />}
            <UserAvatar name={user ? displayName(user) : 'U'} avatarUrl={user?.avatarUrl} token={token} />
            <ThemeToggle />
          </div>
        </header>

        {/* Header desktop (≥1024px) */}
        <header className="hidden lg:flex h-12 items-center px-6 gap-4 shrink-0" style={{ background: S.paper, borderBottom: `1px solid ${S.rule}` }}>
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
            {/* Breadcrumb uniquement en profondeur (≥2 segments) pour éviter la redondance avec le titre de page */}
            {breadcrumbs.length > 1 && breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                {i > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                )}
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-foreground truncate">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-muted-foreground hover:text-foreground transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
          {token && <NotificationBell token={token} />}
        </header>

        {/* Contenu — pb 20 pour laisser place bottom nav mobile */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6" style={{ background: 'transparent' }}>{children}</main>
      </div>

      {/* ── Bottom nav (mobile) — groupes nav + Compte ───────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40" style={{
        background: S.paper,
        borderTop: `1px solid ${S.rule}`,
      }}>
        <div className="flex">
          {navGroups.map((group) => {
            const isActive = group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
            const Icon = group.items[0]?.icon ?? MoreHorizontal
            return (
              <button
                key={group.label}
                onClick={() => { setDrawerSection(group.label); setDrawerOpen(true) }}
                style={{
                  flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px 10px', minHeight: 44,
                  color: isActive ? S.accent : S.muted,
                  fontFamily: "'Inter Tight', system-ui, sans-serif",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? S.accent : 'transparent' }} />
                <Icon style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{group.label}</span>
              </button>
            )
          })}
          {/* Compte */}
          <button
            onClick={() => { setDrawerSection(null); setDrawerOpen(true) }}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px 10px', minHeight: 44,
              color: drawerOpen && drawerSection === null ? S.accent : S.muted,
              fontFamily: "'Inter Tight', system-ui, sans-serif",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: drawerOpen && drawerSection === null ? S.accent : 'transparent' }} />
            <User style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Compte</span>
          </button>
        </div>
      </nav>

      {/* ── Drawer mobile — slide-in depuis la gauche ────────────────────── */}
      {drawerOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex flex-col overflow-hidden"
            style={{
              background: S.paper,
              borderTop: `1px solid ${S.rule}`,
              borderRadius: '20px 20px 0 0',
              maxHeight: '70vh',
              animation: 'gaiaSlideUp 220ms ease-out',
            }}
          >
            {/* En-tête */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 18px 14px',
              borderBottom: `1px solid ${S.rule}`,
            }}>
              <span style={{
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.15em', color: S.faint,
              }}>
                {drawerSection ?? 'Compte'}
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{
                  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 10, border: `1px solid ${S.rule}`, background: 'transparent',
                  color: S.muted, cursor: 'pointer',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Corps */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
              {drawerSection !== null ? (
                // Items du groupe sélectionné
                navGroups.find((g) => g.label === drawerSection)?.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link key={item.href} href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      style={{
                        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '0 12px', borderRadius: 10, minHeight: 44,
                        background: isActive ? S.accent : 'transparent',
                        color: isActive ? S.onAccent : S.ink,
                        fontFamily: "'Inter Tight', system-ui, sans-serif",
                        fontSize: 14, fontWeight: isActive ? 600 : 400,
                        marginBottom: 2,
                      }}>
                      <Icon style={{ width: 18, height: 18, flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                      {item.label}
                    </Link>
                  )
                })
              ) : (
                // Section Compte
                <>
                  {user && (
                    <div style={{ padding: '10px 12px 12px', marginBottom: 4, borderBottom: `1px solid ${S.rule}` }}>
                      <div style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: S.ink }}>
                        {displayName(user)}
                      </div>
                      <div style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 11, color: S.faint, marginTop: 2 }}>
                        {user.email}
                      </div>
                    </div>
                  )}
                  <Link href="/profil" onClick={() => setDrawerOpen(false)} style={{
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0 12px', borderRadius: 10, minHeight: 44,
                    background: pathname === '/profil' ? S.accent : 'transparent',
                    color: pathname === '/profil' ? S.onAccent : S.ink,
                    fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 14, marginBottom: 2,
                  }}>
                    <User style={{ width: 18, height: 18, opacity: 0.7 }} />
                    Mon profil
                  </Link>
                  <Link href="/parametres" onClick={() => setDrawerOpen(false)} style={{
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0 12px', borderRadius: 10, minHeight: 44,
                    background: pathname === '/parametres' ? S.accent : 'transparent',
                    color: pathname === '/parametres' ? S.onAccent : S.ink,
                    fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 14, marginBottom: 2,
                  }}>
                    <Settings style={{ width: 18, height: 18, opacity: 0.7 }} />
                    Paramètres
                  </Link>
                  {user?.globalRole === 'platform_admin' && (
                    <Link href="/admin" onClick={() => setDrawerOpen(false)} style={{
                      textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '0 12px', borderRadius: 10, minHeight: 44,
                      background: pathname.startsWith('/admin') ? S.accent : 'transparent',
                      color: pathname.startsWith('/admin') ? S.onAccent : S.ink,
                      fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 14, marginBottom: 2,
                    }}>
                      <Settings style={{ width: 18, height: 18, opacity: 0.7 }} />
                      Administration
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 12px 16px', borderTop: `1px solid ${S.rule}` }}>
              <button onClick={handleLogout} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 12px', minHeight: 44, borderRadius: 10,
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize: 13.5, color: S.accent,
              }}>
                <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}

      <InstallPrompt />
    </div>
  )
}
