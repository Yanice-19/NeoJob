# Neo Job

Site d'offres d'emploi : consultation des annonces, candidature (avec CV), comptes utilisateurs et back office d'administration.
Projet Epitech Pré-MSc 2026-2027, réalisé en binôme par **Yanice Eloundi** et **Jacob Essomba**.

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Technologies](#technologies)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Lancement](#lancement)
6. [Comptes de test](#comptes-de-test)
7. [Structure du projet](#structure-du-projet)
8. [Base de données](#base-de-données-sqlite)
9. [API REST](#api-rest)
10. [Pages](#pages)
11. [Sécurité](#sécurité)
12. [Tester le projet](#tester-le-projet)
13. [Choix techniques](#choix-techniques)
14. [Limites connues et améliorations](#limites-connues-et-améliorations)
15. [Répartition du travail](#répartition-du-travail)
16. [Documentation de l'usage de l'IA](#documentation-de-lusage-de-lia)

## Fonctionnalités

**Visiteur (non connecté)**

-   Liste des annonces avec filtres, détails (« Learn more ») sans rechargement de page
-   Formulaire de candidature (« Apply ») avec envoi du CV en fichier
-   Création de compte et connexion

**Utilisateur connecté**

-   Formulaire de candidature pré-rempli avec ses informations
-   Page « Mon compte » : modification du nom, de l'email, du téléphone et du mot de passe
-   Déconnexion

**Administrateur**

-   Back office : liste, création, modification et suppression sur toutes les tables (annonces, entreprises, catégories, personnes, candidatures), avec pagination
-   Accès au CV déposé par chaque candidat

**Site**

-   Design responsive (ordinateur, tablette, mobile) et footer commun à toutes les pages

## Technologies

| Rôle            | Outil                                   |
| --------------- | --------------------------------------- |
| Serveur         | Node.js 22 + Express                    |
| Base de données | SQLite via `better-sqlite3`             |
| Mots de passe   | `bcryptjs`                              |
| Connexion       | `express-session` (cookie de session)   |
| Envoi de CV     | `multer`                                |
| Front           | HTML, CSS, JavaScript natif + `fetch()` |

## Installation

Prérequis : Node.js 22 ou plus, et la ligne de commande `sqlite3`.

```bash
git clone <url-du-repository>
cd jobboard
npm install
sqlite3 jobboard.db < database.sql
```

La commande `sqlite3` crée la base `jobboard.db` avec les tables et des données de test.
Attention : `database.sql` commence par des `DROP TABLE`, il remet la base à zéro.

Le dossier `public/uploads/` reçoit les CV envoyés. Il est créé automatiquement s'il manque ; sinon : `mkdir -p public/uploads`.

## Configuration

| Variable         | Rôle                                  | Valeur par défaut                                     |
| ---------------- | ------------------------------------- | ----------------------------------------------------- |
| `SESSION_SECRET` | Secret qui signe le cookie de session | `jobboard-secret-a-changer` (à changer en production) |

Exemple : `SESSION_SECRET="une-longue-phrase-secrete" node server.js`

Le serveur écoute sur le port **3000**.

## Lancement

```bash
node server.js
```

Ouvrir ensuite http://localhost:3000 (et non le port de Live Server : le site et l'API doivent venir du même serveur).

### Créer un administrateur

1. Créer un compte sur http://localhost:3000/register.html
2. Le promouvoir :

```bash
sqlite3 jobboard.db "UPDATE people SET role='admin' WHERE email='votre@email.com';"
```

3. Se déconnecter puis se reconnecter : la connexion redirige vers `/admin.html`.

## Comptes de test

| Rôle           | Email              | Mot de passe |
| -------------- | ------------------ | ------------ |
| Administrateur | `admin@neojob.com` | `Admin1234`  |
| Utilisateur    | `user@neojob.com`  | `User1234`   |

Si ces comptes n'existent pas sur votre base, suivre « Créer un administrateur » ci-dessus.

## Structure du projet

```
jobboard/
├── server.js          Serveur Express : toutes les routes de l'API (doit rester à la racine)
├── database.sql       Création des tables + données de test
├── jobboard.db        Base SQLite (générée par database.sql)
├── package.json       Dépendances et infos du projet
├── README.md          Ce fichier
├── AI_USAGE.md        Documentation de l'usage de l'IA
└── public/            Fichiers servis au navigateur
    ├── index.html     Liste des annonces, détails, candidature
    ├── login.html     Connexion
    ├── register.html  Création de compte
    ├── account.html   Mon compte
    ├── admin.html     Back office
    ├── style.css      Feuille de style commune (responsive + footer)
    ├── logo.svg, favicon.svg
    └── uploads/       CV envoyés par les candidats
```

## Base de données (SQLite)

| Table          | Champs                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `companies`    | `id`, `name`                                                                                                             |
| `categories`   | `id`, `name`                                                                                                             |
| `ads`          | `id`, `title`, `description`, `company_id` → companies, `category_id` → categories, `salary`, `location`, `working_time` |
| `people`       | `id`, `name`, `email` (unique), `phone`, `password_hash`, `role` (`user` par défaut, ou `admin`)                         |
| `applications` | `id`, `person_id` → people, `ad_id` → ads, `message`, `applied_at`, `cv_url` (chemin du CV envoyé)                       |

Relations :

```
companies 1 ──< ads >── 1 categories
people    1 ──< applications >── 1 ads
```

-   Une entreprise et une catégorie ont plusieurs annonces.
-   Une annonce reçoit plusieurs candidatures ; une personne peut en déposer plusieurs.
-   Les clés étrangères sont activées : on ne peut pas supprimer une entreprise qui a encore des annonces (409).

## API REST

Format JSON. Erreurs : `{ "error": "message" }`.
Codes : 200, 201 (créé), 400 (donnée manquante ou invalide), 401 (non connecté), 403 (pas admin), 404, 409 (conflit), 500 (erreur serveur).
Listes paginées : `?page=1&limit=10` renvoie `{ "data": [...], "page": 1, "limit": 10, "total": 42 }`.

### Routes publiques

| Verbe | Route                                                | Description                                                                                    |
| ----- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET   | `/ads`                                               | Liste des annonces                                                                             |
| GET   | `/ads/:id`                                           | Une annonce, avec `company_name` et `category_name`                                            |
| POST  | `/ads/:id/applications`                              | Postuler (`name`, `email`, `phone`, `message`, `cv` = fichier, envoi en `multipart/form-data`) |
| GET   | `/companies`, `/companies/:id`, `/companies/:id/ads` | Entreprises et leurs annonces                                                                  |
| GET   | `/categories`, `/categories/:id`                     | Catégories                                                                                     |
| GET   | `/locations`                                         | Villes disponibles (pour le filtre)                                                            |

### Authentification

| Verbe | Route            | Description                      |
| ----- | ---------------- | -------------------------------- |
| POST  | `/auth/register` | Créer un compte                  |
| POST  | `/auth/login`    | Se connecter                     |
| POST  | `/auth/logout`   | Se déconnecter                   |
| GET   | `/auth/me`       | Utilisateur connecté (401 sinon) |
| PUT   | `/auth/me`       | Modifier son compte              |

### Routes administrateur (connexion + rôle `admin`)

| Verbe                  | Route                                | Description                                               |
| ---------------------- | ------------------------------------ | --------------------------------------------------------- |
| POST, PUT, DELETE      | `/ads`, `/ads/:id`                   | Créer, modifier, supprimer une annonce                    |
| POST, PUT, DELETE      | `/companies`, `/companies/:id`       | Idem pour les entreprises (409 si elle a des annonces)    |
| POST, PUT, DELETE      | `/categories`, `/categories/:id`     | Idem pour les catégories                                  |
| GET, POST, PUT, DELETE | `/people`, `/people/:id`             | Gestion des personnes (jamais de `password_hash` renvoyé) |
| GET, POST, PUT, DELETE | `/applications`, `/applications/:id` | Gestion des candidatures                                  |

Toute route qui n'est ni publique ni dans `/auth` est refusée par défaut à un non-admin : c'est un filtre global dans `server.js`, pas seulement un contrôle route par route.

## Pages

| Page             | Rôle                                         |
| ---------------- | -------------------------------------------- |
| `/`              | Liste des annonces, détails, candidature     |
| `/login.html`    | Connexion (admin → `/admin.html`, sinon `/`) |
| `/register.html` | Création de compte                           |
| `/account.html`  | Modifier son compte                          |
| `/admin.html`    | Back office (admin uniquement)               |

## Sécurité

**Authentification**

-   Mots de passe hachés avec **bcrypt** (`bcryptjs`, sel automatique, coût 10) : jamais stockés ni renvoyés en clair.
-   Connexion par **session** : après `/auth/login`, le serveur garde l'utilisateur en mémoire et envoie un cookie `connect.sid` au navigateur, qui le renvoie à chaque requête. Le cookie est signé avec `SESSION_SECRET`.
-   Pas de jeton lisible en JavaScript côté navigateur.

**Autorisation**

-   Le rôle (`user` ou `admin`) est vérifié **côté serveur** par la fonction `exigerAdmin` : `401` si non connecté, `403` si connecté mais pas admin.
-   Un filtre global applique cette règle à toute route non publique : une route oubliée reste protégée par défaut.
-   Cacher un bouton dans le front ne protège rien : un utilisateur qui appelle l'API à la main reçoit quand même `403`.

**Données**

-   `password_hash` n'est jamais renvoyé par l'API.
-   **Requêtes préparées** (`?`) partout : protection contre l'injection SQL.
-   Affichage avec `textContent` (pas d'HTML injecté) : protection contre le XSS.
-   Email unique : un doublon renvoie `409`.

## Tester le projet

Serveur lancé, ouvrir http://localhost:3000, ouvrir la console du navigateur (F12) puis taper `autoriser le collage`.

**Un visiteur peut lire les annonces (200)**

```js
fetch("/ads").then((r) => console.log(r.status));
```

**Un visiteur ne peut pas lister les personnes (401)**

```js
fetch("/people").then((r) => console.log(r.status));
```

**Un utilisateur simple est refusé sur une action admin (403)** : se connecter avec un compte `user`, puis

```js
fetch("/people/1", { method: "DELETE" }).then((r) => console.log(r.status));
```

**Un admin passe (404 si l'id n'existe pas, 200 sinon)** : se connecter avec le compte admin, puis la même commande.

On peut aussi regarder l'onglet **Réseau** (filtre Fetch/XHR) des outils de développement pour voir chaque appel du site vers l'API.

## Choix techniques

-   **SQLite** (`better-sqlite3`) : base dans un seul fichier, aucune installation de serveur, adaptée à un projet local.
-   **Node.js + Express** : JavaScript côté serveur comme côté client, routes REST simples à écrire et à lire.
-   **HTML / CSS / JavaScript natif** (pas de framework), `fetch()` appelle l'API sans recharger la page.
-   **Sessions par cookie** (`express-session`) : le serveur retient l'utilisateur connecté, pas de jeton à stocker côté navigateur. Choisi plutôt que JWT pour sa simplicité et parce qu'on peut invalider une session côté serveur.
-   **bcryptjs** : implémentation en JavaScript pur de bcrypt, sans compilation à l'installation.
-   **Multer** : gère l'envoi de fichiers (`multipart/form-data`) ; le CV est enregistré dans `public/uploads/` et son chemin dans `applications.cv_url`.
-   **Pagination** côté API (`page`, `limit`) pour ne pas tout charger d'un coup.
-   **Clés étrangères** et codes HTTP explicites (409 en cas de doublon ou de suppression impossible).
-   **Design responsive** : variables CSS pour les couleurs, `@media` en fin de fichier pour adapter les pages aux petits écrans.

## Limites connues et améliorations

| Limite actuelle                                                                   | Amélioration prévue                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Sessions stockées en mémoire : perdues au redémarrage du serveur                  | Store persistant (ex. `connect-sqlite3`)                                  |
| Secret de session par défaut si `SESSION_SECRET` n'est pas défini                 | Refuser de démarrer en production sans variable d'environnement           |
| CV dans `public/uploads/` : accessibles par URL, sans limite de taille ni de type | Dossier privé servi par une route admin, limite de taille, PDF uniquement |
| Pas de limitation du nombre de tentatives de connexion                            | `express-rate-limit` sur `/auth/login`                                    |
| Pas de HTTPS ni de cookie `secure` (usage local)                                  | HTTPS et `cookie.secure` en production                                    |
| Pas de protection CSRF dédiée                                                     | Cookie `sameSite` strict ou jeton CSRF                                    |

## Répartition du travail

| Partie                                                                | Responsable    |
| --------------------------------------------------------------------- | -------------- |
| (base de données, serveur, design ui ux, pages front, CSS responsive) | Yanice Eloundi |
| (css front end, html, serveur, base de données, ux design, auth)      | Jacob Essomba  |

Les décisions techniques ont été discutées et relues à deux.

## Documentation de l'usage de l'IA

Voir [`AI_USAGE.md`](AI_USAGE.md).

## Auteurs

Yanice Eloundi et Jacob Essomba, Epitech année préparatoire Pré-MSc, 2026.
