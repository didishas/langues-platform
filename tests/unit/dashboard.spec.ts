import { describe, expect, it } from 'vitest'

import {
  computeDashboard,
  dayKey,
  lastMonths,
  monthKey,
  type DashboardInput,
  type InvoiceRow,
  type SlotRow,
} from '@/dashboard/metrics'

// Samedi 17 octobre 2026, 12 h à Bruxelles (10 h UTC, heure d'été).
const NOW = new Date('2026-10-17T10:00:00.000Z')

const base = (over: Partial<DashboardInput> = {}): DashboardInput => ({
  now: NOW,
  invoices: [],
  prestations: [],
  slots: [],
  submissionsToCorrect: [],
  newTrialRequests: [],
  oralToReview: 0,
  taxReservePercent: null,
  directBilling: true,
  ...over,
})

const invoice = (over: Partial<InvoiceRow>): InvoiceRow => ({
  id: 1,
  status: 'validated',
  totalCents: 3000,
  paidAt: null,
  issueDate: '2026-10-01',
  dueDate: '2026-10-16',
  number: 'F2026-0001',
  studentId: 1,
  studentName: 'Noa',
  ...over,
})

const slot = (over: Partial<SlotRow>): SlotRow => ({
  id: 1,
  start: '2026-10-10T08:00:00.000Z',
  end: '2026-10-10T09:30:00.000Z',
  capacity: 1,
  activeBookings: 0,
  confirmedBookings: 0,
  confirmedStudentIds: [],
  ...over,
})

describe('périodes à l’heure de Bruxelles', () => {
  it('un instant de fin de mois en UTC tombe dans le bon mois à Bruxelles', () => {
    // 30 septembre 23 h 30 à Bruxelles = 21 h 30 UTC : septembre.
    expect(monthKey('2026-09-30T21:30:00.000Z')).toBe('2026-09')
    // 30 septembre 22 h 30 UTC = 1er octobre 0 h 30 à Bruxelles : octobre.
    expect(monthKey('2026-09-30T22:30:00.000Z')).toBe('2026-10')
    // En hiver (UTC+1) : 31 décembre 23 h 30 UTC = 1er janvier à Bruxelles.
    expect(monthKey('2026-12-31T23:30:00.000Z')).toBe('2027-01')
  })

  it('le jour de bascule à l’heure d’hiver reste correct', () => {
    // 25 octobre 2026 : passage à l’heure d’hiver.
    expect(dayKey('2026-10-25T22:59:00.000Z')).toBe('2026-10-25')
    expect(dayKey('2026-10-25T23:00:00.000Z')).toBe('2026-10-26')
  })

  it('les 12 derniers mois enjambent l’année', () => {
    expect(lastMonths(NOW, 12)).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ])
  })
})

describe('argent', () => {
  it('encaissé par mois selon la date de paiement à Bruxelles, et comparaison au mois précédent', () => {
    const d = computeDashboard(
      base({
        invoices: [
          invoice({ id: 1, status: 'paid', totalCents: 3000, paidAt: '2026-09-30T21:30:00.000Z' }), // septembre
          invoice({ id: 2, status: 'paid', totalCents: 4500, paidAt: '2026-09-30T22:30:00.000Z' }), // octobre
          invoice({ id: 3, status: 'paid', totalCents: 2500, paidAt: '2026-10-05T10:00:00.000Z' }),
          invoice({ id: 4, status: 'paid', totalCents: 9999, paidAt: '2025-10-05T10:00:00.000Z' }), // hors 12 mois
        ],
      }),
    )
    expect(d.money.collectedThisMonth).toBe(7000)
    expect(d.money.collectedLastMonth).toBe(3000)
    expect(d.money.collectedByMonth).toHaveLength(12)
    expect(d.money.collectedByMonth.at(-1)).toEqual({ month: '2026-10', cents: 7000 })
    expect(d.money.collectedThisYear).toBe(10000)
  })

  it('une facture est en retard le lendemain de son échéance, pas le jour même', () => {
    const d = computeDashboard(
      base({
        invoices: [
          invoice({ id: 1, dueDate: '2026-10-17', totalCents: 1000 }), // échéance aujourd’hui
          invoice({ id: 2, dueDate: '2026-10-16', totalCents: 2000, studentName: 'Ari' }), // 1 jour
          invoice({ id: 3, dueDate: '2026-10-02', totalCents: 3000, status: 'sent', studentName: 'Lev' }), // 15 jours
          invoice({ id: 4, dueDate: '2026-10-01', status: 'paid', paidAt: '2026-10-03T10:00:00.000Z' }),
          invoice({ id: 5, dueDate: '2026-10-01', status: 'cancelled' }),
          invoice({ id: 6, dueDate: '2026-10-01', status: 'to_validate' }),
        ],
      }),
    )
    expect(d.money.overdue.map((o) => [o.studentName, o.daysLate])).toEqual([
      ['Lev', 15],
      ['Ari', 1],
    ])
    expect(d.money.overdueCents).toBe(5000)
    expect(d.money.toCollectCount).toBe(3)
    expect(d.money.toCollectCents).toBe(6000)
    expect(d.money.toValidateCount).toBe(1)
  })

  it('pas de réserve sans pourcentage saisi, ni en phase Smart', () => {
    const paid = [invoice({ status: 'paid', totalCents: 10000, paidAt: '2026-03-01T10:00:00.000Z' })]
    expect(computeDashboard(base({ invoices: paid })).money.taxReserveCents).toBeNull()
    expect(computeDashboard(base({ invoices: paid, taxReservePercent: 30, directBilling: false })).money.taxReserveCents).toBeNull()
    expect(computeDashboard(base({ invoices: paid, taxReservePercent: 30 })).money.taxReserveCents).toBe(3000)
  })
})

describe('par langue', () => {
  it('additionne les prestations réalisées des 12 derniers mois, sans les futures', () => {
    const d = computeDashboard(
      base({
        prestations: [
          { studentId: 1, date: '2026-10-01T10:00:00.000Z', totalCents: 3500, languageCode: 'he', invoiced: true },
          { studentId: 1, date: '2026-05-01T10:00:00.000Z', totalCents: 3500, languageCode: 'he', invoiced: true },
          { studentId: 2, date: '2026-10-02T10:00:00.000Z', totalCents: 3000, languageCode: 'en', invoiced: false },
          { studentId: 2, date: '2026-10-03T10:00:00.000Z', totalCents: 1000, languageCode: null, invoiced: false },
          { studentId: 2, date: '2026-11-03T10:00:00.000Z', totalCents: 9999, languageCode: 'en', invoiced: false },
          { studentId: 2, date: '2025-09-03T10:00:00.000Z', totalCents: 9999, languageCode: 'en', invoiced: true },
        ],
      }),
    )
    expect(d.byLanguage).toEqual([
      { code: 'he', cents: 7000 },
      { code: 'en', cents: 3000 },
      { code: 'unknown', cents: 1000 },
    ])
    expect(d.money.toInvoiceCount).toBe(3)
  })
})

describe('heures et remplissage', () => {
  it('heures données = créneaux passés avec un élève confirmé ; remplissage des 4 prochaines semaines', () => {
    const d = computeDashboard(
      base({
        slots: [
          slot({ id: 1, confirmedBookings: 1 }), // 1 h 30 donnée
          slot({ id: 2, start: '2026-10-12T08:00:00.000Z', end: '2026-10-12T09:00:00.000Z' }), // 1 h ouverte, personne
          slot({ id: 3, start: '2026-08-01T08:00:00.000Z', end: '2026-08-01T10:00:00.000Z', confirmedBookings: 1 }), // trop ancien
          slot({ id: 4, start: '2026-10-20T08:00:00.000Z', end: '2026-10-20T09:00:00.000Z', capacity: 4, activeBookings: 3 }),
          slot({ id: 5, start: '2026-10-21T08:00:00.000Z', end: '2026-10-21T09:00:00.000Z', capacity: 1, activeBookings: 1 }),
          slot({ id: 6, start: '2026-12-21T08:00:00.000Z', end: '2026-12-21T09:00:00.000Z', capacity: 6 }), // au-delà de 4 semaines
        ],
      }),
    )
    expect(d.hours.given).toBe(1.5)
    expect(d.hours.opened).toBe(2.5)
    expect(d.hours.upcomingSlots).toBe(2)
    expect(d.hours.upcomingSeats).toBe(5)
    expect(d.hours.upcomingSeatsTaken).toBe(4)
  })
})

describe('élèves actifs, nouveaux, perdus', () => {
  it('suit les définitions affichées à Catherine', () => {
    const daysAgo = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString()
    const p = (studentId: number, n: number) => ({
      studentId,
      date: daysAgo(n),
      totalCents: 3000,
      languageCode: 'en',
      invoiced: true,
    })
    const d = computeDashboard(
      base({
        prestations: [
          p(1, 5), p(1, 50), // actif, ancien élève
          p(2, 3), //           actif et nouveau
          p(3, 45), //          perdu (actif il y a 1 à 3 mois, plus rien depuis 30 jours)
          p(4, 200), //         parti depuis longtemps : ni actif ni « perdu » récemment
          p(5, -3), //          cours futur seulement : pas encore actif
        ],
        slots: [slot({ id: 9, start: daysAgo(2), end: daysAgo(2), confirmedStudentIds: [6], confirmedBookings: 1 })], // actif par un cours
      }),
    )
    expect(d.students).toEqual({ active: 3, new: 2, lost: 1 })
  })
})

describe('à faire', () => {
  it('trie les devoirs à corriger du plus ancien au plus récent', () => {
    const d = computeDashboard(
      base({
        submissionsToCorrect: [
          { id: 2, title: 'B', submittedAt: '2026-10-15T10:00:00.000Z' },
          { id: 1, title: 'A', submittedAt: '2026-10-10T10:00:00.000Z' },
        ],
      }),
    )
    expect(d.todo.submissions.map((s) => s.title)).toEqual(['A', 'B'])
  })
})
