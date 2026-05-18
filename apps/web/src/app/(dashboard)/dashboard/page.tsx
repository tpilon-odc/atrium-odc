'use client'

import { useQueries } from '@tanstack/react-query'
import Link from 'next/link'
import {
  CalendarDays,
  Phone,
  CheckSquare,
  ShieldAlert,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import {
  complianceApi,
  supplierApi,
  contactApi,
  documentApi,
  eventApi,
  displayName,
  type PhaseProgress,
  type CalendarEvent,
  type EventType,
} from '@/lib/api'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Helpers ────────────────────────────────────────────────────────────────

// color-mix() compatible avec les var() CSS — pas besoin de hex
function withOpacity(cssVar: string, pct: number) {
  return `color-mix(in srgb, ${cssVar} ${Math.round(pct * 100)}%, transparent)`
}

// Variables CSS → adapte automatiquement au mode nuit
const T = {
  bg:       'var(--gaia-bg)',
  bgDeep:   'var(--gaia-bg-deep)',
  paper:    'var(--gaia-paper)',
  card:     'var(--gaia-card)',
  ink:      'var(--gaia-ink)',
  muted:    'var(--gaia-muted)',
  faint:    'var(--gaia-faint)',
  rule:     'var(--gaia-rule)',
  ruleSoft: 'var(--gaia-rule-soft)',
  layer1:   'var(--gaia-layer-1)',
  layer2:   'var(--gaia-layer-2)',
  layer3:   'var(--gaia-layer-3)',
  layer4:   'var(--gaia-layer-4)',
  accent:   'var(--gaia-accent)',
  accent2:  'var(--gaia-accent-2)',
  accent3:  'var(--gaia-accent-3)',
  stone:    'var(--gaia-stone)',
  onAccent: 'var(--gaia-on-accent)',
}

const tSerif: React.CSSProperties = {
  fontFamily: "'Fraunces', ui-serif, Georgia, serif",
  letterSpacing: '-0.01em',
}
const tSans: React.CSSProperties = {
  fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
}
const tMicro: React.CSSProperties = {
  ...tSans,
  fontSize: 10,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color: 'var(--gaia-faint)',
}

// ── ContourBg SVG (masthead) ───────────────────────────────────────────────

function ContourBg({ opacity = 0.14 }: { opacity?: number }) {
  return (
    <svg
      viewBox="0 0 600 240"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <path
          key={i}
          d={`M0 ${40 + i * 22} C 100 ${20 + i * 22 + (i % 2 ? 14 : -6)}, 240 ${60 + i * 22 + (i % 2 ? -10 : 8)}, 380 ${30 + i * 22 + (i % 2 ? 6 : -12)}, 520 ${50 + i * 22}, 600 ${36 + i * 22}`}
          stroke="var(--gaia-layer-4)"
          strokeWidth="0.7"
          fill="none"
        />
      ))}
    </svg>
  )
}

// ── Masthead ───────────────────────────────────────────────────────────────

function Masthead({ userName, cabinetName, conformitePct }: {
  userName: string
  cabinetName: string
  conformitePct: number
}) {
  return (
    <header style={{
      position: 'relative',
      background: T.paper,
      border: `1px solid ${T.rule}`,
      borderRadius: 18,
      overflow: 'hidden',
      marginBottom: 28,
    }} className="p-5 md:p-7 lg:p-8">
      <ContourBg opacity={0.14} />
      <div style={{ position: 'relative' }} className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <div style={tMicro}>{cabinetName}</div>
          {/* H1 : 30px mobile → 32px tablet → 44px desktop */}
          <h1 style={{ ...tSerif, color: T.ink, margin: '8px 0 4px', fontWeight: 400, lineHeight: 1.05 }}
            className="text-[30px] md:text-[32px] lg:text-[44px]">
            Bonjour {userName}.
          </h1>
          <div style={{ ...tSerif, fontStyle: 'italic', color: T.muted, fontWeight: 300 }}
            className="text-[15px] md:text-[16px] lg:text-[19px]">
            Le cabinet est à{' '}
            <span style={{ color: T.accent, fontWeight: 500 }}>{conformitePct} %</span>{' '}
            de conformité ce matin.
          </div>
        </div>
        {/* CTA : pleine largeur mobile, inline desktop */}
        <div className="flex gap-2 sm:flex-shrink-0 sm:items-start sm:pt-1">
          {/* Bouton secondaire masqué sur mobile compact */}
          <Link href="/crm/nouveau"
            style={{
              ...tSans, fontWeight: 500,
              borderRadius: 999,
              background: 'transparent', color: T.ink,
              border: `1px solid ${T.rule}`,
              textDecoration: 'none', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 44,
            }}
            className="flex px-4 text-[13px]">
            Nouveau client
          </Link>
          <Link href="/agenda"
            style={{
              ...tSans, fontWeight: 600,
              borderRadius: 999,
              background: T.ink, color: T.onAccent,
              textDecoration: 'none', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 44,
            }}
            className="flex-1 sm:flex-none px-4 text-[13px]">
            Rendez-vous client
          </Link>
        </div>
      </div>
    </header>
  )
}

// ── KpiCard avec sparkline ─────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  detail,
  trend,
  accentColor,
  loading,
}: {
  label: string
  value: string | number
  unit?: string
  detail?: string
  trend?: number[]
  accentColor: string
  loading?: boolean
}) {
  const W = 220, H = 38
  let linePath = ''
  let areaPath = ''

  if (trend && trend.length > 1) {
    const max = Math.max(...trend), min = Math.min(...trend)
    const pts = trend.map((v, i) => {
      const x = (i / (trend.length - 1)) * W
      const y = H - ((v - min) / (max - min || 1)) * H
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    linePath = `M${pts.join(' L')}`
    areaPath = `${linePath} L${W},${H} L0,${H} Z`
  }

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.rule}`,
      borderRadius: 14,
      position: 'relative',
      overflow: 'hidden',
    }} className="flex-1 p-3 md:p-4 lg:p-5">
      <div style={tMicro}>{label}</div>
      {loading ? (
        <div style={{ height: 38, width: 70, background: T.rule, borderRadius: 6, marginTop: 8, opacity: 0.4 }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
          {/* Chiffre : 30px mobile → 38px tablet → 46px desktop */}
          <span style={{ ...tSerif, lineHeight: 1, color: T.ink, fontWeight: 400 }}
            className="text-[30px] md:text-[38px] lg:text-[46px]">
            {value}
          </span>
          {unit && (
            <span style={{ ...tSerif, color: T.muted, fontWeight: 400 }}
              className="text-[15px] md:text-[18px] lg:text-[22px]">
              {unit}
            </span>
          )}
        </div>
      )}
      {detail && (
        <div style={{ ...tSans, color: T.muted, marginTop: 6 }} className="text-[10.5px] md:text-[11.5px]">
          {detail}
        </div>
      )}
      {linePath && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 28, opacity: 0.6 }}
        >
          <path d={areaPath} fill={accentColor} opacity="0.16" />
          <path d={linePath} stroke={accentColor} strokeWidth="1.4" fill="none" />
        </svg>
      )}
    </div>
  )
}

// ── Strata — couches géologiques de conformité ─────────────────────────────

function Strata({ phases }: { phases: PhaseProgress[] }) {
  const colors = [T.layer1, T.layer2, T.layer3, T.layer4]
  const overallPct = phases.length
    ? Math.round(phases.reduce((acc, p) => acc + (p.progress?.percentage ?? 0), 0) / phases.length)
    : 0

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.rule}`,
      borderRadius: 14,
      padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={tMicro}>Progression par phase</div>
          <div style={{ ...tSerif, color: T.ink, marginTop: 4 }} className="text-[18px] md:text-[20px] lg:text-[22px]">
            Strates{' '}
            <span className="hidden md:inline">de conformité </span>
            <span style={{ color: T.accent, fontStyle: 'italic' }}>{overallPct} %</span>
          </div>
        </div>
        <Link href="/conformite" style={{ ...tSans, fontSize: 12, color: T.accent, fontWeight: 500, textDecoration: 'none' }}>
          <span className="hidden sm:inline">Voir le </span>détail →
        </Link>
      </div>

      {phases.length === 0 ? (
        <p style={{ ...tSans, fontSize: 13.5, color: T.muted }}>Aucune phase configurée.</p>
      ) : (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.rule}` }}>
          {phases.slice(0, 4).map((p, i) => {
            const pct = (p.progress?.percentage ?? 0) / 100
            const color = colors[i % colors.length]
            const fill = withOpacity(color, 0.22)
            return (
              <div key={p.id} style={{
                position: 'relative',
                background: fill,
                borderTop: i === 0 ? 'none' : `1px solid ${T.rule}`,
                overflow: 'hidden',
              }}
                /* Hauteur : 44px mobile → 50px tablet → 56px desktop */
                className="h-[44px] md:h-[50px] lg:h-[56px]"
              >
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pct * 100}%`,
                  background: color,
                }} />
                {/* Grain texture */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18, pointerEvents: 'none' }}>
                  <defs>
                    <pattern id={`grain-${i}`} width="6" height="6" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="0.6" fill={i < 2 ? '#fff' : '#000'} />
                      <circle cx="4" cy="4" r="0.4" fill={i < 2 ? '#fff' : '#000'} />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#grain-${i})`} />
                </svg>
                <div style={{
                  position: 'relative', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 12px',
                }}>
                  <div style={{
                    ...tSans, fontWeight: 600,
                    color: pct > 0.5 ? T.onAccent : T.ink,
                  }} className="text-[12px] md:text-[12.5px] lg:text-[13.5px]">
                    {p.name}
                  </div>
                  <div style={{
                    ...tSerif,
                    color: pct > 0.7 ? T.onAccent : T.ink,
                  }} className="text-[13px] md:text-[15px] lg:text-[16px]">
                    {p.progress?.completed ?? 0}
                    <span style={{ opacity: 0.6 }}>/{p.progress?.total ?? 0}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {phases.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginTop: 14, ...tSans, fontSize: 11, color: T.muted }}>
          {phases.slice(0, 4).map((p, i) => (
            <span key={p.id}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: colors[i % colors.length], marginRight: 5, transform: 'translateY(-1px)',
              }} />
              {p.name.split(' ')[0]}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', ...tMicro, color: T.faint }} className="hidden sm:inline">
            Couches superposées
          </span>
        </div>
      )}
    </div>
  )
}

// ── TodoItem ───────────────────────────────────────────────────────────────

function TodoItem({ title, sub, due, urgent, href, last }: {
  title: string
  sub: string
  due: string
  urgent: boolean
  href: string
  last: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr auto',
        gap: 12, alignItems: 'center',
        padding: '12px 0',
        borderBottom: last ? 'none' : `1px solid ${T.ruleSoft}`,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          border: `1.5px dashed ${urgent ? T.accent : T.stone}`,
          background: urgent ? withOpacity(T.accent, 0.08) : 'transparent',
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...tSans, color: T.ink, fontWeight: 500, lineHeight: 1.35 }}
            className="text-[12.5px] md:text-[13.5px]">
            {title}
          </div>
          <div style={{ ...tSans, color: T.muted, marginTop: 2 }}
            className="text-[10.5px] md:text-[11.5px]">
            {sub}
          </div>
        </div>
        <div style={{
          ...tSans, fontWeight: 600,
          padding: '3px 8px', borderRadius: 999,
          background: urgent ? T.accent : 'transparent',
          color: urgent ? T.onAccent : T.muted,
          border: urgent ? 'none' : `1px solid ${T.rule}`,
          whiteSpace: 'nowrap',
          minHeight: 28, display: 'flex', alignItems: 'center',
        }} className="text-[10px] md:text-[11px]">
          {due}
        </div>
      </div>
    </Link>
  )
}

// ── EventRow ───────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<EventType, React.ElementType> = {
  RDV: CalendarDays,
  CALL: Phone,
  TASK: CheckSquare,
  COMPLIANCE: ShieldAlert,
}

function EventRow({ ev, last }: { ev: CalendarEvent; last: boolean }) {
  const Icon = EVENT_ICONS[ev.type]
  const date = new Date(ev.startAt)
  const day = format(date, 'd', { locale: fr })
  const month = format(date, 'MMM', { locale: fr }).toUpperCase()
  const time = ev.allDay ? null : format(date, 'HH:mm', { locale: fr })
  const typeLabel = ev.type === 'RDV' ? 'Rendez-vous' : ev.type === 'CALL' ? 'Appel' : ev.type === 'TASK' ? 'Tâche' : 'Conformité'

  return (
    <Link href="/agenda" style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'grid',
        gap: 14, alignItems: 'center',
        padding: '12px 4px',
        borderBottom: last ? 'none' : `1px solid ${T.ruleSoft}`,
      }} className="grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto]">
        {/* Bloc date : 42px mobile → 50px desktop */}
        <div style={{
          textAlign: 'center',
          padding: '6px 4px', borderRadius: 10,
          background: T.paper, border: `1px solid ${T.rule}`,
          flexShrink: 0,
        }} className="w-[42px] md:w-[50px]">
          <div style={{ ...tSerif, color: T.ink, lineHeight: 1 }}
            className="text-[15px] md:text-[18px]">
            {day}
          </div>
          <div style={{ ...tMicro, marginTop: 2 }} className="text-[7.5px] md:text-[8.5px]">{month}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...tSans, color: T.ink, fontWeight: 500, lineHeight: 1.35 }}
            className="text-[12.5px] md:text-[13.5px]">
            {ev.title}
          </div>
          <div style={{ ...tSans, color: T.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}
            className="text-[10.5px] md:text-[11.5px]">
            <Icon style={{ width: 11, height: 11, flexShrink: 0 }} />
            {ev.contact
              ? [ev.contact.firstName, ev.contact.lastName].filter(Boolean).join(' ')
              : time ?? 'Journée entière'}
          </div>
        </div>
        {/* Type masqué sur mobile */}
        <div style={{ ...tMicro, color: T.faint, fontSize: 9, whiteSpace: 'nowrap' }}
          className="hidden md:block">
          {typeLabel}
        </div>
      </div>
    </Link>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { token, user, cabinet } = useAuthStore()

  const [complianceQ, suppliersQ, contactsQ, documentsQ, upcomingQ] = useQueries({
    queries: [
      {
        queryKey: ['compliance-progress', token],
        queryFn: () => complianceApi.getProgress(token!),
        enabled: !!token,
      },
      {
        queryKey: ['suppliers-count', token],
        queryFn: () => supplierApi.list(token!, { limit: 1 }),
        enabled: !!token,
      },
      {
        queryKey: ['contacts-count', token],
        queryFn: () => contactApi.list(token!, { limit: 1 }),
        enabled: !!token,
      },
      {
        queryKey: ['documents-count', token],
        queryFn: () => documentApi.list(token!, { limit: 1 }),
        enabled: !!token,
      },
      {
        queryKey: ['events-upcoming', token],
        queryFn: () => eventApi.upcoming(token!),
        enabled: !!token,
        staleTime: 60_000,
      },
    ],
  })

  const complianceData = complianceQ.data?.data
  const overallPct = complianceData?.globalProgress ?? 0
  const phases = (complianceData?.phases ?? []).filter((p) => !!p?.id)
  const now = new Date()

  const urgentItems = phases.flatMap((p) =>
    p.items
      .filter((i) => i.status === 'expired' || i.status === 'expiring_soon')
      .map((i) => ({ ...i, phaseName: p.name, phaseId: p.id }))
  )

  const notStartedItems = phases.flatMap((p) =>
    p.items
      .filter((i) => i.status === 'not_started')
      .map((i) => ({ ...i, phaseName: p.name, phaseId: p.id }))
  ).slice(0, 3)

  const allTasks = [...urgentItems, ...notStartedItems]

  const suppliersCount = suppliersQ.data?.data.total ?? 0
  const contactsCount = contactsQ.data?.data.total ?? 0
  const documentsCount = documentsQ.data?.data.total ?? 0
  const upcomingEvents = upcomingQ.data?.data.events ?? []

  const userName = user ? (user.firstName ?? displayName(user).split(' ')[0]) : '—'
  const cabinetName = cabinet?.name ?? '—'

  const kpis = [
    {
      label: 'Conformité',
      value: overallPct,
      unit: '%',
      detail: `${phases.filter((p) => p.progress?.status === 'completed').length}/${phases.length} phases validées`,
      trend: [60, 65, 70, 72, 78, 80, overallPct],
      accentColor: T.layer1,
      loading: complianceQ.isLoading,
    },
    {
      label: 'Contacts',
      value: contactsCount,
      detail: 'clients suivis',
      trend: [0, 2, 5, 8, contactsCount - 2, contactsCount],
      accentColor: T.layer2,
      loading: contactsQ.isLoading,
    },
    {
      label: 'Fournisseurs',
      value: suppliersCount,
      detail: 'référencés',
      trend: [0, 1, 2, 3, suppliersCount - 1, suppliersCount],
      accentColor: T.layer3,
      loading: suppliersQ.isLoading,
    },
    {
      label: 'Documents',
      value: documentsCount,
      detail: 'dans la GED',
      trend: [0, 3, 8, 15, documentsCount - 5, documentsCount],
      accentColor: T.layer4,
      loading: documentsQ.isLoading,
    },
  ]

  return (
    <div style={{
      minHeight: '100%',
      background: `linear-gradient(180deg, ${T.bg} 0%, ${T.bgDeep} 100%)`,
      color: T.ink,
      ...tSans,
    }}
      /* padding : 16/18 mobile → 22/24 tablet → 28/40 desktop */
      className="-m-4 md:-m-6 p-4 md:p-6 lg:p-0 lg:m-0 lg:px-10 lg:pt-7 lg:pb-12">

      {/* Masthead */}
      <Masthead userName={userName} cabinetName={cabinetName} conformitePct={overallPct} />

      {/* KPIs — 2×2 mobile/tablet → 4 en ligne desktop */}
      <section className="grid grid-cols-2 lg:flex gap-2.5 md:gap-3 lg:gap-3.5 mb-5 md:mb-6 lg:mb-7">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </section>

      {/* À faire + Strates — stack mobile/tablet → 2 colonnes desktop */}
      <section className="flex flex-col lg:grid lg:grid-cols-[1fr_1.05fr] gap-4 lg:gap-[22px] mb-5 lg:mb-7">

        {/* À faire */}
        <div style={{
          background: T.card, border: `1px solid ${T.rule}`, borderRadius: 14,
          padding: '18px 18px',
        }} className="lg:p-[22px]">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div>
              <div style={tMicro}>À faire</div>
              <div style={{ ...tSerif, color: T.ink, marginTop: 4 }}
                className="text-[18px] md:text-[20px] lg:text-[22px]">
                {allTasks.length > 0 ? (
                  <>
                    {allTasks.length} tâche{allTasks.length > 1 ? 's' : ''}{' '}
                    {urgentItems.length > 0 && (
                      <>· <span style={{ color: T.accent }}>{urgentItems.length} urgente{urgentItems.length > 1 ? 's' : ''}</span></>
                    )}
                  </>
                ) : 'Tout est à jour'}
              </div>
            </div>
            <Link href="/conformite" style={{ ...tSans, fontSize: 12, color: T.accent2, fontWeight: 500, textDecoration: 'none' }}>
              Tout voir →
            </Link>
          </div>

          {complianceQ.isLoading ? (
            <div className="flex flex-col gap-2 mt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 48, borderRadius: 10, background: T.rule, opacity: 0.4 }} />
              ))}
            </div>
          ) : allTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: T.muted, ...tSans, fontSize: 13.5 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div>Aucune action requise.</div>
            </div>
          ) : (
            <div>
              {urgentItems.map((item, idx) => {
                const isExpired = item.status === 'expired'
                const expiresAt = item.answer?.expiresAt ? new Date(item.answer.expiresAt) : null
                const daysLeft = expiresAt
                  ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  : null
                return (
                  <TodoItem
                    key={`u-${idx}`}
                    title={item.label}
                    sub={item.phaseName}
                    due={isExpired ? 'Expiré' : daysLeft !== null ? `J−${daysLeft}` : 'Bientôt'}
                    urgent={true}
                    href={`/conformite/${item.phaseId}`}
                    last={idx === urgentItems.length - 1 && notStartedItems.length === 0}
                  />
                )
              })}
              {notStartedItems.map((item, idx) => (
                <TodoItem
                  key={`ns-${idx}`}
                  title={item.label}
                  sub={item.phaseName}
                  due="À démarrer"
                  urgent={false}
                  href={`/conformite/${item.phaseId}`}
                  last={idx === notStartedItems.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Strates */}
        {complianceQ.isLoading ? (
          <div style={{ background: T.card, border: `1px solid ${T.rule}`, borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ height: 22, width: '60%', background: T.rule, borderRadius: 6, opacity: 0.4, marginBottom: 16 }} />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 50, borderRadius: 4, background: T.rule, opacity: 0.3, marginBottom: 1 }} />
            ))}
          </div>
        ) : (
          <Strata phases={phases} />
        )}
      </section>

      {/* Prochains événements */}
      <section style={{
        background: T.card, border: `1px solid ${T.rule}`, borderRadius: 14,
        padding: '18px 18px',
      }} className="lg:p-[22px]">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div>
            <div style={tMicro}>Saisons & échéances</div>
            <div style={{ ...tSerif, color: T.ink, marginTop: 4 }}
              className="text-[18px] md:text-[20px] lg:text-[22px]">
              Prochains événements
            </div>
          </div>
          <Link href="/agenda" style={{ ...tSans, fontSize: 12, color: T.accent2, fontWeight: 500, textDecoration: 'none' }}>
            Agenda →
          </Link>
        </div>

        {upcomingQ.isLoading ? (
          <div className="flex flex-col gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 58, borderRadius: 8, background: T.rule, opacity: 0.3 }} />
            ))}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <p style={{ ...tSans, fontSize: 13.5, color: T.muted, padding: '14px 0' }}>Aucun événement à venir.</p>
        ) : (
          <div>
            {upcomingEvents.slice(0, 5).map((ev: CalendarEvent, i: number) => (
              <EventRow key={ev.id} ev={ev} last={i === Math.min(upcomingEvents.length, 5) - 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
