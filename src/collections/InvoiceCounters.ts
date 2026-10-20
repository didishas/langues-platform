import type { CollectionConfig } from 'payload'

import { staffOnly, teacherOnly } from '@/access'

/** Compteur de numérotation par année. Géré par le code, jamais à la main. */
export const InvoiceCounters: CollectionConfig = {
  slug: 'invoice-counters',
  labels: { singular: 'Compteur de factures', plural: 'Compteurs de factures' },
  admin: { hidden: true },
  access: { read: staffOnly, create: teacherOnly, update: teacherOnly, delete: () => false },
  fields: [
    { name: 'year', type: 'number', required: true, unique: true },
    { name: 'last', type: 'number', required: true, defaultValue: 0 },
  ],
}
