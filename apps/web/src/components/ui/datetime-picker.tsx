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

export function DateTimePicker({
  value,
  onChange,
  allDay = false,
  placeholder = 'Sélectionner',
  disabled,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  // Parse la date selon le mode
  const dateStr = value ? (allDay ? value.slice(0, 10) : value.slice(0, 10)) : ''
  const timeStr = value && !allDay ? (value.includes('T') ? value.slice(11, 16) : '00:00') : ''

  const selected = dateStr && isValid(parse(dateStr, 'yyyy-MM-dd', new Date()))
    ? parse(dateStr, 'yyyy-MM-dd', new Date())
    : undefined

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
    if (allDay) {
      onChange?.(d)
      setOpen(false)
    } else {
      const t = timeStr || '00:00'
      onChange?.(`${d}T${t}`)
      // on garde le popover ouvert pour choisir l'heure
    }
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const t = e.target.value
    const d = dateStr || format(new Date(), 'yyyy-MM-dd')
    onChange?.(`${d}T${t}`)
  }

  const label = selected
    ? allDay
      ? format(selected, 'd MMMM yyyy', { locale: fr })
      : `${format(selected, 'd MMM yyyy', { locale: fr })} ${timeStr}`
    : placeholder

  return (
    <div ref={ref} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn('w-full justify-start text-left font-normal', !selected && 'text-muted-foreground')}
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        {label}
      </Button>

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
