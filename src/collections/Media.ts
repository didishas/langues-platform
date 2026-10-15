import path from 'path'
import type { CollectionConfig } from 'payload'

import { staffOnly } from '@/access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Image ou fichier', plural: 'Images et fichiers' },
  admin: { group: 'Contenu du site' },
  access: {
    read: () => true,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    {
      name: 'alt',
      label: 'Description de l’image',
      type: 'text',
      required: true,
      localized: true,
      admin: { description: 'Lue par les lecteurs d’écran et affichée si l’image ne charge pas.' },
    },
  ],
  upload: { staticDir: path.resolve(process.cwd(), 'uploads', 'media') },
}
