import { FastifyPluginAsync } from 'fastify'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { toCsv, csvReply } from '../../lib/csv'
import { getPresignedUrl } from '../../lib/minio'

export const exportRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/v1/exports/contacts ──────────────────────────────────────────
  app.get('/contacts', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const contacts = await prisma.contact.findMany({
      where: { cabinetId: request.cabinetId, deletedAt: null },
      orderBy: { lastName: 'asc' },
    })

    const rows = contacts.map((c) => ({
      id: c.id,
      type: c.type,
      nom: c.lastName,
      prenom: c.firstName ?? '',
      email: c.email ?? '',
      telephone: c.phone ?? '',
      date_creation: c.createdAt.toISOString(),
    }))

    return csvReply(reply, 'contacts.csv', toCsv(rows))
  })

  // ── GET /api/v1/exports/suppliers ─────────────────────────────────────────
  app.get('/suppliers', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const cabinetSuppliers = await prisma.cabinetSupplier.findMany({
      where: { cabinetId: request.cabinetId },
      include: { supplier: true },
      orderBy: { supplier: { name: 'asc' } },
    })

    const rows = cabinetSuppliers.map((cs) => ({
      id: cs.supplier.id,
      nom: cs.supplier.name,
      categorie: cs.supplier.category ?? '',
      note_publique: cs.supplier.avgPublicRating ?? '',
      note_privee: cs.privateNote ?? '',
      date_creation: cs.supplier.createdAt.toISOString(),
    }))

    return csvReply(reply, 'fournisseurs.csv', toCsv(rows))
  })

  // ── GET /api/v1/exports/documents ─────────────────────────────────────────
  app.get('/documents', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const documents = await prisma.document.findMany({
      where: { cabinetId: request.cabinetId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    const rows = documents.map((d) => ({
      id: d.id,
      nom: d.name,
      mode_stockage: d.storageMode,
      type_mime: d.mimeType ?? '',
      taille_octets: d.sizeBytes?.toString() ?? '',
      description: d.description ?? '',
      chemin: d.storagePath ?? '',
      chemin_externe: d.externalPath ?? '',
      date_upload: d.createdAt.toISOString(),
    }))

    return csvReply(reply, 'documents.csv', toCsv(rows))
  })

  // ── GET /api/v1/exports/trainings ─────────────────────────────────────────
  app.get('/trainings', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const trainings = await prisma.collaboratorTraining.findMany({
      where: { cabinetId: request.cabinetId, deletedAt: null },
      include: {
        training: true,
        user: { select: { email: true } },
      },
      orderBy: { trainingDate: 'desc' },
    })

    const rows = trainings.map((t) => ({
      id: t.id,
      collaborateur: t.user.email,
      formation: t.training.name,
      organisateur: t.training.organizer ?? '',
      categorie: t.training.category ?? '',
      date: t.trainingDate.toISOString().split('T')[0],
      heures: t.hoursCompleted ?? '',
      notes: t.notes ?? '',
    }))

    return csvReply(reply, 'formations.csv', toCsv(rows))
  })

  // ── GET /api/v1/exports/compliance ────────────────────────────────────────
  app.get('/compliance', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const answers = await prisma.cabinetComplianceAnswer.findMany({
      where: { cabinetId: request.cabinetId, deletedAt: null },
      include: {
        item: { select: { label: true, type: true } },
      },
      orderBy: { submittedAt: 'asc' },
    })

    const rows = answers.map((a) => ({
      item: a.item.label,
      type: a.item.type,
      statut: a.status,
      soumis_le: a.submittedAt?.toISOString() ?? '',
      expire_le: a.expiresAt?.toISOString() ?? '',
    }))

    return csvReply(reply, 'conformite.csv', toCsv(rows))
  })

  // ── POST /api/v1/exports/jobs ─────────────────────────────────────────────
  // Crée un job d'export global du cabinet (traité de manière asynchrone)
  app.post('/jobs', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    // Vérifie qu'il n'y a pas déjà un job en cours pour ce cabinet
    const pending = await prisma.exportJob.findFirst({
      where: {
        cabinetId: request.cabinetId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    })
    if (pending) {
      return reply.status(409).send({
        error: 'Un export est déjà en cours pour ce cabinet',
        code: 'EXPORT_ALREADY_PENDING',
      })
    }

    const job = await prisma.exportJob.create({
      data: {
        cabinetId: request.cabinetId,
        requestedBy: request.user.id,
        status: 'PENDING',
      },
    })

    return reply.status(201).send({ data: { job } })
  })

  // ── GET /api/v1/exports/jobs ──────────────────────────────────────────────
  app.get('/jobs', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const jobs = await prisma.exportJob.findMany({
      where: { cabinetId: request.cabinetId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return reply.send({ data: { jobs } })
  })

  // ── GET /api/v1/exports/jobs/:id ──────────────────────────────────────────
  app.get('/jobs/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const job = await prisma.exportJob.findFirst({
      where: { id, cabinetId: request.cabinetId },
    })
    if (!job) {
      return reply.status(404).send({ error: 'Job introuvable', code: 'NOT_FOUND' })
    }

    let downloadUrl: string | null = null
    if (job.status === 'DONE' && job.storagePath) {
      downloadUrl = getPresignedUrl(job.storagePath)
    }

    return reply.send({ data: { job, downloadUrl } })
  })
}
