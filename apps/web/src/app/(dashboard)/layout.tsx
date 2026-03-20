'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
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
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/conformite', label: 'Conformité', icon: ShieldCheck },
  { href: '/fournisseurs', label: 'Fournisseurs', icon: Building2 },
  { href: '/produits', label: 'Produits', icon: Package },
  { href: '/outils', label: 'Outils', icon: Wrench },
  { href: '/crm', label: 'CRM', icon: Users },
  { href: '/ged', label: 'Documents', icon: FolderOpen },
  { href: '/formations', label: 'Formations', icon: GraduationCap },
  { href: '/partage', label: 'Partage', icon: Share2 },
  { href: '/parametres', label: 'Paramètres', icon: Settings },
]

const adminNavItems = [
  { href: '/admin', label: 'Administration', icon: ShieldAlert },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, user, cabinet, hydrate, logout } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    hydrate()
    const stored = localStorage.getItem('access_token')
    if (!stored) {
      router.replace('/login')
    } else {
      setReady(true)
    }
  }, [hydrate, router])

  const handleLogout = async () => {
    if (token) {
      try {
        await authApi.logout(token)
      } catch {
        // ignore
      }
    }
    logout()
    router.push('/login')
  }

  if (!ready) return null

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-card border-r border-border shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-border">
          <span className="text-lg font-bold text-primary">CGP Platform</span>
          {cabinet && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{cabinet.name}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                    {isActive && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Admin nav */}
        {user?.globalRole === 'platform_admin' && (
          <div className="px-3 pb-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground px-3 mb-1 font-medium uppercase tracking-wide">Admin</p>
            <ul>
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-border">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium truncate">{user?.email}</p>
            {user?.globalRole === 'platform_admin' && (
              <span className="text-xs text-primary font-medium">Admin plateforme</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border bg-card flex items-center px-6 shrink-0">
          <h1 className="text-sm font-medium text-muted-foreground">
            {navItems.find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.label ?? 'CGP Platform'}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
