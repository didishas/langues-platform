import { describe, expect, it } from 'vitest'

import {
  gradeExercise,
  normalizeAnswer,
  parseGapText,
  stableShuffle,
  toPublicExercise,
  type ExerciseConfig,
} from '@/exercises/core'

const mcq: ExerciseConfig = {
  blockType: 'mcq',
  id: 'q1',
  question: 'Comment dit-on « bonjour » ?',
  options: [{ text: 'שלום', correct: true }, { text: 'תודה' }, { text: 'להתראות' }],
  explanation: 'שלום sert aussi à dire au revoir.',
}
const gap: ExerciseConfig = {
  blockType: 'gap',
  id: 'g1',
  text: 'Je [suis] étudiant et j’[ai|avais] [vingt|20] ans.',
  explanation: 'Verbe être, puis avoir.',
}
const matching: ExerciseConfig = {
  blockType: 'matching',
  id: 'm1',
  pairs: [
    { item: 'perro', match: 'chien' },
    { item: 'gato', match: 'chat' },
    { item: 'pájaro', match: 'oiseau' },
  ],
}

describe('normalisation des réponses écrites', () => {
  it('ignore majuscules, espaces, ponctuation finale et apostrophes typographiques', () => {
    expect(normalizeAnswer('  J’AI   vu. ')).toBe("j'ai vu")
    expect(normalizeAnswer('¿Qué?')).toBe('qué')
  })
  it('ignore les voyelles hébraïques mais garde les lettres finales', () => {
    expect(normalizeAnswer('שָׁלוֹם')).toBe('שלום')
    expect(normalizeAnswer('שלומ')).not.toBe(normalizeAnswer('שלום'))
  })
  it('garde les accents obligatoires', () => {
    expect(normalizeAnswer('ete')).not.toBe(normalizeAnswer('été'))
  })
})

describe('texte à trous', () => {
  it('découpe le texte et lit les variantes acceptées', () => {
    const { segments, answers } = parseGapText('Je [suis] là, j’[ai|avais] faim')
    expect(answers).toEqual([['suis'], ['ai', 'avais']])
    expect(segments).toEqual([
      { t: 'text', v: 'Je ' },
      { t: 'blank', i: 0 },
      { t: 'text', v: ' là, j’' },
      { t: 'blank', i: 1 },
      { t: 'text', v: ' faim' },
    ])
  })
  it('laisse tel quel un crochet non refermé ou vide', () => {
    expect(parseGapText('a [] b [c').answers).toEqual([])
  })
})

describe('version envoyée au navigateur', () => {
  it('ne contient aucune bonne réponse ni explication', () => {
    for (const ex of [mcq, gap, matching]) {
      const pub = JSON.stringify(toPublicExercise(ex, 'x'))
      expect(pub).not.toContain('correct')
      expect(pub).not.toContain('explanation')
      expect(pub).not.toMatch(/Verbe être|aussi à dire/)
    }
    const g = JSON.stringify(toPublicExercise(gap, 'x'))
    for (const word of ['suis', 'avais', 'vingt']) expect(g).not.toContain(word)
  })
  it('présente les paires mélangées, jamais dans l’ordre, de façon stable', () => {
    const pub = toPublicExercise(matching, 'x')
    if (pub?.kind !== 'matching') throw new Error('type')
    expect(pub.lefts).toEqual(['perro', 'gato', 'pájaro'])
    expect(pub.rights).not.toEqual(['chien', 'chat', 'oiseau'])
    expect([...pub.rights].sort()).toEqual(['chat', 'chien', 'oiseau'])
    expect(toPublicExercise(matching, 'x')).toEqual(pub)
    expect(stableShuffle(['a', 'b'], 'seed')).toEqual(['b', 'a'])
  })
  it('signale un QCM à plusieurs réponses et ignore un exercice incomplet', () => {
    const multi = toPublicExercise({ ...mcq, options: [{ text: 'a', correct: true }, { text: 'b', correct: true }] } as ExerciseConfig, 'x')
    expect(multi).toMatchObject({ kind: 'mcq', multiple: true })
    expect(toPublicExercise({ blockType: 'gap', text: 'aucun trou' }, 'x')).toBeNull()
    expect(toPublicExercise({ blockType: 'matching', pairs: [{ item: 'a', match: 'b' }] }, 'x')).toBeNull()
  })
})

describe('correction sur le serveur', () => {
  it('QCM : juste seulement avec exactement les bonnes options', () => {
    expect(gradeExercise(mcq, ['0'], false)).toEqual({ score: 1, max: 1, perItem: [true] })
    expect(gradeExercise(mcq, ['0', '1'], false)?.score).toBe(0)
    expect(gradeExercise(mcq, [], false)?.score).toBe(0)
    expect(gradeExercise(mcq, ['9'], false)?.score).toBe(0)
  })
  it('texte à trous : un point par trou, variantes acceptées', () => {
    const r = gradeExercise(gap, ['Suis', 'avais', 'trente'], false)
    expect(r).toEqual({ score: 2, max: 3, perItem: [true, true, false] })
    expect(gradeExercise(gap, ['suis', 'ai', '20'], false)?.score).toBe(3)
  })
  it('paires : un point par paire', () => {
    expect(gradeExercise(matching, ['chien', 'oiseau', 'chat'], false)).toEqual({ score: 1, max: 3, perItem: [true, false, false] })
  })
  it('montre solution et explication seulement si Catherine l’a choisi', () => {
    expect(gradeExercise(gap, [], true)).toMatchObject({ solution: ['suis', 'ai', 'vingt'], explanation: 'Verbe être, puis avoir.' })
    expect(gradeExercise(mcq, ['1'], true)?.solution).toEqual(['שלום'])
    expect(gradeExercise(gap, [], false)).not.toHaveProperty('solution')
  })
  it('réponse orale : pas de correction automatique', () => {
    expect(gradeExercise({ blockType: 'audio', prompt: 'Présentez-vous' }, [], true)).toBeNull()
  })
})

describe('sens d’un texte libre', () => {
  it('suit la majorité des lettres, pas la première', async () => {
    const { textDir } = await import('@/i18n/config')
    expect(textDir('תודה (toda) veut dire merci ; בבקשה, s’il vous plaît.')).toBe('ltr')
    expect(textDir('אני = je')).toBe('rtl')
    expect(textDir('Comment dit-on « merci » ?')).toBe('ltr')
    expect(textDir('')).toBe('ltr')
  })
})
