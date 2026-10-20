import type { GlobalConfig } from 'payload'

import { staffOnly } from '@/access'

const help =
  'Repères remplacés automatiquement : {prenom}, {numero}, {montant}, {echeance}, {communication}, {paiement_en_ligne}, {lien_espace}, {date_seance}, {signature}. Laisser vide pour le texte par défaut.'

/** Textes des e-mails préparés par le site, dans chaque langue de l'interface (l'élève reçoit la sienne). */
export const EmailTemplates: GlobalConfig = {
  slug: 'email-templates',
  label: 'Modèles d’e-mails',
  admin: { group: 'Réglages', description: help },
  access: { read: staffOnly, update: staffOnly },
  fields: [
    { name: 'signature', label: 'Signature', type: 'textarea', localized: true },
    {
      type: 'collapsible',
      label: 'Facture',
      fields: [
        { name: 'invoiceSubject', label: 'Objet', type: 'text', localized: true },
        { name: 'invoiceBody', label: 'Texte', type: 'textarea', localized: true },
        { name: 'invoiceOnlineLine', label: 'Ligne « paiement en ligne » (si activé)', type: 'text', localized: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Séance confirmée',
      fields: [
        { name: 'bookingSubject', label: 'Objet', type: 'text', localized: true },
        { name: 'bookingBody', label: 'Texte', type: 'textarea', localized: true },
      ],
    },
  ],
}
