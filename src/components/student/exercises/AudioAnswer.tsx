'use client'

import { useEffect, useRef, useState } from 'react'

import { fill } from '@/i18n/format'
import type { StudentDictionary } from '@/i18n/studentDictionaries'

/**
 * Enregistrement de la réponse orale dans le navigateur. L'enregistrement est placé dans le champ fichier
 * du formulaire : il part avec le formulaire, comme un fichier joint. Sans micro, l'élève joint un fichier.
 */
export function AudioAnswer({ id, maxSeconds, t }: { id: string; maxSeconds: number; t: StudentDictionary['videos']['audio'] }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [noMic, setNoMic] = useState(false)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => {
    if (!recording) return
    const started = Date.now()
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000)
      setElapsed(s)
      if (s >= maxSeconds) recorder.current?.stop()
    }, 250)
    return () => clearInterval(timer)
  }, [recording, maxSeconds])

  const start = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setNoMic(true)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        const type = rec.mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const file = new File(chunks, `reponse.${ext}`, { type })
        const transfer = new DataTransfer()
        transfer.items.add(file)
        if (fileInput.current) fileInput.current.files = transfer.files
        setPreview(URL.createObjectURL(file))
      }
      recorder.current = rec
      setElapsed(0)
      setPreview(null)
      rec.start()
      setRecording(true)
    } catch {
      setNoMic(true)
    }
  }

  return (
    <div className="audio-answer">
      <div className="audio-answer__controls">
        {recording ? (
          <>
            <button type="button" className="button" onClick={() => recorder.current?.stop()}>
              {t.stop}
            </button>
            <span className="audio-answer__live" role="status">
              <span className="audio-answer__dot" aria-hidden="true" /> {t.recording} · <bdi>{elapsed} s</bdi>
            </span>
          </>
        ) : (
          <button type="button" className="button button--quiet" onClick={start}>
            {preview ? t.again : t.record}
          </button>
        )}
        <span className="muted">{fill(t.max, { n: maxSeconds })}</span>
      </div>
      {noMic ? <p className="muted">{t.noMic}</p> : null}
      {preview ? <audio controls src={preview} className="audio-answer__preview" /> : null}
      <div className="field">
        <label htmlFor={`audio-${id}`}>{t.file}</label>
        <input ref={fileInput} id={`audio-${id}`} name="audio" type="file" accept="audio/*" onChange={() => setPreview(null)} />
      </div>
    </div>
  )
}
