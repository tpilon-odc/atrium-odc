'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  destructive?: boolean
}

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Supprimer',
  destructive = true,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div
        className="bg-background border border-border rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm">{message}</p>
        <div className="flex justify-end gap-2">
          <Button ref={cancelRef} variant="outline" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            onClick={() => { onConfirm(); onCancel() }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
