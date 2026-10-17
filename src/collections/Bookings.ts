import { APIError, type CollectionConfig } from 'payload'

import { ownStudentDocsOrStaff, staffOnly } from '@/access'
import { LOCK, lockInTransaction } from '@/lib/dbLock'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  labels: { singular: 'Réservation', plural: 'Réservations' },
  admin: {
    defaultColumns: ['slot', 'student', 'offer', 'status'],
    group: 'Agenda',
  },
  access: {
    read: ownStudentDocsOrStaff,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc, operation }) => {
        const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | undefined))
        const slotId = idOf(data.slot ?? originalDoc?.slot)
        const status = data.status ?? originalDoc?.status ?? 'requested'
        const becomesActive = status !== 'cancelled'
        const wasActive = operation === 'update' && originalDoc && originalDoc.status !== 'cancelled'
        const slotChanged = operation === 'create' || idOf(originalDoc?.slot) !== slotId
        if (!slotId || !becomesActive || (wasActive && !slotChanged)) return data

        // Une seule vérification de capacité à la fois par créneau : la demande suivante attend que
        // la précédente soit enregistrée, puis compte les places avec elle.
        await lockInTransaction(req, LOCK.slotBooking, slotId)
        const slot = await req.payload.findByID({ collection: 'slots', id: slotId, req, depth: 0 })
        const taken = await req.payload.count({
          collection: 'bookings',
          req,
          where: { and: [{ slot: { equals: slotId } }, { status: { not_equals: 'cancelled' } }] },
        })
        if (taken.totalDocs >= (slot.capacity ?? 1)) {
          throw new APIError('Ce créneau est complet. Choisissez un autre créneau.', 409, null, true)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'slot', label: 'Créneau', type: 'relationship', relationTo: 'slots', required: true },
    { name: 'student', label: 'Élève', type: 'relationship', relationTo: 'students', required: true },
    { name: 'offer', label: 'Formule', type: 'relationship', relationTo: 'offers' },
    {
      name: 'status',
      label: 'État',
      type: 'select',
      defaultValue: 'requested',
      options: [
        { label: 'Demandée', value: 'requested' },
        { label: 'Confirmée', value: 'confirmed' },
        { label: 'Annulée', value: 'cancelled' },
      ],
    },
    { name: 'message', label: 'Message de l’élève', type: 'textarea' },
  ],
}
