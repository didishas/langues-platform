import path from 'path'
import type { CollectionConfig } from 'payload'

import { isStaffUser, staffOnly } from '@/access'

/** Documents que Catherine partage avec un ou plusieurs élèves. Jamais publics. */
export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Document partagé', plural: 'Documents partagés' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'language', 'sharedWith', 'updatedAt'],
    group: 'Élèves',
  },
  access: {
    read: ({ req }) => {
      if (isStaffUser(req)) return true
      if (req.user?.collection === 'students') return { sharedWith: { equals: req.user.id } }
      return false
    },
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  upload: {
    // Fichiers privés : servis uniquement via l'API, qui applique les règles d'accès.
    staticDir: path.resolve(process.cwd(), 'uploads', 'documents'),
    mimeTypes: ['application/pdf', 'image/*', 'audio/*', 'video/mp4', 'application/vnd.openxmlformats-officedocument.*', 'application/msword', 'text/plain'],
  },
  fields: [
    { name: 'title', label: 'Titre', type: 'text', required: true },
    { name: 'language', label: 'Langue', type: 'relationship', relationTo: 'languages' },
    {
      name: 'sharedWith',
      label: 'Partagé avec',
      type: 'relationship',
      relationTo: 'students',
      hasMany: true,
      admin: { description: 'Seuls ces élèves voient le document dans leur espace.' },
    },
    { name: 'note', label: 'Note pour les élèves', type: 'textarea' },
  ],
}
