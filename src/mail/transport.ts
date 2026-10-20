/**
 * Envoi réel des e-mails. Seul `src/mail/` connaît le service d'envoi.
 *
 * MAIL_TRANSPORT :
 * - `smtp`   : serveur SMTP du service choisi par Catherine (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
 *              Protocole standard : aucune API propre à un fournisseur.
 * - `file`   : développement ; chaque message est écrit dans `.mail-outbox/` au lieu de partir.
 * - `memory` : tests ; les messages restent en mémoire (`sentInMemory`).
 * Par défaut : `smtp` en production (refus d'envoyer s'il n'est pas configuré), `file` sinon.
 */
import fs from 'fs/promises'
import path from 'path'

import nodemailer from 'nodemailer'

export type OutgoingMail = { to: string; toName?: string | null; subject: string; text: string; html: string }
export type SendResult = { messageId: string }

export class MailNotConfiguredError extends Error {
  constructor() {
    super('Envoi d’e-mails non configuré : renseignez SMTP_HOST, SMTP_USER, SMTP_PASS et MAIL_FROM.')
  }
}

const memory: OutgoingMail[] = []
/** Messages « envoyés » en mode `memory` (tests). */
export const sentInMemory = (): readonly OutgoingMail[] => memory

function mode(): 'smtp' | 'file' | 'memory' {
  const m = process.env.MAIL_TRANSPORT
  if (m === 'smtp' || m === 'file' || m === 'memory') return m
  return process.env.NODE_ENV === 'production' ? 'smtp' : 'file'
}

export async function sendMail(mail: OutgoingMail): Promise<SendResult> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  switch (mode()) {
    case 'memory':
      memory.push(mail)
      return { messageId: `memory-${id}` }
    case 'file': {
      const dir = path.resolve(process.cwd(), '.mail-outbox')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(mail, null, 2))
      return { messageId: `file-${id}` }
    }
    case 'smtp': {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) throw new MailNotConfiguredError()
      const port = Number(SMTP_PORT || 587)
      const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
      const info = await transporter.sendMail({
        from: MAIL_FROM,
        to: mail.toName ? { name: mail.toName, address: mail.to } : mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      })
      return { messageId: info.messageId }
    }
  }
}
