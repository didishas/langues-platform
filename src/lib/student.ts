import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { Locale } from '@/i18n/config'
import type { Student } from '@/payload-types'

import { payloadClient } from './content'

export type StudentUser = Student & { collection: 'students' }

/** Élève connecté, ou `null` (visiteur, ou compte de l'équipe). */
export async function getCurrentStudent(): Promise<StudentUser | null> {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return user?.collection === 'students' ? (user as StudentUser) : null
}

export async function requireStudent(locale: Locale): Promise<StudentUser> {
  const student = await getCurrentStudent()
  if (!student) redirect(`/${locale}/espace/connexion`)
  return student
}

/** Options de l'API locale pour lire « en tant que » l'élève : ses règles d'accès s'appliquent. */
export const asStudent = (student: StudentUser) => ({ user: student, overrideAccess: false as const })

export function formatDate(iso: string | null | undefined, locale: Locale, withTime = false): string {
  if (!iso) return ''
  const tag = locale === 'he' ? 'he-IL' : locale === 'en' ? 'en-GB' : 'fr-BE'
  return new Intl.DateTimeFormat(tag, {
    dateStyle: 'full',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'Europe/Brussels',
  }).format(new Date(iso))
}
