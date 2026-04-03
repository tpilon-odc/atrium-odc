'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventDropArg, EventResizeDoneArg, EventInput, EventContentArg } from '@fullcalendar/core'
import frLocale from '@fullcalendar/core/locales/fr'
import { useAuthStore } from '@/stores/auth'
import { eventApi, contactApi, type CalendarEvent, type EventType, type EventStatus } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Plus, X, Phone, CalendarDays, CheckSquare, ShieldAlert, ExternalLink, ChevronLeft, ChevronRight, Calendar, MapPin, AlignLeft, User, Clock } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Constantes ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<EventType, string> = {
  RDV:        '#3b82f6',
  CALL:       '#22c55e',
  TASK:       '#f97316',
  COMPLIANCE: '#ef4444',
}

const TYPE_BG: Record<EventType, string> = {
  RDV:        'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  CALL:       'bg-green-500/10 text-green-600 dark:text-green-400',
  TASK:       'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  COMPLIANCE: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const TYPE_ICONS: Record<EventType, React.ElementType> = {
  RDV:        CalendarDays,
  CALL:       Phone,
  TASK:       CheckSquare,
  COMPLIANCE: ShieldAlert,
}

const TYPE_LABELS: Record<EventType, string> = {
  RDV:        'RDV client',
  CALL:       'Appel',
  TASK:       'Tâche',
  COMPLIANCE: 'Conformité',
}

function toFcEvent(ev: CalendarEvent): EventInput {
  return {
    id: ev.id,
    title: ev.title,
    start: ev.startAt,
    end: ev.endAt,
    allDay: ev.allDay,
    backgroundColor: TYPE_COLORS[ev.type] + (ev.status === 'CANCELLED' ? '66' : ev.status === 'DONE' ? '99' : 'ff'),
    borderColor: 'transparent',
    textColor: '#fff',
    editable: ev.type !== 'COMPLIANCE',
    extendedProps: ev,
  }
}

// ── Custom event renderer ────────────────────────────────────────────────────

function EventContent({ info }: { info: EventContentArg }) {
  const ev = info.event.extendedProps as CalendarEvent
  const Icon = TYPE_ICONS[ev.type] ?? CalendarDays
  const contact = ev.contact
    ? [ev.contact.firstName, ev.contact.lastName].filter(Boolean).join(' ')
    : null

  return (
    <div className={cn('flex items-start gap-1 px-1.5 py-1 w-full overflow-hidden', ev.status === 'CANCELLED' && 'line-through opacity-60')}>
      <Icon className="h-3 w-3 shrink-0 mt-0.5 opacity-80" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold leading-tight truncate">{info.event.title}</p>
        {contact && <p className="text-[10px] opacity-75 truncate leading-tight">{contact}</p>}
      </div>
    </div>
  )
}

// ── Modal création/édition ───────────────────────────────────────────────────

interface ModalState {
  mode: 'create' | 'edit' | 'view'
  event?: CalendarEvent
  defaultStart?: string
  defaultEnd?: string
  defaultContactId?: string
}

function EventModal({ state, onClose, onSaved }: {
  state: ModalState
  onClose: () => void
  onSaved: () => void
}) {
  const { token } = useAuthStore()
  const { mode, event, defaultStart, defaultEnd, defaultContactId } = state
  const [isEditing, setIsEditing] = useState(mode !== 'view')

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const toLocalDate = (iso: string) => new Date(iso).toISOString().slice(0, 10)

  const [title, setTitle] = useState(event?.title ?? '')
  const [type, setType] = useState<'RDV' | 'CALL' | 'TASK'>((event?.type as 'RDV' | 'CALL' | 'TASK') ?? 'RDV')
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'PLANNED')
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [startAt, setStartAt] = useState(() => {
    if (event) return event.allDay ? toLocalDate(event.startAt) : toLocalDatetime(event.startAt)
    if (defaultStart) return defaultStart.slice(0, 16)
    return toLocalDatetime(new Date().toISOString())
  })
  const [endAt, setEndAt] = useState(() => {
    if (event) return event.allDay ? toLocalDate(event.endAt) : toLocalDatetime(event.endAt)
    if (defaultEnd) return defaultEnd.slice(0, 16)
    return toLocalDatetime(new Date(Date.now() + 3600_000).toISOString())
  })
  const [contactId, setContactId] = useState(event?.contactId ?? defaultContactId ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [error, setError] = useState('')

  const { data: contactsData } = useQuery({
    queryKey: ['contacts-select', token],
    queryFn: () => contactApi.list(token!, { limit: 100 }),
    enabled: !!token,
    staleTime: 60_000,
  })
  const contacts = contactsData?.data.contacts ?? []

  const queryClient = useQueryClient()

  const toISO = (val: string, isAllDay: boolean, isEnd = false) => {
    if (isAllDay) {
      const date = new Date(val + 'T00:00:00')
      if (isEnd) date.setHours(23, 59, 59)
      return date.toISOString()
    }
    return new Date(val).toISOString()
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        type,
        startAt: toISO(startAt, allDay),
        endAt: toISO(endAt, allDay, true),
        allDay,
        status,
        contactId: contactId || null,
        location: location.trim() || null,
        description: description.trim() || null,
      }
      return !event
        ? eventApi.create(payload, token!)
        : eventApi.update(event.id, payload, token!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      onSaved()
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => eventApi.delete(event!.id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      onSaved()
    },
  })

  const isReadonly = mode === 'view' && !isEditing
  const isCompliance = event?.type === 'COMPLIANCE'
  const TypeIcon = TYPE_ICONS[event?.type ?? type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bande couleur en haut */}
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: TYPE_COLORS[event?.type ?? type] }}
        />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn('p-1.5 rounded-lg', TYPE_BG[event?.type ?? type])}>
              <TypeIcon className="h-4 w-4" />
            </div>
            <div>
              {isReadonly
                ? <h2 className="font-semibold text-sm leading-tight">{event?.title}</h2>
                : <h2 className="font-semibold text-sm">{mode === 'create' ? 'Nouvel événement' : 'Modifier'}</h2>
              }
              {isReadonly && event && (
                <p className="text-xs text-muted-foreground mt-0.5">{TYPE_LABELS[event.type]}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isReadonly && !isCompliance && (
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                Modifier
              </Button>
            )}
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="px-5 pb-2 max-h-[70vh] overflow-y-auto">
          {isCompliance && (
            <div className="mb-4 flex items-start gap-2 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Événement généré automatiquement par la conformité — lecture seule.
            </div>
          )}

          {isReadonly ? (
            /* Vue lecture */
            <div className="space-y-3 pb-2">
              <div className="flex items-start gap-2.5 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  {event?.allDay
                    ? format(new Date(event.startAt), 'EEEE d MMMM yyyy', { locale: fr })
                    : <>
                        <p>{format(new Date(event!.startAt), 'EEEE d MMMM yyyy', { locale: fr })}</p>
                        <p className="text-muted-foreground text-xs">
                          {format(new Date(event!.startAt), 'HH:mm')} → {format(new Date(event!.endAt), 'HH:mm')}
                        </p>
                      </>
                  }
                </div>
              </div>
              {event?.contact && (
                <div className="flex items-center gap-2.5 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Link href={`/crm/${event.contactId}`} className="text-primary hover:underline flex items-center gap-1">
                    {[event.contact.firstName, event.contact.lastName].filter(Boolean).join(' ')}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
              {event?.location && (
                <div className="flex items-start gap-2.5 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{event.location}</span>
                </div>
              )}
              {event?.description && (
                <div className="flex items-start gap-2.5 text-sm">
                  <AlignLeft className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs px-2.5 py-1 rounded-full font-medium',
                  event?.status === 'DONE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  event?.status === 'CANCELLED' ? 'bg-muted text-muted-foreground' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                )}>
                  {event?.status === 'DONE' ? 'Réalisé' : event?.status === 'CANCELLED' ? 'Annulé' : 'Planifié'}
                </span>
              </div>
            </div>
          ) : (
            /* Formulaire édition/création */
            <div className="space-y-3 pb-2">
              <div className="space-y-1">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre de l'événement"
                  className="text-sm font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Type</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'RDV' | 'CALL' | 'TASK')}
                    className="w-full h-8 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="RDV">RDV client</option>
                    <option value="CALL">Appel</option>
                    <option value="TASK">Tâche</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Statut</Label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EventStatus)}
                    className="w-full h-8 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="PLANNED">Planifié</option>
                    <option value="DONE">Réalisé</option>
                    <option value="CANCELLED">Annulé</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded border-input h-3.5 w-3.5" />
                <span className="text-sm text-muted-foreground">Toute la journée</span>
              </label>

              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Début</Label>
                  <DateTimePicker
                    value={allDay ? startAt.slice(0, 10) : startAt}
                    onChange={setStartAt}
                    allDay={allDay}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Fin</Label>
                  <DateTimePicker
                    value={allDay ? endAt.slice(0, 10) : endAt}
                    onChange={setEndAt}
                    allDay={allDay}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Contact</Label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Aucun —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
                {contactId && (
                  <Link href={`/crm/${contactId}`} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Voir la fiche contact
                  </Link>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Lieu</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Adresse, visio…" className="h-8 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Notes</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Ordre du jour, notes…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        {(!isReadonly || isEditing) && !isCompliance && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
            {event && (
              <button
                onClick={() => confirm('Supprimer cet événement ?') && deleteMutation.mutate()}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                disabled={deleteMutation.isPending}
              >
                Supprimer
              </button>
            )}
            {!event && <div />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>Annuler</Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !title.trim()}
                style={{ backgroundColor: TYPE_COLORS[type] }}
              >
                {saveMutation.isPending ? 'Enregistrement…' : event ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

type ViewKey = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'timeGridDay', label: 'Jour' },
  { key: 'timeGridWeek', label: 'Semaine' },
  { key: 'dayGridMonth', label: 'Mois' },
  { key: 'listWeek', label: 'Liste' },
]

export default function AgendaClient() {
  const { token } = useAuthStore()
  const calendarRef = useRef<FullCalendar>(null)
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [view, setView] = useState<ViewKey>('timeGridWeek')
  const [title, setTitle] = useState('')
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(['RDV', 'CALL', 'TASK', 'COMPLIANCE']))
  const [modal, setModal] = useState<ModalState | null>(null)
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      end: new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString(),
    }
  })

  // Auto-open create modal when coming from CRM (?contactId=xxx)
  useEffect(() => {
    const contactId = searchParams.get('contactId')
    if (contactId) {
      setModal({ mode: 'create', defaultContactId: contactId })
      router.replace('/agenda')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ['events', token, dateRange, [...activeTypes].sort().join(',')],
    queryFn: () => eventApi.list(token!, {
      start: dateRange.start,
      end: dateRange.end,
      type: [...activeTypes].join(','),
    }),
    enabled: !!token,
    staleTime: 30_000,
  })

  const events = (data?.data.events ?? []).map(toFcEvent)

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof eventApi.update>[1] }) =>
      eventApi.update(id, data, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })

  const toggleType = (t: EventType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  const changeView = (v: ViewKey) => {
    setView(v)
    calendarRef.current?.getApi().changeView(v)
  }

  const handleDateSelect = useCallback((arg: DateSelectArg) => {
    setModal({ mode: 'create', defaultStart: arg.startStr, defaultEnd: arg.endStr })
  }, [])

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const ev = arg.event.extendedProps as CalendarEvent
    setModal({ mode: 'view', event: ev })
  }, [])

  const handleEventDrop = useCallback((arg: EventDropArg) => {
    const ev = arg.event.extendedProps as CalendarEvent
    updateMutation.mutate({ id: ev.id, data: { startAt: arg.event.startStr, endAt: arg.event.endStr ?? arg.event.startStr } })
  }, [updateMutation])

  const handleEventResize = useCallback((arg: EventResizeDoneArg) => {
    const ev = arg.event.extendedProps as CalendarEvent
    updateMutation.mutate({ id: ev.id, data: { startAt: arg.event.startStr, endAt: arg.event.endStr ?? arg.event.startStr } })
  }, [updateMutation])

  const handleDatesSet = useCallback((arg: { startStr: string; endStr: string; view: { title: string } }) => {
    setDateRange({ start: arg.startStr, end: arg.endStr })
    setTitle(arg.view.title)
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        {/* Gauche : navigation + titre */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => calendarRef.current?.getApi().prev()}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => calendarRef.current?.getApi().today()}
            className="h-8 px-3 rounded-lg border border-border text-sm hover:bg-accent transition-colors font-medium"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => calendarRef.current?.getApi().next()}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold ml-1 capitalize hidden sm:block">{title}</h2>
        </div>

        {/* Centre : vues */}
        <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => changeView(v.key)}
              className={cn(
                'px-3 h-7 text-xs font-medium rounded-md transition-all',
                view === v.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Droite : filtres + bouton */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                title={label}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-all',
                  activeTypes.has(t) ? 'border-transparent scale-105' : 'border-transparent opacity-30 grayscale'
                )}
                style={{ backgroundColor: TYPE_COLORS[t] }}
              />
            ))}
          </div>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setModal({ mode: 'create' })}
          >
            <Plus className="h-3.5 w-3.5" />
            Nouveau
          </Button>
        </div>
      </div>

      {/* Légende compacte */}
      <div className="flex gap-3 mb-2">
        {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([t, label]) => (
          <span key={t} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: TYPE_COLORS[t] }} />
            {label}
          </span>
        ))}
      </div>

      {/* Calendrier */}
      <div className="flex-1 min-h-0 rounded-xl border border-border overflow-hidden bg-card agenda-calendar">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50 z-10">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={view}
          locale={frLocale}
          headerToolbar={false}
          events={events}
          selectable
          selectMirror
          editable
          dayMaxEvents={3}
          nowIndicator
          height="100%"
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          datesSet={handleDatesSet}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          eventContent={(info) => <EventContent info={info} />}
          eventClassNames="rounded-md overflow-hidden cursor-pointer"
          dayCellClassNames="hover:bg-accent/30 transition-colors"
        />
      </div>

      {/* Modal */}
      {modal && (
        <EventModal
          state={modal}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
    </div>
  )
}
