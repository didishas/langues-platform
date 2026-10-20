import type { Locale } from './config'

/**
 * Modèles d'e-mails par défaut, utilisés tant que Catherine n'a rien écrit dans « Modèles d'e-mails ».
 * Repères remplacés à la préparation : {prenom}, {numero}, {montant}, {echeance}, {communication},
 * {paiement_en_ligne}, {lien_paiement}, {lien_espace}, {date_seance}, {signature}.
 * Traductions anglaise et hébraïque à relire par Catherine.
 */
export type EmailTemplateTexts = {
  signature: string
  invoiceSubject: string
  invoiceBody: string
  invoiceOnlineLine: string
  bookingSubject: string
  bookingBody: string
}

export const EMAIL_DEFAULTS: Record<Locale, EmailTemplateTexts> = {
  fr: {
    signature: 'Catherine\nMotàMot',
    invoiceSubject: 'Votre facture {numero}',
    invoiceBody:
      'Bonjour {prenom},\n\nVoici votre facture {numero}, d’un montant de {montant}, à régler pour le {echeance}.\n\nPar virement, avec la communication structurée {communication}.\n{paiement_en_ligne}\n\nVous la retrouvez dans votre espace élève : {lien_espace}\n\n{signature}',
    invoiceOnlineLine: 'Ou en ligne : {lien_paiement}',
    bookingSubject: 'Votre séance est confirmée',
    bookingBody:
      'Bonjour {prenom},\n\nVotre séance du {date_seance} est confirmée.\nLe lien de la visio vous attend dans votre espace élève : {lien_espace}\n\nÀ bientôt,\n{signature}',
  },
  en: {
    signature: 'Catherine\nMotàMot',
    invoiceSubject: 'Your invoice {numero}',
    invoiceBody:
      'Hello {prenom},\n\nHere is your invoice {numero} for {montant}, due on {echeance}.\n\nBy bank transfer, with the structured reference {communication}.\n{paiement_en_ligne}\n\nYou can also find it in your student area: {lien_espace}\n\n{signature}',
    invoiceOnlineLine: 'Or pay online: {lien_paiement}',
    bookingSubject: 'Your lesson is confirmed',
    bookingBody:
      'Hello {prenom},\n\nYour lesson on {date_seance} is confirmed.\nThe video call link is waiting in your student area: {lien_espace}\n\nSee you soon,\n{signature}',
  },
  he: {
    signature: 'קתרין\nMotàMot',
    invoiceSubject: 'החשבונית שלך {numero}',
    invoiceBody:
      'שלום {prenom},\n\nמצורפת החשבונית {numero} על סך {montant}, לתשלום עד {echeance}.\n\nבהעברה בנקאית, עם ההפניה המובנית {communication}.\n{paiement_en_ligne}\n\nהחשבונית נמצאת גם באזור התלמיד: {lien_espace}\n\n{signature}',
    invoiceOnlineLine: 'או לתשלום מקוון: {lien_paiement}',
    bookingSubject: 'השיעור שלך אושר',
    bookingBody:
      'שלום {prenom},\n\nהשיעור שלך ב־{date_seance} אושר.\nהקישור לשיחת הווידאו מחכה באזור התלמיד: {lien_espace}\n\nלהתראות,\n{signature}',
  },
}
