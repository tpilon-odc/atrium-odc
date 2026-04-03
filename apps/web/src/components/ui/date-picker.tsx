'use client'

import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'

interface DatePickerProps {
  value?: string          // format ISO YYYY-MM-DD (compatible input[type=date])
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  name?: string
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
  const ref = React.useRef<HTMLDivElement>(null)

  const selected = value && isValid(parse(value, 'yyyy-MM-dd', new Date()))
    ? parse(value, 'yyyy-MM-dd', new Date())
    : undefined

  // Fermer au clic en dehors
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange?.(format(date, 'yyyy-MM-dd'))
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Input caché pour compatibilité formulaires React Hook Form */}
      <input type="hidden" id={id} name={name} value={value ?? ''} readOnly />

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full justify-start text-left font-normal',
          !selected && 'text-muted-foreground'
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {selected
          ? format(selected, 'd MMMM yyyy', { locale: fr })
          : placeholder}
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 rounded-md border bg-popover shadow-md">
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
