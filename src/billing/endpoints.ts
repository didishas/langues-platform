import type { Endpoint } from 'payload'

import { isStaffUser } from '@/access'

import { toSmartCsv } from './providers/smart'
import { handlePaymentNotification, prepareDraftInvoice } from './service'
import type { InvoiceDraft } from './types'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/** POST /api/invoices/prepare { studentId, prestationIds } → facture à valider. */
export const prepareEndpoint: Endpoint = {
  path: '/prepare',
  method: 'post',
  handler: async (req) => {
    if (!isStaffUser(req)) return json({ error: 'Accès refusé' }, 403)
    const body = (await req.json?.()) as { studentId?: string | number; prestationIds?: (string | number)[] }
    if (!body?.studentId || !Array.isArray(body.prestationIds)) {
      return json({ error: 'studentId et prestationIds sont requis' }, 400)
    }
    try {
      const invoice = await prepareDraftInvoice(
        req.payload,
        { studentId: body.studentId, prestationIds: body.prestationIds },
        req,
      )
      return json({ id: invoice.id, status: invoice.status })
    } catch (e) {
      return json({ error: (e as Error).message }, 400)
    }
  },
}

/** GET /api/invoices/smart-export → CSV des demandes validées, à reporter dans l'outil Smart. */
export const smartExportEndpoint: Endpoint = {
  path: '/smart-export',
  method: 'get',
  handler: async (req) => {
    if (!isStaffUser(req)) return json({ error: 'Accès refusé' }, 403)
    const res = await req.payload.find({
      collection: 'invoices',
      where: { and: [{ provider: { equals: 'smart' } }, { status: { equals: 'validated' } }] },
      limit: 500,
      depth: 0,
      req,
    })
    const drafts = res.docs.map(
      (d: any): InvoiceDraft => ({
        provider: 'smart',
        number: null,
        customer: { id: String(d.student), ...d.customer },
        lines: (d.lines ?? []).map((l: any) => ({
          prestationId: String(l.prestation),
          description: l.description,
          date: l.date,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          discountPercent: l.discountPercent ?? 0,
          totalCents: l.lineTotalCents,
        })),
        subtotalCents: d.subtotalCents,
        vatRatePercent: 0,
        vatCents: 0,
        totalCents: d.totalCents,
        vatMention: null,
        issueDate: d.issueDate,
        dueDate: d.dueDate,
        structuredCommunication: null,
        delivery: 'smart',
        status: 'to_validate',
      }),
    )
    return new Response('﻿' + toSmartCsv(drafts), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="demandes-smart.csv"',
      },
    })
  },
}

/**
 * POST /api/invoices/payment-webhook (corps : id=tr_…) — appelé par Mollie.
 * Mollie n'envoie que l'identifiant du paiement : tout le reste est relu et vérifié côté serveur
 * (voir handlePaymentNotification). 200 = notification traitée ou ignorée ; 500 = Mollie réessaiera.
 */
export const paymentWebhookEndpoint: Endpoint = {
  path: '/payment-webhook',
  method: 'post',
  handler: async (req) => {
    const form = await req.formData?.().catch(() => null)
    const paymentId = form?.get('id')
    if (typeof paymentId !== 'string') return json({ ok: true })
    try {
      const outcome = await handlePaymentNotification(req.payload, paymentId)
      return json({ ok: true, outcome })
    } catch (e) {
      req.payload.logger.error({ err: e, msg: 'Notification de paiement non traitée', paymentId })
      return json({ ok: false }, 500)
    }
  },
}
