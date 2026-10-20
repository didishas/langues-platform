import type { CollectionConfig, Where } from 'payload'

import { isStaffUser, teacherOnly } from '@/access'
import { prepareInvoiceEmail } from '@/mail/outbox'
import { paymentWebhookEndpoint, prepareEndpoint, smartExportEndpoint } from '@/billing/endpoints'
import { createPaymentLink, finalizeOnValidation } from '@/billing/service'
import { euroAmountFields } from '@/fields'
import { LOCK, lockInTransaction } from '@/lib/dbLock'

/** Champs fixés au moment de la validation ; recopiés tels quels si la facture vient d'être validée ailleurs. */
const FINALIZED_FIELDS = [
  'number',
  'structuredCommunication',
  'issueDate',
  'dueDate',
  'validatedAt',
  'lines',
  'customer',
  'subtotalCents',
  'vatRatePercent',
  'vatCents',
  'totalCents',
  'vatMention',
  'delivery',
  'provider',
  'paymentId',
  'paymentUrl',
] as const

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: string | number }).id : v)

/**
 * Factures (phase 1) ou demandes de facture Smart (phase 2).
 * Cycle : à valider → validée → envoyée → payée. Rien ne part sans la validation de Catherine.
 */
export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: 'Facture', plural: 'Factures' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'student', 'total', 'status', 'dueDate'],
    group: 'Facturation',
    description:
      'Les factures se préparent à partir des prestations. Une facture reste un brouillon tant qu’elle n’est pas validée.',
  },
  defaultSort: '-createdAt',
  endpoints: [prepareEndpoint, smartExportEndpoint, paymentWebhookEndpoint],
  access: {
    // Un élève ne voit que ses factures validées : jamais les brouillons « à valider ».
    read: ({ req }) => {
      if (isStaffUser(req)) return true
      if (req.user?.collection === 'students') {
        return { and: [{ student: { equals: req.user.id } }, { status: { not_equals: 'to_validate' } }] } as Where
      }
      return false
    },
    create: teacherOnly,
    update: teacherOnly,
    delete: teacherOnly,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        if (operation === 'update' && originalDoc) {
          const from = originalDoc.status
          const to = data.status ?? from
          if (from === 'to_validate' && to === 'validated') {
            // Double clic, deux onglets : une seule validation à la fois pour une même facture.
            // Après le verrou, on relit la facture : si une autre requête vient de la valider,
            // on garde son numéro au lieu d'en consommer un second.
            await lockInTransaction(req, LOCK.invoice, Number(originalDoc.id))
            const fresh = await req.payload.findByID({ collection: 'invoices', id: originalDoc.id, req, depth: 0 })
            if (fresh.status !== 'to_validate') {
              for (const key of FINALIZED_FIELDS) data[key] = (fresh as unknown as Record<string, unknown>)[key]
              data.status = fresh.status
            } else {
              Object.assign(data, await finalizeOnValidation(req.payload, originalDoc, req))
              req.context.finalizedInvoice = originalDoc.id
            }
          } else if (from !== 'to_validate' && to === 'to_validate') {
            throw new Error('Une facture validée ne peut pas redevenir un brouillon.')
          } else if (from === 'to_validate' && (to === 'sent' || to === 'paid')) {
            throw new Error('Validez d’abord la facture.')
          }
          if (to === 'paid' && from !== 'paid' && !data.paidAt) data.paidAt = new Date().toISOString()
        }
        const label = data.number ?? originalDoc?.number
        data.title = label
          ? `${data.provider === 'smart' || originalDoc?.provider === 'smart' ? 'Smart' : 'Facture'} ${label}`
          : 'Brouillon'
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        // Facture payée ou annulée : son e-mail encore en attente de validation n'a plus lieu d'être.
        if (operation === 'update' && ['paid', 'cancelled'].includes(doc.status) && previousDoc?.status !== doc.status) {
          await req.payload.update({
            collection: 'outbox',
            where: { and: [{ invoice: { equals: doc.id } }, { status: { in: ['draft', 'failed'] } }] },
            data: { status: 'cancelled' },
            req,
            overrideAccess: true,
          })
        }
        return doc
      },
      async ({ doc, req, operation }) => {
        // Effets de la validation (prestations facturées, lien de paiement) : une seule fois,
        // par la requête qui a réellement attribué le numéro.
        if (operation !== 'update' || req.context.finalizedInvoice !== doc.id) return doc
        req.context.finalizedInvoice = undefined
        for (const line of doc.lines ?? []) {
          const prestationId = idOf(line.prestation)
          if (prestationId) {
            await req.payload.update({
              collection: 'prestations',
              id: prestationId as string | number,
              data: { status: 'invoiced', invoice: doc.id },
              req,
            })
          }
        }
        try {
          const link = await createPaymentLink(req.payload, doc, req)
          if (link) {
            await req.payload.update({
              collection: 'invoices',
              id: doc.id,
              data: { paymentId: link.paymentId, paymentUrl: link.checkoutUrl },
              req,
            })
          }
        } catch (e) {
          req.payload.logger.error({ err: e, msg: 'Lien de paiement non créé' })
        }
        // Brouillon d'e-mail de la facture : il attend la validation de Catherine dans « Messages à envoyer ».
        const fresh = await req.payload.findByID({ collection: 'invoices', id: doc.id, depth: 0, req, overrideAccess: true })
        await prepareInvoiceEmail(req.payload, fresh, req)
        return doc
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const doc = await req.payload.findByID({ collection: 'invoices', id, req, depth: 0 })
        if (doc.status !== 'to_validate') {
          throw new Error('Une facture validée ne se supprime pas : passez-la en « Annulée ».')
        }
        for (const line of doc.lines ?? []) {
          const prestationId = idOf(line.prestation)
          if (prestationId) {
            await req.payload.update({
              collection: 'prestations',
              id: prestationId as string | number,
              data: { invoice: null },
              req,
            })
          }
        }
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      name: 'status',
      label: 'État',
      type: 'select',
      required: true,
      defaultValue: 'to_validate',
      options: [
        { label: 'À valider', value: 'to_validate' },
        { label: 'Validée, prête à envoyer', value: 'validated' },
        { label: 'Envoyée', value: 'sent' },
        { label: 'Payée', value: 'paid' },
        { label: 'Annulée', value: 'cancelled' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'provider',
      label: 'Émise par',
      type: 'select',
      required: true,
      options: [
        { label: 'Catherine (indépendante)', value: 'direct' },
        { label: 'Smart', value: 'smart' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'number', label: 'Numéro', type: 'text', unique: true, admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'structuredCommunication',
      label: 'Communication structurée',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'student', label: 'Élève', type: 'relationship', relationTo: 'students', required: true, admin: { readOnly: true } },
    {
      name: 'customer',
      label: 'Client facturé',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        { name: 'name', label: 'Nom', type: 'text' },
        { name: 'email', label: 'E-mail', type: 'email' },
        {
          name: 'kind',
          label: 'Type',
          type: 'select',
          options: [
            { label: 'Particulier', value: 'individual' },
            { label: 'Entreprise', value: 'business' },
          ],
        },
        { name: 'vatNumber', label: 'Numéro de TVA', type: 'text' },
      ],
    },
    {
      name: 'lines',
      label: 'Lignes',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'prestation', type: 'relationship', relationTo: 'prestations' },
        { name: 'description', label: 'Libellé', type: 'text' },
        { name: 'date', label: 'Date', type: 'date' },
        { name: 'quantity', label: 'Quantité', type: 'number' },
        ...euroAmountFields('unitPrice', 'Prix unitaire', { readOnly: true }),
        { name: 'discountPercent', label: 'Remise (%)', type: 'number', admin: { readOnly: true } },
        ...euroAmountFields('lineTotal', 'Total ligne', { readOnly: true }),
      ],
    },
    {
      type: 'row',
      fields: [
        ...euroAmountFields('subtotal', 'Total hors TVA', { readOnly: true }),
        { name: 'vatRatePercent', label: 'Taux de TVA (%)', type: 'number', admin: { readOnly: true } },
        ...euroAmountFields('vat', 'TVA', { readOnly: true }),
        ...euroAmountFields('total', 'Total à payer', { readOnly: true }),
      ],
    },
    { name: 'vatMention', label: 'Mention TVA', type: 'text', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'issueDate', label: 'Date d’émission', type: 'date', admin: { readOnly: true } },
        { name: 'dueDate', label: 'Échéance', type: 'date', admin: { readOnly: true } },
      ],
    },
    {
      name: 'delivery',
      label: 'Envoi',
      type: 'select',
      options: [
        { label: 'PDF par e-mail', value: 'pdf' },
        { label: 'Peppol (entreprise)', value: 'peppol' },
        { label: 'Via Smart', value: 'smart' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      type: 'collapsible',
      label: 'Paiement',
      fields: [
        { name: 'paymentUrl', label: 'Lien de paiement en ligne', type: 'text', admin: { readOnly: true } },
        { name: 'paymentId', type: 'text', index: true, admin: { readOnly: true } },
        { name: 'validatedAt', label: 'Validée le', type: 'date', admin: { readOnly: true } },
        { name: 'paidAt', label: 'Payée le', type: 'date', admin: { readOnly: true } },
        {
          name: 'paymentIssue',
          label: 'Anomalie de paiement',
          type: 'textarea',
          access: { read: ({ req }) => isStaffUser(req) },
          admin: {
            readOnly: true,
            description: 'Un paiement reçu ne correspondait pas à cette facture : il n’a pas été accepté. À vérifier dans Mollie.',
          },
        },
      ],
    },
  ],
}
