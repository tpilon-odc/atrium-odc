'use client'

import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'

interface DateTimePickerProps {
  value?: string          // format ISO YYYY-MM-DDTHH:mm ou YYYY-MM-DD selon allDay
  onChange?: (value: string) => void
  allDay?: boolean        // si true : date seulement, sinon date + heure
  placeholder?: string
  disabled?: boolean
  className?: string
}

const INPUT_FORMATS = ['dd/MM/yyyy', 'dd-MM-yyyy', 'ddMMyyyy']

function parseInputText(text: string): Date | undefined {
  for (const fmt of INPUT_FORMATS) {
    const d = parse(text, fmt, new Date())
    if (isValid(d) && d.getFullYear() > 1900) return d
  }
  return undefined
}

export function DateTimePicker({
  value,
  onChange,
  allDay = false,
  placeholder = 'Sélectionner',
  disabled,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputText, setInputText] = React.useState('')
  const [inputFocused, setInputFocused] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  const dateStr = value ? value.slice(0, 10) : ''
  const timeStr = value && !allDay ? (value.includes('T') ? value.slice(11, 16) : '00:00') : ''

  const selected = dateStr && isValid(parse(dateStr, 'yyyy-MM-dd', new Date()))
    ? parse(dateStr, 'yyyy-MM-dd', new Date())
    : undefined

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

  function handleSelectDate(date: Date | undefined) {
    if (!date) return
    const d = format(date, 'yyyy-MM-dd')
    setInputText(format(date, 'dd/MM/yyyy'))
    if (allDay) {
      onChange?.(d)
      setOpen(false)
    } else {
      const t = timeStr || '00:00'
      onChange?.(`${d}T${t}`)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value
    setInputText(text)
    const parsed = parseInputText(text)
    if (parsed) {
      const d = format(parsed, 'yyyy-MM-dd')
      if (allDay) {
        onChange?.(d)
      } else {
        const t = timeStr || '00:00'
        onChange?.(`${d}T${t}`)
      }
    } else if (text === '') {
      onChange?.('')
    }
  }

  function handleInputBlur() {
    setInputFocused(false)
    const parsed = parseInputText(inputText)
    if (!parsed && inputText !== '') {
      setInputText(selected ? format(selected, 'dd/MM/yyyy') : '')
    }
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const t = e.target.value
    const d = dateStr || format(new Date(), 'yyyy-MM-dd')
    onChange?.(`${d}T${t}`)
  }

  const labelDate = selected ? format(selected, 'd MMM yyyy', { locale: fr }) : ''

  return (
    <div ref={ref} className={cn('relative', className)}>
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
        {!allDay && timeStr && (
          <span className="text-sm text-muted-foreground shrink-0">{timeStr}</span>
        )}
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
            onSelect={handleSelectDate}
            defaultMonth={selected}
            initialFocus
          />
          {!allDay && (
            <div className="border-t px-3 py-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="time"
                value={timeStr}
                onChange={handleTimeChange}
                className="text-sm bg-transparent border border-input rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-ring w-full"
              />
            </div>
          )}
          {!allDay && (
            <div className="border-t px-3 py-2">
              <Button type="button" size="sm" className="w-full" onClick={() => setOpen(false)}>
                Confirmer
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
