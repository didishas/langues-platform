import type { CollectionConfig } from 'payload'

import { staffOnly } from '@/access'

/** Comptes de l'équipe qui administre le site (Catherine, compte technique). */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Compte équipe', plural: 'Comptes équipe' },
  admin: {
    useAsTitle: 'email',
    group: 'Réglages',
  },
  auth: true,
  access: {
    read: staffOnly,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    { name: 'name', label: 'Nom', type: 'text' },
    {
      name: 'role',
      label: 'Rôle',
      type: 'select',
      defaultValue: 'teacher',
      options: [
        { label: 'Professeure', value: 'teacher' },
        { label: 'Technique', value: 'tech' },
      ],
    },
  ],
}
