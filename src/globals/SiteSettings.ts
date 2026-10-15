import type { GlobalConfig } from 'payload'

import { staffOnly } from '@/access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Contenu de la page d’accueil',
  admin: { group: 'Contenu du site' },
  access: { read: () => true, update: staffOnly },
  fields: [
    { name: 'siteName', label: 'Nom du site', type: 'text', required: true, defaultValue: 'Cours de langues' },
    { name: 'teacherName', label: 'Nom de la professeure', type: 'text' },
    { name: 'tagline', label: 'Accroche', type: 'text', localized: true },
    {
      type: 'collapsible',
      label: 'Bandeau d’accueil',
      fields: [
        { name: 'heroTitle', label: 'Titre', type: 'text', localized: true },
        { name: 'heroText', label: 'Texte', type: 'textarea', localized: true },
        { name: 'heroImage', label: 'Image', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      type: 'collapsible',
      label: 'À propos',
      fields: [
        { name: 'aboutTitle', label: 'Titre', type: 'text', localized: true },
        { name: 'aboutText', label: 'Texte', type: 'textarea', localized: true },
        { name: 'portrait', label: 'Photo', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'faq',
      label: 'Questions fréquentes',
      type: 'array',
      localized: true,
      fields: [
        { name: 'question', label: 'Question', type: 'text', required: true },
        { name: 'answer', label: 'Réponse', type: 'textarea', required: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Contact',
      fields: [
        { name: 'contactEmail', label: 'E-mail de contact', type: 'email' },
        { name: 'phone', label: 'Téléphone', type: 'text' },
        { name: 'city', label: 'Ville', type: 'text' },
        {
          name: 'trialLessonEnabled',
          label: 'Proposer un cours d’essai sur le site',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
  ],
}
