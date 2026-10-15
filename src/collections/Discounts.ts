import type { CollectionConfig } from 'payload'

import { publishedOrStaff, staffOnly } from '@/access'

/** Réductions que Catherine propose ; celles marquées visibles apparaissent sur la page des tarifs. */
export const Discounts: CollectionConfig = {
  slug: 'discounts',
  labels: { singular: 'Réduction', plural: 'Réductions' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'percent', 'published'],
    group: 'Catalogue',
  },
  defaultSort: 'order',
  access: { read: publishedOrStaff, create: staffOnly, update: staffOnly, delete: staffOnly },
  fields: [
    { name: 'title', label: 'Nom', type: 'text', required: true, localized: true },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          defaultValue: 'other',
          options: [
            { label: 'Plusieurs langues', value: 'multi_language' },
            { label: 'Séance supplémentaire', value: 'extra_session' },
            { label: 'Famille d’un élève', value: 'family' },
            { label: 'Paiement au mois', value: 'monthly' },
            { label: 'Autre', value: 'other' },
          ],
          admin: { width: '50%' },
        },
        { name: 'percent', label: 'Remise (%)', type: 'number', required: true, min: 0, max: 100, admin: { width: '50%' } },
      ],
    },
    {
      name: 'minLanguages',
      label: 'À partir de combien de langues',
      type: 'number',
      min: 2,
      defaultValue: 2,
      admin: { condition: (_, sibling) => sibling?.type === 'multi_language' },
    },
    { name: 'description', label: 'Explication pour les élèves', type: 'textarea', localized: true },
    {
      type: 'row',
      fields: [
        { name: 'order', label: 'Ordre d’affichage', type: 'number', defaultValue: 0, admin: { width: '50%' } },
        { name: 'published', label: 'Visible sur le site', type: 'checkbox', defaultValue: true, admin: { width: '50%' } },
      ],
    },
  ],
}
