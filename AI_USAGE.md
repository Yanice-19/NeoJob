# Documentation de l'usage de l'IA

## Outil utilisé

Claude (Anthropic), utilisé comme assistant tout au long du projet Neo Job : il explique, propose du code parfois et aide à déboguer. Les décisions, les tests et la relecture restent les nôtres.

## Principe de travail

-   Nous décidons de ce que le site doit faire (fonctionnalités, parcours, design).
-   Nous tapons ou collons le code nous-mêmes dans VS Code, nous le lisons, puis nous le testons dans le navigateur et dans la console.
-   Nous demandons le « pourquoi » de chaque choix avant de l'accepter, et nous modifions ou refusons ce que nous ne comprenons pas.

## Répartition : ce que fait l'IA et ce que nous faisons

| Étape                | Ce que l'IA a apporté                                           | Ce que nous avons fait et vérifié                                                                                                                    |
| -------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choix techniques     | Comparaison SQLite / autres bases, Node + Express / autres      | Nous avons choisi, compris les raisons (simplicité, fichier unique, même langage front et back) et documenté dans le README                          |
| Base de données      | Proposition de schéma et de jeu de données                      | Nous avons défini les besoins, exécuté `database.sql`, vérifié les tables avec `.tables` et `.schema`                                                |
| API REST             | Exemples de routes CRUD, codes HTTP, pagination                 | Nous avons testé chaque route (navigateur, `curl`, console), vérifié les erreurs (404, 409) et repéré les routes manquantes                          |
| Page d'accueil       | Exemple de liste, « Learn more », « Apply » avec `fetch()`      | Nous avons conçu l'interface et les filtres, testé le comportement sans rechargement et l'enregistrement en base                                     |
| Authentification     | Explication des sessions, de bcrypt et des rôles                | Nous avons testé un compte normal et un compte admin, vérifié que `password_hash` n'est jamais renvoyé                                               |
| Droits d'accès       | Écriture du filtre `exigerAdmin` après notre constat            | Nous avons **trouvé la faille nous-mêmes** en testant : un simple utilisateur obtenait 200 sur `/people`. Nous avons vérifié le 403 après correction |
| CV des candidats     | Explication de Multer et exemple d'envoi de fichier             | Nous avons intégré l'envoi dans le formulaire, ajouté la colonne `cv_url` et testé la candidature avec un fichier                                    |
| Page compte et admin | Aide sur la pagination et les formulaires                       | Nous avons testé création, modification, suppression, et l'accès refusé sans être admin                                                              |
| Design               | Aide sur le CSS (variables, responsive, footer)                 | Le design, la palette, les maquettes et les choix UX/UI viennent de nous (Yanice est designer UX/UI). Nous avons ajusté le rendu à l'écran           |
| Commentaires du code | Aide pour rédiger et structurer les commentaires de `server.js` | Nous les avons relus et adaptés pour qu'ils correspondent à ce que fait réellement le code                                                           |
| README               | Proposition de structure et de rédaction                        | Nous l'avons relu, complété (comptes de test, répartition) et adapté à notre projet                                                                  |

## Problèmes rencontrés et comment nous les avons résolus

-   `sqlite3` lancé depuis le mauvais dossier : tables introuvables. Corrigé en se plaçant dans le dossier du projet.
-   Route `POST /ads` en double : Express utilisait la première. Nous avons supprimé l'ancienne.
-   `database.sql` placé dans `public/` : le fichier était téléchargeable depuis le navigateur. Nous l'avons déplacé à la racine.
-   `server.js` déplacé par erreur dans `public/` : erreur `MODULE_NOT_FOUND` et fichier lisible depuis le navigateur. Nous l'avons remis à la racine.
-   Test avec Go Live (port 5500) au lieu du serveur (port 3000) : l'API et les sessions n'existent pas sur Go Live. Nous testons uniquement sur `http://localhost:3000`.
-   Routes admin accessibles à un simple utilisateur : repéré avec un test dans la console, corrigé par un filtre global côté serveur.
-   Bouton « + Ajouter » des entreprises sans effet : la route `POST /companies` n'existait pas. Nous l'avons ajoutée et testée.

## Ce que nous ne déléguons pas

-   Nous relisons et testons chaque morceau de code avant de le garder.
-   Nous ne mettons aucun mot de passe ni secret dans le dépôt (`.gitignore`, secret de session par variable d'environnement).
-   Les choix de sécurité (hachage, rôles vérifiés côté serveur, requêtes préparées) sont ceux que nous pouvons expliquer et justifier.

## Les erreurs de l'IA que nous avons repérées

-   Une première version du serveur ne protégeait pas les routes d'administration : nous l'avons vu en testant avec un compte normal.
-   Une version de `server.js` sans le filtre de protection nous a été renvoyée par erreur : nous avons comparé et fait réintégrer le filtre.
-   Certaines routes annoncées comme complètes ne l'étaient pas (il manquait `POST /companies`) : nous l'avons constaté dans le back office.
