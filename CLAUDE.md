# MotàMot — plateforme de cours de langues

Site et outil de travail de Catherine, professeure indépendante en Belgique : hébreu, anglais, espagnol, français, roumain. Interface en français, anglais, hébreu. Elle n'est pas développeuse : tout ce qu'elle gère passe par l'administration, jamais par le code.

Le cahier des charges (doc partagé « Plateforme cours de langues — Cahier des charges ») décrit la cible, pas l'existant. Ne développer que le périmètre demandé.

## Repères (vérifiés le 17/10/2026, vidéothèque comprise)

- `src/collections/`, `src/globals/` : modèle de données et règles d'accès Payload. `src/access/` : fonctions d'accès communes.
- `src/billing/` : facturation (seul endroit qui connaît Mollie ou Smart). `src/lib/dbLock.ts` : verrous Postgres.
- `src/app/(frontend)/[locale]/` : site public et espace élève (`espace/`). `src/i18n/` : langues, sens d'écriture, textes de l'interface.
- `src/exercises/` : exercices des vidéos. `core.ts` (pur) fabrique la version sans solution et corrige ; `service.ts` lit avec les droits de l'élève puis enregistre la réponse. Pages élève dans `espace/videos/`, composants dans `src/components/student/exercises/`.
- `src/lib/time.ts` : heures des séances à l'heure de l'élève puis de Bruxelles (champ `timeZone` de l'élève, retenu à la première connexion).
- `src/privacy/` : RGPD, export ZIP et effacement d'un élève (anonymisation de la fiche, factures conservées), points d'entrée `/api/students/:id/privacy-export` et `privacy-erase`, boutons dans `src/components/admin/StudentPrivacy.tsx`.
- `src/mail/` : e-mails. `outbox.ts` prépare les brouillons et fait l'envoi validé (`approveAndSend` : rôle, version, destinataire, montant, verrou) ; `transport.ts` est le seul endroit qui envoie (smtp, file, memory). Collection « Messages à envoyer » (`outbox`), modèles dans le global `email-templates` et `src/i18n/emailDefaults.ts`.
- `src/dashboard/` : calculs (fonctions pures, à l'heure de Bruxelles) et chargement du tableau de bord ; affichage dans `src/components/admin/TeacherDashboard.tsx`, styles dans `src/app/(payload)/custom.scss`.
- `src/seed/` : contenu de départ et élève de démonstration (avec un historique fictif marqué « Démo »). `tests/unit`, `tests/int` (Postgres), `tests/e2e` (Playwright).

Commandes (pnpm, lockfile présent) :

| Commande | État au 17/10/2026 |
| --- | --- |
| `docker compose up -d` | fichier fourni, non exécuté ici (Postgres installé directement) |
| `pnpm install`, `pnpm dev`, `pnpm seed`, `pnpm seed:demo` | OK |
| `pnpm typecheck` | OK |
| `pnpm lint` | OK, 0 erreur (avertissements `any` : tests et quelques fichiers de facturation et de seed) |
| `pnpm test:int` | OK : unitaires + intégration sur `TEST_DATABASE_URL` (base `*_test`, vidée à chaque lancement) |
| `pnpm test:e2e` | OK : serveur de dev + base de dev seedée ; navigateur via `pnpm exec playwright install chromium` ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE` |
| `pnpm build` | OK |

Variables : voir `.env.example`. Aucune valeur réelle dans le dépôt.

## Décisions prises

- Stack adoptée : Next.js 16 (App Router), Payload 3, PostgreSQL. **Pas de Supabase** : Payload possède comptes, droits et schéma.
- Deux types de comptes Payload : `users` (équipe) et `students` (élèves, sans accès à l'administration).
- Équipe : rôle « professeure » (Catherine) ou « technique ». Le compte technique lit tout mais ne fait rien partir (décision de Didier, 20/10/2026) : il n'écrit que dans langues, formules, réductions, images, réglages du site et des cours, et dans son propre compte (pas son rôle). Écritures ailleurs : `teacherOnly` / `isTeacher` (`src/access/`).
- Visio : Zoom ou Google Meet au choix par créneau, liens habituels dans « Réglages des cours ». Lien visible seulement pour une réservation confirmée. Salle intégrée (LiveKit) reportée, décision de Didier.
- Facturation : les prestations sont la source de vérité. Fournisseur `direct` (phase 1) ou `smart` (phase 2) par réglage et date de bascule. Une facture naît « à valider » et reçoit numéro et communication structurée à la validation.
- Identité : nom MotàMot, police Rubik, palette `#23225c` (encre), `#4a47c9` (indigo), `#f6c7ba` / `#fce6df` (pêche), `#a8492f` (texte corail), `#fff8f5` (fond).

Une décision qui change passe par Didier : mettre ce fichier à jour au lieu d'empiler une règle contraire.

## Règles non négociables

- **Hébreu** : `dir` d'après la langue du contenu, pas de l'interface ; propriétés CSS logiques seulement ; `dir="auto"` ou `<bdi>` pour les fragments mixtes (titres, références, nombres). Vérifier le rendu fr et he, mobile et ordinateur.
- **Rien ne part sans Catherine** : aucun e-mail, facture, relance, paiement ou modification de rendez-vous déclenché sans sa validation, vérifiée côté serveur (action, destinataire, contenu, montant, version approuvée).
- **Contenu éditable** : tout texte, tarif ou réglage qu'elle peut vouloir changer vit dans le CMS ou dans `src/i18n/`.
- **Accès** : identité et droit contrôlés côté serveur sur chaque ressource (pages, actions, API, fichiers). Lire « en tant que » l'élève avec `overrideAccess: false`. Tout contournement (`overrideAccess: true`) est justifié en commentaire et limité aux données de cet élève.
- **Fichiers privés** : documents et devoirs rendus jamais publics ; types et tailles limités.
- **Argent** : centimes entiers. Ne jamais confirmer un paiement depuis l'URL de retour : relire chez le prestataire, vérifier statut, montant, devise et référence. Notifications idempotentes. Pas d'API Smart inventée : export CSV tant qu'aucune intégration officielle n'est confirmée.
- **Réglementaire** : TVA, mentions, Peppol, modalités Smart et règles RGPD sont à valider (comptable, Smart) avant production ; les valeurs du cahier des charges ne sont pas des constantes approuvées.
- **Données** : jamais de secrets, de données d'élèves réelles ni d'enregistrements dans le dépôt, les logs, les captures ou les prompts. Données fictives et modes test seulement.

## Pièges connus

- Toute règle « vérifier puis écrire » soumise à concurrence (places, numéros, paiements) passe par `lockInTransaction` dans la transaction de la requête, puis relit les données. Chaque cas a un test de concurrence répété (`Promise.allSettled` sur Postgres).
- En développement, Payload aligne le schéma automatiquement et **attend une confirmation interactive** si un changement peut perdre des données : un script qui semble bloqué au démarrage attend cela. Vider la base de dev ou répondre. La production devra utiliser des migrations (`pnpm payload migrate:create`), pas encore en place.
- Les numéros de facture sont partagés entre fichiers de tests : écrire les attentes relativement au compteur.
- Payload renomme un fichier déjà existant (`copie-1.pdf`).
- Payload reconnaît un enregistrement audio WebM du navigateur comme `video/webm` : il est accepté dans `submission-files` pour cette raison.
- Exercices : toute donnée de solution (bonne réponse, texte à trous, paires, explication) a un droit de lecture réservé à l'équipe et ne sort que par `toPublicExercise`. Le test e2e vérifie la page complète envoyée à l'élève.
- Renommer un champ en développement déclenche la question interactive de Payload (renommé ou nouveau ?) : renommer la colonne en SQL dans la base de dev, ou vider la table.
- Effacement RGPD : toute nouvelle collection qui contient des données d'élève doit être ajoutée à `collect()` dans `src/privacy/service.ts` et au test `tests/int/privacy.int.spec.ts`.
- Tout nouvel e-mail passe par un brouillon `outbox` puis `approveAndSend` : jamais d'appel direct à `sendMail`. Les tests tournent avec `MAIL_TRANSPORT=memory`.
- Une réservation confirmée ou une facture validée crée un brouillon d'e-mail qui référence l'élève : un test qui supprime son élève doit d'abord supprimer ces messages.
- L'administration affiche les lignes d'un tableau imbriqué au défilement : une capture prise trop tôt les montre vides.
- Next.js 16 : consulter `node_modules/next/dist/docs/` avant d'utiliser une API.

## Manière de travailler

- Répondre en français, court et concret. Pour un changement important : plan et critères de réussite d'abord.
- Une tranche fonctionnelle à la fois ; réutiliser l'existant ; pas d'abstraction sans besoin établi.
- Poser seulement les questions qui changent le résultat ; signaler toute contradiction touchant données, coûts, droits ou comportement métier.
- Ne pas réécrire l'historique Git, supprimer des données, lancer une migration destructive, déployer ou souscrire un service payant sans accord explicite de Didier.
- Comptes des services au nom de Catherine ; accès technique séparé et limité.

## Vérification et livraison

- Lancer réellement typecheck, lint, tests et build pertinents ; ne jamais désactiver une protection pour obtenir du vert.
- Bug corrigé = test qui le reproduit (vu échouer avant, passer après). Cas négatifs pour accès, paiements, réservations.
- Changement visuel : regarder le rendu (fr et he, mobile et ordinateur) ou dire que ce n'est pas fait.
- Conclure par : livré, contrôles exécutés et résultats, limites. Distinguer « implémenté », « testé localement », « déployé ».

## Hors de ce dépôt

Le tuteur des enfants (dépôt `kids-tutor`) est une application locale séparée, sans compte ni donnée partagés avec cette plateforme. Suivi des tâches : README et outils de suivi, pas ce fichier.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
