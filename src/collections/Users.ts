import type { CollectionConfig } from 'payload'

import { isTeacher, staffOnly, teacherOnly } from '@/access'

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
    // Seule Catherine crée ou supprime un compte. Le compte technique ne modifie que le sien
    // (mot de passe) : il ne peut ni changer son rôle ni toucher au compte de Catherine.
    create: teacherOnly,
    update: ({ req }) => {
      if (isTeacher(req)) return true
      if (req.user?.collection === 'users') return { id: { equals: req.user.id } }
      return false
    },
    delete: teacherOnly,
    unlock: teacherOnly,
  },
  fields: [
    { name: 'name', label: 'Nom', type: 'text' },
    {
      name: 'role',
      label: 'Rôle',
      type: 'select',
      defaultValue: 'teacher',
      required: true,
      access: { create: ({ req }) => isTeacher(req), update: ({ req }) => isTeacher(req) },
      admin: { description: 'Le compte technique lit tout mais ne valide, n’envoie ni ne supprime rien.' },
      options: [
        { label: 'Professeure', value: 'teacher' },
        { label: 'Technique', value: 'tech' },
      ],
    },
  ],
}
