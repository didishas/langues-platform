'use client'

import { useActionState } from 'react'

import { submitAssignment, type SubmitState } from '@/app/(frontend)/[locale]/espace/actions'
import type { Direction, Locale } from '@/i18n/config'
import type { StudentDictionary } from '@/i18n/studentDictionaries'

export function SubmitForm({
  locale,
  assignmentId,
  answerDir,
  answerLang,
  initialText,
  isResubmission,
  t,
}: {
  locale: Locale
  assignmentId: number
  /** Sens d'écriture de la réponse = celui de la langue du devoir (une réponse en hébreu s'écrit de droite à gauche). */
  answerDir: Direction
  answerLang?: string
  initialText?: string
  isResubmission: boolean
  t: StudentDictionary['assignments']
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitAssignment, { status: 'idle' })

  if (state.status === 'success') {
    return (
      <p className="form-success" role="status">
        {state.message}
      </p>
    )
  }

  return (
    <form action={action} className="trial-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="assignment" value={assignmentId} />
      <div className="field">
        <label htmlFor="answer-text">{t.yourAnswer}</label>
        <textarea
          id="answer-text"
          name="text"
          rows={8}
          dir={answerDir}
          lang={answerLang}
          key={state.text ?? 'initial'}
          defaultValue={state.text ?? initialText}
        />
      </div>
      <div className="field">
        <label htmlFor="answer-files">{t.files}</label>
        <input
          id="answer-files"
          name="files"
          type="file"
          multiple
          accept="application/pdf,image/*,audio/*,.doc,.docx,.txt"
        />
      </div>
      {state.status === 'error' && state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <button type="submit" className="button" disabled={pending}>
        {pending ? t.sending : isResubmission ? t.resubmit : t.submit}
      </button>
    </form>
  )
}
