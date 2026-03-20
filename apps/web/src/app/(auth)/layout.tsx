export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">CGP Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">Plateforme de gestion patrimoniale</p>
        </div>
        {children}
      </div>
    </div>
  )
}
