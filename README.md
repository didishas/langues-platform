# langues-platform

Site de MotàMot, les cours de langues de Catherine (hébreu, anglais, espagnol, français, roumain) : site public en français, anglais et hébreu, CMS, élèves, créneaux et réservations, demandes de cours d'essai, prestations et facturation.

Les règles de développement sont dans [`CLAUDE.md`](CLAUDE.md).

## Stack

Next.js 16 (App Router, TypeScript strict) · Payload CMS 3 · PostgreSQL · police Rubik auto-hébergée (latin + hébreu)

## Démarrer en local

Il faut Node 20+, pnpm et Docker (ou un Postgres déjà installé).

```bash
cp .env.example .env              # puis remplacer PAYLOAD_SECRET par une longue chaîne aléatoire
docker compose up -d              # base Postgres locale
pnpm install
SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… pnpm seed   # contenu de départ + compte de Catherine
pnpm dev
```

- Site : http://localhost:3000 (redirige vers `/fr`, aussi `/en` et `/he`)
- Administration : http://localhost:3000/admin
- Espace élève : http://localhost:3000/fr/espace

Pour essayer l'espace élève : `pnpm seed:demo` crée l'élève `demo.eleve@motamot.test` (mot de passe `demo-eleve-2026`) avec deux devoirs, un document, une séance confirmée et une facture.

## Espace élève

Catherine crée le compte de l'élève dans l'administration (Élèves), avec un mot de passe qu'elle lui transmet. L'élève y retrouve :

- ses prochaines séances, avec le bouton « Rejoindre sur Zoom » ou « Rejoindre sur Google Meet » une fois la réservation confirmée. Catherine enregistre ses liens habituels dans Agenda > Réglages des cours ; ils se remplissent tout seuls sur chaque créneau, et restent modifiables au cas par cas ;
- ses devoirs et TP publiés, qu'il rend avec un texte et des fichiers (5 fichiers de 10 Mo au plus) ; une remise ne se modifie que si Catherine la renvoie « à refaire » ;
- les documents partagés avec lui et ses factures validées.

Les fichiers sont privés : ils ne s'ouvrent que pour l'élève concerné et l'équipe. En local ils sont rangés dans `uploads/` (hors dépôt) ; en production il faudra un stockage objet (Supabase Storage ou S3).

## Tableau de bord de Catherine

En tête de l'accueil de l'administration, dans la langue choisie pour l'administration (français, anglais, hébreu) :
encaissé ce mois-ci et par mois, à encaisser, factures en retard, réserve impôts et cotisations (seulement si un pourcentage
est saisi dans les réglages de facturation, à fixer avec le comptable), montant par langue, heures données et remplissage,
élèves actifs, nouveaux et à relancer, devoirs à corriger et demandes de cours d'essai. Chaque chiffre affiche sa définition.

## Tests

```bash
pnpm typecheck
pnpm lint
pnpm test:int    # unitaires + intégration sur Postgres (TEST_DATABASE_URL, base *_test vidée à chaque lancement)
pnpm test:e2e    # parcours dans un navigateur, sur le serveur et la base de dev (après pnpm seed)
pnpm build
```

Les tests d'intégration couvrent notamment les situations simultanées réelles sur Postgres : dernière place d'un cours, numéros de facture, double validation, notifications de paiement répétées, avec un faux serveur Mollie local. Pour `test:e2e`, installer le navigateur une fois avec `pnpm exec playwright install chromium`.

## Facturation

Tout passe par `src/billing/`. Le reste du code ne connaît ni Mollie ni Smart.

- Les **prestations** sont la source de vérité ; une facture se prépare à partir d'elles (`POST /api/invoices/prepare`).
- Une facture naît **à valider**, sans numéro. Le numéro continu (`F2026-0001`) et la communication structurée sont attribués **à la validation** ; une facture validée ne se supprime plus.
- **Réglages de facturation** dans le CMS : « Moi, comme indépendante » ou « Smart », avec une date de bascule. Avec Smart, pas de numéro propre ni de paiement en ligne ; export CSV des demandes via `GET /api/invoices/smart-export`.
- Paiement en ligne (phase 1) : variable `MOLLIE_API_KEY` + case « Paiement en ligne » dans le CMS. Chaque notification de Mollie est revérifiée chez Mollie (statut, montant, devise, référence) ; un paiement non conforme n'est jamais accepté et apparaît comme « Anomalie de paiement » sur la facture.

## À confirmer avant la mise en ligne

Le contenu de départ reprend le pitch MotàMot. Ces éléments restent à valider avec Catherine :

- les tarifs (repris du pitch) et la répartition des langues entre formules ;
- le prix par page de l'aide aux devoirs et le prix de l'atelier parent + enfant (formules masquées) ;
- le pourcentage de la réduction multi-langues (non créée) ;
- le texte « À propos » (section masquée tant qu'il est vide) ;
- les traductions anglaises et hébraïques ;
- le régime de TVA et la mention légale, avec le comptable.

## À faire avant l'ouverture aux vrais élèves

- Fuseaux horaires : afficher l'heure de Bruxelles explicitement, ou l'heure locale de l'élève (élèves en Israël, en Roumanie…).
- Droits du compte technique : le distinguer des droits de Catherine (aujourd'hui identiques).
- RGPD : export et suppression des données d'un élève, durée de conservation, textes validés.
- Migrations de base de données pour la production (aujourd'hui, schéma aligné automatiquement en développement).
- Stockage des fichiers hors du serveur (stockage objet) et envoi d'e-mails.
