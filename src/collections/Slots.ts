import type { CollectionConfig } from 'payload'

import { staffOnly } from '@/access'

/** Créneaux que Catherine ouvre à la réservation. */
export const Slots: CollectionConfig = {
  slug: 'slots',
  labels: { singular: 'Créneau', plural: 'Créneaux' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'format', 'capacity', 'status'],
    group: 'Agenda',
  },
  defaultSort: 'start',
  access: {
    // Les créneaux ouverts sont visibles publiquement pour la réservation.
    read: ({ req }) => (req.user?.collection === 'users' ? true : { status: { equals: 'open' } }),
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.start && data?.end && new Date(data.end) <= new Date(data.start)) {
          throw new Error('La fin du créneau doit être après son début.')
        }
        return data
      },
    ],
    beforeChange: [
      ({ data }) => {
        if (data.start) {
          const d = new Date(data.start)
          data.label = new Intl.DateTimeFormat('fr-BE', {
            dateStyle: 'full',
            timeStyle: 'short',
            timeZone: 'Europe/Brussels',
          }).format(d)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'label', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        {
          name: 'start',
          label: 'Début',
          type: 'date',
          required: true,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime', timeIntervals: 15 } },
        },
        {
          name: 'end',
          label: 'Fin',
          type: 'date',
          required: true,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime', timeIntervals: 15 } },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'format',
          label: 'Format',
          type: 'select',
          defaultValue: 'individual',
          options: [
            { label: 'Individuel', value: 'individual' },
            { label: 'Groupe', value: 'group' },
          ],
          admin: { width: '33%' },
        },
        { name: 'capacity', label: 'Places', type: 'number', defaultValue: 1, min: 1, admin: { width: '33%' } },
        {
          name: 'status',
          label: 'État',
          type: 'select',
          defaultValue: 'open',
          options: [
            { label: 'Ouvert à la réservation', value: 'open' },
            { label: 'Fermé', value: 'closed' },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    {
      name: 'language',
      label: 'Langue (optionnel)',
      type: 'relationship',
      relationTo: 'languages',
      admin: { description: 'Laisser vide si le créneau est ouvert à toutes les langues.' },
    },
  ],
}
