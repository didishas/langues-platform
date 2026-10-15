import type { CollectionConfig } from 'payload'

import { staffOnly } from '@/access'

/** Créneaux que Catherine ouvre à la réservation. */
export const Slots: CollectionConfig = {
  slug: 'slots',
  labels: { singular: 'Créneau', plural: 'Créneaux' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'format', 'capacity', 'status'],
    group: 'Agenda',
  },
  defaultSort: 'start',
  access: {
    // Les créneaux ouverts sont visibles publiquement pour la réservation.
    read: ({ req }) => (req.user?.collection === 'users' ? true : { status: { equals: 'open' } }),
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.start && data?.end && new Date(data.end) <= new Date(data.start)) {
          throw new Error('La fin du créneau doit être après son début.')
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        // Outil et lien de visio : repris des « Réglages des cours » quand ils ne sont pas saisis.
        const settings = await req.payload.findGlobal({ slug: 'teaching-settings', req, depth: 0, overrideAccess: true })
        const defaults: Record<string, string | null | undefined> = { zoom: settings.zoomUrl, meet: settings.meetUrl }
        const previousTool = originalDoc?.visioTool
        const tool = data.visioTool ?? previousTool ?? settings.defaultVisioTool ?? 'zoom'
        data.visioTool = tool
        const currentUrl = data.meetingUrl ?? originalDoc?.meetingUrl
        const urlWasPreviousDefault = previousTool && currentUrl && currentUrl === defaults[previousTool]
        if (!currentUrl || (tool !== previousTool && urlWasPreviousDefault)) {
          data.meetingUrl = defaults[tool] ?? null
        }
        if (data.start) {
          const d = new Date(data.start)
          data.label = new Intl.DateTimeFormat('fr-BE', {
            dateStyle: 'full',
            timeStyle: 'short',
            timeZone: 'Europe/Brussels',
          }).format(d)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'label', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        {
          name: 'start',
          label: 'Début',
          type: 'date',
          required: true,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime', timeIntervals: 15 } },
        },
        {
          name: 'end',
          label: 'Fin',
          type: 'date',
          required: true,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime', timeIntervals: 15 } },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'format',
          label: 'Format',
          type: 'select',
          defaultValue: 'individual',
          options: [
            { label: 'Individuel', value: 'individual' },
            { label: 'Groupe', value: 'group' },
          ],
          admin: { width: '33%' },
        },
        { name: 'capacity', label: 'Places', type: 'number', defaultValue: 1, min: 1, admin: { width: '33%' } },
        {
          name: 'status',
          label: 'État',
          type: 'select',
          defaultValue: 'open',
          options: [
            { label: 'Ouvert à la réservation', value: 'open' },
            { label: 'Fermé', value: 'closed' },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'visioTool',
          label: 'Visio',
          type: 'select',
          options: [
            { label: 'Zoom', value: 'zoom' },
            { label: 'Google Meet', value: 'meet' },
          ],
          admin: { width: '33%', description: 'Vide = votre outil par défaut.' },
        },
        {
          name: 'meetingUrl',
          label: 'Lien de la visio',
          type: 'text',
          access: { read: ({ req }) => req.user?.collection === 'users' },
          validate: (v: unknown) => !v || /^https:\/\//i.test(String(v)) || 'Le lien doit commencer par https://',
          admin: {
            width: '67%',
            description:
              'Vide = votre lien habituel (Réglages des cours). Visible seulement par les élèves dont la réservation est confirmée.',
          },
        },
      ],
    },
    {
      name: 'language',
      label: 'Langue (optionnel)',
      type: 'relationship',
      relationTo: 'languages',
      admin: { description: 'Laisser vide si le créneau est ouvert à toutes les langues.' },
    },
  ],
}
