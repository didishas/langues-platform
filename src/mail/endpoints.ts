import type { Endpoint } from 'payload'

import { isTeacher } from '@/access'

import { approveAndSend } from './outbox'

const json = (body: unknown, status = 200) => Response.json(body, { status })

const REASONS: Record<string, string> = {
  version: 'Le message a changé depuis que vous l’avez ouvert : relisez-le, puis validez à nouveau.',
  recipient: 'L’adresse de l’élève a changé : enregistrez le message pour la mettre à jour, puis relisez-le.',
  invoice: 'La facture n’est plus valide ou son montant a changé : rien n’est parti.',
  booking: 'La séance n’est plus confirmée : rien n’est parti.',
  cancelled: 'Ce message est annulé.',
  not_found: 'Message introuvable.',
}

/** POST /api/outbox/:id/send { version } : Catherine valide et envoie CE message. */
export const outboxSendEndpoint: Endpoint = {
  path: '/:id/send',
  method: 'post',
  handler: async (req) => {
    if (!isTeacher(req)) return json({ error: 'Seule Catherine peut valider un envoi.' }, 403)
    const raw = req.routeParams?.id
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return json({ error: 'Message introuvable.' }, 404)
    const body = (await req.json?.().catch(() => null)) as { version?: string } | null
    const r = await approveAndSend(req.payload, Number(raw), req.user!.id as number, String(body?.version ?? ''))
    if (r.outcome === 'sent' || r.outcome === 'already_sent') return json({ ok: true, outcome: r.outcome })
    if (r.outcome === 'failed') return json({ ok: false, outcome: r.outcome, error: `L’envoi a échoué : ${r.error}` }, 502)
    return json({ ok: false, outcome: r.outcome, error: REASONS[r.reason] }, r.reason === 'not_found' ? 404 : 409)
  },
}
