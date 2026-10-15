import type { CollectionConfig } from 'payload'

import { publishedOrStaff, staffOnly } from '@/access'
import { LANGUAGE_CODES } from '@/fields'

const LABELS: Record<(typeof LANGUAGE_CODES)[number], string> = {
  he: 'Hébreu',
  en: 'Anglais',
  es: 'Espagnol',
  fr: 'Français',
  ro: 'Roumain',
}

export const Languages: CollectionConfig = {
  slug: 'languages',
  labels: { singular: 'Langue enseignée', plural: 'Langues enseignées' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'code', 'published', 'order'],
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
    {
      type: 'row',
      fields: [
        {
          name: 'code',
          label: 'Langue',
          type: 'select',
          required: true,
          unique: true,
          options: LANGUAGE_CODES.map((c) => ({ label: LABELS[c], value: c })),
          admin: { width: '50%' },
        },
        {
          name: 'order',
          label: 'Ordre d’affichage',
          type: 'number',
          defaultValue: 0,
          admin: { width: '25%' },
        },
        {
          name: 'published',
          label: 'Visible sur le site',
          type: 'checkbox',
          defaultValue: true,
          admin: { width: '25%' },
        },
      ],
    },
    { name: 'name', label: 'Nom affiché', type: 'text', required: true, localized: true },
    {
      name: 'nativeName',
      label: 'Nom dans la langue elle-même',
      type: 'text',
      admin: { description: 'Par exemple עברית, Română, Español.' },
    },
    {
      name: 'summary',
      label: 'Résumé (cartes de la page d’accueil)',
      type: 'textarea',
      localized: true,
      maxLength: 240,
    },
    { name: 'description', label: 'Présentation détaillée', type: 'richText', localized: true },
    {
      name: 'sample',
      label: 'Phrase d’exemple dans la langue',
      type: 'text',
      admin: {
        description:
          'Affichée telle quelle, dans le bon sens d’écriture (de droite à gauche pour l’hébreu).',
      },
    },
    { name: 'image', label: 'Image', type: 'upload', relationTo: 'media' },
  ],
}
