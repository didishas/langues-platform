import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { fr } from '@payloadcms/translations/languages/fr'
import { he } from '@payloadcms/translations/languages/he'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Bookings } from './collections/Bookings'
import { Discounts } from './collections/Discounts'
import { InvoiceCounters } from './collections/InvoiceCounters'
import { Invoices } from './collections/Invoices'
import { Languages } from './collections/Languages'
import { Media } from './collections/Media'
import { Offers } from './collections/Offers'
import { Prestations } from './collections/Prestations'
import { Slots } from './collections/Slots'
import { Students } from './collections/Students'
import { TrialRequests } from './collections/TrialRequests'
import { Users } from './collections/Users'
import { BillingSettings } from './globals/BillingSettings'
import { SiteSettings } from './globals/SiteSettings'
import { LOCALES } from './i18n/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: { titleSuffix: ' · Administration' },
  },
  // Interface d'administration en français par défaut.
  i18n: {
    supportedLanguages: { fr, en, he },
    fallbackLanguage: 'fr',
  },
  // Contenus traduisibles : français (par défaut), anglais, hébreu (de droite à gauche).
  localization: {
    locales: LOCALES.map((l) => ({ code: l.code, label: l.label, rtl: l.dir === 'rtl' })),
    defaultLocale: 'fr',
    fallback: true,
  },
  collections: [
    Languages,
    Offers,
    Discounts,
    Students,
    TrialRequests,
    Slots,
    Bookings,
    Prestations,
    Invoices,
    InvoiceCounters,
    Media,
    Users,
  ],
  globals: [SiteSettings, BillingSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
