import type { GlobalConfig } from 'payload'

import { staffOnly } from '@/access'

/** Réglages des cours, réservés à l'équipe : les liens de visio ne sont jamais publics. */
export const TeachingSettings: GlobalConfig = {
  slug: 'teaching-settings',
  label: 'Réglages des cours',
  admin: {
    group: 'Agenda',
    description:
      'Vos liens de visio habituels. Ils se remplissent tout seuls sur chaque nouveau créneau, selon l’outil choisi.',
  },
  access: { read: staffOnly, update: staffOnly },
  fields: [
    {
      name: 'defaultVisioTool',
      label: 'Outil de visio par défaut',
      type: 'select',
      required: true,
      defaultValue: 'zoom',
      options: [
        { label: 'Zoom', value: 'zoom' },
        { label: 'Google Meet', value: 'meet' },
      ],
    },
    {
      name: 'zoomUrl',
      label: 'Lien Zoom habituel',
      type: 'text',
      validate: (v: unknown) =>
        !v || /^https:\/\/([a-z0-9-]+\.)*zoom\.us\//i.test(String(v)) || 'Collez un lien qui commence par https:// et contient zoom.us',
      admin: { description: 'Par exemple votre salle personnelle : https://us05web.zoom.us/j/…' },
    },
    {
      name: 'meetUrl',
      label: 'Lien Google Meet habituel',
      type: 'text',
      validate: (v: unknown) =>
        !v || /^https:\/\/meet\.google\.com\//i.test(String(v)) || 'Collez un lien qui commence par https://meet.google.com/',
      admin: { description: 'Par exemple https://meet.google.com/abc-defg-hij' },
    },
  ],
}
