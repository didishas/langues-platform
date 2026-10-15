'use server'

import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/dictionaries'
import { payloadClient } from '@/lib/content'

export type TrialFormState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Partial<Record<'name' | 'email' | 'consent', string>>
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitTrialRequest(_prev: TrialFormState, form: FormData): Promise<TrialFormState> {
  const localeRaw = String(form.get('locale') ?? 'fr')
  const locale = isLocale(localeRaw) ? localeRaw : 'fr'
  const t = getDictionary(locale).trial

  // Champ invisible pour les humains : s'il est rempli, c'est un robot. On fait comme si tout allait bien.
  if (String(form.get('website') ?? '').trim() !== '') return { status: 'success', message: t.success }

  const name = String(form.get('name') ?? '').trim()
  const email = String(form.get('email') ?? '').trim()
  const consent = form.get('consent') === 'on'
  const fieldErrors: TrialFormState['fieldErrors'] = {}
  if (name.length < 2) fieldErrors.name = t.errors.name
  if (!EMAIL.test(email)) fieldErrors.email = t.errors.email
  if (!consent) fieldErrors.consent = t.errors.consent
  if (Object.keys(fieldErrors).length > 0) return { status: 'error', fieldErrors }

  const languageRaw = String(form.get('language') ?? '')
  const language = /^\d+$/.test(languageRaw) ? Number(languageRaw) : undefined

  try {
    const payload = await payloadClient()
    const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
    if (settings.trialLessonEnabled === false) return { status: 'error', message: t.disabled }
    await payload.create({
      collection: 'trial-requests',
      data: {
        name: name.slice(0, 200),
        email: email.slice(0, 200),
        phone: String(form.get('phone') ?? '').trim().slice(0, 50) || undefined,
        language,
        forMinor: form.get('forMinor') === 'on',
        message: String(form.get('message') ?? '').trim().slice(0, 4000) || undefined,
        locale,
        privacyConsent: true,
        status: 'new',
      },
    })
    return { status: 'success', message: t.success }
  } catch (e) {
    console.error('Demande de cours d’essai non enregistrée', e)
    return { status: 'error', message: t.errors.generic }
  }
}
