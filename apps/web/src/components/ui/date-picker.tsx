'use client'

import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'

interface DatePickerProps {
  value?: string          // format ISO YYYY-MM-DD
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}

// Formats acceptés en saisie libre (JJ/MM/AAAA ou JJ-MM-AAAA)
const INPUT_FORMATS = ['dd/MM/yyyy', 'dd-MM-yyyy', 'ddMMyyyy']

function parseInputText(text: string): Date | undefined {
  for (const fmt of INPUT_FORMATS) {
    const d = parse(text, fmt, new Date())
    if (isValid(d) && d.getFullYear() > 1900) return d
  }
  return undefined
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  disabled,
  className,
  id,
  name,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputText, setInputText] = React.useState('')
  const [inputFocused, setInputFocused] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  const selected = value && isValid(parse(value, 'yyyy-MM-dd', new Date()))
    ? parse(value, 'yyyy-MM-dd', new Date())
    : undefined

  // Sync l'input texte avec la valeur externe quand il n'est pas en cours d'édition
  React.useEffect(() => {
    if (!inputFocused) {
      setInputText(selected ? format(selected, 'dd/MM/yyyy') : '')
    }
  }, [value, inputFocused, selected])

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange?.(format(date, 'yyyy-MM-dd'))
      setInputText(format(date, 'dd/MM/yyyy'))
    }
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value
    setInputText(text)
    const parsed = parseInputText(text)
    if (parsed) {
      onChange?.(format(parsed, 'yyyy-MM-dd'))
    } else if (text === '') {
      onChange?.('')
    }
  }

  function handleInputBlur() {
    setInputFocused(false)
    // Si la saisie libre est incomplète/invalide, réinitialiser l'affichage à la valeur courante
    const parsed = parseInputText(inputText)
    if (!parsed && inputText !== '') {
      setInputText(selected ? format(selected, 'dd/MM/yyyy') : '')
    }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <input type="hidden" id={id} name={name} value={value ?? ''} readOnly />

      <div className="flex items-center gap-1">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setInputFocused(true)}
          onBlur={handleInputBlur}
          placeholder="JJ/MM/AAAA"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="h-9 w-9 shrink-0"
          aria-label="Ouvrir le calendrier"
        >
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 rounded-md border border-border bg-white dark:bg-zinc-900 shadow-lg">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            initialFocus
          />
        </div>
      )}
    </div>
  )
}
