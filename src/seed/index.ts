/**
 * Contenu de départ, repris des idées du pitch MotàMot et réécrit.
 * Tout est modifiable ensuite dans le CMS ; les éléments à confirmer sont marqués « À CONFIRMER ».
 *
 * Lancer : pnpm seed
 * Idempotent : relancer met à jour sans dupliquer (clé = code de langue ou titre français).
 */
import 'dotenv/config'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

type L = { fr: string; en: string; he: string }

const LANGUAGES: { code: 'he' | 'en' | 'es' | 'fr' | 'ro'; order: number; nativeName: string; sample: string; name: L; summary: L }[] = [
  {
    code: 'he',
    order: 1,
    nativeName: 'עברית',
    sample: 'שלום, נעים מאוד להכיר',
    name: { fr: 'Hébreu', en: 'Hebrew', he: 'עברית' },
    summary: {
      fr: 'Pour débutants : lire, écrire et parler, en commençant par l’alphabet.',
      en: 'For beginners: reading, writing and speaking, starting with the alphabet.',
      he: 'למתחילים: קריאה, כתיבה ודיבור, החל מהאלף־בית.',
    },
  },
  {
    code: 'en',
    order: 2,
    nativeName: 'English',
    sample: 'Nice to meet you',
    name: { fr: 'Anglais', en: 'English', he: 'אנגלית' },
    summary: {
      fr: 'Prononciation et accent, du niveau débutant à intermédiaire. Aide aux devoirs pour les enfants.',
      en: 'Pronunciation and accent, from beginner to intermediate. Homework help for children.',
      he: 'הגייה ומבטא, ממתחילים ועד בינוניים. עזרה בשיעורי בית לילדים.',
    },
  },
  {
    code: 'es',
    order: 3,
    nativeName: 'Español',
    sample: 'Encantada de conocerte',
    name: { fr: 'Espagnol', en: 'Spanish', he: 'ספרדית' },
    summary: {
      fr: 'Lire plus facilement et enrichir son vocabulaire.',
      en: 'Read with more ease and build your vocabulary.',
      he: 'לקרוא בקלות רבה יותר ולהעשיר את אוצר המילים.',
    },
  },
  {
    code: 'fr',
    order: 4,
    nativeName: 'Français',
    sample: 'Ravie de vous rencontrer',
    name: { fr: 'Français', en: 'French', he: 'צרפתית' },
    summary: {
      fr: 'Débutants et intermédiaires : parler, comprendre et écrire au quotidien.',
      en: 'Beginners and intermediate: speaking, understanding and writing for everyday life.',
      he: 'מתחילים ובינוניים: לדבר, להבין ולכתוב ביום־יום.',
    },
  },
  {
    code: 'ro',
    order: 5,
    nativeName: 'Română',
    sample: 'Încântată de cunoștință',
    name: { fr: 'Roumain', en: 'Romanian', he: 'רומנית' },
    summary: {
      fr: 'Du premier mot à la conversation courante.',
      en: 'From the first word to everyday conversation.',
      he: 'מהמילה הראשונה ועד שיחה יומיומית.',
    },
  },
]

const NON_HEBREW = ['en', 'es', 'fr', 'ro'] as const

/** Tarifs repris du pitch (cours de 1 h 30). À CONFIRMER par Catherine avant mise en ligne. */
const OFFERS: {
  title: L
  kind: 'single' | 'pack' | 'subscription' | 'per_unit'
  format: 'individual' | 'group' | 'parent_child'
  durationMinutes?: number
  price: number
  languages: readonly string[]
  published: boolean
  order: number
  unitLabel?: L
  description?: L
}[] = [
  {
    title: { fr: 'Cours individuel', en: 'One-to-one lesson', he: 'שיעור פרטי' },
    kind: 'single',
    format: 'individual',
    durationMinutes: 90,
    price: 30,
    languages: NON_HEBREW,
    published: true,
    order: 1,
  },
  {
    title: { fr: 'Cours individuel d’hébreu', en: 'One-to-one Hebrew lesson', he: 'שיעור פרטי בעברית' },
    kind: 'single',
    format: 'individual',
    durationMinutes: 90,
    price: 35,
    languages: ['he'],
    published: true,
    order: 2,
  },
  {
    title: { fr: 'Cours en groupe, une fois par semaine', en: 'Group lesson, once a week', he: 'שיעור קבוצתי, פעם בשבוע' },
    kind: 'single',
    format: 'group',
    durationMinutes: 90,
    price: 25,
    languages: NON_HEBREW,
    published: true,
    order: 3,
  },
  {
    title: { fr: 'Cours d’hébreu en groupe', en: 'Hebrew group lesson', he: 'שיעור עברית בקבוצה' },
    kind: 'single',
    format: 'group',
    durationMinutes: 90,
    price: 30,
    languages: ['he'],
    published: true,
    order: 4,
  },
  {
    title: { fr: 'Groupe, paiement au mois', en: 'Group, paid monthly', he: 'קבוצה, תשלום חודשי' },
    kind: 'subscription',
    format: 'group',
    durationMinutes: 90,
    price: 80,
    languages: NON_HEBREW,
    published: true,
    order: 5,
    description: {
      fr: 'Le cours hebdomadaire en groupe, réglé une fois par mois.',
      en: 'The weekly group lesson, paid once a month.',
      he: 'השיעור הקבוצתי השבועי, בתשלום פעם בחודש.',
    },
  },
  {
    title: { fr: 'Aide aux devoirs d’anglais', en: 'English homework help', he: 'עזרה בשיעורי בית באנגלית' },
    kind: 'per_unit',
    format: 'individual',
    price: 0,
    languages: ['en'],
    published: false,
    order: 6,
    unitLabel: { fr: 'page', en: 'page', he: 'עמוד' },
    description: {
      fr: 'À CONFIRMER : prix par page, puis cocher « Visible sur le site ».',
      en: '',
      he: '',
    },
  },
  {
    title: { fr: 'Atelier parent + enfant', en: 'Parent + child workshop', he: 'סדנת הורה וילד' },
    kind: 'single',
    format: 'parent_child',
    durationMinutes: 90,
    price: 0,
    languages: [],
    published: false,
    order: 7,
    description: {
      fr: 'À CONFIRMER : durée et prix, puis cocher « Visible sur le site ».',
      en: '',
      he: '',
    },
  },
]

const DISCOUNTS: { title: L; type: 'extra_session' | 'family'; percent: number; description: L; order: number }[] = [
  {
    title: { fr: 'Deuxième cours à moitié prix', en: 'Second lesson at half price', he: 'שיעור שני בחצי מחיר' },
    type: 'extra_session',
    percent: 50,
    description: {
      fr: 'Pour un deuxième cours suivi en parallèle.',
      en: 'For a second lesson taken alongside the first.',
      he: 'לשיעור שני במקביל לראשון.',
    },
    order: 1,
  },
  {
    title: { fr: 'Accompagnement de votre enfant à moitié prix', en: 'Half price for your child', he: 'חצי מחיר לילד/ה שלכם' },
    type: 'family',
    percent: 50,
    description: {
      fr: 'Si vous suivez déjà des cours, l’accompagnement de votre enfant est à moitié prix.',
      en: 'If you already take lessons, support for your child is half price.',
      he: 'אם אתם כבר לומדים אצלי, הליווי לילד/ה שלכם בחצי מחיר.',
    },
    order: 2,
  },
]

const SITE: Record<'fr' | 'en' | 'he', Record<string, unknown>> = {
  fr: {
    siteName: 'MotàMot',
    teacherName: 'Catherine',
    tagline: 'Cours de langues en visio, en individuel ou en groupe',
    heroTitle: 'Tout le monde peut devenir polyglotte',
    heroText:
      'Hébreu, anglais, espagnol, français et roumain. Pour découvrir une nouvelle langue ou perfectionner celle que vous parlez déjà, sans peur de vous lancer.',
    faq: [
      {
        question: 'Où ont lieu les cours ?',
        answer: 'En visio, depuis votre espace élève. Il n’y a rien à installer.',
      },
      {
        question: 'Les supports de cours sont-ils compris ?',
        answer: 'Oui, les supports sont inclus dans toutes les formules.',
      },
      {
        question: 'Et entre deux cours ?',
        answer: 'Vous recevez des devoirs et un suivi personnalisé, et vous pouvez poser vos questions à tout moment.',
      },
      {
        question: 'Proposez-vous des cours pour les enfants ?',
        answer: 'Oui : de l’aide aux devoirs d’anglais et des ateliers à faire en duo, parent et enfant.',
      },
    ],
    privacyText:
      'Les informations envoyées par le formulaire (nom, e-mail, téléphone, message) servent uniquement à vous recontacter au sujet de votre demande de cours. Elles ne sont ni vendues ni transmises à des tiers.\n\nVous pouvez demander à consulter, corriger ou supprimer vos données à tout moment en écrivant à l’adresse de contact du site.',
  },
  en: {
    tagline: 'Online language lessons, one-to-one or in a group',
    heroTitle: 'Anyone can become multilingual',
    heroText:
      'Hebrew, English, Spanish, French and Romanian. Discover a new language or polish one you already speak, without the fear of getting started.',
    faq: [
      { question: 'Where do lessons take place?', answer: 'Online, from your student space. Nothing to install.' },
      { question: 'Are course materials included?', answer: 'Yes, materials are included in every course.' },
      {
        question: 'What happens between lessons?',
        answer: 'You get homework and personal follow-up, and you can ask questions at any time.',
      },
      {
        question: 'Do you teach children?',
        answer: 'Yes: English homework help and workshops for a parent and child together.',
      },
    ],
    privacyText:
      'The details sent through the form (name, email, phone, message) are only used to contact you about your lesson request. They are never sold or shared.\n\nYou can ask to see, correct or delete your data at any time by writing to the site’s contact address.',
  },
  he: {
    tagline: 'שיעורי שפה בווידאו, פרטיים או בקבוצה',
    heroTitle: 'כל אחד יכול לדבר כמה שפות',
    heroText:
      'עברית, אנגלית, ספרדית, צרפתית ורומנית. להכיר שפה חדשה או לשפר שפה שכבר מדברים, בלי פחד להתחיל.',
    faq: [
      { question: 'איפה מתקיימים השיעורים?', answer: 'בווידאו, מהאזור האישי. אין צורך להתקין דבר.' },
      { question: 'האם חומרי הלימוד כלולים?', answer: 'כן, חומרי הלימוד כלולים בכל המסלולים.' },
      { question: 'ומה בין השיעורים?', answer: 'שיעורי בית ומעקב אישי, ואפשר לשאול שאלות בכל עת.' },
      { question: 'יש שיעורים לילדים?', answer: 'כן: עזרה בשיעורי בית באנגלית וסדנאות להורה וילד יחד.' },
    ],
    privacyText:
      'הפרטים שנשלחים בטופס (שם, דוא״ל, טלפון, הודעה) משמשים רק ליצירת קשר בנוגע לבקשת השיעור. הם אינם נמכרים ואינם מועברים לאחרים.\n\nאפשר לבקש לעיין בנתונים, לתקן או למחוק אותם בכל עת בכתיבה לכתובת יצירת הקשר של האתר.',
  },
}

async function upsert(payload: Payload, collection: 'languages' | 'offers' | 'discounts', where: object, data: L | any) {
  const found = await payload.find({ collection, where: where as any, limit: 1, depth: 0, locale: 'fr' })
  if (found.docs[0]) {
    return payload.update({ collection, id: found.docs[0].id, data, locale: 'fr' })
  }
  return payload.create({ collection, data, locale: 'fr' })
}

async function seed() {
  const payload = await getPayload({ config: await config })

  const langIds: Record<string, number> = {}
  for (const l of LANGUAGES) {
    const doc = await upsert(payload, 'languages', { code: { equals: l.code } }, {
      code: l.code,
      order: l.order,
      nativeName: l.nativeName,
      sample: l.sample,
      name: l.name.fr,
      summary: l.summary.fr,
      published: true,
    })
    langIds[l.code] = doc.id as number
    for (const locale of ['en', 'he'] as const) {
      await payload.update({
        collection: 'languages',
        id: doc.id,
        locale,
        data: { name: l.name[locale], summary: l.summary[locale] },
      })
    }
  }

  for (const o of OFFERS) {
    const doc = await upsert(payload, 'offers', { title: { equals: o.title.fr } }, {
      title: o.title.fr,
      kind: o.kind,
      format: o.format,
      durationMinutes: o.durationMinutes,
      price: o.price,
      languages: o.languages.map((c) => langIds[c]),
      published: o.published,
      order: o.order,
      unitLabel: o.unitLabel?.fr,
      description: o.description?.fr,
      resourcesIncluded: true,
    })
    for (const locale of ['en', 'he'] as const) {
      await payload.update({
        collection: 'offers',
        id: doc.id,
        locale,
        data: {
          title: o.title[locale],
          unitLabel: o.unitLabel?.[locale],
          description: o.description?.[locale] || undefined,
        },
      })
    }
  }

  for (const d of DISCOUNTS) {
    const doc = await upsert(payload, 'discounts', { title: { equals: d.title.fr } }, {
      title: d.title.fr,
      type: d.type,
      percent: d.percent,
      description: d.description.fr,
      order: d.order,
      published: true,
    })
    for (const locale of ['en', 'he'] as const) {
      await payload.update({
        collection: 'discounts',
        id: doc.id,
        locale,
        data: { title: d.title[locale], description: d.description[locale] },
      })
    }
  }

  await payload.updateGlobal({ slug: 'site-settings', locale: 'fr', data: SITE.fr as any })
  await payload.updateGlobal({ slug: 'site-settings', locale: 'en', data: SITE.en as any })
  await payload.updateGlobal({ slug: 'site-settings', locale: 'he', data: SITE.he as any })

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (email && password) {
    const existing = await payload.count({ collection: 'users', where: { email: { equals: email } } })
    if (existing.totalDocs === 0) {
      await payload.create({ collection: 'users', data: { email, password, name: 'Catherine', role: 'teacher' } })
    }
  }

  payload.logger.info('Contenu de départ en place.')
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
