import path from 'path'
import type { CollectionConfig } from 'payload'

import { isStaffUser } from '@/access'

/** Fichiers rendus par les élèves avec leurs devoirs. Visibles par l'élève qui les a envoyés et par l'équipe. */
export const SubmissionFiles: CollectionConfig = {
  slug: 'submission-files',
  labels: { singular: 'Fichier rendu', plural: 'Fichiers rendus' },
  admin: { group: 'Élèves', hidden: ({ user }) => user?.collection !== 'users' },
  access: {
    read: ({ req }) => {
      if (isStaffUser(req)) return true
      if (req.user?.collection === 'students') return { owner: { equals: req.user.id } }
      return false
    },
    create: ({ req }) => isStaffUser(req) || req.user?.collection === 'students',
    update: () => false,
    delete: ({ req }) => isStaffUser(req),
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        // Le propriétaire est toujours l'élève connecté, jamais une valeur envoyée par le formulaire.
        if (operation === 'create' && req.user?.collection === 'students') data.owner = req.user.id
        return data
      },
    ],
  },
  upload: {
    // Fichiers privés : servis uniquement via l'API, qui applique les règles d'accès.
    staticDir: path.resolve(process.cwd(), 'uploads', 'submission-files'),
    mimeTypes: ['application/pdf', 'image/*', 'audio/*', 'application/vnd.openxmlformats-officedocument.*', 'application/msword', 'text/plain'],
  },
  fields: [
    { name: 'owner', label: 'Élève', type: 'relationship', relationTo: 'students', admin: { readOnly: true } },
  ],
}
