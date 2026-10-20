import { sql } from '@payloadcms/db-postgres/drizzle'
import type { PayloadRequest } from 'payload'

/** Espaces de verrous, pour qu'un identifiant de créneau ne bloque jamais une facture du même numéro. */
export const LOCK = {
  slotBooking: 1,
  invoiceCounter: 2,
  invoice: 3,
  outbox: 4,
} as const

/**
 * Verrou Postgres tenu jusqu'à la fin de la transaction en cours (`pg_advisory_xact_lock`).
 *
 * Deux requêtes qui demandent le même verrou s'exécutent l'une après l'autre : la seconde attend
 * que la première soit validée en base, puis relit des données à jour. C'est ce qui empêche
 * deux réservations de la dernière place ou deux factures avec le même numéro.
 *
 * Doit être appelé dans un hook ou une opération qui tourne dans la transaction de `req`
 * (les opérations Payload en ouvrent une par défaut). Sans transaction, on refuse d'avancer :
 * un verrou hors transaction ne protégerait rien.
 */
export async function lockInTransaction(req: PayloadRequest, namespace: number, key: number): Promise<void> {
  const transactionID = req.transactionID ? await req.transactionID : undefined
  const adapter = req.payload.db as unknown as { sessions?: Record<string | number, { db?: any }> }
  const tx = transactionID !== undefined ? adapter.sessions?.[transactionID]?.db : undefined
  if (!tx) {
    throw new Error('Verrou impossible : cette opération doit s’exécuter dans une transaction.')
  }
  await tx.execute(sql`select pg_advisory_xact_lock(${namespace}::int, ${key}::int)`)
}
