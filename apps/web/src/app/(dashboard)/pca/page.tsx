'use client'

import { ShieldCheck } from 'lucide-react'
import PcaStepper from './PcaStepper'

export default function PcaPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Plan de Continuité d'Activité</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Renseignez et maintenez à jour votre PCA. Les données sont sauvegardées automatiquement.
        </p>
      </div>

      <PcaStepper />
    </div>
  )
}
