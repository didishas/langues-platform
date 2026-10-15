import type { CollectionConfig } from 'payload'

import { isStaffUser, selfOrStaff, staffOnly } from '@/access'
import { cefrLevelField } from '@/fields'

const staffField = { read: ({ req }: any) => isStaffUser(req), update: ({ req }: any) => isStaffUser(req) }

export const Students: CollectionConfig = {
  slug: 'students',
  labels: { singular: 'Élève', plural: 'Élèves' },
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'email', 'level', 'isMinor'],
    group: 'Élèves',
  },
  auth: true,
  access: {
    read: selfOrStaff,
    create: staffOnly,
    update: selfOrStaff,
    delete: staffOnly,
    admin: () => false,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const firstName = data.firstName ?? originalDoc?.firstName
        const lastName = data.lastName ?? originalDoc?.lastName
        data.fullName = [firstName, lastName].filter(Boolean).join(' ')
        // Le consentement à l'enregistrement est daté au moment où il est donné.
        if (data.recordingConsent === true && !originalDoc?.recordingConsent) {
          data.recordingConsentAt = new Date().toISOString()
        } else if (data.recordingConsent === false) {
          data.recordingConsentAt = null
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'firstName', label: 'Prénom', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'lastName', label: 'Nom', type: 'text', required: true, admin: { width: '50%' } },
      ],
    },
    { name: 'fullName', type: 'text', admin: { hidden: true } },
    { name: 'phone', label: 'Téléphone', type: 'text' },
    {
      name: 'preferredLocale',
      label: 'Langue de l’interface',
      type: 'select',
      defaultValue: 'fr',
      options: [
        { label: 'Français', value: 'fr' },
        { label: 'English', value: 'en' },
        { label: 'עברית', value: 'he' },
      ],
    },
    {
      name: 'languages',
      label: 'Langues suivies',
      type: 'relationship',
      relationTo: 'languages',
      hasMany: true,
      access: staffField,
    },
    { ...cefrLevelField(), access: staffField },
    {
      name: 'familyOf',
      label: 'Proche d’un autre élève',
      type: 'relationship',
      relationTo: 'students',
      access: staffField,
      admin: { description: 'Par exemple l’enfant d’une élève, pour appliquer la réduction famille.' },
    },
    {
      type: 'collapsible',
      label: 'Élève mineur',
      fields: [
        { name: 'isMinor', label: 'L’élève est mineur', type: 'checkbox', defaultValue: false, access: staffField },
        {
          name: 'guardian',
          label: 'Responsable légal',
          type: 'group',
          // L'accord parental est enregistré par Catherine, jamais par l'élève lui-même.
          access: { update: ({ req }) => isStaffUser(req) },
          admin: { condition: (data) => Boolean(data?.isMinor) },
          fields: [
            { name: 'name', label: 'Nom', type: 'text' },
            { name: 'email', label: 'E-mail', type: 'email' },
            { name: 'phone', label: 'Téléphone', type: 'text' },
            { name: 'consent', label: 'Accord parental reçu', type: 'checkbox', defaultValue: false },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Consentements (RGPD)',
      fields: [
        {
          name: 'recordingConsent',
          label: 'Accepte l’enregistrement des séances',
          type: 'checkbox',
          defaultValue: false,
        },
        { name: 'recordingConsentAt', label: 'Date du consentement', type: 'date', admin: { readOnly: true } },
      ],
    },
    {
      type: 'collapsible',
      label: 'Facturation',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'customerKind',
          label: 'Type de client',
          type: 'select',
          defaultValue: 'individual',
          options: [
            { label: 'Particulier', value: 'individual' },
            { label: 'Entreprise', value: 'business' },
          ],
        },
        {
          name: 'companyName',
          label: 'Nom de l’entreprise',
          type: 'text',
          admin: { condition: (data) => data?.customerKind === 'business' },
        },
        {
          name: 'vatNumber',
          label: 'Numéro de TVA',
          type: 'text',
          admin: { condition: (data) => data?.customerKind === 'business' },
        },
        { name: 'billingAddress', label: 'Adresse de facturation', type: 'textarea' },
      ],
    },
    {
      name: 'notes',
      label: 'Notes privées de la professeure',
      type: 'textarea',
      access: staffField,
    },
  ],
}
