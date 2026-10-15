import type { Locale } from './config'

/**
 * Textes fixes de l'interface (boutons, libellés, messages).
 * Les contenus éditoriaux (accueil, langues, tarifs, FAQ) viennent du CMS, pas d'ici.
 * Les traductions anglaise et hébraïque sont à relire par Catherine.
 */
const fr = {
  nav: { languages: 'Langues', prices: 'Tarifs', about: 'À propos', faq: 'Questions', trial: 'Cours d’essai' },
  localeSwitcher: 'Langue du site',
  hero: { cta: 'Réserver un cours d’essai', secondary: 'Voir les tarifs' },
  languages: {
    title: 'Les langues',
    levels: 'Niveaux',
    more: 'En savoir plus',
    empty: 'Les langues seront bientôt présentées ici.',
    back: 'Toutes les langues',
  },
  prices: {
    title: 'Formules et tarifs',
    formats: { individual: 'En individuel', group: 'En groupe', parent_child: 'Atelier parent + enfant' },
    per: { single: 'la séance', pack: 'le forfait', subscription: 'par mois', per_unit: 'par' },
    minutes: 'min',
    sessions: 'séances',
    allLanguages: 'Toutes les langues',
    resources: 'Supports de cours inclus',
    discountsTitle: 'Réductions',
    empty: 'Les tarifs seront bientôt affichés. Écrivez-moi pour en savoir plus.',
  },
  steps: {
    title: 'Comment ça se passe',
    items: [
      { title: 'Un cours d’essai', text: 'On fait connaissance, on évalue votre niveau et ce que vous voulez atteindre.' },
      { title: 'Une formule', text: 'En individuel ou en groupe, à l’unité, en forfait ou au mois.' },
      { title: 'Des cours en visio', text: 'Depuis votre espace élève, sans rien installer. Devoirs et suivi entre les séances.' },
    ],
  },
  about: { title: 'À propos' },
  faq: { title: 'Questions fréquentes' },
  trial: {
    title: 'Réserver un cours d’essai',
    intro: 'Laissez vos coordonnées : je vous recontacte pour fixer un moment.',
    name: 'Nom et prénom',
    email: 'E-mail',
    phone: 'Téléphone (facultatif)',
    language: 'Langue souhaitée',
    chooseLanguage: 'Choisir une langue',
    forMinor: 'Le cours est pour un enfant mineur',
    message: 'Votre message (facultatif)',
    consent: 'J’accepte que mes coordonnées soient utilisées pour me recontacter.',
    privacyLink: 'Politique de confidentialité',
    submit: 'Envoyer la demande',
    sending: 'Envoi…',
    success: 'Demande envoyée. Je vous recontacte très vite.',
    errors: {
      name: 'Indiquez votre nom.',
      email: 'Indiquez une adresse e-mail valide.',
      consent: 'Cochez la case pour que je puisse vous recontacter.',
      generic: 'La demande n’a pas pu être envoyée. Réessayez, ou écrivez-moi directement.',
    },
    disabled: 'Les cours d’essai sont complets pour le moment.',
  },
  footer: { privacy: 'Confidentialité', contact: 'Contact', admin: 'Espace professeure' },
  privacy: { title: 'Politique de confidentialité' },
  payment: { thanksTitle: 'Merci', thanksText: 'Votre paiement a bien été transmis. Vous recevrez une confirmation par e-mail.', home: 'Retour à l’accueil' },
}

export type Dictionary = typeof fr

const en: Dictionary = {
  nav: { languages: 'Languages', prices: 'Prices', about: 'About', faq: 'Questions', trial: 'Trial lesson' },
  localeSwitcher: 'Site language',
  hero: { cta: 'Book a trial lesson', secondary: 'See prices' },
  languages: {
    title: 'Languages',
    levels: 'Levels',
    more: 'Learn more',
    empty: 'Languages will be listed here soon.',
    back: 'All languages',
  },
  prices: {
    title: 'Courses and prices',
    formats: { individual: 'One-to-one', group: 'In a group', parent_child: 'Parent + child workshop' },
    per: { single: 'per lesson', pack: 'for the pack', subscription: 'per month', per_unit: 'per' },
    minutes: 'min',
    sessions: 'lessons',
    allLanguages: 'All languages',
    resources: 'Course materials included',
    discountsTitle: 'Discounts',
    empty: 'Prices will be shown here soon. Write to me to find out more.',
  },
  steps: {
    title: 'How it works',
    items: [
      { title: 'A trial lesson', text: 'We get to know each other, assess your level and set your goals.' },
      { title: 'A course', text: 'One-to-one or in a group, per lesson, as a pack or monthly.' },
      { title: 'Online lessons', text: 'From your student space, nothing to install. Homework and follow-up between lessons.' },
    ],
  },
  about: { title: 'About' },
  faq: { title: 'Frequently asked questions' },
  trial: {
    title: 'Book a trial lesson',
    intro: 'Leave your details and I will get back to you to find a time.',
    name: 'Full name',
    email: 'Email',
    phone: 'Phone (optional)',
    language: 'Language',
    chooseLanguage: 'Choose a language',
    forMinor: 'The lesson is for a child under 18',
    message: 'Your message (optional)',
    consent: 'I agree that my details are used to contact me.',
    privacyLink: 'Privacy policy',
    submit: 'Send request',
    sending: 'Sending…',
    success: 'Request sent. I will get back to you very soon.',
    errors: {
      name: 'Enter your name.',
      email: 'Enter a valid email address.',
      consent: 'Tick the box so I can contact you.',
      generic: 'The request could not be sent. Try again, or write to me directly.',
    },
    disabled: 'Trial lessons are fully booked for now.',
  },
  footer: { privacy: 'Privacy', contact: 'Contact', admin: 'Teacher area' },
  privacy: { title: 'Privacy policy' },
  payment: { thanksTitle: 'Thank you', thanksText: 'Your payment has been sent. You will receive a confirmation by email.', home: 'Back to home' },
}

const he: Dictionary = {
  nav: { languages: 'שפות', prices: 'מחירים', about: 'אודות', faq: 'שאלות', trial: 'שיעור ניסיון' },
  localeSwitcher: 'שפת האתר',
  hero: { cta: 'לקביעת שיעור ניסיון', secondary: 'למחירים' },
  languages: {
    title: 'השפות',
    levels: 'רמות',
    more: 'לפרטים נוספים',
    empty: 'השפות יוצגו כאן בקרוב.',
    back: 'כל השפות',
  },
  prices: {
    title: 'מסלולים ומחירים',
    formats: { individual: 'שיעור פרטי', group: 'בקבוצה', parent_child: 'סדנת הורה וילד' },
    per: { single: 'לשיעור', pack: 'לחבילה', subscription: 'לחודש', per_unit: 'ל' },
    minutes: 'דק׳',
    sessions: 'שיעורים',
    allLanguages: 'כל השפות',
    resources: 'חומרי לימוד כלולים',
    discountsTitle: 'הנחות',
    empty: 'המחירים יוצגו כאן בקרוב. אפשר לכתוב לי לפרטים.',
  },
  steps: {
    title: 'איך זה עובד',
    items: [
      { title: 'שיעור ניסיון', text: 'מכירים, בודקים את הרמה ומגדירים מטרות.' },
      { title: 'מסלול', text: 'פרטי או בקבוצה, לשיעור, בחבילה או חודשי.' },
      { title: 'שיעורים בווידאו', text: 'מהאזור האישי, בלי להתקין דבר. שיעורי בית ומעקב בין השיעורים.' },
    ],
  },
  about: { title: 'אודות' },
  faq: { title: 'שאלות נפוצות' },
  trial: {
    title: 'קביעת שיעור ניסיון',
    intro: 'השאירו פרטים ואחזור אליכם לתיאום מועד.',
    name: 'שם מלא',
    email: 'דוא״ל',
    phone: 'טלפון (לא חובה)',
    language: 'שפה',
    chooseLanguage: 'בחירת שפה',
    forMinor: 'השיעור מיועד לקטין',
    message: 'הודעה (לא חובה)',
    consent: 'אני מסכים/ה שהפרטים ישמשו ליצירת קשר איתי.',
    privacyLink: 'מדיניות פרטיות',
    submit: 'שליחת הבקשה',
    sending: 'שולח…',
    success: 'הבקשה נשלחה. אחזור אליכם בהקדם.',
    errors: {
      name: 'נא למלא שם.',
      email: 'נא למלא כתובת דוא״ל תקינה.',
      consent: 'נא לסמן את התיבה כדי שאוכל ליצור קשר.',
      generic: 'הבקשה לא נשלחה. נסו שוב או כתבו לי ישירות.',
    },
    disabled: 'שיעורי הניסיון מלאים כרגע.',
  },
  footer: { privacy: 'פרטיות', contact: 'יצירת קשר', admin: 'אזור המורה' },
  privacy: { title: 'מדיניות פרטיות' },
  payment: { thanksTitle: 'תודה', thanksText: 'התשלום נשלח. אישור יישלח אליכם בדוא״ל.', home: 'חזרה לדף הבית' },
}

const dictionaries: Record<Locale, Dictionary> = { fr, en, he }

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale]
