import type { GlobalConfig } from 'payload'

import { staffOnly } from '@/access'

export const BillingSettings: GlobalConfig = {
  slug: 'billing-settings',
  label: 'Réglages de facturation',
  admin: {
    group: 'Facturation',
    description:
      'Statut de facturation et mentions légales. Le passage à Smart se fait ici, avec une date de bascule.',
  },
  access: { read: staffOnly, update: staffOnly },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'activeProvider',
          label: 'Qui émet les factures',
          type: 'select',
          required: true,
          defaultValue: 'direct',
          options: [
            { label: 'Moi, comme indépendante', value: 'direct' },
            { label: 'Smart', value: 'smart' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'switchDate',
          label: 'Date de passage à Smart',
          type: 'date',
          admin: {
            width: '50%',
            condition: (data) => data?.activeProvider === 'smart',
            description: 'Avant cette date, les factures restent émises par vous. Vide = immédiat.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Facturation en tant qu’indépendante',
      admin: { condition: (data) => data?.activeProvider !== 'smart' || Boolean(data?.switchDate) },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'legalName', label: 'Nom légal', type: 'text', admin: { width: '50%' } },
            {
              name: 'enterpriseNumber',
              label: 'Numéro d’entreprise (BCE)',
              type: 'text',
              admin: { width: '50%' },
            },
          ],
        },
        { name: 'address', label: 'Adresse', type: 'textarea' },
        {
          type: 'row',
          fields: [
            { name: 'iban', label: 'IBAN', type: 'text', admin: { width: '50%' } },
            { name: 'bic', label: 'BIC', type: 'text', admin: { width: '50%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'invoicePrefix',
              label: 'Préfixe des numéros',
              type: 'text',
              defaultValue: 'F',
              admin: { width: '33%', description: 'Exemple : F donne F2026-0001.' },
            },
            {
              name: 'paymentTermDays',
              label: 'Délai de paiement (jours)',
              type: 'number',
              defaultValue: 15,
              min: 0,
              admin: { width: '33%' },
            },
            {
              name: 'onlinePayments',
              label: 'Paiement en ligne (Bancontact, carte)',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '33%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'vatRegime',
              label: 'Régime de TVA',
              type: 'select',
              required: true,
              defaultValue: 'franchise',
              options: [
                { label: 'Franchise des petites entreprises', value: 'franchise' },
                { label: 'Exonération', value: 'exempt' },
                { label: 'TVA appliquée', value: 'standard' },
              ],
              admin: { width: '50%', description: 'À confirmer avec votre comptable.' },
            },
            {
              name: 'vatRatePercent',
              label: 'Taux de TVA (%)',
              type: 'number',
              defaultValue: 21,
              admin: { width: '50%', condition: (data) => data?.vatRegime === 'standard' },
            },
          ],
        },
        {
          name: 'taxReservePercent',
          label: 'Part à mettre de côté pour impôts et cotisations (%)',
          type: 'number',
          min: 0,
          max: 80,
          admin: {
            description:
              'À fixer avec votre comptable. Vide = rien n’est affiché. Le tableau de bord applique ce pourcentage à ce que vous avez encaissé depuis le 1er janvier.',
          },
        },
        {
          name: 'vatMention',
          label: 'Mention imprimée sur les factures',
          type: 'text',
          admin: {
            condition: (data) => data?.vatRegime !== 'standard',
            description: 'Texte exact fourni par votre comptable.',
          },
        },
      ],
    },
  ],
}
