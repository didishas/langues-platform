import type { CollectionConfig } from 'payload'

import { publishedOrStaff, staffOnly } from '@/access'
import { cefrLevelField, euroAmountFields } from '@/fields'

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
            { label: 'Tarif à l’unité de travail (ex. par page)', value: 'per_unit' },
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
            { label: 'Atelier parent + enfant', value: 'parent_child' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'durationMinutes',
          label: 'Durée d’une séance (minutes)',
          type: 'number',
          min: 15,
          defaultValue: 90,
          admin: { width: '33%', condition: (_, sibling) => sibling?.kind !== 'per_unit' },
        },
      ],
    },
    {
      name: 'sessionsCount',
      label: 'Nombre de séances incluses',
      type: 'number',
      min: 1,
      admin: { condition: (_, sibling) => sibling?.kind === 'pack' || sibling?.kind === 'subscription' },
    },
    {
      name: 'unitLabel',
      label: 'Unité facturée',
      type: 'text',
      localized: true,
      admin: {
        condition: (_, sibling) => sibling?.kind === 'per_unit',
        description: 'Par exemple « page » pour l’aide aux devoirs.',
      },
    },
    ...euroAmountFields('price', 'Prix', {
      required: true,
      description: 'En euros : prix de la séance, du forfait entier, du mois ou de l’unité selon le type.',
    }),
    {
      name: 'languages',
      label: 'Langues concernées',
      type: 'relationship',
      relationTo: 'languages',
      hasMany: true,
      admin: { description: 'Laisser vide si la formule vaut pour toutes les langues.' },
    },
    {
      name: 'focus',
      label: 'Spécialité',
      type: 'text',
      localized: true,
      admin: { description: 'Par exemple « Prononciation et accent » ou « Lecture, écriture, expression orale ».' },
    },
    {
      type: 'row',
      fields: [
        { ...cefrLevelField('levelFrom', 'Du niveau'), admin: { width: '50%' } },
        { ...cefrLevelField('levelTo', 'Au niveau'), admin: { width: '50%' } },
      ],
    },
    {
      name: 'resourcesIncluded',
      label: 'Supports de cours inclus',
      type: 'checkbox',
      defaultValue: true,
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
