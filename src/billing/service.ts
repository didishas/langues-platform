import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'

import { LOCK, lockInTransaction } from '@/lib/dbLock'

import { getBillingProvider, getConfiguredGateway, getDirectProviderForPayments } from './index'
import type { BillingSettings, Customer, InvoiceDraft, PaymentGateway, PrestationInput } from './types'

const today = () => new Date().toISOString().slice(0, 10)
const idOf = (v: unknown): string | number | undefined =>
  v && typeof v === 'object' ? (v as { id: string | number }).id : (v as string | number | undefined)

export async function loadBillingSettings(payload: Payload, req?: PayloadRequest): Promise<BillingSettings> {
  const g = await payload.findGlobal({ slug: 'billing-settings', req, depth: 0 })
  return {
    activeProvider: g.activeProvider === 'smart' ? 'smart' : 'direct',
    switchDate: g.switchDate ?? null,
    invoicePrefix: g.invoicePrefix ?? '',
    vatRegime: g.vatRegime ?? 'franchise',
    vatRatePercent: g.vatRatePercent ?? 21,
    vatMention: g.vatMention ?? null,
    paymentTermDays: g.paymentTermDays ?? 15,
    onlinePayments: Boolean(g.onlinePayments),
  }
}

function customerFromStudent(student: Record<string, any>): Customer {
  const business = student.customerKind === 'business'
  return {
    id: String(student.id),
    name: business && student.companyName ? student.companyName : (student.fullName ?? student.email),
    email: student.isMinor && student.guardian?.email ? student.guardian.email : student.email,
    kind: business ? 'business' : 'individual',
    vatNumber: business ? (student.vatNumber ?? null) : null,
  }
}

/** Convertit un brouillon de fournisseur en données du document `invoices`. */
export function draftToInvoiceData(draft: InvoiceDraft, studentId: string | number) {
  return {
    provider: draft.provider,
    number: draft.number,
    student: studentId,
    customer: {
      name: draft.customer.name,
      email: draft.customer.email,
      kind: draft.customer.kind,
      vatNumber: draft.customer.vatNumber ?? null,
    },
    lines: draft.lines.map((l) => ({
      // Les identifiants Postgres sont numériques : on rend au CMS l'identifiant dans son type d'origine.
      prestation: /^\d+$/.test(l.prestationId) ? Number(l.prestationId) : l.prestationId,
      description: l.description,
      date: l.date,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      discountPercent: l.discountPercent,
      lineTotalCents: l.totalCents,
    })),
    subtotalCents: draft.subtotalCents,
    vatRatePercent: draft.vatRatePercent,
    vatCents: draft.vatCents,
    totalCents: draft.totalCents,
    vatMention: draft.vatMention,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    structuredCommunication: draft.structuredCommunication,
    delivery: draft.delivery,
  }
}

async function loadPrestations(payload: Payload, ids: (string | number)[], req?: PayloadRequest) {
  const res = await payload.find({
    collection: 'prestations',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 0,
    req,
  })
  return res.docs
}

const toInput = (p: Record<string, any>): PrestationInput => ({
  id: String(p.id),
  description: p.description,
  date: String(p.date).slice(0, 10),
  quantity: p.quantity ?? 1,
  unitPriceCents: p.unitPriceCents ?? 0,
  discountPercent: p.discountPercent ?? 0,
})

/**
 * Prépare une facture à valider à partir de prestations d'un élève.
 * Aucun numéro n'est consommé ici : il est attribué à la validation.
 */
export async function prepareDraftInvoice(
  payload: Payload,
  args: { studentId: string | number; prestationIds: (string | number)[] },
  req?: PayloadRequest,
) {
  if (args.prestationIds.length === 0) throw new Error('Aucune prestation sélectionnée.')
  const student = await payload.findByID({ collection: 'students', id: args.studentId, depth: 0, req })
  const prestations = await loadPrestations(payload, args.prestationIds, req)
  if (prestations.length !== args.prestationIds.length) throw new Error('Prestation introuvable.')
  for (const p of prestations) {
    if (String(idOf(p.student)) !== String(student.id)) throw new Error('Prestation d’un autre élève.')
    if (p.status !== 'to_invoice' || p.invoice) throw new Error(`Prestation déjà facturée : ${p.description}`)
  }

  const settings = await loadBillingSettings(payload, req)
  const provider = getBillingProvider(settings, { gateway: null })
  const draft = provider.prepareInvoice(
    { customer: customerFromStudent(student), prestations: prestations.map(toInput), issueDate: today(), sequence: null },
    settings,
  )

  const invoice = await payload.create({
    collection: 'invoices',
    data: { ...draftToInvoiceData(draft, student.id), status: 'to_validate' } as any,
    req,
  })
  for (const p of prestations) {
    await payload.update({ collection: 'prestations', id: p.id, data: { invoice: invoice.id }, req })
  }
  return invoice
}

/**
 * Réserve le prochain numéro d'ordre de l'année (numérotation continue, sans trou).
 * Le compteur est verrouillé jusqu'à la fin de la transaction de validation : deux validations
 * simultanées reçoivent des numéros distincts, et un numéro n'est consommé que si la validation aboutit.
 */
export async function nextSequence(payload: Payload, year: number, req: PayloadRequest): Promise<number> {
  await lockInTransaction(req, LOCK.invoiceCounter, year)
  const found = await payload.find({
    collection: 'invoice-counters',
    where: { year: { equals: year } },
    limit: 1,
    depth: 0,
    req,
  })
  const current = found.docs[0]
  if (!current) {
    await payload.create({ collection: 'invoice-counters', data: { year, last: 1 }, req })
    return 1
  }
  const next = (current.last ?? 0) + 1
  await payload.update({ collection: 'invoice-counters', id: current.id, data: { last: next }, req })
  return next
}

/**
 * Finalise une facture au moment où Catherine la valide :
 * date d'émission du jour, numéro définitif et communication structurée (facturation directe).
 */
export async function finalizeOnValidation(
  payload: Payload,
  original: Record<string, any>,
  req: PayloadRequest,
): Promise<Record<string, unknown>> {
  const settings = await loadBillingSettings(payload, req)
  const provider = getBillingProvider(settings, { gateway: null })
  const student = await payload.findByID({ collection: 'students', id: idOf(original.student)!, depth: 0, req })
  const ids = (original.lines ?? []).map((l: any) => idOf(l.prestation)).filter(Boolean)
  const prestations = await loadPrestations(payload, ids, req)
  const issueDate = today()
  const sequence = provider.id === 'direct' ? await nextSequence(payload, Number(issueDate.slice(0, 4)), req) : null
  const draft = provider.prepareInvoice(
    { customer: customerFromStudent(student), prestations: prestations.map(toInput), issueDate, sequence },
    settings,
  )
  return { ...draftToInvoiceData(draft, student.id), validatedAt: new Date().toISOString() }
}

/** Demande un lien de paiement en ligne si le fournisseur actif et les réglages le permettent. */
export async function createPaymentLink(
  payload: Payload,
  invoice: Record<string, any>,
  req?: PayloadRequest,
): Promise<{ paymentId: string; checkoutUrl: string } | null> {
  const settings = await loadBillingSettings(payload, req)
  const provider = getBillingProvider(settings)
  if (provider.id !== invoice.provider || !provider.supportsOnlinePayment(settings)) return null
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return provider.requestPayment(invoice as any, settings, {
    redirectUrl: `${site}/fr/paiement/merci`,
    webhookUrl: site.startsWith('https://') ? `${site}/api/invoices/payment-webhook` : undefined,
  })
}

export type PaymentNotificationOutcome =
  | 'paid'
  | 'already_paid'
  | 'not_paid'
  | 'mismatch'
  | 'unknown_payment'

/**
 * Traite une notification de paiement (webhook). Le contenu de la notification n'est jamais cru :
 * on relit le paiement chez le prestataire, puis on vérifie, dans une transaction verrouillée sur la facture,
 * le statut, le montant, la devise et le rattachement (référence = numéro de facture, même identifiant de paiement).
 *
 * Idempotent : une notification répétée ou simultanée ne marque la facture payée qu'une seule fois.
 * Une anomalie n'est jamais « payée » : elle est notée sur la facture pour Catherine.
 */
export async function handlePaymentNotification(
  payload: Payload,
  paymentId: string,
  gateway: PaymentGateway | null = getConfiguredGateway(),
): Promise<PaymentNotificationOutcome> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(paymentId)) return 'unknown_payment'

  const found = await payload.find({
    collection: 'invoices',
    where: { paymentId: { equals: paymentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const target = found.docs[0]
  if (!target || target.provider !== 'direct') return 'unknown_payment'

  const provider = getDirectProviderForPayments(gateway)
  const info = await provider.getPayment(paymentId)
  if (!info) throw new Error('Aucune passerelle de paiement configurée pour vérifier ce paiement.')

  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    await lockInTransaction(req, LOCK.invoice, Number(target.id))
    const invoice = await payload.findByID({ collection: 'invoices', id: target.id, depth: 0, req, overrideAccess: true })

    let outcome: PaymentNotificationOutcome
    if (invoice.status === 'paid') {
      outcome = 'already_paid'
    } else if (info.status !== 'paid') {
      outcome = 'not_paid'
    } else {
      const problems: string[] = []
      if (info.id !== paymentId || invoice.paymentId !== paymentId) problems.push('identifiant de paiement différent')
      if (info.currency !== 'EUR') problems.push(`devise ${info.currency ?? 'inconnue'} au lieu de EUR`)
      if (info.amountCents !== invoice.totalCents) {
        problems.push(`montant ${info.amountCents ?? '?'} centimes au lieu de ${invoice.totalCents ?? '?'}`)
      }
      if (!invoice.number || info.reference !== invoice.number) {
        problems.push(`référence « ${info.reference ?? ''} » au lieu de « ${invoice.number ?? ''} »`)
      }
      if (invoice.status !== 'validated' && invoice.status !== 'sent') problems.push(`facture à l’état « ${invoice.status} »`)

      if (problems.length > 0) {
        outcome = 'mismatch'
        await payload.update({
          collection: 'invoices',
          id: invoice.id,
          data: { paymentIssue: `Paiement ${paymentId} non accepté : ${problems.join(', ')}.` },
          req,
          overrideAccess: true,
        })
        payload.logger.warn({ msg: 'Paiement refusé à la vérification', invoice: invoice.id, paymentId, problems })
      } else {
        outcome = 'paid'
        await payload.update({
          collection: 'invoices',
          id: invoice.id,
          data: { status: 'paid', paidAt: new Date().toISOString(), paymentIssue: null },
          req,
          overrideAccess: true,
        })
      }
    }
    await commitTransaction(req)
    return outcome
  } catch (e) {
    await killTransaction(req)
    throw e
  }
}
