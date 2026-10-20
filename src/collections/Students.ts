import type { CollectionConfig, FieldAccess } from 'payload'

import { isStaffUser, isTeacher, selfOrStaff, teacherOnly } from '@/access'
import { cefrLevelField } from '@/fields'
import { isValidTimeZone } from '@/lib/time'

const staffField: { read: FieldAccess; update: FieldAccess } = {
  read: ({ req }) => isStaffUser(req),
  update: ({ req }) => isTeacher(req),
}

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
    create: teacherOnly,
    // Le compte technique lit les fiches mais ne les modifie pas.
    update: ({ req }) => {
      if (isTeacher(req)) return true
      if (req.user?.collection === 'students') return { id: { equals: req.user.id } }
      return false
    },
    delete: teacherOnly,
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
      name: 'timeZone',
      label: 'Fuseau horaire',
      type: 'text',
      access: { update: ({ req }) => isTeacher(req) },
      admin: {
        placeholder: 'Europe/Brussels',
        description:
          'Rempli automatiquement à la première connexion de l’élève. Exemples : Europe/Brussels, Asia/Jerusalem, Europe/Bucharest. Vide = heure de Bruxelles.',
      },
      validate: (value: unknown) =>
        value === null || value === undefined || value === '' || isValidTimeZone(value)
          ? true
          : 'Fuseau inconnu. Exemple : Asia/Jerusalem.',
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
          access: { update: ({ req }) => isTeacher(req) },
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
