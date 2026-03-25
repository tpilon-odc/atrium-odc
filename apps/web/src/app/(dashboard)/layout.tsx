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
  X,
  AlertTriangle,
  AlertCircle,
  Sun,
  Moon,
  CalendarDays,
  MessagesSquare,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { authApi, memberApi, complianceApi, notificationApi, channelApi, consentApi, displayName, type AppNotification, type CabinetMember } from '@/lib/api'
import { Button } from '@/components/ui/button'

// ── Nav groups (desktop sidebar) ───────────────────────────────────────────

type NavItem = { href: string; label: string; icon: React.ElementType; showProgress?: boolean; permission?: keyof CabinetMember }

function buildNavGroups(member: CabinetMember | null, hasCabinet: boolean) {
  const canAll = !member || member.role === 'owner' || member.role === 'admin'
  const allow = (perm: keyof CabinetMember) => canAll || !!member?.[perm]

  return [
    {
      label: 'Mon Cabinet',
      items: ([
        { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
        hasCabinet && { href: '/conformite', label: 'Conformité', icon: ShieldCheck, showProgress: true },
        hasCabinet && { href: '/parametres', label: 'Paramètres', icon: Settings },
      ] as (NavItem | false)[]).filter(Boolean) as NavItem[],
    },
    {
      label: 'Communauté',
      items: ([
        allow('canManageSuppliers') && { href: '/fournisseurs', label: 'Fournisseurs', icon: Building2 },
        allow('canManageProducts') && { href: '/produits', label: 'Produits', icon: Package },
        { href: '/outils', label: 'Outils', icon: Wrench },
        { href: '/clusters', label: 'Clusters', icon: MessagesSquare },
      ] as (NavItem | false)[]).filter(Boolean) as NavItem[],
    },
    {
      label: 'Mon Activité',
      items: ([
        allow('canManageContacts') && { href: '/crm', label: 'CRM', icon: Users },
        { href: '/agenda', label: 'Agenda', icon: CalendarDays },
        { href: '/ged', label: 'Documents', icon: FolderOpen },
        { href: '/formations', label: 'Formations', icon: GraduationCap },
      ] as (NavItem | false)[]).filter(Boolean) as NavItem[],
    },
    {
      label: 'Partage',
      items: [
        { href: '/partage', label: 'Données partagées', icon: Share2 },
        { href: '/conformite-partagee', label: 'Conformité partagée', icon: ShieldCheck },
      ] as NavItem[],
    },
  ]
}

function buildBottomNav(member: CabinetMember | null, hasCabinet: boolean): NavItem[] {
  const canAll = !member || member.role === 'owner' || member.role === 'admin'
  const allow = (perm: keyof CabinetMember) => canAll || !!member?.[perm]
  return ([
    { href: '/dashboard', label: 'Accueil', icon: LayoutDashboard },
    hasCabinet && { href: '/conformite', label: 'Conformité', icon: ShieldCheck },
    allow('canManageSuppliers') && { href: '/fournisseurs', label: 'Fournisseurs', icon: Building2 },
    allow('canManageContacts') && { href: '/crm', label: 'CRM', icon: Users },
  ] as (NavItem | false)[]).filter(Boolean) as NavItem[]
}

function buildDrawerItems(member: CabinetMember | null, hasCabinet: boolean): NavItem[] {
  const canAll = !member || member.role === 'owner' || member.role === 'admin'
  const allow = (perm: keyof CabinetMember) => canAll || !!member?.[perm]
  return ([
    allow('canManageProducts') && { href: '/produits', label: 'Produits', icon: Package },
    { href: '/outils', label: 'Outils', icon: Wrench },
    { href: '/clusters', label: 'Clusters', icon: MessagesSquare },
    { href: '/agenda', label: 'Agenda', icon: CalendarDays },
    { href: '/ged', label: 'Documents', icon: FolderOpen },
    { href: '/formations', label: 'Formations', icon: GraduationCap },
    { href: '/partage', label: 'Partage', icon: Share2 },
    hasCabinet && { href: '/parametres', label: 'Paramètres', icon: Settings },
  ] as (NavItem | false)[]).filter(Boolean) as NavItem[]
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  conformite: 'Conformité',
  fournisseurs: 'Fournisseurs',
  produits: 'Produits',
  outils: 'Outils',
  crm: 'CRM',
  agenda: 'Agenda',
  ged: 'Documents',
  formations: 'Formations',
  partage: 'Partage',
  parametres: 'Paramètres',
  clusters: 'Clusters',
  notifications: 'Notifications',
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

// ── Theme toggle ────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
      title={resolvedTheme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
    >
      {resolvedTheme === 'dark'
        ? <Sun className="h-3.5 w-3.5" />
        : <Moon className="h-3.5 w-3.5" />
      }
    </button>
  )
}

// ── Avatar initiales ────────────────────────────────────────────────────────

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
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
                    : n.type === 'compliance_expired'
                    ? <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
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

// ── NavLink helper ──────────────────────────────────────────────────────────

function SidebarLink({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string
  label: string
  icon: React.ElementType
  isActive: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, user, cabinet, hydrate, logout } = useAuthStore()
  const [ready, setReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { data: notifData } = useNotifications(token)
  const alertCount = notifData?.data.unreadCount ?? 0
  const breadcrumbs = getBreadcrumbs(pathname)

  const { data: membersData } = useQuery({
    queryKey: ['members', token],
    queryFn: () => memberApi.list(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
  const currentMember = membersData?.data.members.find((m) => m.userId === user?.id) ?? null
  // hasCabinet = l'utilisateur est membre d'un cabinet (quel que soit son globalRole)
  const hasCabinet = currentMember !== null
  const navGroups = buildNavGroups(currentMember, hasCabinet)
  const bottomNavItems = buildBottomNav(currentMember, hasCabinet)
  const drawerItems = buildDrawerItems(currentMember, hasCabinet)

  useEffect(() => {
    hydrate()
    const stored = localStorage.getItem('access_token')
    if (!stored) {
      router.replace('/login')
    } else {
      setReady(true)
    }
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
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Sidebar (desktop) ────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 flex-col bg-card border-r border-border shrink-0">
        {/* Logo */}
        <div className="px-4 py-3.5 border-b border-border flex justify-center">
          <Link href="/dashboard">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto dark:brightness-0 dark:invert" />
          </Link>
        </div>

        {/* Nav groupée */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <SidebarLink
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        isActive={isActive}
                      />
                      {'showProgress' in item && item.showProgress && token && (
                        <ComplianceProgressBar token={token} />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {user?.globalRole === 'platform_admin' && (
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                Admin
              </p>
              <ul className="space-y-0.5">
                <li>
                  <SidebarLink
                    href="/admin/conformite"
                    label="Référentiel conformité"
                    icon={ShieldAlert}
                    isActive={pathname.startsWith('/admin/conformite')}
                  />
                </li>
                <li>
                  <SidebarLink
                    href="/admin/clusters"
                    label="Modération clusters"
                    icon={MessagesSquare}
                    isActive={pathname.startsWith('/admin/clusters')}
                  />
                </li>
                <li>
                  <SidebarLink
                    href="/admin/utilisateurs"
                    label="Utilisateurs plateforme"
                    icon={Users}
                    isActive={pathname.startsWith('/admin/utilisateurs')}
                  />
                </li>
              </ul>
            </div>
          )}
        </nav>

        {/* Footer utilisateur */}
        <div className="px-2.5 py-3 border-t border-border">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 min-w-0">
            <UserAvatar name={user ? displayName(user) : 'U'} avatarUrl={user?.avatarUrl} />
            <Link href="/profil" className="flex-1 min-w-0 rounded-md hover:bg-accent px-1 py-0.5 transition-colors">
              <p className="text-xs font-medium truncate">{user ? displayName(user) : '…'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </Link>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* ── Zone principale ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header mobile (md:hidden) */}
        <header className="md:hidden h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <img src="/logo.png" alt="Logo" className="h-10 w-auto dark:brightness-0 dark:invert" />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {token && <NotificationBell token={token} />}
            <UserAvatar name={user ? displayName(user) : 'U'} avatarUrl={user?.avatarUrl} />
          </div>
        </header>

        {/* Header desktop (hidden md:flex) */}
        <header className="hidden md:flex h-12 border-b border-border bg-card items-center px-6 gap-4 shrink-0">
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

        {/* Contenu — pb pour bottom nav mobile */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>

      {/* ── Bottom nav (mobile) ──────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-40">
        <div className="flex">
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
          {/* Bouton Plus */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>Plus</span>
          </button>
        </div>
      </nav>

      {/* ── Drawer "Plus" (mobile) ───────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-foreground/20 z-40"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Panel */}
          <div className="md:hidden fixed bottom-0 inset-x-0 bg-card rounded-t-2xl border-t border-border z-50 pb-safe">
            {/* Handle */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-sm font-semibold">Navigation</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 pb-4 space-y-0.5">
              {drawerItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                )
              })}

              {user?.globalRole === 'platform_admin' && (
                <Link
                  href="/admin/conformite"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    pathname.startsWith('/admin')
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-accent'
                  )}
                >
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  Référentiel conformité
                </Link>
              )}

              <div className="pt-2 border-t border-border mt-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 w-full transition-colors"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
