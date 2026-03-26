'use client'

import { useState, useRef, useEffect, memo } from 'react'
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePca } from '@/hooks/usePca'
import { cabinetApi, PcaData } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useQuery } from '@tanstack/react-query'

import Step01Organisation from './steps/Step01Organisation'
import Step02Donnees from './steps/Step02Donnees'
import Step03Procedures from './steps/Step03Procedures'
import PcaHistory from './PcaHistory'

const STEPS = [
  { id: 'organisation', label: 'Organisation',                        short: '1. Organisation' },
  { id: 'donnees',      label: 'Enregistrement et conservation',      short: '2. Données' },
  { id: 'procedures',   label: 'Procédures en cas de dysfonctionnement', short: '3. Procédures' },
]

export default function PcaStepper() {
  const { token } = useAuthStore()
  const { pca, isLoading, isSaving, saveDebounced, saveNow, setCompleted, isMarkingComplete } = usePca()
  const [currentStep, setCurrentStep] = useState(0)

  const { data: cabinetRes } = useQuery({
    queryKey: ['cabinet-me', token],
    queryFn: () => cabinetApi.getMe(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
  const cabinet = cabinetRes?.data.cabinet

  const [localData, setLocalData] = useState<PcaData>({})
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && pca) {
      setLocalData((pca.data ?? {}) as PcaData)
      initialized.current = true
    }
  }, [pca])

  const localDataRef = useRef(localData)
  localDataRef.current = localData

  const handleStepChange = useRef((stepKey: string, stepData: unknown) => {
    const next = { ...localDataRef.current, [stepKey]: stepData }
    localDataRef.current = next
    setLocalData(next)
    saveDebounced(next)
  }).current

  const goToStep = (idx: number) => {
    saveNow(localDataRef.current)
    setCurrentStep(idx)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleExport = async () => {
    const { exportPcaDocx } = await import('./exportDocx')
    exportPcaDocx(localDataRef.current, cabinet ?? undefined)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* En-tête statut */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {pca?.isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium text-sm">
              {pca?.isCompleted ? 'PCA validé' : 'PCA en cours de rédaction'}
            </p>
            {pca?.completedAt && (
              <p className="text-xs text-muted-foreground">
                Validé le {new Date(pca.completedAt).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
          {isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Enregistrement…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PcaHistory
            token={token!}
            onRestore={(data) => {
              setLocalData(data)
              localDataRef.current = data
              saveDebounced(data)
            }}
          />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exporter DOCX
          </Button>
          <Button
            size="sm"
            variant={pca?.isCompleted ? 'outline' : 'default'}
            onClick={() => setCompleted(!pca?.isCompleted)}
            disabled={isMarkingComplete}
          >
            {isMarkingComplete ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {pca?.isCompleted ? 'Rouvrir le PCA' : 'Valider le PCA'}
          </Button>
        </div>
      </div>

      {/* Navigation étapes */}
      <div className="flex bg-card border border-border rounded-lg overflow-hidden">
        {STEPS.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => goToStep(idx)}
            className={cn(
              'flex-1 py-3 px-4 text-sm font-medium text-center border-r border-border last:border-r-0 transition-colors',
              idx === currentStep
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <span className="hidden sm:inline">{step.label}</span>
            <span className="sm:hidden">{step.short}</span>
          </button>
        ))}
      </div>

      {/* Contenu de l'étape */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">{STEPS[currentStep].label}</h2>
        <StepContent
          stepIndex={currentStep}
          stepData={localData[STEPS[currentStep].id]}
          onChange={handleStepChange}
        />
      </div>

      {/* Navigation bas de page */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 0}>
          <ChevronLeft className="h-4 w-4 mr-1.5" />
          Précédent
        </Button>
        <span className="text-sm text-muted-foreground">
          Étape {currentStep + 1} / {STEPS.length}
        </span>
        <Button variant="outline" onClick={() => goToStep(currentStep + 1)} disabled={currentStep === STEPS.length - 1}>
          Suivant
          <ChevronRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  )
}

const StepContent = memo(function StepContent({
  stepIndex,
  stepData,
  onChange,
}: {
  stepIndex: number
  stepData: unknown
  onChange: (key: string, data: unknown) => void
}) {
  const d = (stepData ?? {}) as never
  switch (stepIndex) {
    case 0: return <Step01Organisation data={d} onChange={(v) => onChange('organisation', v)} />
    case 1: return <Step02Donnees data={d} onChange={(v) => onChange('donnees', v)} />
    case 2: return <Step03Procedures data={d} onChange={(v) => onChange('procedures', v)} />
    default: return null
  }
})
