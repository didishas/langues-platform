/**
 * RGPD : export et effacement des données d'un élève, à la demande de Catherine.
 *
 * Effacement = la fiche devient « Ancien élève n°X » (plus aucune donnée personnelle, plus de connexion)
 * au lieu d'être supprimée : les factures, qui doivent être conservées, gardent ainsi leur lien et le
 * client imprimé dessus. Durées de conservation à valider avec le comptable : rien n'est effacé automatiquement.
 */
import fs from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'

import { strToU8, zipSync, type Zippable } from 'fflate'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'

const idOf = (v: unknown): number | undefined =>
  v && typeof v === 'object' ? (v as { id: number }).id : typeof v === 'number' ? v : undefined

export class PrivacyError extends Error {
  constructor(
    public code: 'not_found' | 'confirm' | 'blocked' | 'already_erased',
    public details: string[] = [],
  ) {
    super(code)
  }
}

/** Champs techniques du compte, jamais exportés (mot de passe, sessions, jetons). */
const ACCOUNT_SECRETS = ['hash', 'salt', 'sessions', 'resetPasswordToken', 'resetPasswordExpiration', 'loginAttempts', 'lockUntil', '_verified', '_verificationToken']
const withoutSecrets = <T extends Record<string, unknown>>(doc: T) =>
  Object.fromEntries(Object.entries(doc).filter(([k]) => !ACCOUNT_SECRETS.includes(k)))

const INVOICE_STATE: Record<string, string> = {
  to_validate: 'à valider ou annuler',
  validated: 'validée, pas encore payée',
  sent: 'envoyée, pas encore payée',
}

const all = { pagination: false as const, depth: 0, overrideAccess: true }

/** Toutes les données qui concernent l'élève. Lu avec les droits de l'équipe : l'appelant a vérifié que c'est Catherine. */
async function collect(payload: Payload, studentId: number, req?: PayloadRequest) {
  const q = { ...all, ...(req ? { req } : {}) }
  const student = await payload.findByID({ collection: 'students', id: studentId, depth: 0, overrideAccess: true, ...(req ? { req } : {}) }).catch(() => null)
  if (!student) throw new PrivacyError('not_found')
  const mine = { student: { equals: studentId } }
  const [bookings, submissions, attempts, files, prestations, invoices, assignments, documents, videos, messages] = await Promise.all([
    payload.find({ collection: 'bookings', where: mine, ...q }),
    payload.find({ collection: 'submissions', where: mine, ...q }),
    payload.find({ collection: 'exercise-attempts', where: mine, ...q }),
    payload.find({ collection: 'submission-files', where: { owner: { equals: studentId } }, ...q }),
    payload.find({ collection: 'prestations', where: mine, ...q }),
    payload.find({ collection: 'invoices', where: mine, ...q }),
    payload.find({ collection: 'assignments', where: { students: { equals: studentId } }, ...q }),
    payload.find({ collection: 'documents', where: { sharedWith: { equals: studentId } }, ...q }),
    payload.find({ collection: 'videos', where: { students: { equals: studentId } }, ...q }),
    payload.find({ collection: 'outbox', where: mine, ...q }),
  ])
  const slotIds = bookings.docs.map((b) => idOf(b.slot)).filter((id): id is number => id !== undefined)
  const slots = slotIds.length ? (await payload.find({ collection: 'slots', where: { id: { in: slotIds } }, ...q })).docs : []
  const trials = student.email
    ? (await payload.find({ collection: 'trial-requests', where: { email: { equals: student.email } }, ...q })).docs
    : []
  return {
    student,
    bookings: bookings.docs,
    slots,
    submissions: submissions.docs,
    attempts: attempts.docs,
    files: files.docs,
    prestations: prestations.docs,
    invoices: invoices.docs,
    assignments: assignments.docs,
    documents: documents.docs,
    videos: videos.docs,
    messages: messages.docs,
    trials,
  }
}

const README = `Export des données personnelles — MotàMot

donnees.json : la fiche de l'élève, ses séances, ses devoirs rendus, ses réponses aux exercices,
ses prestations, ses factures, et les devoirs, documents et vidéos qui lui ont été attribués.
fichiers/ : les fichiers envoyés par l'élève (devoirs, réponses orales).
`

/** Archive ZIP de toutes les données de l'élève et des fichiers qu'il a envoyés. */
export async function exportStudentData(payload: Payload, studentId: number): Promise<{ zip: Uint8Array; filename: string }> {
  const d = await collect(payload, studentId)
  const slotById = new Map(d.slots.map((s) => [s.id, s]))
  const data = {
    exportedAt: new Date().toISOString(),
    student: withoutSecrets(d.student as unknown as Record<string, unknown>),
    sessions: d.bookings.map((b) => {
      const slot = slotById.get(idOf(b.slot) ?? -1)
      return { status: b.status, start: slot?.start ?? null, end: slot?.end ?? null, format: slot?.format ?? null }
    }),
    submissions: d.submissions,
    exerciseAnswers: d.attempts,
    prestations: d.prestations,
    invoices: d.invoices.filter((i) => i.status !== 'to_validate'),
    assignments: d.assignments.map((a) => ({ id: a.id, title: a.title, kind: a.kind, dueDate: a.dueDate })),
    documents: d.documents.map((doc) => ({ id: doc.id, title: doc.title, filename: doc.filename })),
    videos: d.videos.map((v) => ({ id: v.id, title: v.title })),
    trialRequests: d.trials,
    emails: d.messages
      .filter((m) => m.status === 'sent')
      .map((m) => ({ to: m.to, subject: m.subject, body: m.body, sentAt: m.sentAt })),
  }

  const staticDir = payload.collections['submission-files'].config.upload?.staticDir as string
  const files: Zippable = {}
  for (const f of d.files) {
    if (!f.filename) continue
    try {
      files[f.filename] = new Uint8Array(await fs.readFile(path.join(staticDir, path.basename(f.filename))))
    } catch {
      // Fichier absent du disque : la fiche reste dans donnees.json.
    }
  }
  const zip = zipSync({
    'LISEZ-MOI.txt': strToU8(README),
    'donnees.json': strToU8(JSON.stringify(data, null, 2)),
    ...(Object.keys(files).length ? { fichiers: files } : {}),
  })
  return { zip, filename: `donnees-eleve-${studentId}.zip` }
}

export type ErasureSummary = {
  submissions: number
  exerciseAnswers: number
  files: number
  futureBookings: number
  assignmentsDeleted: number
  documentsDeleted: number
  trialRequests: number
  messages: number
  invoicesKept: number
}

/**
 * Efface les données personnelles de l'élève, dans une transaction.
 * `confirmEmail` doit être l'e-mail actuel de l'élève (retapé par Catherine) : vérifié ici, côté serveur.
 * Refusé s'il reste de l'argent en suspens (prestations non facturées, factures non payées).
 */
export async function eraseStudentData(payload: Payload, studentId: number, confirmEmail: string): Promise<ErasureSummary> {
  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    const d = await collect(payload, studentId, req)
    if (d.student.erasedAt) throw new PrivacyError('already_erased')
    if (!confirmEmail || confirmEmail.trim().toLowerCase() !== (d.student.email ?? '').toLowerCase()) {
      throw new PrivacyError('confirm')
    }
    const blockers = [
      ...d.prestations.filter((p) => p.status === 'to_invoice').map((p) => `Prestation non facturée : ${p.description}`),
      ...d.invoices
        .filter((i) => ['to_validate', 'validated', 'sent'].includes(i.status))
        .map((i) => `Facture ${i.number ?? 'brouillon'} : ${INVOICE_STATE[i.status] ?? i.status}`),
    ]
    if (blockers.length) throw new PrivacyError('blocked', blockers)

    const del = { req, overrideAccess: true }
    for (const s of d.submissions) await payload.delete({ collection: 'submissions', id: s.id, ...del })
    for (const a of d.attempts) await payload.delete({ collection: 'exercise-attempts', id: a.id, ...del })
    // Les fichiers (devoirs, réponses orales) disparaissent aussi du disque.
    for (const f of d.files) await payload.delete({ collection: 'submission-files', id: f.id, ...del })

    const now = Date.now()
    const slotById = new Map(d.slots.map((s) => [s.id, s]))
    let futureBookings = 0
    for (const b of d.bookings) {
      const start = slotById.get(idOf(b.slot) ?? -1)?.start
      // Séances passées : gardées sans nom pour les heures données du tableau de bord.
      if (start && new Date(start).getTime() > now) {
        await payload.delete({ collection: 'bookings', id: b.id, ...del })
        futureBookings++
      }
    }

    let assignmentsDeleted = 0
    for (const a of d.assignments) {
      const others = (a.students ?? []).map(idOf).filter((id) => id !== studentId) as number[]
      if (others.length === 0) {
        await payload.delete({ collection: 'assignments', id: a.id, ...del })
        assignmentsDeleted++
      } else {
        await payload.update({ collection: 'assignments', id: a.id, data: { students: others }, ...del })
      }
    }
    let documentsDeleted = 0
    for (const doc of d.documents) {
      const others = (doc.sharedWith ?? []).map(idOf).filter((id) => id !== studentId) as number[]
      if (others.length === 0) {
        await payload.delete({ collection: 'documents', id: doc.id, ...del })
        documentsDeleted++
      } else {
        await payload.update({ collection: 'documents', id: doc.id, data: { sharedWith: others }, ...del })
      }
    }
    for (const v of d.videos) {
      const others = (v.students ?? []).map(idOf).filter((id) => id !== studentId) as number[]
      await payload.update({ collection: 'videos', id: v.id, data: { students: others }, ...del })
    }
    for (const t of d.trials) await payload.delete({ collection: 'trial-requests', id: t.id, ...del })
    // Messages préparés ou envoyés : leur texte contient nom et adresse. Les factures, elles, restent.
    req.context.privacyErase = true
    for (const m of d.messages) await payload.delete({ collection: 'outbox', id: m.id, ...del })

    await payload.update({
      collection: 'students',
      id: studentId,
      data: {
        firstName: 'Ancien',
        lastName: `élève n°${studentId}`,
        email: `ancien-eleve-${studentId}@supprime.invalid`,
        // Mot de passe aléatoire jamais communiqué : plus aucune connexion possible.
        password: randomBytes(32).toString('hex'),
        phone: null,
        preferredLocale: 'fr',
        timeZone: null,
        languages: [],
        level: null,
        familyOf: null,
        isMinor: false,
        guardian: { name: null, email: null, phone: null, consent: false },
        recordingConsent: false,
        companyName: null,
        vatNumber: null,
        billingAddress: null,
        notes: null,
        sessions: [],
        erasedAt: new Date().toISOString(),
      } as any,
      ...del,
    })

    await commitTransaction(req)
    return {
      submissions: d.submissions.length,
      exerciseAnswers: d.attempts.length,
      files: d.files.length,
      futureBookings,
      assignmentsDeleted,
      documentsDeleted,
      trialRequests: d.trials.length,
      messages: d.messages.length,
      invoicesKept: d.invoices.length,
    }
  } catch (e) {
    await killTransaction(req)
    throw e
  }
}
