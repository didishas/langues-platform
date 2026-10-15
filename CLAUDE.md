# Plateforme cours de langues — instructions pour Claude

Plateforme de cours de langues (hébreu, anglais, espagnol, français, roumain) pour une professeure indépendante en Belgique.
Elle n'est pas développeuse : tout ce qu'elle doit modifier passe par le CMS, jamais par le code.
Référence fonctionnelle : le cahier des charges « Plateforme cours de langues — Cahier des charges ».

## Stack

- Next.js (App Router, TypeScript strict)
- Payload CMS intégré à Next.js
- Supabase : Postgres, authentification, stockage de fichiers
- Visio : LiveKit (ou Jitsi auto-hébergé), intégrée au site, pas de logiciel à installer pour l'élève
- Vidéos de cours : Bunny Stream
- Paiements phase 1 : Mollie (Bancontact, carte, SEPA)
- Mails transactionnels : Resend ou Brevo

## Règles non négociables

1. **RTL partout.** L'hébreu s'écrit de droite à gauche. Toute page, composant, exercice, PDF et e-mail doit fonctionner en RTL.
   - Utiliser les propriétés CSS logiques (`margin-inline-start`, `padding-inline-end`, `text-align: start`), jamais `left`/`right` en dur.
   - `dir` est défini à partir de la langue du contenu, pas de la langue de l'interface.
   - Tout nouveau composant est vérifié en `dir="rtl"` avant d'être considéré comme terminé.
2. **Facturation abstraite.** Le site enregistre des *prestations* (séance, forfait, abonnement), jamais des factures en direct.
   - Toute facturation passe par l'interface `BillingProvider`.
   - `DirectProvider` (phase 1, indépendante) : numérotation propre, paiement Mollie ou virement avec communication structurée, PDF pour les particuliers, Peppol pour les clients entreprises.
   - `SmartProvider` (phase 2, via Smart) : prépare les demandes de facture pour Smart, suit les statuts par rapprochement ; les paiements en ligne sont désactivés.
   - Le fournisseur actif et la date de bascule sont un réglage, pas une branche de code.
   - Aucun code métier hors de `billing/` ne connaît Mollie ou Smart.
   - Les factures de la phase 1 restent consultables et exportables après la bascule.
3. **Rien ne part sans elle.** Aucun e-mail, aucune facture, aucune relance n'est envoyé automatiquement par un agent : tout passe par une file de validation.
4. **Tout ce qu'elle modifie est éditable dans le CMS** : textes, tarifs, langues, niveaux, vidéos, exercices, FAQ. Si une donnée de contenu est en dur dans le code, c'est un bug.
5. **RGPD.** Consentement explicite avant d'enregistrer une séance, accord parental pour les élèves mineurs, suppression des données d'un élève sur demande.

## Modèle de contenu

- Chaque langue est structurée par niveaux CECRL (A1 à C2) ; contenus, exercices et progression s'y rattachent.
- Une vidéo de cours peut avoir zéro ou un bloc d'exercices (QCM, texte à trous, association, réponse audio). Le bloc est optionnel et géré dans le CMS.
- Les exercices corrigeables sont corrigés automatiquement ; les réponses libres et audio attendent sa correction.
- Un clavier virtuel hébreu est disponible dans les exercices.

## Espaces et dashboards

- Espace élève : devoirs, TP, échéances, corrections, documents partagés, enregistrements de séances, messagerie avec la prof.
- Dashboard prof : revenus par mois et par langue, heures données vs prévues, remplissage des créneaux, élèves actifs/nouveaux/perdus, impayés, devoirs à corriger, réserve impôts et cotisations (phase 1).
- Progression élève : radar des 6 compétences, courbe de niveau CECRL, assiduité, vocabulaire acquis.

## Conventions

- Interface du site : français, anglais, hébreu au minimum (i18n via fichiers de traduction, pas de texte en dur).
- Montants en euros, stockés en centimes (entiers).
- Dates stockées en UTC, affichées en Europe/Brussels.
- Tests : chaque `BillingProvider` a ses tests ; chaque composant d'exercice a un test en RTL.
- Les secrets ne vont jamais dans le dépôt.

## Ce qui n'est pas dans ce dépôt

Le tuteur des enfants est une application séparée (dépôt `kids-tutor`), locale, sans aucun lien de données avec cette plateforme.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
