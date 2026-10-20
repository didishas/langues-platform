'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { payloadClient } from '@/lib/content'
import { asStudent, getCurrentStudent } from '@/lib/student'
import { isValidTimeZone } from '@/lib/time'

const COOKIE = 'payload-token'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 5

/** `email` est renvoyé pour réafficher la saisie : React vide le formulaire après chaque envoi. */
export type LoginState = { error?: string; email?: string }

export async function loginStudent(_prev: LoginState, form: FormData): Promise<LoginState> {
  const localeRaw = String(form.get('locale') ?? 'fr')
  const locale = isLocale(localeRaw) ? localeRaw : 'fr'
  const t = getStudentDictionary(locale).login
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  if (!email || !password) return { error: t.error, email }

  try {
    const payload = await payloadClient()
    const result = await payload.login({ collection: 'students', data: { email, password } })
    if (!result.token) return { error: t.error, email }
    // Première connexion : on retient le fuseau de l'appareil. Ensuite, seule Catherine le change.
    // Droits contournés pour ce seul champ de la fiche de l'élève qui vient de se connecter.
    const tz = String(form.get('tz') ?? '')
    if (result.user && !result.user.timeZone && isValidTimeZone(tz)) {
      await payload.update({ collection: 'students', id: result.user.id, data: { timeZone: tz }, overrideAccess: true })
    }
    const store = await cookies()
    store.set(COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(result.exp ? { expires: new Date(result.exp * 1000) } : {}),
    })
  } catch {
    // Même message pour un e-mail inconnu ou un mauvais mot de passe : on ne révèle pas qui est inscrit.
    return { error: t.error, email }
  }
  redirect(`/${locale}/espace`)
}

export async function logoutStudent(form: FormData) {
  const localeRaw = String(form.get('locale') ?? 'fr')
  const locale = isLocale(localeRaw) ? localeRaw : 'fr'
  const store = await cookies()
  store.delete(COOKIE)
  redirect(`/${locale}`)
}

export type SubmitState = { status: 'idle' | 'success' | 'error'; message?: string; text?: string }

export async function submitAssignment(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const localeRaw = String(form.get('locale') ?? 'fr')
  const locale = isLocale(localeRaw) ? localeRaw : 'fr'
  const t = getStudentDictionary(locale).assignments
  const student = await getCurrentStudent()
  if (!student) redirect(`/${locale}/espace/connexion`)

  const assignmentId = Number(form.get('assignment'))
  const text = String(form.get('text') ?? '').trim().slice(0, 20_000)
  const uploads = form
    .getAll('files')
    .filter((f): f is File => typeof f === 'object' && f !== null && 'size' in f && (f as File).size > 0)
    .slice(0, MAX_FILES)

  if (!Number.isInteger(assignmentId)) return { status: 'error', message: t.error, text }
  if (!text && uploads.length === 0) return { status: 'error', message: t.empty_answer, text }
  if (uploads.some((f) => f.size > MAX_FILE_BYTES)) return { status: 'error', message: t.error, text }

  try {
    const payload = await payloadClient()
    const access = asStudent(student)
    const fileIds: number[] = []
    for (const f of uploads) {
      const data = Buffer.from(await f.arrayBuffer())
      const created = await payload.create({
        collection: 'submission-files',
        data: {},
        file: { data, mimetype: f.type || 'application/octet-stream', name: f.name, size: f.size },
        ...access,
      })
      fileIds.push(created.id)
    }

    const existing = await payload.find({
      collection: 'submissions',
      where: { assignment: { equals: assignmentId } },
      limit: 1,
      depth: 0,
      ...access,
    })
    if (existing.docs[0]) {
      const previousFiles = (existing.docs[0].files ?? []).map((f) => (typeof f === 'object' ? f.id : f))
      await payload.update({
        collection: 'submissions',
        id: existing.docs[0].id,
        data: { text, files: [...previousFiles, ...fileIds] },
        ...access,
      })
    } else {
      await payload.create({
        collection: 'submissions',
        data: { assignment: assignmentId, text, files: fileIds },
        ...access,
      })
    }
    return { status: 'success', message: t.sent }
  } catch (e) {
    console.error('Devoir non rendu', e)
    return { status: 'error', message: t.error, text }
  }
}
