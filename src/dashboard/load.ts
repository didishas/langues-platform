import type { Payload, TypedUser } from 'payload'

import { resolveProviderId } from '@/billing'
import { loadBillingSettings } from '@/billing/service'
import { toLines } from '@/billing/totals'

import { computeDashboard, type DashboardInput } from './metrics'

const DAY = 864e5
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined))

/**
 * Charge les données du tableau de bord avec les droits de l'utilisateur connecté (équipe uniquement),
 * puis calcule les indicateurs. Ne renvoie rien pour un autre type de compte.
 */
export async function loadDashboard(payload: Payload, user: TypedUser, locale: 'fr' | 'en' | 'he', now = new Date()) {
  if (user.collection !== 'users') return null
  const as = { user, overrideAccess: false as const, pagination: false as const, depth: 0 }
  const t = now.getTime()
  const since13Months = new Date(t - 400 * DAY).toISOString()

  const [invoices, prestations, slots, submissions, trials, languages, students, billingGlobal, settings, oral, outbox] = await Promise.all([
    payload.find({ collection: 'invoices', ...as, where: { status: { not_equals: 'cancelled' } } }),
    payload.find({
      collection: 'prestations',
      ...as,
      where: { or: [{ date: { greater_than_equal: since13Months } }, { status: { equals: 'to_invoice' } }] },
    }),
    payload.find({
      collection: 'slots',
      ...as,
      where: {
        and: [
          { start: { greater_than_equal: new Date(t - 90 * DAY).toISOString() } },
          { start: { less_than_equal: new Date(t + 28 * DAY).toISOString() } },
        ],
      },
    }),
    payload.find({ collection: 'submissions', ...as, where: { status: { equals: 'submitted' } } }),
    payload.find({ collection: 'trial-requests', ...as, where: { status: { equals: 'new' } } }),
    payload.find({ collection: 'languages', ...as, locale }),
    payload.find({ collection: 'students', ...as }),
    payload.findGlobal({ slug: 'billing-settings', user, overrideAccess: false, depth: 0 }),
    loadBillingSettings(payload),
    payload.count({ collection: 'exercise-attempts', user, overrideAccess: false, where: { status: { equals: 'to_review' } } }),
    payload.count({ collection: 'outbox', user, overrideAccess: false, where: { status: { in: ['draft', 'failed'] } } }),
  ])

  const slotIds = slots.docs.map((s) => s.id)
  const bookings = slotIds.length
    ? await payload.find({
        collection: 'bookings',
        ...as,
        where: { and: [{ slot: { in: slotIds } }, { status: { not_equals: 'cancelled' } }] },
      })
    : { docs: [] }

  const studentName = new Map(students.docs.map((s) => [s.id, s.fullName || s.email]))
  const languageById = new Map(languages.docs.map((l) => [l.id, l]))

  const input: DashboardInput = {
    now,
    invoices: invoices.docs.map((i) => ({
      id: i.id,
      status: i.status,
      totalCents: i.totalCents ?? 0,
      paidAt: i.paidAt ?? null,
      issueDate: i.issueDate ?? null,
      dueDate: i.dueDate ?? null,
      number: i.number ?? null,
      studentId: idOf(i.student) ?? null,
      studentName: (i.customer?.name || studentName.get(idOf(i.student) ?? -1)) ?? '',
    })),
    prestations: prestations.docs.map((p) => ({
      studentId: idOf(p.student)!,
      date: p.date,
      totalCents: toLines([
        {
          id: String(p.id),
          description: p.description,
          date: p.date,
          quantity: p.quantity ?? 1,
          unitPriceCents: p.unitPriceCents ?? 0,
          discountPercent: p.discountPercent ?? 0,
        },
      ])[0].totalCents,
      languageCode: languageById.get(idOf(p.language) ?? -1)?.code ?? null,
      invoiced: p.status === 'invoiced',
    })),
    slots: slots.docs.map((s) => {
      const forSlot = bookings.docs.filter((b) => idOf(b.slot) === s.id)
      const confirmed = forSlot.filter((b) => b.status === 'confirmed')
      return {
        id: s.id,
        start: s.start,
        end: s.end,
        capacity: s.capacity ?? 1,
        activeBookings: forSlot.length,
        confirmedBookings: confirmed.length,
        confirmedStudentIds: confirmed.map((b) => idOf(b.student)!).filter(Boolean),
      }
    }),
    submissionsToCorrect: submissions.docs.map((s) => ({ id: s.id, title: s.title ?? '', submittedAt: s.submittedAt ?? null })),
    newTrialRequests: trials.docs.map((r) => ({ id: r.id, name: r.name, createdAt: r.createdAt })),
    oralToReview: oral.totalDocs,
    messagesToApprove: outbox.totalDocs,
    taxReservePercent: typeof billingGlobal.taxReservePercent === 'number' ? billingGlobal.taxReservePercent : null,
    directBilling: resolveProviderId(settings, now) === 'direct',
  }

  return {
    dashboard: computeDashboard(input),
    languageNames: Object.fromEntries(languages.docs.map((l) => [l.code, l.name])) as Record<string, string>,
  }
}
