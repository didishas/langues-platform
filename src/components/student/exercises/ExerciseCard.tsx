'use client'

import { useActionState, useRef, useState } from 'react'

import { submitExercise, type ExerciseState } from '@/app/(frontend)/[locale]/espace/videos/actions'
import type { GradeResult, PublicExercise } from '@/exercises/core'
import type { LatestAttempt } from '@/exercises/service'
import { textDir, type Direction, type Locale } from '@/i18n/config'
import { fill } from '@/i18n/format'
import type { StudentDictionary } from '@/i18n/studentDictionaries'

import { AudioAnswer } from './AudioAnswer'
import { HebrewKeyboard, rememberField } from './HebrewKeyboard'

type T = StudentDictionary['videos']

type Props = {
  locale: Locale
  videoId: number
  /** Version sans solution : la correction a lieu sur le serveur. */
  exercise: PublicExercise
  index: number
  /** Sens d'écriture des exercices = celui de la langue de la vidéo, pas de l'interface. */
  contentDir: Direction
  contentLang?: string
  latest: LatestAttempt | null
  t: T
}

/** Un exercice sous une vidéo. « Recommencer » remonte un formulaire neuf. */
export function ExerciseCard(props: Props) {
  const [round, setRound] = useState(0)
  return <ExerciseForm key={round} {...props} latest={round === 0 ? props.latest : null} onRetry={() => setRound((r) => r + 1)} />
}

function Mark({ ok, t }: { ok: boolean; t: T }) {
  return (
    <span className={`mark ${ok ? 'mark--ok' : 'mark--no'}`}>
      <span aria-hidden="true">{ok ? '✓' : '✗'}</span>
      <span className="visually-hidden">{ok ? t.right : t.wrong}</span>
    </span>
  )
}

function ExerciseForm({ locale, videoId, exercise: ex, index, contentDir, contentLang, latest, t, onRetry }: Props & { onRetry: () => void }) {
  const [state, action, pending] = useActionState<ExerciseState, FormData>(submitExercise, { status: 'idle' })
  const body = useRef<HTMLDivElement>(null)
  const result = state.status === 'graded' ? state.result : undefined
  const done = Boolean(result)
  const answers = state.answers ?? []
  const kindLabel = ex.kind === 'mcq' && ex.multiple ? t.kinds.mcqMultiple : t.kinds[ex.kind]
  const titleId = `ex-${ex.id}`

  return (
    <article className="exercise" aria-labelledby={titleId} data-kind={ex.kind}>
      <header className="exercise__head">
        <h3 id={titleId}>{fill(t.exercise, { n: index })}</h3>
        <p className="exercise__kind">{kindLabel}</p>
      </header>

      {latest && state.status === 'idle' ? <LatestLine latest={latest} t={t} /> : null}

      {state.status === 'sent' ? (
        <p className="form-success" role="status">
          {t.audio.sent}
        </p>
      ) : (
        <form action={action} className="exercise__form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="video" value={videoId} />
          <input type="hidden" name="exercise" value={ex.id} />
          <input type="hidden" name="kind" value={ex.kind} />

          {/* Consignes dans le sens de leur texte ; zone de réponse dans le sens de la langue de la vidéo. */}
          <div ref={body} className="exercise__body" onFocus={rememberField}
            key={`${state.status}-${answers.join('\u0000')}`}
          >
            {ex.kind === 'mcq' ? <Mcq ex={ex} answers={answers} result={result} t={t} dir={contentDir} lang={contentLang} /> : null}
            {ex.kind === 'gap' ? <Gap ex={ex} answers={answers} result={result} t={t} dir={contentDir} lang={contentLang} /> : null}
            {ex.kind === 'matching' ? <Matching ex={ex} answers={answers} result={result} t={t} dir={contentDir} lang={contentLang} /> : null}
            {ex.kind === 'audio' ? (
              <>
                <p className="exercise__question" dir={textDir(ex.prompt)}>
                  {ex.prompt}
                </p>
                <AudioAnswer id={ex.id} maxSeconds={ex.maxSeconds} t={t.audio} />
              </>
            ) : null}
          </div>

          {ex.kind === 'gap' && contentLang === 'he' && !done ? <HebrewKeyboard scope={body} t={t.keyboard} /> : null}

          {state.status === 'error' && state.message ? (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          ) : null}

          {result ? <Result result={result} t={t} /> : null}

          <div className="exercise__actions">
            {done ? (
              <button type="button" className="button button--quiet" onClick={onRetry}>
                {t.retry}
              </button>
            ) : (
              <button type="submit" className="button" disabled={pending}>
                {pending ? (ex.kind === 'audio' ? t.audio.sending : t.checking) : ex.kind === 'audio' ? t.audio.send : t.check}
              </button>
            )}
          </div>
        </form>
      )}
    </article>
  )
}

function LatestLine({ latest, t }: { latest: LatestAttempt; t: T }) {
  if (latest.status === 'graded' && typeof latest.score === 'number' && typeof latest.maxScore === 'number') {
    return <p className="muted">{fill(t.last, { score: latest.score, max: latest.maxScore })}</p>
  }
  return (
    <div className="muted">
      <p>{latest.status === 'reviewed' ? t.audio.reviewed : t.audio.toReview}</p>
      {latest.feedback ? (
        <p>
          {t.audio.feedback} <bdi dir={textDir(latest.feedback)}>{latest.feedback}</bdi>
        </p>
      ) : null}
    </div>
  )
}

function Result({ result, t }: { result: GradeResult; t: T }) {
  const all = result.score === result.max
  return (
    <div className={`exercise__result ${all ? 'exercise__result--ok' : ''}`} role="status">
      <p className="exercise__score">
        {fill(t.score, { score: result.score, max: result.max })}
        {all ? <> · {t.allRight}</> : null}
      </p>
      {result.explanation ? (
        <p className="exercise__explanation">
          <strong>{t.explanation}</strong>{' '}
          <span dir={textDir(result.explanation)} className="exercise__explanation-text">
            {result.explanation}
          </span>
        </p>
      ) : null}
    </div>
  )
}

type Body<K extends PublicExercise['kind']> = {
  ex: Extract<PublicExercise, { kind: K }>
  answers: string[]
  result?: GradeResult
  t: T
  dir: Direction
  lang?: string
}

function Mcq({ ex, answers, result, t, dir, lang }: Body<'mcq'>) {
  const expected = new Set(result?.solution ?? [])
  return (
    <fieldset className="choices" disabled={Boolean(result)}>
      <legend className="exercise__question">
        <span dir={textDir(ex.question)}>{ex.question}</span>
      </legend>
      <div className="choices__list" dir={dir} lang={lang}>
      {ex.options.map((o) => {
        const chosen = answers.includes(o.value)
        const cls = result?.solution ? (expected.has(o.text) ? 'choice--expected' : chosen ? 'choice--wrong' : '') : ''
        return (
          <label key={o.value} className={`choice ${cls}`}>
            <input type={ex.multiple ? 'checkbox' : 'radio'} name="answer" value={o.value} defaultChecked={chosen} />
            <span dir="auto">{o.text}</span>
            {result?.solution && (expected.has(o.text) || chosen) ? <Mark ok={expected.has(o.text)} t={t} /> : null}
          </label>
        )
      })}
      </div>
      {result && !result.solution ? <Mark ok={result.perItem[0]} t={t} /> : null}
    </fieldset>
  )
}

function Gap({ ex, answers, result, t, dir, lang }: Body<'gap'>) {
  return (
    <>
      {ex.instructions ? (
        <p className="exercise__question" dir={textDir(ex.instructions)}>
          {ex.instructions}
        </p>
      ) : null}
      <p className="gap-text" dir={dir} lang={lang}>
      {ex.segments.map((s, k) =>
        s.t === 'text' ? (
          <span key={k}>{s.v}</span>
        ) : (
          <span key={k} className="gap">
            <input
              type="text"
              name="answer"
              className="gap__input"
              aria-label={fill(t.blank, { n: s.i + 1 })}
              defaultValue={answers[s.i] ?? ''}
              disabled={Boolean(result)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              lang={lang}
              dir="auto"
            />
            {result ? <Mark ok={result.perItem[s.i]} t={t} /> : null}
            {result?.solution && !result.perItem[s.i] ? (
              <span className="gap__solution">
                <span className="visually-hidden">{t.solution} </span>
                <bdi>{result.solution[s.i]}</bdi>
              </span>
            ) : null}
          </span>
        ),
      )}
      </p>
    </>
  )
}

function Matching({ ex, answers, result, t, dir, lang }: Body<'matching'>) {
  return (
    <>
      {ex.instructions ? (
        <p className="exercise__question" dir={textDir(ex.instructions)}>
          {ex.instructions}
        </p>
      ) : null}
      <ul className="pairs" dir={dir} lang={lang}>
        {ex.lefts.map((left, i) => (
          <li key={i} className="pair">
            <span className="pair__left" id={`${ex.id}-l${i}`} dir="auto">
              {left}
            </span>
            <select name="answer" aria-labelledby={`${ex.id}-l${i}`} defaultValue={answers[i] ?? ''} disabled={Boolean(result)} dir="auto">
              <option value="">{t.choose}</option>
              {ex.rights.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {result ? <Mark ok={result.perItem[i]} t={t} /> : null}
            {result?.solution && !result.perItem[i] ? (
              <span className="gap__solution">
                <span className="visually-hidden">{t.solution} </span>
                <bdi>{result.solution[i]}</bdi>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}
