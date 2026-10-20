import type { CollectionConfig } from 'payload'

import { staffOnly, teacherOnly } from '@/access'

/** Demandes de cours d'essai envoyées depuis le site public. */
export const TrialRequests: CollectionConfig = {
  slug: 'trial-requests',
  labels: { singular: 'Demande de cours d’essai', plural: 'Demandes de cours d’essai' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'language', 'status', 'createdAt'],
    group: 'Élèves',
  },
  defaultSort: '-createdAt',
  access: {
    read: staffOnly,
    // La création publique passe uniquement par l'action serveur du formulaire.
    create: teacherOnly,
    update: teacherOnly,
    delete: teacherOnly,
  },
  fields: [
    { name: 'name', label: 'Nom', type: 'text', required: true },
    { name: 'email', label: 'E-mail', type: 'email', required: true },
    { name: 'phone', label: 'Téléphone', type: 'text' },
    { name: 'language', label: 'Langue souhaitée', type: 'relationship', relationTo: 'languages' },
    { name: 'forMinor', label: 'Pour un enfant mineur', type: 'checkbox', defaultValue: false },
    { name: 'message', label: 'Message', type: 'textarea' },
    {
      name: 'locale',
      label: 'Langue du site au moment de la demande',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'privacyConsent',
      label: 'A accepté la politique de confidentialité',
      type: 'checkbox',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'status',
      label: 'Suivi',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'Nouvelle', value: 'new' },
        { label: 'Contactée', value: 'contacted' },
        { label: 'Devenue élève', value: 'converted' },
        { label: 'Archivée', value: 'archived' },
      ],
    },
  ],
}
