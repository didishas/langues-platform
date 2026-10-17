'use server'

import { redirect } from 'next/navigation'

import type { GradeResult } from '@/exercises/core'
import { ExerciseError, submitAttempt } from '@/exercises/service'
import { isLocale } from '@/i18n/config'
import { getStudentDictionary } from '@/i18n/studentDictionaries'
import { payloadClient } from '@/lib/content'
import { getCurrentStudent } from '@/lib/student'

export type ExerciseState = {
  status: 'idle' | 'graded' | 'sent' | 'error'
  result?: GradeResult
  message?: string
  /** Réponses renvoyées pour les réafficher : React vide le formulaire après chaque envoi. */
  answers?: string[]
}

/** Correction d'un exercice de vidéo : tout se décide sur le serveur (droits, solution, note). */
export async function submitExercise(_prev: ExerciseState, form: FormData): Promise<ExerciseState> {
  const localeRaw = String(form.get('locale') ?? 'fr')
  const locale = isLocale(localeRaw) ? localeRaw : 'fr'
  const t = getStudentDictionary(locale).videos.errors
  const student = await getCurrentStudent()
  if (!student) redirect(`/${locale}/espace/connexion`)

  const videoId = Number(form.get('video'))
  const exerciseId = String(form.get('exercise') ?? '')
  const answers = form.getAll('answer').map((a) => (typeof a === 'string' ? a : ''))
  const file = form.get('audio')
  const audio =
    file && typeof file === 'object' && 'size' in file && file.size > 0
      ? { data: Buffer.from(await file.arrayBuffer()), mimetype: file.type || 'application/octet-stream', name: file.name || 'reponse.webm', size: file.size }
      : null

  if (!Number.isInteger(videoId) || !exerciseId) return { status: 'error', message: t.generic, answers }
  if (form.get('kind') !== 'audio' && answers.every((a) => a.trim() === '')) return { status: 'error', message: t.empty, answers }

  try {
    const payload = await payloadClient()
    const { result, status } = await submitAttempt(payload, student, { videoId, exerciseId, answers, audio })
    return status === 'to_review' ? { status: 'sent' } : { status: 'graded', result: result!, answers }
  } catch (e) {
    if (e instanceof ExerciseError && (e.code === 'audio_missing' || e.code === 'audio_invalid')) {
      return { status: 'error', message: t[e.code], answers }
    }
    console.error('Réponse à un exercice non enregistrée', e instanceof Error ? e.message : e)
    return { status: 'error', message: t.generic, answers }
  }
}
