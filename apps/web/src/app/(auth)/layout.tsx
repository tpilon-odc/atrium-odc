import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Anneau tricolore */}
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: 'conic-gradient(var(--gaia-layer-1) 0deg 120deg, var(--gaia-accent) 120deg 240deg, var(--gaia-layer-2) 240deg 360deg)',
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: 'var(--gaia-paper, #e8eae3)' }} />
            </div>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <span style={{
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize: 15, fontWeight: 400, color: 'var(--gaia-muted)', fontStyle: 'italic',
              }}>my</span>
              <span style={{
                fontFamily: "'Fraunces', ui-serif, Georgia, serif",
                fontSize: 26, fontWeight: 400, color: 'var(--gaia-ink)', letterSpacing: '-0.01em',
              }}>Gaïa</span>
            </span>
          </div>
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
