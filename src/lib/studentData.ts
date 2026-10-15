import 'server-only'

import type { Assignment, Document, Invoice, Language, Slot, Submission } from '@/payload-types'

import { payloadClient } from './content'
import { asStudent, type StudentUser } from './student'

const idOf = <T extends { id: number }>(v: number | T | null | undefined) => (v && typeof v === 'object' ? v.id : v)

export type AssignmentStatus = 'todo' | 'submitted' | 'corrected' | 'returned'

export type AssignmentRow = {
  assignment: Assignment
  submission: Submission | null
  status: AssignmentStatus
  language: Language | null
}

/** Devoirs de l'élève avec l'état de sa remise. Lu avec les droits de l'élève. */
export async function getAssignmentRows(student: StudentUser): Promise<AssignmentRow[]> {
  const payload = await payloadClient()
  const [assignments, submissions] = await Promise.all([
    payload.find({ collection: 'assignments', limit: 200, depth: 1, sort: 'dueDate', ...asStudent(student) }),
    payload.find({ collection: 'submissions', limit: 200, depth: 0, ...asStudent(student) }),
  ])
  return assignments.docs.map((assignment) => {
    const submission = submissions.docs.find((s) => idOf(s.assignment) === assignment.id) ?? null
    return {
      assignment,
      submission,
      status: (submission?.status ?? 'todo') as AssignmentStatus,
      language: typeof assignment.language === 'object' ? (assignment.language as Language) : null,
    }
  })
}

export async function getAssignment(student: StudentUser, id: number) {
  const payload = await payloadClient()
  try {
    const assignment = await payload.findByID({ collection: 'assignments', id, depth: 1, ...asStudent(student) })
    const submissions = await payload.find({
      collection: 'submissions',
      where: { assignment: { equals: id } },
      limit: 1,
      depth: 1,
      ...asStudent(student),
    })
    return { assignment, submission: submissions.docs[0] ?? null }
  } catch {
    return null
  }
}

export type UpcomingSession = {
  bookingId: number
  slot: Slot
  confirmed: boolean
  meetingUrl: string | null
  visioTool: 'zoom' | 'meet' | null
}

/**
 * Prochaines séances réservées. Le créneau et son lien de visio sont lus avec les droits de l'équipe,
 * mais seulement pour les réservations de l'élève, et le lien seulement si la réservation est confirmée.
 */
export async function getUpcomingSessions(student: StudentUser): Promise<UpcomingSession[]> {
  const payload = await payloadClient()
  const bookings = await payload.find({
    collection: 'bookings',
    where: { status: { not_equals: 'cancelled' } },
    limit: 50,
    depth: 0,
    ...asStudent(student),
  })
  const slotIds = bookings.docs.map((b) => idOf(b.slot)).filter((id): id is number => typeof id === 'number')
  if (slotIds.length === 0) return []
  const slots = await payload.find({
    collection: 'slots',
    where: { and: [{ id: { in: slotIds } }, { end: { greater_than: new Date().toISOString() } }] },
    sort: 'start',
    limit: 50,
    depth: 1,
    overrideAccess: true,
  })
  return slots.docs.map((slot) => {
    const booking = bookings.docs.find((b) => idOf(b.slot) === slot.id)!
    const confirmed = booking.status === 'confirmed'
    const { meetingUrl, ...publicSlot } = slot
    return {
      bookingId: booking.id,
      slot: publicSlot as Slot,
      confirmed,
      meetingUrl: confirmed ? (meetingUrl ?? null) : null,
      visioTool: slot.visioTool ?? null,
    }
  })
}

export async function getDocuments(student: StudentUser): Promise<Document[]> {
  const payload = await payloadClient()
  const res = await payload.find({ collection: 'documents', limit: 200, depth: 1, sort: '-updatedAt', ...asStudent(student) })
  return res.docs
}

export async function getInvoices(student: StudentUser): Promise<Invoice[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'invoices',
    where: { status: { not_equals: 'cancelled' } },
    limit: 100,
    depth: 0,
    sort: '-issueDate',
    ...asStudent(student),
  })
  return res.docs
}
