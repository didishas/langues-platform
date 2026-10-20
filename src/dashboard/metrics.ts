/**
 * Calculs du tableau de bord de Catherine. Fonctions pures : aucune lecture de base ici,
 * pour pouvoir tester chaque définition (mois, retards, élèves perdus…) avec des données maîtrisées.
 *
 * Toutes les périodes sont calculées à l'heure de Bruxelles.
 */

export const TIME_ZONE = 'Europe/Brussels'
const DAY = 864e5

export type InvoiceRow = {
  id: number
  status: 'to_validate' | 'validated' | 'sent' | 'paid' | 'cancelled'
  totalCents: number
  paidAt: string | null
  issueDate: string | null
  dueDate: string | null
  number: string | null
  studentId: number | null
  studentName: string
}

export type PrestationRow = {
  studentId: number
  date: string
  totalCents: number
  languageCode: string | null
  invoiced: boolean
}

export type SlotRow = {
  id: number
  start: string
  end: string
  capacity: number
  /** Réservations non annulées. */
  activeBookings: number
  confirmedBookings: number
  /** Élèves dont la réservation est confirmée. */
  confirmedStudentIds: number[]
}

export type SubmissionRow = { id: number; title: string; submittedAt: string | null }
export type TrialRow = { id: number; name: string; createdAt: string }

export type DashboardInput = {
  now: Date
  invoices: InvoiceRow[]
  prestations: PrestationRow[]
  slots: SlotRow[]
  submissionsToCorrect: SubmissionRow[]
  newTrialRequests: TrialRow[]
  /** Réponses orales aux exercices des vidéos, pas encore écoutées. */
  oralToReview: number
  /** Messages préparés qui attendent la validation de Catherine (ou dont l'envoi a échoué). */
  messagesToApprove: number
  /** Pourcentage saisi par Catherine ; `null` = pas de réserve affichée. */
  taxReservePercent: number | null
  directBilling: boolean
}

/** « 2026-10 » pour un instant donné, à l'heure de Bruxelles. */
export function monthKey(iso: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(
    typeof iso === 'string' ? new Date(iso) : iso,
  )
  const y = parts.find((p) => p.type === 'year')!.value
  const m = parts.find((p) => p.type === 'month')!.value
  return `${y}-${m}`
}

/** Les `count` derniers mois, du plus ancien au mois en cours. */
export function lastMonths(now: Date, count: number): string[] {
  const [y, m] = monthKey(now).split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const total = y * 12 + (m - 1) - (count - 1 - i)
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
  })
}

/** Jour calendaire à Bruxelles (« 2026-10-17 »). */
export function dayKey(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    typeof iso === 'string' ? new Date(iso) : iso,
  )
}

const OPEN_STATUSES = new Set(['validated', 'sent'])

export function computeDashboard(input: DashboardInput) {
  const { now } = input
  const t = now.getTime()
  const thisMonth = monthKey(now)
  const months = lastMonths(now, 12)
  const prevMonth = months.at(-2)!
  const today = dayKey(now)

  // ——— Argent
  const paid = input.invoices.filter((i) => i.status === 'paid' && i.paidAt)
  const paidByMonth = new Map<string, number>(months.map((m) => [m, 0]))
  for (const i of paid) {
    const k = monthKey(i.paidAt!)
    if (paidByMonth.has(k)) paidByMonth.set(k, paidByMonth.get(k)! + i.totalCents)
  }
  const collectedThisMonth = paidByMonth.get(thisMonth) ?? 0
  const collectedLastMonth = paidByMonth.get(prevMonth) ?? 0
  const year = thisMonth.slice(0, 4)
  const collectedThisYear = paid.filter((i) => monthKey(i.paidAt!).startsWith(year)).reduce((s, i) => s + i.totalCents, 0)

  const open = input.invoices.filter((i) => OPEN_STATUSES.has(i.status))
  // En retard : échéance dépassée, à partir du lendemain de l'échéance (heure de Bruxelles).
  const overdue = open
    .filter((i) => i.dueDate && dayKey(i.dueDate) < today)
    .map((i) => ({
      id: i.id,
      number: i.number,
      studentName: i.studentName,
      totalCents: i.totalCents,
      daysLate: Math.round((Date.parse(today) - Date.parse(dayKey(i.dueDate!))) / DAY),
    }))
    .sort((a, b) => b.daysLate - a.daysLate)

  const toInvoice = input.prestations.filter((p) => !p.invoiced)

  // ——— Par langue (12 mois glissants, prestations réalisées)
  const firstMonth = months[0]
  const byLanguage = new Map<string, number>()
  for (const p of input.prestations) {
    if (monthKey(p.date) < firstMonth || p.date > now.toISOString()) continue
    const k = p.languageCode ?? 'unknown'
    byLanguage.set(k, (byLanguage.get(k) ?? 0) + p.totalCents)
  }

  // ——— Heures
  const hours = (s: SlotRow) => (Date.parse(s.end) - Date.parse(s.start)) / 36e5
  const past30 = input.slots.filter((s) => Date.parse(s.end) <= t && Date.parse(s.start) >= t - 30 * DAY)
  const hoursGiven = past30.filter((s) => s.confirmedBookings > 0).reduce((h, s) => h + hours(s), 0)
  const hoursOpened = past30.reduce((h, s) => h + hours(s), 0)
  const next28 = input.slots.filter((s) => Date.parse(s.start) > t && Date.parse(s.start) <= t + 28 * DAY)
  const seats = next28.reduce((n, s) => n + Math.max(1, s.capacity), 0)
  const seatsTaken = next28.reduce((n, s) => n + Math.min(s.activeBookings, Math.max(1, s.capacity)), 0)

  // ——— Élèves (activité = prestation réalisée ou cours confirmé déjà passé)
  const activity = new Map<number, number[]>()
  const add = (id: number, iso: string) => {
    const at = Date.parse(iso)
    if (at > t) return
    activity.set(id, [...(activity.get(id) ?? []), at])
  }
  for (const p of input.prestations) add(p.studentId, p.date)
  for (const s of input.slots) for (const id of s.confirmedStudentIds) add(id, s.start)

  let active = 0
  let fresh = 0
  let lost = 0
  for (const dates of activity.values()) {
    const recent = dates.some((d) => d >= t - 30 * DAY)
    const before = dates.some((d) => d < t - 30 * DAY)
    const between = dates.some((d) => d >= t - 90 * DAY && d < t - 30 * DAY)
    if (recent) active += 1
    if (recent && !before) fresh += 1
    if (!recent && between) lost += 1
  }

  return {
    money: {
      collectedThisMonth,
      collectedLastMonth,
      collectedThisYear,
      collectedByMonth: months.map((m) => ({ month: m, cents: paidByMonth.get(m) ?? 0 })),
      toCollectCents: open.reduce((s, i) => s + i.totalCents, 0),
      toCollectCount: open.length,
      overdue,
      overdueCents: overdue.reduce((s, i) => s + i.totalCents, 0),
      toValidateCount: input.invoices.filter((i) => i.status === 'to_validate').length,
      toInvoiceCount: toInvoice.length,
      toInvoiceCents: toInvoice.reduce((s, p) => s + p.totalCents, 0),
      taxReserveCents:
        input.directBilling && input.taxReservePercent != null && input.taxReservePercent > 0
          ? Math.round((collectedThisYear * input.taxReservePercent) / 100)
          : null,
      taxReservePercent: input.taxReservePercent,
      year,
    },
    byLanguage: [...byLanguage.entries()]
      .map(([code, cents]) => ({ code, cents }))
      .sort((a, b) => b.cents - a.cents),
    hours: {
      given: Math.round(hoursGiven * 10) / 10,
      opened: Math.round(hoursOpened * 10) / 10,
      upcomingSeats: seats,
      upcomingSeatsTaken: seatsTaken,
      upcomingSlots: next28.length,
    },
    students: { active, new: fresh, lost },
    todo: {
      submissions: [...input.submissionsToCorrect].sort((a, b) =>
        (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''),
      ),
      trialRequests: [...input.newTrialRequests].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      oralToReview: input.oralToReview,
      messagesToApprove: input.messagesToApprove,
    },
  }
}

export type Dashboard = ReturnType<typeof computeDashboard>
