import type { CollectionConfig } from 'payload'

import { ownStudentDocsOrStaff, staffOnly } from '@/access'
import { euroAmountFields } from '@/fields'

/**
 * Prestation = ce qui a été donné (séance, forfait, abonnement).
 * C'est la source de vérité : les factures ne sont qu'une projection de ces lignes,
 * quel que soit le fournisseur de facturation.
 */
export const Prestations: CollectionConfig = {
  slug: 'prestations',
  labels: { singular: 'Prestation', plural: 'Prestations' },
  admin: {
    useAsTitle: 'description',
    defaultColumns: ['date', 'student', 'description', 'unitPrice', 'status'],
    group: 'Facturation',
  },
  defaultSort: '-date',
  access: {
    read: ownStudentDocsOrStaff,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        const doc = await req.payload.findByID({ collection: 'prestations', id, req, depth: 0 })
        if (doc.status === 'invoiced') {
          throw new Error('Une prestation facturée ne peut pas être supprimée.')
        }
      },
    ],
  },
  fields: [
    { name: 'student', label: 'Élève', type: 'relationship', relationTo: 'students', required: true },
    {
      type: 'row',
      fields: [
        { name: 'date', label: 'Date', type: 'date', required: true, admin: { width: '50%' } },
        { name: 'offer', label: 'Formule', type: 'relationship', relationTo: 'offers', admin: { width: '50%' } },
      ],
    },
    { name: 'description', label: 'Libellé sur la facture', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'quantity', label: 'Quantité', type: 'number', defaultValue: 1, min: 0.25, required: true },
        ...euroAmountFields('unitPrice', 'Prix unitaire', { required: true }),
      ],
    },
    { name: 'booking', label: 'Réservation liée', type: 'relationship', relationTo: 'bookings' },
    {
      name: 'status',
      label: 'État',
      type: 'select',
      defaultValue: 'to_invoice',
      options: [
        { label: 'À facturer', value: 'to_invoice' },
        { label: 'Facturée', value: 'invoiced' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'invoice',
      label: 'Facture',
      type: 'relationship',
      relationTo: 'invoices',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
