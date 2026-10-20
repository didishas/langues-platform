/**
 * Messages préparés par le site, envoyés seulement après validation de Catherine.
 *
 * Règle du projet « rien ne part sans Catherine », vérifiée ici côté serveur au moment d'envoyer :
 * - action : seule une professeure (`isTeacher`) déclenche l'envoi, message par message ;
 * - version : Catherine valide la version qu'elle a sous les yeux (`updatedAt`) ; si le message a changé, refus ;
 * - destinataire : recalculé depuis la fiche de l'élève (jamais une adresse libre) et comparé au message ;
 * - montant : pour une facture, le total doit être celui du message préparé, et la facture toujours valide ;
 * - une seule fois : verrou Postgres + relecture ; un message envoyé n'est plus modifiable.
 */
import { createHash } from 'crypto'

import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'

import { isLocale, type Locale } from '@/i18n/config'
import { EMAIL_DEFAULTS, type EmailTemplateTexts } from '@/i18n/emailDefaults'
import { fill } from '@/i18n/format'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { LOCK, lockInTransaction } from '@/lib/dbLock'
import { formatSessionTime } from '@/lib/time'
import type { Booking, Invoice, Outbox, Student } from '@/payload-types'

import { sendMail } from './transport'

const idOf = (v: unknown): number | undefined =>
  v && typeof v === 'object' ? (v as { id: number }).id : typeof v === 'number' ? v : undefined

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
const TAG: Record<Locale, string> = { fr: 'fr-BE', en: 'en-GB', he: 'he-IL' }

/** Adresse à laquelle un message pour cet élève peut partir : la sienne, ou celle de son responsable légal. */
export function recipientFor(student: Pick<Student, 'email' | 'fullName' | 'guardian' | 'erasedAt'>, who: 'student' | 'guardian') {
  if (student.erasedAt) return null
  if (who === 'guardian') {
    const email = student.guardian?.email
    return email ? { email, name: student.guardian?.name ?? null } : null
  }
  return student.email ? { email: student.email, name: student.fullName ?? null } : null
}

/** Empreinte de ce qui part réellement : enregistrée avec la validation de Catherine. */
export const contentHash = (m: { to: string; subject: string; body: string; kind: string; amountCents?: number | null }) =>
  createHash('sha256')
    .update(JSON.stringify([m.to, m.subject, m.body, m.kind, m.amountCents ?? null]))
    .digest('hex')

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Version HTML : le texte de Catherine, échappé, dans le sens de la langue de l'élève. */
export function toHtml(body: string, locale: Locale) {
  const dir = locale === 'he' ? 'rtl' : 'ltr'
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="font-family:Rubik,Arial,sans-serif;line-height:1.5;color:#23225c">${paragraphs}</body></html>`
}

async function templates(payload: Payload, locale: Locale, req?: PayloadRequest): Promise<EmailTemplateTexts> {
  const g = (await payload.findGlobal({ slug: 'email-templates', locale, fallbackLocale: false, depth: 0, ...(req ? { req } : {}) })) as Partial<
    Record<keyof EmailTemplateTexts, string | null>
  >
  const d = EMAIL_DEFAULTS[locale]
  const pick = (k: keyof EmailTemplateTexts) => (g[k] && g[k]!.trim() ? g[k]! : d[k])
  return {
    signature: pick('signature'),
    invoiceSubject: pick('invoiceSubject'),
    invoiceBody: pick('invoiceBody'),
    invoiceOnlineLine: pick('invoiceOnlineLine'),
    bookingSubject: pick('bookingSubject'),
    bookingBody: pick('bookingBody'),
  }
}

const tidy = (s: string) => s.replace(/\n{3,}/g, '\n\n').trim()

async function loadStudent(payload: Payload, id: number, req?: PayloadRequest) {
  return payload.findByID({ collection: 'students', id, depth: 0, overrideAccess: true, ...(req ? { req } : {}) })
}

/** Brouillon de l'e-mail d'une facture validée (facturation directe, envoi par e-mail). */
export async function prepareInvoiceEmail(payload: Payload, invoice: Invoice, req?: PayloadRequest) {
  if (invoice.provider !== 'direct' || invoice.delivery !== 'pdf' || !invoice.number) return null
  const studentId = idOf(invoice.student)
  if (!studentId) return null
  const student = await loadStudent(payload, studentId, req)
  const who = student.isMinor && student.guardian?.email ? 'guardian' : 'student'
  if (!recipientFor(student, who)) return null
  const locale: Locale = isLocale(student.preferredLocale ?? '') ? (student.preferredLocale as Locale) : 'fr'
  const t = await templates(payload, locale, req)
  const money = new Intl.NumberFormat(TAG[locale], { style: 'currency', currency: 'EUR' }).format((invoice.totalCents ?? 0) / 100)
  const due = invoice.dueDate
    ? new Intl.DateTimeFormat(TAG[locale], { dateStyle: 'long', timeZone: 'Europe/Brussels' }).format(new Date(invoice.dueDate))
    : ''
  const values = {
    prenom: student.firstName,
    numero: invoice.number,
    montant: money,
    echeance: due,
    communication: invoice.structuredCommunication ?? '',
    lien_paiement: invoice.paymentUrl ?? '',
    lien_espace: `${SITE()}/${locale}/espace/factures`,
    signature: t.signature,
  }
  const body = tidy(fill(t.invoiceBody, { ...values, paiement_en_ligne: invoice.paymentUrl ? fill(t.invoiceOnlineLine, values) : '' }))
  return payload.create({
    collection: 'outbox',
    data: {
      kind: 'invoice',
      student: studentId,
      recipient: who,
      subject: fill(t.invoiceSubject, values),
      body,
      locale,
      invoice: invoice.id,
      amountCents: invoice.totalCents ?? 0,
      status: 'draft',
    },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
}

/** Brouillon de confirmation d'une séance à venir. */
export async function prepareBookingEmail(payload: Payload, booking: Booking, req?: PayloadRequest) {
  const studentId = idOf(booking.student)
  const slotId = idOf(booking.slot)
  if (!studentId || !slotId) return null
  const slot = await payload.findByID({ collection: 'slots', id: slotId, depth: 0, overrideAccess: true, ...(req ? { req } : {}) })
  if (new Date(slot.start).getTime() <= Date.now()) return null
  const student = await loadStudent(payload, studentId, req)
  const who = student.isMinor && student.guardian?.email ? 'guardian' : 'student'
  if (!recipientFor(student, who)) return null
  const locale: Locale = isLocale(student.preferredLocale ?? '') ? (student.preferredLocale as Locale) : 'fr'
  const t = await templates(payload, locale, req)
  const when = formatSessionTime(slot.start, locale, student.timeZone, getStudentDictionary(locale).home.brussels)
  const values = {
    prenom: student.firstName,
    date_seance: when.brussels ? `${when.local} (${when.brussels})` : when.local,
    lien_espace: `${SITE()}/${locale}/espace`,
    signature: t.signature,
  }
  return payload.create({
    collection: 'outbox',
    data: {
      kind: 'booking',
      student: studentId,
      recipient: who,
      subject: fill(t.bookingSubject, values),
      body: tidy(fill(t.bookingBody, values)),
      locale,
      booking: booking.id,
      status: 'draft',
    },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
}

export type SendOutcome =
  | { outcome: 'sent'; messageId: string }
  | { outcome: 'already_sent' }
  | { outcome: 'refused'; reason: 'version' | 'recipient' | 'invoice' | 'booking' | 'cancelled' | 'not_found' }
  | { outcome: 'failed'; error: string }

/**
 * Validation et envoi d'UN message par Catherine. `version` = `updatedAt` du message qu'elle a relu.
 * L'appelant a vérifié que `userId` est une professeure.
 */
export async function approveAndSend(payload: Payload, id: number, userId: number, version: string): Promise<SendOutcome> {
  const req = await createLocalReq({ context: { outboxSend: true } }, payload)
  await initTransaction(req)
  try {
    await lockInTransaction(req, LOCK.outbox, id)
    const msg = (await payload.findByID({ collection: 'outbox', id, depth: 0, req, overrideAccess: true }).catch(() => null)) as Outbox | null
    if (!msg) return await done(req, { outcome: 'refused', reason: 'not_found' })
    if (msg.status === 'sent') return await done(req, { outcome: 'already_sent' })
    if (msg.status === 'cancelled') return await done(req, { outcome: 'refused', reason: 'cancelled' })
    if (!version || new Date(version).getTime() !== new Date(msg.updatedAt).getTime()) {
      return await done(req, { outcome: 'refused', reason: 'version' })
    }

    const student = await loadStudent(payload, idOf(msg.student)!, req)
    const recipient = recipientFor(student, msg.recipient ?? 'student')
    if (!recipient || recipient.email !== msg.to) return await done(req, { outcome: 'refused', reason: 'recipient' })

    if (msg.kind === 'invoice') {
      const invoice = await payload.findByID({ collection: 'invoices', id: idOf(msg.invoice)!, depth: 0, req, overrideAccess: true }).catch(() => null)
      const stillValid = invoice && ['validated', 'sent'].includes(invoice.status) && invoice.totalCents === msg.amountCents
      if (!stillValid) return await done(req, { outcome: 'refused', reason: 'invoice' })
    }
    if (msg.kind === 'booking') {
      const booking = await payload.findByID({ collection: 'bookings', id: idOf(msg.booking)!, depth: 0, req, overrideAccess: true }).catch(() => null)
      if (!booking || booking.status !== 'confirmed') return await done(req, { outcome: 'refused', reason: 'booking' })
    }

    const locale: Locale = isLocale(msg.locale ?? '') ? (msg.locale as Locale) : 'fr'
    const approvedHash = contentHash({ to: msg.to!, subject: msg.subject, body: msg.body, kind: msg.kind, amountCents: msg.amountCents })
    const approval = { approvedBy: userId, approvedAt: new Date().toISOString(), approvedHash }
    let result
    try {
      result = await sendMail({ to: msg.to!, toName: msg.toName, subject: msg.subject, text: msg.body, html: toHtml(msg.body, locale) })
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Erreur inconnue'
      await payload.update({ collection: 'outbox', id, data: { ...approval, status: 'failed', error }, req, overrideAccess: true })
      return await done(req, { outcome: 'failed', error })
    }
    await payload.update({
      collection: 'outbox',
      id,
      data: { ...approval, status: 'sent', sentAt: new Date().toISOString(), messageId: result.messageId, error: null },
      req,
      overrideAccess: true,
    })
    if (msg.kind === 'invoice') {
      const invoiceId = idOf(msg.invoice)!
      const invoice = await payload.findByID({ collection: 'invoices', id: invoiceId, depth: 0, req, overrideAccess: true })
      if (invoice.status === 'validated') {
        await payload.update({ collection: 'invoices', id: invoiceId, data: { status: 'sent' }, req, overrideAccess: true })
      }
    }
    return await done(req, { outcome: 'sent', messageId: result.messageId })
  } catch (e) {
    await killTransaction(req)
    throw e
  }
}

async function done<T>(req: PayloadRequest, value: T): Promise<T> {
  await commitTransaction(req)
  return value
}
