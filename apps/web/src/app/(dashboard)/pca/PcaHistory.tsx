'use client'

import { useState } from 'react'
import { History, X, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pcaApi, PcaHistoryEntry, PcaData } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
}

function displayAuthor(user: PcaHistoryEntry['user']): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || user.email.split('@')[0]
}

interface PcaHistoryProps {
  token: string
  onRestore: (data: PcaData) => void
}

export default function PcaHistory({ token, onRestore }: PcaHistoryProps) {
  const [open, setOpen] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pca-history', token],
    queryFn: () => pcaApi.history(token),
    enabled: open && !!token,
    staleTime: 30 * 1000,
  })

  const history = data?.data.history ?? []

  const handleRestoreClick = (id: string) => {
    setConfirmId(id)
  }

  const handleConfirmRestore = async (id: string) => {
    setRestoringId(id)
    setConfirmId(null)
    try {
      const res = await pcaApi.historyEntry(id, token)
      onRestore(res.data.entry.data)
      setOpen(false)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <History className="h-3.5 w-3.5 mr-1.5" />
        Historique
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Historique des versions</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Aucune version sauvegardée pour le moment.
                </p>
              ) : (
                <ul className="space-y-3">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="bg-card border border-border rounded-lg px-4 py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {displayAuthor(entry.user)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(entry.createdAt)}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {confirmId === entry.id ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <p className="text-xs text-muted-foreground text-right max-w-[180px]">
                              Restaurer cette version remplacera les données actuelles.
                            </p>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setConfirmId(null)}
                              >
                                Annuler
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleConfirmRestore(entry.id)}
                              >
                                Confirmer
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleRestoreClick(entry.id)}
                            disabled={restoringId === entry.id}
                          >
                            {restoringId === entry.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-1" />
                            )}
                            Restaurer
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
