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
- les documents partagés avec lui et ses factures validées ;
- la vidéothèque (voir ci-dessous).

Les fichiers sont privés : ils ne s'ouvrent que pour l'élève concerné et l'équipe. En local ils sont rangés dans `uploads/` (hors dépôt) ; en production il faudra un stockage objet (Supabase Storage ou S3).

## Vidéothèque et exercices

Dans l'administration, Élèves > Vidéothèque : Catherine envoie une vidéo (MP4 ou WebM, 500 Mo au plus), choisit la langue, le niveau
et qui la voit (les élèves de cette langue, tous les élèves ou des élèves choisis), puis ajoute si elle veut des exercices :
QCM, texte à trous (mots à trouver entre crochets, variantes séparées par `|`), paires à associer, réponse orale.
Une vidéo n'apparaît qu'une fois cochée « Visible par les élèves ».

- La correction se fait sur le serveur : les bonnes réponses ne sont jamais envoyées au navigateur avant la réponse de l'élève.
  Majuscules, espaces, ponctuation finale et voyelles hébraïques sont ignorés ; les accents comptent.
- Les exercices s'affichent dans le sens de la langue de la vidéo (hébreu de droite à gauche), avec un clavier hébreu à l'écran
  (lettres dans l'ordre de l'alphabet) pour les textes à trous.
- Les réponses orales arrivent dans Élèves > Réponses aux exercices, état « À écouter », et sont comptées dans le « À faire » du tableau de bord.
- Le fichier vidéo est privé, servi seulement aux élèves qui ont le droit de voir la vidéo.

## Tableau de bord de Catherine

En tête de l'accueil de l'administration, dans la langue choisie pour l'administration (français, anglais, hébreu) :
encaissé ce mois-ci et par mois, à encaisser, factures en retard, réserve impôts et cotisations (seulement si un pourcentage
est saisi dans les réglages de facturation, à fixer avec le comptable), montant par langue, heures données et remplissage,
élèves actifs, nouveaux et à relancer, devoirs à corriger, réponses orales à écouter et demandes de cours d'essai. Chaque chiffre affiche sa définition.

## Fuseaux horaires

Catherine donne cours à l'heure de Bruxelles. Un élève qui vit ailleurs voit ses séances et ses échéances à son heure, puis à celle
de Bruxelles (« jeudi 22 octobre 2026 à 19:00 (heure d'Israël) · Bruxelles : 18:00 »). Son fuseau est retenu à sa première connexion ;
ensuite seule Catherine le change, dans la fiche de l'élève. Factures et documents restent datés à l'heure de Bruxelles.

## Données personnelles (RGPD)

Dans la fiche d'un élève, Catherine seule voit deux boutons :

- **Exporter ses données** : un ZIP avec `donnees.json` (fiche, séances, devoirs rendus, réponses aux exercices, prestations, factures, demandes d'essai) et les fichiers envoyés par l'élève. Jamais de mot de passe ni de session.
- **Effacer ses données** : après avoir retapé l'e-mail de l'élève (vérifié par le serveur). Refusé tant qu'il reste une prestation non facturée ou une facture non payée. Efface devoirs rendus, réponses aux exercices et leurs fichiers, réservations à venir, demandes d'essai, devoirs et documents destinés à lui seul ; la fiche devient « Ancien élève n°X » sans donnée personnelle ni connexion possible. Gardés : factures (avec le client imprimé dessus) et séances passées, sans nom.

## E-mails : rien ne part sans Catherine

Le site prépare les messages dans Élèves > Messages à envoyer : e-mail de facture quand Catherine valide une facture
(facturation directe), confirmation quand une séance à venir passe à « confirmée ». Catherine peut aussi écrire un message
à un élève (ou à son responsable légal). Les textes se règlent dans Réglages > Modèles d'e-mails, en français, anglais et hébreu ;
l'élève reçoit sa langue.

Rien ne part avant le bouton « Valider et envoyer », réservé à Catherine. Le serveur vérifie au moment d'envoyer : que c'est
bien elle, que le message n'a pas changé depuis qu'elle l'a relu, que l'adresse est celle de la fiche de l'élève (jamais saisie
à la main), que la facture est toujours valide et du même montant, et qu'il ne part qu'une fois. Un message parti est gardé
tel quel ; un e-mail de facture en attente est annulé si la facture est payée ou annulée.

Envoi réel : `MAIL_TRANSPORT=smtp` et les variables `SMTP_*` / `MAIL_FROM` du service choisi par Catherine (SMTP standard).
En développement, les messages sont écrits dans `.mail-outbox/` au lieu de partir.

## Comptes de l'équipe

- **Professeure** (Catherine) : tous les droits.
- **Technique** (Didier, Siméon) : lit tout pour dépanner, mais ne valide, n'envoie, ne modifie ni ne supprime rien qui touche aux élèves ou à l'argent. Il peut corriger le contenu du site (langues, formules, réductions, images) et les réglages du site et des cours. Seule Catherine crée les comptes et choisit les rôles.

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

- RGPD : durées de conservation (factures, devoirs, enregistrements de voix) et textes (politique de confidentialité, consentements) à valider ; aujourd'hui rien n'est effacé automatiquement.
- Migrations de base de données pour la production (aujourd'hui, schéma aligné automatiquement en développement).
- Stockage des fichiers hors du serveur (stockage objet). Indispensable pour les vidéos : sur le serveur du site, chaque vidéo passe par la mémoire du serveur à l'envoi et occupe son disque.
- Service d'envoi d'e-mails au nom de Catherine (SMTP), adresse d'expédition et domaine vérifiés (SPF/DKIM).
- Facture en PDF jointe à l'e-mail (aujourd'hui : détails dans le message et facture visible dans l'espace élève).
- Consentement des élèves à l'enregistrement de leur voix (réponses orales) et durée de conservation de ces enregistrements.
