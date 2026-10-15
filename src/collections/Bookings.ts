import type { CollectionConfig } from 'payload'

import { ownStudentDocsOrStaff, staffOnly } from '@/access'

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
        const slotId = typeof data.slot === 'object' ? data.slot?.id : data.slot
        const becomesActive = data.status !== 'cancelled'
        const wasActive = originalDoc && originalDoc.status !== 'cancelled'
        const slotChanged =
          operation === 'create' ||
          (originalDoc && (typeof originalDoc.slot === 'object' ? originalDoc.slot?.id : originalDoc.slot) !== slotId)
        if (!slotId || !becomesActive || (wasActive && !slotChanged)) return data

        const slot = await req.payload.findByID({ collection: 'slots', id: slotId, req, depth: 0 })
        const taken = await req.payload.count({
          collection: 'bookings',
          req,
          where: { and: [{ slot: { equals: slotId } }, { status: { not_equals: 'cancelled' } }] },
        })
        if (taken.totalDocs >= (slot.capacity ?? 1)) {
          throw new Error('Ce créneau est complet.')
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
