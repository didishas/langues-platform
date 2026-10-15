import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { Locale } from '@/i18n/config'
import type { Discount, Language, Offer, SiteSetting } from '@/payload-types'

export const payloadClient = cache(async () => getPayload({ config: await config }))

export const getSiteSettings = cache(async (locale: Locale): Promise<SiteSetting> => {
  const payload = await payloadClient()
  return payload.findGlobal({ slug: 'site-settings', locale, depth: 1 })
})

export const getLanguages = cache(async (locale: Locale): Promise<Language[]> => {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'languages',
    locale,
    where: { published: { equals: true } },
    sort: 'order',
    limit: 20,
    depth: 1,
  })
  return res.docs
})

export const getLanguageByCode = cache(async (locale: Locale, code: string): Promise<Language | null> => {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'languages',
    locale,
    where: { and: [{ code: { equals: code } }, { published: { equals: true } }] },
    limit: 1,
    depth: 1,
  })
  return res.docs[0] ?? null
})

export const getOffers = cache(async (locale: Locale): Promise<Offer[]> => {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'offers',
    locale,
    where: { published: { equals: true } },
    sort: 'order',
    limit: 50,
    depth: 1,
  })
  return res.docs
})

export const getDiscounts = cache(async (locale: Locale): Promise<Discount[]> => {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'discounts',
    locale,
    where: { published: { equals: true } },
    sort: 'order',
    limit: 20,
  })
  return res.docs
})

/** Prix en centimes → texte localisé (« 25 € », « 37,50 € », « ₪ » jamais : toujours en euros). */
export function formatPrice(cents: number | null | undefined, locale: Locale): string {
  if (typeof cents !== 'number') return ''
  const tag = locale === 'he' ? 'he-IL' : locale === 'en' ? 'en-IE' : 'fr-BE'
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}
