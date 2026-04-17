'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <div className="mb-6 flex justify-center">
          <img src="/logo.png" alt="CGP Platform" className="h-10 w-auto" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Pas de connexion
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Vérifiez votre connexion internet et réessayez.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary hover:underline"
        >
          Réessayer
        </button>
      </div>
    </div>
  )
}
