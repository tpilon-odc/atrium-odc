'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, useDayPicker, useNavigation } from 'react-day-picker'
import { fr } from 'date-fns/locale'
import { format, setMonth, setYear } from 'date-fns'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function CaptionWithDropdowns({ displayMonth }: { displayMonth: Date }) {
  const { goToMonth } = useNavigation()
  const { fromYear, toYear } = useDayPicker()

  const currentYear = new Date().getFullYear()
  const startYear = fromYear ?? currentYear - 100
  const endYear = toYear ?? currentYear + 10

  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)
  const months = Array.from({ length: 12 }, (_, i) =>
    format(setMonth(new Date(2000, 0, 1), i), 'MMMM', { locale: fr })
  )

  return (
    <div className="flex items-center justify-center gap-1 pt-1 relative">
      <button
        type="button"
        aria-label="Mois précédent"
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1'
        )}
        onClick={() => goToMonth(setMonth(displayMonth, displayMonth.getMonth() - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        <select
          value={displayMonth.getMonth()}
          onChange={(e) => goToMonth(setMonth(displayMonth, Number(e.target.value)))}
          className="text-sm font-medium capitalize bg-transparent border-0 cursor-pointer outline-none focus:ring-1 focus:ring-ring rounded px-1 py-0.5 hover:bg-accent"
        >
          {months.map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>

        <select
          value={displayMonth.getFullYear()}
          onChange={(e) => goToMonth(setYear(displayMonth, Number(e.target.value)))}
          className="text-sm font-medium bg-transparent border-0 cursor-pointer outline-none focus:ring-1 focus:ring-ring rounded px-1 py-0.5 hover:bg-accent"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        aria-label="Mois suivant"
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1'
        )}
        onClick={() => goToMonth(setMonth(displayMonth, displayMonth.getMonth() + 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={fr}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'hidden',
        nav: 'hidden',
        nav_button: 'hidden',
        nav_button_previous: 'hidden',
        nav_button_next: 'hidden',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        day: cn(buttonVariants({ variant: 'ghost' }), 'h-9 w-9 p-0 font-normal aria-selected:opacity-100'),
        day_range_end: 'day-range-end',
        day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside: 'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Caption: ({ displayMonth }) => <CaptionWithDropdowns displayMonth={displayMonth} />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
