'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Building2, TrendingUp, Briefcase, HelpCircle, CreditCard, Wallet, PiggyBank, Receipt } from 'lucide-react'
import { contactApi, type ContactAsset, type ContactLiability, type ContactIncome, type ContactTax, type ContactProduct } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

// ── Asset section ─────────────────────────────────────────────────────────────

const ASSET_TYPE_LABELS: Record<ContactAsset['type'], string> = {
  immobilier: 'Immobilier',
  financier: 'Financier',
  professionnel: 'Professionnel',
  autre: 'Autre',
}
const ASSET_TYPE_ICONS: Record<ContactAsset['type'], React.ElementType> = {
  immobilier: Building2,
  financier: TrendingUp,
  professionnel: Briefcase,
  autre: HelpCircle,
}

function AssetForm({ contactId, token, onDone, initial }: {
  contactId: string
  token: string
  onDone: () => void
  initial?: ContactAsset
}) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<ContactAsset['type']>(initial?.type ?? 'immobilier')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [estimatedValue, setEstimatedValue] = useState(initial?.estimatedValue?.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const mutation = useMutation({
    mutationFn: () => initial
      ? contactApi.updateAsset(contactId, initial.id, { type, label, estimatedValue: parseFloat(estimatedValue), notes: notes || null }, token)
      : contactApi.addAsset(contactId, { type, label, estimatedValue: parseFloat(estimatedValue), notes: notes || null }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-assets', contactId] })
      onDone()
    },
  })

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(ASSET_TYPE_LABELS) as ContactAsset['type'][]).map((t) => (
          <button key={t} onClick={() => setType(t)} className={cn('text-xs px-3 py-1.5 rounded-full font-medium transition-colors', type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
            {ASSET_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Libellé</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Résidence principale" className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valeur estimée (€)</Label>
          <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} placeholder="250000" className="text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes (optionnel)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques…" className="text-sm" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !label || !estimatedValue}>
          {mutation.isPending ? 'Enregistrement…' : initial ? 'Modifier' : 'Ajouter'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Annuler</Button>
      </div>
    </div>
  )
}

function AssetsSection({ contactId, token }: { contactId: string; token: string }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['contact-assets', contactId],
    queryFn: () => contactApi.listAssets(contactId, token),
    enabled: !!token,
  })
  const items = data?.data.items ?? []
  const total = items.reduce((sum, i) => sum + i.estimatedValue, 0)

  const remove = useMutation({
    mutationFn: (id: string) => contactApi.removeAsset(contactId, id, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-assets', contactId] }),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">Actifs</h3>
          {items.length > 0 && <p className="text-xs text-muted-foreground">Total : {fmt(total)}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditing(null) }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {adding && <AssetForm contactId={contactId} token={token} onDone={() => setAdding(false)} />}

      {items.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Aucun actif enregistré.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const Icon = ASSET_TYPE_ICONS[item.type]
          return (
            <div key={item.id}>
              {editing === item.id ? (
                <AssetForm contactId={contactId} token={token} onDone={() => setEditing(null)} initial={item} />
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border group">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[item.type]}</p>
                  </div>
                  <span className="text-sm font-semibold">{fmt(item.estimatedValue)}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(item.id)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove.mutate(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Liability section ─────────────────────────────────────────────────────────

const LIABILITY_TYPE_LABELS: Record<ContactLiability['type'], string> = {
  immobilier: 'Immobilier',
  consommation: 'Consommation',
  professionnel: 'Professionnel',
  autre: 'Autre',
}

function LiabilityForm({ contactId, token, onDone, initial }: {
  contactId: string
  token: string
  onDone: () => void
  initial?: ContactLiability
}) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<ContactLiability['type']>(initial?.type ?? 'immobilier')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [outstandingAmount, setOutstandingAmount] = useState(initial?.outstandingAmount?.toString() ?? '')
  const [monthlyPayment, setMonthlyPayment] = useState(initial?.monthlyPayment?.toString() ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 10) ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        type, label,
        outstandingAmount: parseFloat(outstandingAmount),
        monthlyPayment: monthlyPayment ? parseFloat(monthlyPayment) : null,
        endDate: endDate || null,
        notes: notes || null,
      }
      return initial
        ? contactApi.updateLiability(contactId, initial.id, data, token)
        : contactApi.addLiability(contactId, data, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-liabilities', contactId] })
      onDone()
    },
  })

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(LIABILITY_TYPE_LABELS) as ContactLiability['type'][]).map((t) => (
          <button key={t} onClick={() => setType(t)} className={cn('text-xs px-3 py-1.5 rounded-full font-medium transition-colors', type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
            {LIABILITY_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Libellé</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Crédit immobilier" className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Capital restant dû (€)</Label>
          <Input type="number" value={outstandingAmount} onChange={(e) => setOutstandingAmount(e.target.value)} placeholder="150000" className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mensualité (€)</Label>
          <Input type="number" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} placeholder="800" className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fin du crédit</Label>
          <DatePicker value={endDate} onChange={setEndDate} className="text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes (optionnel)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques…" className="text-sm" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !label || !outstandingAmount}>
          {mutation.isPending ? 'Enregistrement…' : initial ? 'Modifier' : 'Ajouter'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Annuler</Button>
      </div>
    </div>
  )
}

function LiabilitiesSection({ contactId, token }: { contactId: string; token: string }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['contact-liabilities', contactId],
    queryFn: () => contactApi.listLiabilities(contactId, token),
    enabled: !!token,
  })
  const items = data?.data.items ?? []
  const total = items.reduce((sum, i) => sum + i.outstandingAmount, 0)

  const remove = useMutation({
    mutationFn: (id: string) => contactApi.removeLiability(contactId, id, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-liabilities', contactId] }),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">Passifs</h3>
          {items.length > 0 && <p className="text-xs text-muted-foreground">Total encours : {fmt(total)}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditing(null) }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {adding && <LiabilityForm contactId={contactId} token={token} onDone={() => setAdding(false)} />}

      {items.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Aucun passif enregistré.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id}>
            {editing === item.id ? (
              <LiabilityForm contactId={contactId} token={token} onDone={() => setEditing(null)} initial={item} />
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border group">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {LIABILITY_TYPE_LABELS[item.type]}
                    {item.monthlyPayment ? ` · ${fmt(item.monthlyPayment)}/mois` : ''}
                    {item.endDate ? ` · fin ${new Date(item.endDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}` : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold text-destructive">{fmt(item.outstandingAmount)}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(item.id)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove.mutate(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Income section ────────────────────────────────────────────────────────────

const INCOME_TYPE_LABELS: Record<ContactIncome['type'], string> = {
  salaire: 'Salaire',
  foncier: 'Revenus fonciers',
  dividendes: 'Dividendes',
  pension: 'Pension / Retraite',
  autre: 'Autre',
}

function IncomeForm({ contactId, token, onDone, initial }: {
  contactId: string
  token: string
  onDone: () => void
  initial?: ContactIncome
}) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<ContactIncome['type']>(initial?.type ?? 'salaire')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [annualAmount, setAnnualAmount] = useState(initial?.annualAmount?.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const data = { type, label, annualAmount: parseFloat(annualAmount), notes: notes || null }
      return initial
        ? contactApi.updateIncome(contactId, initial.id, data, token)
        : contactApi.addIncome(contactId, data, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-incomes', contactId] })
      onDone()
    },
  })

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(INCOME_TYPE_LABELS) as ContactIncome['type'][]).map((t) => (
          <button key={t} onClick={() => setType(t)} className={cn('text-xs px-3 py-1.5 rounded-full font-medium transition-colors', type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
            {INCOME_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Libellé</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Salaire net annuel" className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Montant annuel (€)</Label>
          <Input type="number" value={annualAmount} onChange={(e) => setAnnualAmount(e.target.value)} placeholder="45000" className="text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes (optionnel)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques…" className="text-sm" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !label || !annualAmount}>
          {mutation.isPending ? 'Enregistrement…' : initial ? 'Modifier' : 'Ajouter'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Annuler</Button>
      </div>
    </div>
  )
}

function IncomesSection({ contactId, token }: { contactId: string; token: string }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['contact-incomes', contactId],
    queryFn: () => contactApi.listIncomes(contactId, token),
    enabled: !!token,
  })
  const items = data?.data.items ?? []
  const total = items.reduce((sum, i) => sum + i.annualAmount, 0)

  const remove = useMutation({
    mutationFn: (id: string) => contactApi.removeIncome(contactId, id, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-incomes', contactId] }),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">Revenus</h3>
          {items.length > 0 && <p className="text-xs text-muted-foreground">Total annuel : {fmt(total)}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditing(null) }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {adding && <IncomeForm contactId={contactId} token={token} onDone={() => setAdding(false)} />}

      {items.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Aucun revenu enregistré.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id}>
            {editing === item.id ? (
              <IncomeForm contactId={contactId} token={token} onDone={() => setEditing(null)} initial={item} />
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border group">
                <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{INCOME_TYPE_LABELS[item.type]}</p>
                </div>
                <span className="text-sm font-semibold text-green-600">{fmt(item.annualAmount)}/an</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(item.id)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove.mutate(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tax section ───────────────────────────────────────────────────────────────

const TMI_OPTIONS = [
  { value: 0, label: '0 %' },
  { value: 0.11, label: '11 %' },
  { value: 0.30, label: '30 %' },
  { value: 0.41, label: '41 %' },
  { value: 0.45, label: '45 %' },
]

function TaxSection({ contactId, token }: { contactId: string; token: string }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['contact-tax', contactId],
    queryFn: () => contactApi.getTax(contactId, token),
    enabled: !!token,
  })
  const tax = data?.data.tax

  const [tmi, setTmi] = useState<string>('')
  const [regime, setRegime] = useState<string>('')
  const [pfuOption, setPfuOption] = useState(false)
  const [ifi, setIfi] = useState(false)
  const [ifiValue, setIfiValue] = useState('')
  const [notes, setNotes] = useState('')

  function startEdit() {
    setTmi(tax?.tmi?.toString() ?? '')
    setRegime(tax?.regime ?? '')
    setPfuOption(tax?.pfuOption ?? false)
    setIfi(tax?.ifi ?? false)
    setIfiValue(tax?.ifiValue?.toString() ?? '')
    setNotes(tax?.notes ?? '')
    setEditing(true)
  }

  const mutation = useMutation({
    mutationFn: () => contactApi.upsertTax(contactId, {
      tmi: tmi ? parseFloat(tmi) : null,
      regime: (regime as 'ir' | 'is') || null,
      pfuOption,
      ifi,
      ifiValue: ifiValue ? parseFloat(ifiValue) : null,
      notes: notes || null,
    }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-tax', contactId] })
      setEditing(false)
    },
  })

  if (isLoading) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Fiscalité</h3>
        {!editing && (
          <Button size="sm" variant="outline" onClick={startEdit}>
            {tax ? <><Pencil className="h-3.5 w-3.5 mr-1" /> Modifier</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Renseigner</>}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">TMI</Label>
              <select value={tmi} onChange={(e) => setTmi(e.target.value)} className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background">
                <option value="">— Non renseigné —</option>
                {TMI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Régime fiscal</Label>
              <select value={regime} onChange={(e) => setRegime(e.target.value)} className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background">
                <option value="">— Non renseigné —</option>
                <option value="ir">IR (Impôt sur le revenu)</option>
                <option value="is">IS (Impôt sur les sociétés)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={pfuOption} onChange={(e) => setPfuOption(e.target.checked)} className="rounded" />
              Option PFU (Flat Tax 30 %)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={ifi} onChange={(e) => setIfi(e.target.checked)} className="rounded" />
              Assujetti à l'IFI
            </label>
          </div>
          {ifi && (
            <div className="space-y-1">
              <Label className="text-xs">Valeur du patrimoine taxable IFI (€)</Label>
              <Input type="number" value={ifiValue} onChange={(e) => setIfiValue(e.target.value)} placeholder="1500000" className="text-sm" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Notes (optionnel)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques fiscales…" className="text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </div>
      ) : tax ? (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {tax.tmi !== null && (
              <div>
                <p className="text-xs text-muted-foreground">TMI</p>
                <p className="font-medium">{Math.round(tax.tmi * 100)} %</p>
              </div>
            )}
            {tax.regime && (
              <div>
                <p className="text-xs text-muted-foreground">Régime</p>
                <p className="font-medium">{tax.regime.toUpperCase()}</p>
              </div>
            )}
            {tax.pfuOption && (
              <div>
                <p className="text-xs text-muted-foreground">PFU</p>
                <p className="font-medium">Option Flat Tax</p>
              </div>
            )}
            {tax.ifi && (
              <div>
                <p className="text-xs text-muted-foreground">IFI</p>
                <p className="font-medium">{tax.ifiValue ? fmt(tax.ifiValue) : 'Assujetti'}</p>
              </div>
            )}
          </div>
          {tax.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{tax.notes}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune donnée fiscale renseignée.</p>
      )}
    </div>
  )
}

// ── Sold products section ─────────────────────────────────────────────────────

function SoldProductsSection({ contactId, token }: { contactId: string; token: string }) {
  const { data } = useQuery({
    queryKey: ['contact-products', contactId],
    queryFn: () => contactApi.listProducts(contactId, token),
    enabled: !!token,
  })
  const items: ContactProduct[] = data?.data.items ?? []

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm">Produits souscrits</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun produit souscrit. Ajoutez-en depuis l&apos;onglet Adéquation.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <PiggyBank className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.product.category ?? item.product.mainCategory ?? 'Produit'}
                  {' · '}
                  Souscrit le {new Date(item.soldAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {item.amount !== null && (
                <span className="text-sm font-semibold">{fmt(item.amount)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContactPatrimoineTab({ contactId, token }: { contactId: string; token: string }) {
  return (
    <div className="space-y-8">
      <SoldProductsSection contactId={contactId} token={token} />
      <div className="border-t border-border" />
      <AssetsSection contactId={contactId} token={token} />
      <div className="border-t border-border" />
      <LiabilitiesSection contactId={contactId} token={token} />
      <div className="border-t border-border" />
      <IncomesSection contactId={contactId} token={token} />
      <div className="border-t border-border" />
      <TaxSection contactId={contactId} token={token} />
    </div>
  )
}
