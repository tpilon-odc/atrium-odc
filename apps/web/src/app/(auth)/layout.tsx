import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Logo" className="h-12 w-auto " />
        </div>
        {children}
      </div>
      <footer className="mt-8 flex gap-4 text-xs text-muted-foreground">
        <Link href="/legal/privacy" className="hover:text-foreground hover:underline">
          Politique de confidentialité
        </Link>
        <span>·</span>
        <Link href="/legal/terms" className="hover:text-foreground hover:underline">
          CGU
        </Link>
      </footer>
    </div>
  )
}
