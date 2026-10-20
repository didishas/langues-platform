import { APIError, type CollectionConfig } from 'payload'

import { isStaffUser, isTeacher, staffOnly, teacherOnly } from '@/access'
import { recipientFor } from '@/mail/outbox'
import { outboxSendEndpoint } from '@/mail/endpoints'

/** Un message parti n'est plus modifiable (aussi affiché en lecture seule dans l'administration). */
const editableUntilSent = {
  update: ({ req, doc }: { req: Parameters<typeof isTeacher>[0]; doc?: { status?: string } }) => isTeacher(req) && doc?.status !== 'sent',
}

const idOf = (v: unknown): number | undefined =>
  v && typeof v === 'object' ? (v as { id: number }).id : typeof v === 'number' ? v : undefined

/**
 * Messages à envoyer. Le site les prépare (facture validée, séance confirmée) ou Catherine les écrit ;
 * rien ne part avant qu'elle clique sur « Valider et envoyer » (voir `src/mail/outbox.ts`).
 */
export const Outbox: CollectionConfig = {
  slug: 'outbox',
  labels: { singular: 'Message', plural: 'Messages à envoyer' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'status', 'updatedAt'],
    group: 'Élèves',
    description: 'Rien ne part sans vous : relisez, modifiez si besoin, puis « Valider et envoyer ».',
  },
  defaultSort: '-updatedAt',
  endpoints: [outboxSendEndpoint],
  access: { read: staffOnly, create: teacherOnly, update: teacherOnly, delete: teacherOnly },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        const sending = req.context.outboxSend === true
        if (originalDoc?.status === 'sent' && !sending) {
          throw new APIError('Ce message est déjà parti : il ne peut plus être modifié.', 409, null, true)
        }
        // Seul l'envoi (côté serveur) passe un message à « envoyé » ou « échec ».
        if (!sending && data.status && !['draft', 'cancelled'].includes(data.status)) {
          data.status = originalDoc?.status === 'failed' ? 'failed' : 'draft'
        }
        // Le destinataire n'est jamais saisi : il vient de la fiche de l'élève.
        const studentId = idOf(data.student ?? originalDoc?.student)
        if (!studentId) throw new APIError('Choisissez l’élève.', 400, null, true)
        const student = await req.payload.findByID({ collection: 'students', id: studentId, depth: 0, overrideAccess: true, req })
        const who = (data.recipient ?? originalDoc?.recipient ?? 'student') as 'student' | 'guardian'
        const recipient = recipientFor(student, who)
        if (!recipient) {
          throw new APIError(
            who === 'guardian' ? 'Aucun e-mail de responsable légal dans la fiche de l’élève.' : 'Aucun e-mail dans la fiche de l’élève.',
            400,
            null,
            true,
          )
        }
        data.to = recipient.email
        data.toName = recipient.name
        if (operation === 'create' && !data.locale) data.locale = student.preferredLocale ?? 'fr'
        data.title = `${data.subject ?? originalDoc?.subject ?? ''} · ${student.fullName ?? recipient.email}`
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        if (req.context.privacyErase === true) return
        const doc = await req.payload.findByID({ collection: 'outbox', id, depth: 0, overrideAccess: true, req })
        if (doc.status === 'sent') throw new APIError('Un message envoyé est gardé comme trace.', 409, null, true)
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'student', label: 'Élève', type: 'relationship', relationTo: 'students', required: true, access: editableUntilSent, admin: { width: '50%' } },
        {
          name: 'recipient',
          label: 'Envoyer à',
          type: 'select',
          defaultValue: 'student',
          access: editableUntilSent,
          options: [
            { label: 'L’élève', value: 'student' },
            { label: 'Son responsable légal', value: 'guardian' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    { name: 'to', label: 'Adresse', type: 'email', admin: { readOnly: true, description: 'Reprise de la fiche de l’élève.' } },
    { name: 'toName', type: 'text', admin: { hidden: true } },
    { name: 'subject', label: 'Objet', type: 'text', required: true, access: editableUntilSent },
    { name: 'body', label: 'Message', type: 'textarea', required: true, access: editableUntilSent, admin: { rows: 14 } },
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      required: true,
      defaultValue: 'message',
      options: [
        { label: 'Message', value: 'message' },
        { label: 'Facture', value: 'invoice' },
        { label: 'Séance confirmée', value: 'booking' },
      ],
      access: { update: () => false },
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      label: 'État',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'À valider', value: 'draft' },
        { label: 'Envoyé', value: 'sent' },
        { label: 'Échec de l’envoi', value: 'failed' },
        { label: 'Annulé', value: 'cancelled' },
      ],
      admin: { position: 'sidebar', description: 'Pour envoyer, utilisez le bouton « Valider et envoyer ».' },
    },
    {
      name: 'sendAction',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '/components/admin/OutboxSend#OutboxSend' } },
    },
    { name: 'locale', type: 'text', admin: { hidden: true } },
    { name: 'invoice', label: 'Facture', type: 'relationship', relationTo: 'invoices', admin: { readOnly: true, position: 'sidebar', condition: (d) => Boolean(d?.invoice) } },
    { name: 'booking', label: 'Réservation', type: 'relationship', relationTo: 'bookings', admin: { readOnly: true, position: 'sidebar', condition: (d) => Boolean(d?.booking) } },
    { name: 'amountCents', type: 'number', admin: { hidden: true } },
    { name: 'approvedBy', label: 'Validé par', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar', condition: (d) => Boolean(d?.approvedBy) } },
    { name: 'approvedAt', label: 'Validé le', type: 'date', admin: { readOnly: true, position: 'sidebar', condition: (d) => Boolean(d?.approvedAt) } },
    { name: 'approvedHash', type: 'text', access: { read: ({ req }) => isStaffUser(req) }, admin: { hidden: true } },
    { name: 'sentAt', label: 'Envoyé le', type: 'date', admin: { readOnly: true, position: 'sidebar', condition: (d) => Boolean(d?.sentAt) } },
    { name: 'messageId', type: 'text', admin: { hidden: true } },
    { name: 'error', label: 'Erreur d’envoi', type: 'text', admin: { readOnly: true, condition: (d) => Boolean(d?.error) } },
  ],
}

