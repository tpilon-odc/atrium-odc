import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
} from 'docx'
import { saveAs } from 'file-saver'
import { PcaData } from '@/lib/api'

export type CabinetInfo = {
  name?: string | null
  siret?: string | null
  oriasNumber?: string | null
  city?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function h1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
  })
}

function h2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  })
}

function p(text: string, options?: { bold?: boolean; indent?: boolean }): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: options?.bold, size: 22 })],
    spacing: { after: 100 },
    indent: options?.indent ? { left: 360 } : undefined,
  })
}

function field(label: string, value: string | undefined | null): Paragraph[] {
  if (!value?.trim()) return []
  return [
    new Paragraph({
      children: [
        new TextRun({ text: `${label} : `, bold: true, size: 22 }),
        new TextRun({ text: value, size: 22 }),
      ],
      spacing: { after: 100 },
    }),
  ]
}

function multiline(label: string, value: string | undefined | null): Paragraph[] {
  if (!value?.trim()) return []
  const lines = value.split('\n').filter((l) => l.trim())
  return [
    new Paragraph({ children: [new TextRun({ text: `${label} :`, bold: true, size: 22 })], spacing: { after: 80 } }),
    ...lines.map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 60 }, indent: { left: 360 } })),
    new Paragraph({ text: '', spacing: { after: 60 } }),
  ]
}

function separator(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
    spacing: { after: 240 },
    text: '',
  })
}

function tableRow(cells: string[], header = false): TableRow {
  return new TableRow({
    children: cells.map((text) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 20 })] })],
        verticalAlign: VerticalAlign.CENTER,
        width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      })
    ),
    tableHeader: header,
  })
}

// ── Export principal ─────────────────────────────────────────────────────────

export async function exportPcaDocx(data: PcaData, cabinet?: CabinetInfo) {
  const org = (data.organisation ?? {}) as Record<string, unknown>
  const donnees = (data.donnees ?? {}) as Record<string, string>
  const proc = (data.procedures ?? {}) as {
    lieuReplacement?: string
    listeTelephoniqueLocalisation?: string
    risques?: Array<{ id: string; libelle: string; consequencesSolutions: string }>
    absences?: Array<{ id: string; nomFonction: string; remplacant: string }>
  }

  const today = new Date().toLocaleDateString('fr-FR')
  const personnesAcces = (org.personnesAcces as Array<Record<string, string>> | undefined) ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [
    // Page de titre
    new Paragraph({
      children: [new TextRun({ text: "PLAN DE CONTINUITÉ D'ACTIVITÉ", bold: true, size: 40 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: cabinet?.name || '', size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Document généré le ${today}`, size: 20, color: '888888' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    ...(cabinet?.siret ? [new Paragraph({ children: [new TextRun({ text: `SIRET : ${cabinet.siret}`, size: 20, color: '888888' })], alignment: AlignmentType.CENTER, spacing: { after: 60 } })] : []),
    ...(cabinet?.oriasNumber ? [new Paragraph({ children: [new TextRun({ text: `ORIAS : ${cabinet.oriasNumber}`, size: 20, color: '888888' })], alignment: AlignmentType.CENTER, spacing: { after: 60 } })] : []),
    ...(cabinet?.city ? [new Paragraph({ children: [new TextRun({ text: cabinet.city, size: 20, color: '888888' })], alignment: AlignmentType.CENTER, spacing: { after: 600 } })] : [new Paragraph({ text: '', spacing: { after: 600 } })]),

    // Préambule
    new Paragraph({
      children: [new TextRun({ text: "Le plan de continuité d'activité précise l'ensemble des dispositifs mis en place pour assurer, après la manifestation de dysfonctionnements graves dans le déroulement des activités de l'entreprise, la continuité de ces activités, dans un souci de conditions de volumes, de délais et de qualité compatibles avec ses engagements juridiques, professionnels et économiques.", size: 22, italics: true })],
      spacing: { after: 200 },
    }),
    separator(),

    // ── 1. ORGANISATION ──────────────────────────────────────────────────────
    h1('1. ORGANISATION'),

    h2("Responsable de la continuité de l'activité"),
    p("Est en charge de la mise en œuvre du plan de continuité d'activité :"),
    ...field('Madame / Monsieur', org.responsableNom as string),
    ...field('Exerçant la fonction de', org.responsableFonction as string),

    h2('Sécurité des locaux'),
    p("L'entreprise dispose de locaux situés :"),
    ...field('Adresse', [org.locauxRue, org.locauxCodePostal, org.locauxVille].filter(Boolean).join(', ') || undefined),
    ...field("Contrôle d'accès", org.locauxControleAcces as string),

    ...(personnesAcces.length > 0
      ? [
          new Paragraph({ children: [new TextRun({ text: 'Personnes ayant accès aux locaux :', bold: true, size: 22 })], spacing: { before: 200, after: 100 } }),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              tableRow(['Nom', 'Prénom', 'Fonction', "Type d'accès"], true),
              ...personnesAcces.map((p) => tableRow([p.nom ?? '', p.prenom ?? '', p.fonction ?? '', p.typeAcces ?? ''])),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 100 } }),
        ]
      : []),

    ...field('Vidéosurveillance', org.videoSurveillanceSociete as string),

    h2('Ressources humaines'),
    ...multiline('Règles de présence et suppléance', org.reglesPresence as string),

    h2('Mesures de prévention incendie et accident'),
    ...multiline('Dispositifs en place', org.preventionIncendie as string),
    separator(),

    // ── 2. DONNÉES ───────────────────────────────────────────────────────────
    h1('2. ENREGISTREMENT ET CONSERVATION DES DONNÉES'),

    h2('Système informatique'),
    ...multiline('Organisation et sauvegarde des données', donnees.systemeInformatique),
    ...field('Prestataire de maintenance informatique', donnees.prestataireMaintenance),

    h2('Gestion des accès et sécurité'),
    ...field('Politique de mots de passe', donnees.politiqueMotDePasse),
    ...field('Antivirus et pare-feu', donnees.antivirus),

    h2('Accès aux courriels'),
    ...(donnees.urlMessagerie
      ? [p(`Les messageries sont accessibles via : ${donnees.urlMessagerie}`)]
      : [p('(Non renseigné)', { indent: true })]),

    h2('Supervision informatique'),
    ...field('Responsable', [donnees.responsableSupervisionCivilite, donnees.responsableSupervisionPrenom, donnees.responsableSupervisionNom].filter(Boolean).join(' ') || undefined),
    ...multiline('Missions et responsabilités', donnees.missionsSupervision),

    h2('Enregistrement et conservation des informations'),
    ...multiline('Politique de conservation', donnees.conservationDocuments),
    separator(),

    // ── 3. PROCÉDURES ────────────────────────────────────────────────────────
    h1('3. PROCÉDURE À SUIVRE EN CAS DE DYSFONCTIONNEMENT'),

    h2('Indisponibilité des locaux'),
    ...multiline('Lieu de repli et organisation', proc.lieuReplacement),
    ...field('Localisation de la liste téléphonique des partenaires', proc.listeTelephoniqueLocalisation),

    h2('Cartographie des risques'),
    ...(proc.risques && proc.risques.length > 0
      ? [
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              tableRow(['N°', 'Risque', 'Conséquences et solutions'], true),
              ...proc.risques.map((r, idx) =>
                tableRow([String(idx + 1), r.libelle, r.consequencesSolutions])
              ),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
        ]
      : [p('(Aucun risque renseigné)', { indent: true })]),

    ...(proc.absences && proc.absences.length > 0
      ? [
          h2("Absence prolongée d'un collaborateur"),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              tableRow(['Nom / Fonction', 'Remplaçant'], true),
              ...proc.absences.map((a) => tableRow([a.nomFonction, a.remplacant])),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
        ]
      : []),

    separator(),

    // ── ANNEXE ───────────────────────────────────────────────────────────────
    h1('ANNEXE — RÉFÉRENCES ANSSI'),
    p('• ANSSI, La cybersécurité pour les TPE/PME en douze questions :'),
    p('https://www.ssi.gouv.fr/entreprise/guide/la-cybersecurite-pour-les-tpepme-en-douze-questions/', { indent: true }),
    p('• ANSSI, Bonnes pratiques à l\'usage des professionnels en déplacement :'),
    p('https://www.ssi.gouv.fr/entreprise/guide/partir-en-mission-avec-son-telephone-sa-tablette-ou-son-ordinateur-portable/', { indent: true }),
    p('• ANSSI, Guide d\'hygiène informatique :'),
    p('https://www.ssi.gouv.fr/entreprise/guide/guide-dhygiene-informatique/', { indent: true }),
    p('• ANSSI, Guide des bonnes pratiques de l\'informatique :'),
    p('https://www.ssi.gouv.fr/entreprise/guide/guide-des-bonnes-pratiques-de-linformatique/', { indent: true }),
  ]

  const doc = new Document({
    creator: 'Plateforme CGP',
    title: `PCA — ${cabinet?.name || 'Cabinet'}`,
    description: "Plan de Continuité d'Activité",
    sections: [{ children }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `PCA_${(cabinet?.name ?? 'cabinet').replace(/\s+/g, '_')}_${today.replace(/\//g, '-')}.docx`
  saveAs(blob, filename)
}
