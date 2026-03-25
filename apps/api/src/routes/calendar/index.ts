import { FastifyPluginAsync } from 'fastify'
import ical from 'ical-generator'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'

const TYPE_LABELS: Record<string, string> = {
  RDV: 'RDV',
  CALL: 'Appel',
  TASK: 'Tâche',
  COMPLIANCE: 'Conformité',
}

export const calendarRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/calendar/:cabinet_id/feed.ics?token=XXX — public, protégé par ics_token
  app.get('/:cabinetId/feed.ics', async (request, reply) => {
    const { cabinetId } = request.params as { cabinetId: string }
    const { token } = request.query as { token?: string }

    if (!token) {
      return reply.status(401).send('Token manquant')
    }

    const cabinet = await prisma.cabinet.findFirst({
      where: { id: cabinetId, icsToken: token },
      select: { id: true, name: true },
    })

    if (!cabinet) {
      return reply.status(401).send('Token invalide')
    }

    const events = await prisma.event.findMany({
      where: { cabinetId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        startAt: true,
        endAt: true,
        allDay: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        contact: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startAt: 'asc' },
    })

    const cal = ical({ name: `Agenda CGP — ${cabinet.name}` })

    for (const ev of events) {
      const summary = `[${TYPE_LABELS[ev.type] ?? ev.type}] ${ev.title}`
      const description = [
        ev.description,
        ev.contact
          ? `Contact : ${[ev.contact.firstName, ev.contact.lastName].filter(Boolean).join(' ')}`
          : null,
        ev.status !== 'PLANNED' ? `Statut : ${ev.status}` : null,
      ]
        .filter((s): s is string => !!s)
        .join('\n')

      cal.createEvent({
        id: ev.id,
        summary,
        description: description || undefined,
        location: ev.location ?? undefined,
        start: ev.startAt,
        end: ev.endAt,
        allDay: ev.allDay,
        created: ev.createdAt,
        lastModified: ev.updatedAt,
      })
    }

    reply.header('Content-Type', 'text/calendar; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="cgp-agenda.ics"')
    reply.header('Cache-Control', 'no-cache, no-store')

    return reply.send(cal.toString())
  })

  // POST /api/v1/calendar/regenerate-token — authentifié
  app.post('/regenerate-token', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const cabinet = await prisma.cabinet.update({
      where: { id: request.cabinetId },
      data: { icsToken: crypto.randomUUID() },
      select: { id: true, icsToken: true },
    })

    return reply.send({ data: { icsToken: cabinet.icsToken } })
  })
}
