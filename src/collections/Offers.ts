import type { CollectionConfig } from 'payload'

import { publishedOrStaff, staffOnly } from '@/access'
import { euroAmountFields } from '@/fields'

export const Offers: CollectionConfig = {
  slug: 'offers',
  labels: { singular: 'Formule', plural: 'Formules et tarifs' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'format', 'price', 'published'],
    group: 'Catalogue',
  },
  defaultSort: 'order',
  access: {
    read: publishedOrStaff,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    { name: 'title', label: 'Nom de la formule', type: 'text', required: true, localized: true },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          label: 'Type',
          type: 'select',
          required: true,
          defaultValue: 'single',
          options: [
            { label: 'Séance à l’unité', value: 'single' },
            { label: 'Forfait de séances', value: 'pack' },
            { label: 'Abonnement mensuel', value: 'subscription' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'format',
          label: 'Format',
          type: 'select',
          required: true,
          defaultValue: 'individual',
          options: [
            { label: 'Individuel', value: 'individual' },
            { label: 'Groupe', value: 'group' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'durationMinutes',
          label: 'Durée d’une séance (minutes)',
          type: 'number',
          required: true,
          min: 15,
          defaultValue: 60,
          admin: { width: '33%' },
        },
      ],
    },
    {
      name: 'sessionsCount',
      label: 'Nombre de séances incluses',
      type: 'number',
      min: 1,
      admin: { condition: (_, sibling) => sibling?.kind !== 'single' },
    },
    ...euroAmountFields('price', 'Prix', {
      required: true,
      description: 'En euros, pour la formule entière (toutes séances comprises).',
    }),
    {
      name: 'languages',
      label: 'Langues concernées',
      type: 'relationship',
      relationTo: 'languages',
      hasMany: true,
      admin: { description: 'Laisser vide si la formule vaut pour toutes les langues.' },
    },
    { name: 'description', label: 'Description', type: 'textarea', localized: true },
    {
      type: 'row',
      fields: [
        { name: 'order', label: 'Ordre d’affichage', type: 'number', defaultValue: 0, admin: { width: '50%' } },
        {
          name: 'published',
          label: 'Visible sur le site',
          type: 'checkbox',
          defaultValue: true,
          admin: { width: '50%' },
        },
      ],
    },
  ],
}
