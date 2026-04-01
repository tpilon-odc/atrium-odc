import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <img
              src="/logo.png"
              alt="CGP Platform"
              className="h-8 w-auto "
            />
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap gap-4 items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} CGP Platform</span>
          <div className="flex gap-4">
            <Link href="/legal/privacy" className="hover:text-foreground hover:underline">
              Politique de confidentialité
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground hover:underline">
              CGU
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
