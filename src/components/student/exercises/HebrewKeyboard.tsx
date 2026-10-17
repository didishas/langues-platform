'use client'

import { useState, type RefObject } from 'react'

import type { StudentDictionary } from '@/i18n/studentDictionaries'

/**
 * Lettres dans l'ordre de l'alphabet (plus simple pour un élève débutant que la disposition d'un clavier israélien),
 * chaque lettre finale juste après sa forme normale. Ajout du guérech pour les sons étrangers (ג׳, ז׳, צ׳).
 */
const LETTERS = 'א ב ג ד ה ו ז ח ט י כ ך ל מ ם נ ן ס ע פ ף צ ץ ק ר ש ת ׳'.split(' ')

/** Dernier champ texte utilisé dans `scope`, ou le premier à défaut. */
function target(scope: HTMLElement | null): HTMLInputElement | HTMLTextAreaElement | null {
  if (!scope) return null
  const last = scope.querySelector<HTMLInputElement>('[data-kbd-last="true"]')
  return last ?? scope.querySelector<HTMLInputElement>('input[type="text"]:not([disabled]), textarea:not([disabled])')
}

/** Mémorise le champ où l'élève écrit, pour que le clavier sache où insérer les lettres. */
export function rememberField(e: React.FocusEvent<HTMLElement>) {
  const el = e.target
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  e.currentTarget.querySelectorAll('[data-kbd-last]').forEach((n) => n.removeAttribute('data-kbd-last'))
  el.setAttribute('data-kbd-last', 'true')
}

/** Clavier hébreu à l'écran, pour taper une réponse sans clavier hébreu physique. */
export function HebrewKeyboard({ scope, t }: { scope: RefObject<HTMLElement | null>; t: StudentDictionary['videos']['keyboard'] }) {
  const [open, setOpen] = useState(false)

  const type = (text: string | null) => {
    const field = target(scope.current)
    if (!field) return
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? start
    if (text === null) {
      // Effacer : la sélection, ou le caractère avant le curseur.
      if (start === end && start > 0) field.setRangeText('', start - 1, end, 'end')
      else field.setRangeText('', start, end, 'end')
    } else {
      field.setRangeText(text, start, end, 'end')
    }
    field.focus()
  }

  return (
    <div className="hkbd">
      <button type="button" className="button button--quiet button--small" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t.hide : t.show}
      </button>
      {open ? (
        <div className="hkbd__keys" role="group" aria-label={t.label} dir="rtl" lang="he">
          {LETTERS.map((l) => (
            <button
              key={l}
              type="button"
              className="hkbd__key"
              // Garder le curseur dans le champ : le clic ne doit pas lui retirer le focus.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => type(l)}
            >
              {l}
            </button>
          ))}
          <button type="button" className="hkbd__key hkbd__key--wide" onMouseDown={(e) => e.preventDefault()} onClick={() => type(' ')}>
            {t.space}
          </button>
          <button type="button" className="hkbd__key hkbd__key--wide" onMouseDown={(e) => e.preventDefault()} onClick={() => type(null)}>
            {t.erase}
          </button>
        </div>
      ) : null}
    </div>
  )
}
