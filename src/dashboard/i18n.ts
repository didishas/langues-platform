/** Textes du tableau de bord, dans la langue de l'administration choisie par Catherine. */
const fr = {
  title: 'Votre activité',
  asOf: 'Au',
  money: {
    collectedThisMonth: 'Encaissé ce mois-ci',
    vsLastMonth: (amount: string, month: string) => `${month} : ${amount}`,
    toCollect: 'À encaisser',
    invoices: (n: number) => (n === 1 ? '1 facture' : `${n} factures`),
    overdue: 'En retard',
    overdueNone: 'Aucune facture en retard',
    reserve: 'À mettre de côté',
    reserveHint: (pct: number, year: string) => `${pct} % de l’encaissé ${year}, taux fixé avec votre comptable`,
    byMonth: 'Encaissé par mois',
    byMonthHint: 'Factures payées, selon la date de paiement. 12 derniers mois.',
    showTable: 'Voir les chiffres',
    month: 'Mois',
    amount: 'Montant',
  },
  languages: {
    title: 'Par langue',
    hint: 'Prestations réalisées sur les 12 derniers mois, facturées ou non.',
    unknown: 'Langue non précisée',
    empty: 'Aucune prestation sur les 12 derniers mois.',
  },
  hours: {
    title: 'Heures de cours',
    given: (given: string, opened: string) => `${given} h données sur ${opened} h ouvertes`,
    givenHint: '30 derniers jours. « Données » : créneaux passés avec au moins un élève confirmé.',
    fill: 'Remplissage à venir',
    fillValue: (taken: number, seats: number) => `${taken} ${taken > 1 ? 'places prises' : 'place prise'} sur ${seats}`,
    fillHint: (slots: number) => `${slots} ${slots > 1 ? 'créneaux' : 'créneau'} dans les 4 prochaines semaines`,
    noSlots: 'Aucun créneau dans les 4 prochaines semaines.',
  },
  students: {
    title: 'Élèves',
    active: 'Actifs',
    activeHint: 'Une prestation ou un cours confirmé dans les 30 derniers jours',
    new: 'Nouveaux',
    newHint: 'Actifs pour la première fois ces 30 derniers jours',
    lost: 'À relancer',
    lostHint: 'Actifs il y a 1 à 3 mois, plus rien depuis 30 jours',
  },
  todo: {
    title: 'À faire',
    toValidate: (n: number) => (n === 1 ? '1 facture à valider' : `${n} factures à valider`),
    toInvoice: (n: number, amount: string) =>
      n === 1 ? `1 prestation pas encore facturée (${amount})` : `${n} prestations pas encore facturées (${amount})`,
    overdueTitle: 'Factures en retard',
    daysLate: (n: number) => (n === 1 ? '1 jour de retard' : `${n} jours de retard`),
    oral: (n: number) => (n === 1 ? '1 réponse orale à écouter' : `${n} réponses orales à écouter`),
    submissions: 'Devoirs à corriger',
    submissionsNone: 'Aucun devoir à corriger.',
    trials: 'Nouvelles demandes de cours d’essai',
    trialsNone: 'Aucune nouvelle demande.',
    since: 'depuis le',
    nothing: 'Rien en attente.',
  },
}

export type DashboardText = typeof fr

const en: DashboardText = {
  title: 'Your activity',
  asOf: 'As of',
  money: {
    collectedThisMonth: 'Collected this month',
    vsLastMonth: (amount, month) => `${month}: ${amount}`,
    toCollect: 'To collect',
    invoices: (n) => (n === 1 ? '1 invoice' : `${n} invoices`),
    overdue: 'Overdue',
    overdueNone: 'No overdue invoices',
    reserve: 'To set aside',
    reserveHint: (pct, year) => `${pct}% of ${year} collections, rate agreed with your accountant`,
    byMonth: 'Collected per month',
    byMonthHint: 'Paid invoices, by payment date. Last 12 months.',
    showTable: 'Show the figures',
    month: 'Month',
    amount: 'Amount',
  },
  languages: {
    title: 'By language',
    hint: 'Lessons given over the last 12 months, invoiced or not.',
    unknown: 'Language not set',
    empty: 'No lessons over the last 12 months.',
  },
  hours: {
    title: 'Teaching hours',
    given: (given, opened) => `${given} h taught out of ${opened} h opened`,
    givenHint: 'Last 30 days. “Taught”: past slots with at least one confirmed student.',
    fill: 'Upcoming bookings',
    fillValue: (taken, seats) => `${taken} of ${seats} ${seats > 1 ? 'places' : 'place'} booked`,
    fillHint: (slots) => `${slots} ${slots > 1 ? 'slots' : 'slot'} in the next 4 weeks`,
    noSlots: 'No slots in the next 4 weeks.',
  },
  students: {
    title: 'Students',
    active: 'Active',
    activeHint: 'A lesson or confirmed booking in the last 30 days',
    new: 'New',
    newHint: 'Active for the first time in the last 30 days',
    lost: 'To follow up',
    lostHint: 'Active 1 to 3 months ago, nothing in the last 30 days',
  },
  todo: {
    title: 'To do',
    toValidate: (n) => (n === 1 ? '1 invoice to approve' : `${n} invoices to approve`),
    toInvoice: (n, amount) => (n === 1 ? `1 lesson not invoiced yet (${amount})` : `${n} lessons not invoiced yet (${amount})`),
    overdueTitle: 'Overdue invoices',
    daysLate: (n) => (n === 1 ? '1 day late' : `${n} days late`),
    oral: (n) => (n === 1 ? '1 spoken answer to listen to' : `${n} spoken answers to listen to`),
    submissions: 'Homework to correct',
    submissionsNone: 'No homework to correct.',
    trials: 'New trial lesson requests',
    trialsNone: 'No new requests.',
    since: 'since',
    nothing: 'Nothing pending.',
  },
}

const he: DashboardText = {
  title: 'הפעילות שלך',
  asOf: 'נכון ל־',
  money: {
    collectedThisMonth: 'נגבה החודש',
    vsLastMonth: (amount, month) => `${month}: ${amount}`,
    toCollect: 'לגבייה',
    invoices: (n) => (n === 1 ? 'חשבונית אחת' : `${n} חשבוניות`),
    overdue: 'באיחור',
    overdueNone: 'אין חשבוניות באיחור',
    reserve: 'להפריש',
    reserveHint: (pct, year) => `${pct}% מהגבייה של ${year}, לפי השיעור שנקבע עם רואה החשבון`,
    byMonth: 'גבייה לפי חודש',
    byMonthHint: 'חשבוניות ששולמו, לפי תאריך התשלום. 12 החודשים האחרונים.',
    showTable: 'הצגת הנתונים',
    month: 'חודש',
    amount: 'סכום',
  },
  languages: {
    title: 'לפי שפה',
    hint: 'שיעורים שניתנו ב־12 החודשים האחרונים, עם או בלי חשבונית.',
    unknown: 'שפה לא צוינה',
    empty: 'אין שיעורים ב־12 החודשים האחרונים.',
  },
  hours: {
    title: 'שעות לימוד',
    given: (given, opened) => `${given} שעות שניתנו מתוך ${opened} שעות שנפתחו`,
    givenHint: '30 הימים האחרונים. „שניתנו”: מועדים שעברו עם לפחות תלמיד מאושר אחד.',
    fill: 'תפוסה קרובה',
    fillValue: (taken, seats) => (taken === 1 ? `מקום אחד תפוס מתוך ${seats}` : `${taken} מקומות תפוסים מתוך ${seats}`),
    fillHint: (slots) => `${slots} מועדים ב־4 השבועות הקרובים`,
    noSlots: 'אין מועדים ב־4 השבועות הקרובים.',
  },
  students: {
    title: 'תלמידים',
    active: 'פעילים',
    activeHint: 'שיעור או הזמנה מאושרת ב־30 הימים האחרונים',
    new: 'חדשים',
    newHint: 'פעילים לראשונה ב־30 הימים האחרונים',
    lost: 'ליצור קשר',
    lostHint: 'היו פעילים לפני חודש עד שלושה, ללא פעילות ב־30 הימים האחרונים',
  },
  todo: {
    title: 'לטיפול',
    toValidate: (n) => (n === 1 ? 'חשבונית אחת לאישור' : `${n} חשבוניות לאישור`),
    toInvoice: (n, amount) => (n === 1 ? `שיעור אחד שטרם חויב (${amount})` : `${n} שיעורים שטרם חויבו (${amount})`),
    overdueTitle: 'חשבוניות באיחור',
    daysLate: (n) => (n === 1 ? 'יום איחור אחד' : `${n} ימי איחור`),
    oral: (n) => (n === 1 ? 'תשובה בעל פה אחת להאזנה' : `${n} תשובות בעל פה להאזנה`),
    submissions: 'שיעורי בית לבדיקה',
    submissionsNone: 'אין שיעורי בית לבדיקה.',
    trials: 'בקשות חדשות לשיעור ניסיון',
    trialsNone: 'אין בקשות חדשות.',
    since: 'מאז',
    nothing: 'אין משימות ממתינות.',
  },
}

export type AdminLocale = 'fr' | 'en' | 'he'
export const dashboardText = (locale: AdminLocale): DashboardText => ({ fr, en, he })[locale]
export const toAdminLocale = (lang: string | undefined): AdminLocale => (lang === 'en' || lang === 'he' ? lang : 'fr')

const intlTag: Record<AdminLocale, string> = { fr: 'fr-BE', en: 'en-GB', he: 'he-IL' }

export function money(cents: number, locale: AdminLocale): string {
  return new Intl.NumberFormat(intlTag[locale], {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export function monthLabel(key: string, locale: AdminLocale, style: 'short' | 'long' = 'short'): string {
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(intlTag[locale], { month: style, ...(style === 'long' ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  )
}

export function dateLabel(iso: string | Date, locale: AdminLocale): string {
  return new Intl.DateTimeFormat(intlTag[locale], { dateStyle: 'long', timeZone: 'Europe/Brussels' }).format(
    typeof iso === 'string' ? new Date(iso) : iso,
  )
}

export function hoursLabel(h: number, locale: AdminLocale): string {
  return new Intl.NumberFormat(intlTag[locale], { maximumFractionDigits: 1 }).format(h)
}
