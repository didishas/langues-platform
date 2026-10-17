/**
 * Exercices des vidéos : fonctions pures, sans base de données.
 *
 * Règle centrale : les bonnes réponses ne quittent jamais le serveur avant que l'élève ait répondu.
 * `toPublicExercise` fabrique la version envoyée au navigateur (sans solution) ;
 * `gradeExercise` corrige sur le serveur à partir de la version complète stockée dans le CMS.
 */

export type McqConfig = {
  blockType: 'mcq'
  id?: string | null
  question: string
  options?: { text: string; correct?: boolean | null }[] | null
  explanation?: string | null
}
export type GapConfig = { blockType: 'gap'; id?: string | null; instructions?: string | null; text: string; explanation?: string | null }
export type MatchingConfig = {
  blockType: 'matching'
  id?: string | null
  instructions?: string | null
  pairs?: { item: string; match: string }[] | null
  explanation?: string | null
}
export type AudioConfig = { blockType: 'audio'; id?: string | null; prompt: string; maxSeconds?: number | null }
export type ExerciseConfig = McqConfig | GapConfig | MatchingConfig | AudioConfig

export type GapSegment = { t: 'text'; v: string } | { t: 'blank'; i: number }

export type PublicExercise =
  | { kind: 'mcq'; id: string; question: string; options: { value: string; text: string }[]; multiple: boolean }
  | { kind: 'gap'; id: string; instructions: string | null; segments: GapSegment[]; blanks: number }
  | { kind: 'matching'; id: string; instructions: string | null; lefts: string[]; rights: string[] }
  | { kind: 'audio'; id: string; prompt: string; maxSeconds: number }

export type GradeResult = {
  score: number
  max: number
  /** Juste / faux, par élément : la réponse du QCM, chaque trou, chaque paire. */
  perItem: boolean[]
  /** Solution attendue par élément, seulement si Catherine a choisi de la montrer après la réponse. */
  solution?: string[]
  explanation?: string
}

export const DEFAULT_AUDIO_SECONDS = 60
export const MAX_AUDIO_SECONDS = 300

/**
 * Comparaison tolérante d'une réponse écrite : majuscules, espaces, ponctuation finale, apostrophes typographiques.
 * Les voyelles hébraïques (nikoud) sont ignorées, car les élèves écrivent sans.
 * Les accents français et espagnols restent obligatoires : « été » n'est pas « ete ».
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[֑-ׇֽֿׁׂׅׄ]/g, '')
    .replace(/[’‘`´׳]/g, "'")
    .replace(/[“”«»״]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.,;:!?¡¿"\s]+|[.,;:!?¡¿"\s]+$/g, '')
}

/**
 * Texte à trous écrit par Catherine : les mots à trouver entre crochets, variantes séparées par « | ».
 * « Je [suis] étudiant et j'[ai|avais] vingt ans. »
 */
export function parseGapText(text: string): { segments: GapSegment[]; answers: string[][] } {
  const segments: GapSegment[] = []
  const answers: string[][] = []
  const re = /\[([^\[\]]+)\]/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const alternatives = m[1]
      .split('|')
      .map((a) => a.trim())
      .filter(Boolean)
    if (alternatives.length === 0) continue
    if (m.index > last) segments.push({ t: 'text', v: text.slice(last, m.index) })
    segments.push({ t: 'blank', i: answers.length })
    answers.push(alternatives)
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ t: 'text', v: text.slice(last) })
  return { segments, answers }
}

/** Ordre pseudo-aléatoire mais stable pour un exercice donné (le même à chaque affichage). */
export function stableShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  // Ne jamais présenter les paires déjà dans l'ordre : ce serait donner la réponse.
  if (out.length > 1 && out.every((v, i) => v === items[i])) out.push(out.shift()!)
  return out
}

const uniq = (xs: string[]) => [...new Set(xs)]

/** Version envoyée au navigateur : aucune bonne réponse, aucune explication. */
export function toPublicExercise(ex: ExerciseConfig, fallbackId: string): PublicExercise | null {
  const id = ex.id || fallbackId
  switch (ex.blockType) {
    case 'mcq': {
      const options = (ex.options ?? []).filter((o) => o.text?.trim())
      if (options.length < 2) return null
      return {
        kind: 'mcq',
        id,
        question: ex.question,
        options: options.map((o, i) => ({ value: String(i), text: o.text })),
        multiple: options.filter((o) => o.correct).length > 1,
      }
    }
    case 'gap': {
      const { segments, answers } = parseGapText(ex.text ?? '')
      if (answers.length === 0) return null
      return { kind: 'gap', id, instructions: ex.instructions ?? null, segments, blanks: answers.length }
    }
    case 'matching': {
      const pairs = (ex.pairs ?? []).filter((p) => p.item?.trim() && p.match?.trim())
      if (pairs.length < 2) return null
      return {
        kind: 'matching',
        id,
        instructions: ex.instructions ?? null,
        lefts: pairs.map((p) => p.item),
        rights: stableShuffle(uniq(pairs.map((p) => p.match)), id),
      }
    }
    case 'audio':
      return {
        kind: 'audio',
        id,
        prompt: ex.prompt,
        maxSeconds: Math.min(MAX_AUDIO_SECONDS, Math.max(5, ex.maxSeconds ?? DEFAULT_AUDIO_SECONDS)),
      }
  }
}

/** Corrige une réponse. `null` pour une réponse orale : c'est Catherine qui l'écoute et l'évalue. */
export function gradeExercise(ex: ExerciseConfig, answers: string[], showSolution: boolean): GradeResult | null {
  const withExtras = (r: Omit<GradeResult, 'solution' | 'explanation'>, solution: string[]): GradeResult => ({
    ...r,
    ...(showSolution ? { solution } : {}),
    ...(showSolution && 'explanation' in ex && ex.explanation ? { explanation: ex.explanation } : {}),
  })

  switch (ex.blockType) {
    case 'mcq': {
      const options = (ex.options ?? []).filter((o) => o.text?.trim())
      const expected = new Set(options.flatMap((o, i) => (o.correct ? [String(i)] : [])))
      const given = new Set(answers.filter((a) => /^\d+$/.test(a) && Number(a) < options.length))
      const ok = expected.size > 0 && given.size === expected.size && [...given].every((g) => expected.has(g))
      return withExtras(
        { score: ok ? 1 : 0, max: 1, perItem: [ok] },
        options.filter((o) => o.correct).map((o) => o.text),
      )
    }
    case 'gap': {
      const { answers: expected } = parseGapText(ex.text ?? '')
      const perItem = expected.map((alts, i) => {
        const g = normalizeAnswer(answers[i] ?? '')
        return g !== '' && alts.some((a) => normalizeAnswer(a) === g)
      })
      return withExtras({ score: perItem.filter(Boolean).length, max: expected.length, perItem }, expected.map((a) => a[0]))
    }
    case 'matching': {
      const pairs = (ex.pairs ?? []).filter((p) => p.item?.trim() && p.match?.trim())
      const perItem = pairs.map((p, i) => normalizeAnswer(answers[i] ?? '') === normalizeAnswer(p.match))
      return withExtras({ score: perItem.filter(Boolean).length, max: pairs.length, perItem }, pairs.map((p) => p.match))
    }
    case 'audio':
      return null
  }
}
