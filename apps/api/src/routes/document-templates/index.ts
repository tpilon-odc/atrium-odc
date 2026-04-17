import { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { TemplateTargetEntity } from '@cgp/db'
import { authMiddleware } from '../../middleware/auth'
import { cabinetMiddleware } from '../../middleware/cabinet'
import { prisma } from '../../lib/prisma'
import { uploadToMinio, deleteFromMinio, buildStoragePath, getPresignedUrl, MAX_FILE_SIZE } from '../../lib/minio'
import { resolveVariableValues, mergeDocxTemplate, uploadMergedDocx, type TemplateVariable } from '../../lib/documentMerge'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const documentTemplateRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } })

  // ── GET / ─────────────────────────────────────────────────────────────────
  // Liste les templates du cabinet
  app.get('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const templates = await prisma.documentTemplate.findMany({
      where: { cabinetId: request.cabinetId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        targetEntity: true,
        variables: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { generations: true } },
      },
    })
    return reply.send({ data: { templates } })
  })

  // ── POST / ────────────────────────────────────────────────────────────────
  // Créer un template — multipart : fichier .docx + champs JSON
  app.post('/', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const parts = request.parts()

    let fileBuffer: Buffer | null = null
    let filename = ''
    let name = ''
    let description: string | undefined
    let targetEntity: TemplateTargetEntity | null = null
    let variables: TemplateVariable[] = []

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.mimetype !== DOCX_MIME) {
          return reply.status(400).send({ error: 'Seuls les fichiers .docx sont acceptés', code: 'INVALID_FILE_TYPE' })
        }
        fileBuffer = await part.toBuffer()
        filename = part.filename
      } else {
        switch (part.fieldname) {
          case 'name':
            name = (part as any).value as string
            break
          case 'description':
            description = (part as any).value as string
            break
          case 'targetEntity':
            targetEntity = (part as any).value as TemplateTargetEntity
            break
          case 'variables':
            try {
              variables = JSON.parse((part as any).value as string)
            } catch {
              return reply.status(400).send({ error: 'Format variables invalide', code: 'VALIDATION_ERROR' })
            }
            break
        }
      }
    }

    if (!fileBuffer || !filename) {
      return reply.status(400).send({ error: 'Fichier .docx requis', code: 'VALIDATION_ERROR' })
    }
    if (!name?.trim()) {
      return reply.status(400).send({ error: 'Nom du template requis', code: 'VALIDATION_ERROR' })
    }
    if (!targetEntity || !Object.values(TemplateTargetEntity).includes(targetEntity)) {
      return reply.status(400).send({ error: 'Entité cible invalide', code: 'VALIDATION_ERROR' })
    }

    const fileKey = buildStoragePath(request.cabinetId, filename)
    await uploadToMinio(fileKey, fileBuffer, DOCX_MIME)

    const template = await prisma.documentTemplate.create({
      data: {
        cabinetId: request.cabinetId,
        name: name.trim(),
        description: description?.trim() || null,
        fileKey,
        targetEntity,
        variables: variables as object,
      },
    })

    return reply.status(201).send({ data: { template } })
  })

  // ── GET /:id ──────────────────────────────────────────────────────────────
  app.get('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const template = await prisma.documentTemplate.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!template) return reply.status(404).send({ error: 'Template introuvable', code: 'NOT_FOUND' })

    return reply.send({ data: { template } })
  })

  // ── PATCH /:id ────────────────────────────────────────────────────────────
  // Mettre à jour nom, description et/ou variables (pas le fichier)
  app.patch('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      description?: string
      variables?: TemplateVariable[]
    }

    const existing = await prisma.documentTemplate.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) return reply.status(404).send({ error: 'Template introuvable', code: 'NOT_FOUND' })

    const template = await prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
        ...(body.variables !== undefined ? { variables: body.variables as object } : {}),
      },
    })

    return reply.send({ data: { template } })
  })

  // ── POST /:id/file ────────────────────────────────────────────────────────
  // Remplacer le fichier .docx d'un template existant
  app.post('/:id/file', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.documentTemplate.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!existing) return reply.status(404).send({ error: 'Template introuvable', code: 'NOT_FOUND' })

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Fichier requis', code: 'VALIDATION_ERROR' })
    if (data.mimetype !== DOCX_MIME) {
      return reply.status(400).send({ error: 'Seuls les fichiers .docx sont acceptés', code: 'INVALID_FILE_TYPE' })
    }

    const buffer = await data.toBuffer()
    const newFileKey = buildStoragePath(request.cabinetId, data.filename)
    await uploadToMinio(newFileKey, buffer, DOCX_MIME)

    // Supprimer l'ancien fichier
    try { await deleteFromMinio(existing.fileKey) } catch { /* ignore si déjà supprimé */ }

    const template = await prisma.documentTemplate.update({
      where: { id },
      data: { fileKey: newFileKey },
    })

    return reply.send({ data: { template } })
  })

  // ── DELETE /:id ───────────────────────────────────────────────────────────
  app.delete('/:id', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const template = await prisma.documentTemplate.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!template) return reply.status(404).send({ error: 'Template introuvable', code: 'NOT_FOUND' })

    await prisma.documentTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return reply.status(204).send()
  })

  // ── POST /:id/generate ────────────────────────────────────────────────────
  // Fusionne le template avec les données d'un contact/cabinet et retourne le .docx
  app.post('/:id/generate', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { contactId?: string }

    const template = await prisma.documentTemplate.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
    })
    if (!template) return reply.status(404).send({ error: 'Template introuvable', code: 'NOT_FOUND' })

    if (template.targetEntity === TemplateTargetEntity.CONTACT && !body?.contactId) {
      return reply.status(400).send({ error: 'contactId requis pour ce template', code: 'VALIDATION_ERROR' })
    }

    if (body?.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: body.contactId, cabinetId: request.cabinetId, deletedAt: null },
      })
      if (!contact) return reply.status(404).send({ error: 'Contact introuvable', code: 'NOT_FOUND' })
    }

    const variables = template.variables as unknown as TemplateVariable[]
    const fieldKeys = variables.map((v) => v.fieldKey)

    const resolvedValues = await resolveVariableValues(fieldKeys, {
      contactId: body?.contactId,
      cabinetId: request.cabinetId,
      generatedByUserId: request.user.id,
    })

    const mergedBuffer = await mergeDocxTemplate(template.fileKey, variables, resolvedValues)

    const originalName = template.fileKey.split('/').pop() ?? template.name
    const generatedKey = await uploadMergedDocx(request.cabinetId, mergedBuffer, originalName)

    await prisma.documentTemplateGeneration.create({
      data: {
        templateId: template.id,
        contactId: body?.contactId ?? null,
        generatedBy: request.user.id,
        fileKey: generatedKey,
      },
    })

    const downloadUrl = await getPresignedUrl(generatedKey)

    return reply.send({ data: { downloadUrl, fileKey: generatedKey } })
  })

  // ── GET /:id/generations ──────────────────────────────────────────────────
  app.get('/:id/generations', { preHandler: [authMiddleware, cabinetMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const template = await prisma.documentTemplate.findFirst({
      where: { id, cabinetId: request.cabinetId, deletedAt: null },
      select: { id: true },
    })
    if (!template) return reply.status(404).send({ error: 'Template introuvable', code: 'NOT_FOUND' })

    const generations = await prisma.documentTemplateGeneration.findMany({
      where: { templateId: id },
      orderBy: { generatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        generatedAt: true,
        fileKey: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    // Ajouter les URLs de téléchargement
    const generationsWithUrls = await Promise.all(
      generations.map(async (g) => ({
        ...g,
        downloadUrl: await getPresignedUrl(g.fileKey),
      }))
    )

    return reply.send({ data: { generations: generationsWithUrls } })
  })

  // ── GET /fields ───────────────────────────────────────────────────────────
  // Catalogue des champs disponibles par entité cible.
  // Pour COMPLIANCE, les items sont chargés dynamiquement depuis la DB.
  app.get('/fields', { preHandler: [authMiddleware, cabinetMiddleware] }, async (_request, reply) => {
    // Charger les phases de conformité actives avec leurs items
    const compliancePhases = await prisma.compliancePhase.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        label: true,
        items: {
          orderBy: { order: 'asc' },
          select: { id: true, label: true, type: true },
        },
      },
    })

    // Chaque item devient un champ avec fieldKey = "compliance_item_<id>"
    // On groupe par phase pour que le frontend puisse afficher des sections
    const complianceFields = compliancePhases.map((phase) => ({
      phaseId: phase.id,
      phaseLabel: phase.label,
      items: phase.items.map((item) => ({
        fieldKey: `compliance_item_${item.id}`,
        label: item.label,
        type: item.type,
      })),
    }))

    const catalog = {
      CONTACT: [
        { fieldKey: 'contact_prenom', label: 'Prénom' },
        { fieldKey: 'contact_nom', label: 'Nom' },
        { fieldKey: 'contact_nom_complet', label: 'Nom complet' },
        { fieldKey: 'contact_email', label: 'Email principal' },
        { fieldKey: 'contact_email2', label: 'Email secondaire' },
        { fieldKey: 'contact_telephone', label: 'Téléphone principal' },
        { fieldKey: 'contact_telephone2', label: 'Téléphone secondaire' },
        { fieldKey: 'contact_date_naissance', label: 'Date de naissance' },
        { fieldKey: 'contact_profession', label: 'Profession' },
        { fieldKey: 'contact_adresse', label: 'Adresse' },
        { fieldKey: 'contact_ville', label: 'Ville' },
        { fieldKey: 'contact_code_postal', label: 'Code postal' },
        { fieldKey: 'contact_pays', label: 'Pays' },
        { fieldKey: 'contact_situation_maritale', label: 'Situation maritale' },
        { fieldKey: 'contact_personnes_a_charge', label: 'Personnes à charge' },
      ],
      CABINET: [
        { fieldKey: 'cabinet_nom', label: 'Nom du cabinet' },
        { fieldKey: 'cabinet_siret', label: 'SIRET / SIREN' },
        { fieldKey: 'cabinet_forme_juridique', label: 'Forme juridique' },
        { fieldKey: 'cabinet_capital_social', label: 'Capital social' },
        { fieldKey: 'cabinet_date_immatriculation', label: "Date d'immatriculation" },
        { fieldKey: 'cabinet_adresse', label: 'Adresse' },
        { fieldKey: 'cabinet_code_postal', label: 'Code postal' },
        { fieldKey: 'cabinet_ville', label: 'Ville' },
        { fieldKey: 'cabinet_adresse_complete', label: 'Adresse complète (rue + CP + ville)' },
        { fieldKey: 'cabinet_orias', label: 'Numéro ORIAS' },
        { fieldKey: 'cabinet_categories_orias', label: 'Catégories ORIAS (CIF, COA…)' },
        { fieldKey: 'cabinet_orias_validite', label: "ORIAS valide jusqu'au" },
        { fieldKey: 'cabinet_date_adhesion_cncgp', label: 'Date adhésion CNCGP' },
        { fieldKey: 'cabinet_site_web', label: 'Site web' },
      ],
      // Pour COMPLIANCE : champs cabinet + items conformité dynamiques
      COMPLIANCE: [
        { fieldKey: 'cabinet_nom', label: 'Nom du cabinet' },
        { fieldKey: 'cabinet_siret', label: 'SIRET / SIREN' },
        { fieldKey: 'cabinet_forme_juridique', label: 'Forme juridique' },
        { fieldKey: 'cabinet_adresse_complete', label: 'Adresse complète' },
        { fieldKey: 'cabinet_orias', label: 'Numéro ORIAS' },
        { fieldKey: 'cabinet_categories_orias', label: 'Catégories ORIAS (CIF, COA…)' },
        { fieldKey: 'cabinet_orias_validite', label: "ORIAS valide jusqu'au" },
        { fieldKey: 'cabinet_date_adhesion_cncgp', label: 'Date adhésion CNCGP' },
      ],
      SYSTEM: [
        { fieldKey: 'date_aujourd_hui', label: "Date d'aujourd'hui" },
        { fieldKey: 'annee_en_cours', label: 'Année en cours' },
        { fieldKey: 'conseiller_prenom', label: 'Prénom conseiller' },
        { fieldKey: 'conseiller_nom', label: 'Nom conseiller' },
        { fieldKey: 'conseiller_nom_complet', label: 'Nom complet conseiller' },
        { fieldKey: 'conseiller_email', label: 'Email conseiller' },
      ],
      // Sections conformité groupées par phase (uniquement pour targetEntity COMPLIANCE)
      COMPLIANCE_PHASES: complianceFields,
    }
    return reply.send({ data: { catalog } })
  })
}
