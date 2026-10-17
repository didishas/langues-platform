import type { Payload } from 'payload'

import type { ExerciseAttempt, Language, Student, Video } from '@/payload-types'

import { gradeExercise, toPublicExercise, type ExerciseConfig, type GradeResult, type PublicExercise } from './core'

type StudentUser = Student & { collection: 'students' }
const asStudent = (student: StudentUser) => ({ user: student, overrideAccess: false as const })

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const AUDIO_TYPES = /^(audio\/(webm|ogg|mp4|mpeg|wav|x-wav|aac|x-m4a)|video\/webm)(;.*)?$/

export class ExerciseError extends Error {
  constructor(public code: 'not_found' | 'invalid' | 'audio_missing' | 'audio_invalid') {
    super(code)
  }
}

/** Vidéos visibles par l'élève, lues avec ses droits. */
export async function listVideosForStudent(payload: Payload, student: StudentUser) {
  const res = await payload.find({
    collection: 'videos',
    limit: 200,
    depth: 1,
    sort: '-createdAt',
    select: { title: true, language: true, level: true, exercises: true, createdAt: true },
    ...asStudent(student),
  })
  return res.docs.map((v) => ({
    id: v.id,
    title: v.title,
    level: v.level ?? null,
    language: typeof v.language === 'object' ? (v.language as Language) : null,
    exerciseCount: (v.exercises ?? []).length,
  }))
}

/**
 * Une vidéo et ses exercices, sans solution.
 * 1. Lecture avec les droits de l'élève : c'est elle qui décide s'il a accès (sinon `null`).
 * 2. Relecture complète de CETTE vidéo seulement, droits contournés : les champs de solution sont
 *    illisibles pour un élève, mais il faut le texte à trous pour l'afficher et les solutions pour corriger.
 *    Rien de cette relecture n'est renvoyé tel quel : seul `toPublicExercise` en sort.
 */
export async function loadVideoForStudent(payload: Payload, student: StudentUser, id: number) {
  let visible: Video
  try {
    visible = await payload.findByID({ collection: 'videos', id, depth: 1, ...asStudent(student) })
  } catch {
    return null
  }
  const full = await payload.findByID({ collection: 'videos', id, depth: 0, overrideAccess: true })
  const configs = ((full.exercises ?? []) as ExerciseConfig[]).map((ex, i) => ({ ex, id: ex.id || `ex-${i}` }))
  const exercises = configs
    .map(({ ex, id: exId }) => toPublicExercise(ex, exId))
    .filter((e): e is PublicExercise => e !== null)
  const { exercises: _hidden, students: _students, ...video } = visible
  return {
    video,
    language: typeof visible.language === 'object' ? (visible.language as Language) : null,
    exercises,
    showSolutions: full.showSolutions !== false,
    configs,
  }
}

export type LatestAttempt = Pick<ExerciseAttempt, 'score' | 'maxScore' | 'status' | 'feedback' | 'createdAt'>

/** Dernière réponse de l'élève à chaque exercice de la vidéo, lue avec ses droits. */
export async function latestAttempts(payload: Payload, student: StudentUser, videoId: number) {
  const res = await payload.find({
    collection: 'exercise-attempts',
    where: { video: { equals: videoId } },
    sort: '-createdAt',
    limit: 500,
    depth: 0,
    ...asStudent(student),
  })
  const byExercise: Record<string, LatestAttempt> = {}
  for (const a of res.docs) {
    byExercise[a.exerciseId] ??= { score: a.score, maxScore: a.maxScore, status: a.status, feedback: a.feedback, createdAt: a.createdAt }
  }
  return byExercise
}

export type AudioUpload = { data: Buffer; mimetype: string; name: string; size: number }

/**
 * Corrige et enregistre une réponse. La note est calculée ici, jamais reçue du navigateur.
 * Une réponse orale est enregistrée « à écouter » pour Catherine.
 */
export async function submitAttempt(
  payload: Payload,
  student: StudentUser,
  input: { videoId: number; exerciseId: string; answers: string[]; audio?: AudioUpload | null },
): Promise<{ result: GradeResult | null; status: 'graded' | 'to_review' }> {
  const loaded = await loadVideoForStudent(payload, student, input.videoId)
  if (!loaded) throw new ExerciseError('not_found')
  const found = loaded.configs.find((c) => c.id === input.exerciseId)
  if (!found || !toPublicExercise(found.ex, found.id)) throw new ExerciseError('not_found')
  const answers = input.answers.slice(0, 50).map((a) => String(a).slice(0, 500))

  const base = {
    title: `${loaded.video.title} · ${student.fullName || student.email}`,
    student: student.id,
    video: input.videoId,
    exerciseId: found.id,
    kind: found.ex.blockType,
  }

  if (found.ex.blockType === 'audio') {
    const audio = input.audio
    if (!audio || audio.size === 0) throw new ExerciseError('audio_missing')
    if (audio.size > MAX_AUDIO_BYTES || !AUDIO_TYPES.test(audio.mimetype)) throw new ExerciseError('audio_invalid')
    // Le fichier est créé avec les droits de l'élève : il en devient automatiquement le propriétaire.
    let file
    try {
      file = await payload.create({ collection: 'submission-files', data: {}, file: audio, ...asStudent(student) })
    } catch {
      throw new ExerciseError('audio_invalid')
    }
    // Les élèves ne peuvent pas créer de réponse via l'API (sinon ils fixeraient leur note) :
    // seul ce chemin serveur le fait, pour l'élève connecté et une vidéo qu'il a le droit de voir.
    await payload.create({
      collection: 'exercise-attempts',
      data: { ...base, answers: [], audio: file.id, status: 'to_review' },
      overrideAccess: true,
    })
    return { result: null, status: 'to_review' }
  }

  const result = gradeExercise(found.ex, answers, loaded.showSolutions)
  if (!result) throw new ExerciseError('invalid')
  // Même justification que ci-dessus : création réservée au serveur, après correction.
  await payload.create({
    collection: 'exercise-attempts',
    data: { ...base, answers, score: result.score, maxScore: result.max, status: 'graded' },
    overrideAccess: true,
  })
  return { result, status: 'graded' }
}
