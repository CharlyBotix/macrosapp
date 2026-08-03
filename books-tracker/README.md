# Books Tracker

PWA de suivi de lecture auto-hébergée (façon Goodreads/OpenReads), avec backend
Node.js/Express + SQLite. Pensée pour tourner sur un Raspberry Pi 5 derrière
Cloudflare Tunnel + Cloudflare Access (aucune authentification applicative :
Cloudflare Access gère qui a le droit d'accéder à `books.beaujour.me`).

## Fonctionnalités

- Recherche de livres via l'API Open Library, ou ajout manuel
- 4 statuts : à lire / en cours / terminé / abandonné
- Notes (0-5), tags personnalisés, dates de début/fin, nombre de pages, avis
- Statistiques : livres/pages par an, répartition par statut, tags les plus utilisés
- Import CSV (export OpenReads ou compatible) avec détection automatique des colonnes
- Installable comme PWA (icône, plein écran, mode standalone)

## Stack

- Backend : Node.js + Express + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (pas de serveur DB séparé, un seul fichier `books.db`)
- Frontend : HTML/CSS/JS vanilla, sans build step, PWA installable (manifest + service worker)
- Aucune dépendance à un service externe à l'exécution, à part l'appel proxifié vers `openlibrary.org` pour la recherche

## Arborescence

```
books-tracker/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server/
│   ├── index.js            # entrée Express
│   ├── db/                 # init SQLite + schéma + helpers tags
│   ├── routes/             # books, openlibrary, stats, import
│   └── utils/              # parseur CSV + mapping colonnes import
├── public/                 # frontend statique servi par Express
│   ├── index.html, css/, js/
│   ├── manifest.json, sw.js
│   └── icons/
└── data/                   # books.db (ignoré par git, sur le volume /mnt/data/books en prod)
```

## 1. Tester en local

```bash
cd books-tracker
npm install
npm start
```

L'app écoute sur `http://localhost:3300`. La base SQLite est créée automatiquement
dans `./data/books.db` au premier lancement (dossier configurable via `DATA_DIR`).

Pour du rechargement auto pendant le développement : `npm run dev`.

Un point de santé est exposé sur `GET /healthz`.

## 2. Construire et lancer avec Docker (test local avant le Pi)

```bash
cd books-tracker
docker compose build
docker compose up -d
docker compose logs -f books
```

Par défaut le `docker-compose.yml` :
- monte `/mnt/data/books` (hôte) sur `/app/data` (conteneur) -- **crée ce dossier sur
  le Pi avant le premier lancement** : `sudo mkdir -p /mnt/data/books`
- rejoint un réseau Docker externe nommé `cloudflared_net`, pour que le conteneur
  `cloudflared` puisse joindre `books` par son nom de service
- publie `127.0.0.1:3300` uniquement en local, pratique pour tester depuis le Pi
  lui-même sans passer par le tunnel (à retirer une fois la route Cloudflare validée)

### Adapter le réseau à ton setup existant

Le nom `cloudflared_net` est un exemple. Si ton `docker-compose.yml` existant
(celui qui fait tourner Nextcloud/Immich/NPM/cloudflared) utilise un autre nom de
réseau, remplace `cloudflared_net` par le vrai nom dans `docker-compose.yml` ici.

Pour lister tes réseaux Docker existants sur le Pi :

```bash
docker network ls
```

Si tes services actuels utilisent le réseau `bridge` par défaut de Compose (un par
projet) plutôt qu'un réseau externe partagé, la façon la plus simple de connecter
ce nouveau conteneur à `cloudflared` est de créer un réseau externe dédié une
fois, puis de l'ajouter aux deux stacks :

```bash
docker network create cloudflared_net
# puis ajoute le même bloc "networks: - cloudflared_net" (external: true)
# au service cloudflared de ta stack existante, et redémarre-le :
docker compose up -d cloudflared
```

## 3. Déployer sur le Raspberry Pi

1. Copier le dossier `books-tracker/` sur le Pi (via `git clone`/`git pull` du repo,
   ou `scp`), par exemple dans `~/docker/books-tracker`.
2. Créer le dossier de données persistantes :
   ```bash
   sudo mkdir -p /mnt/data/books
   ```
3. Vérifier/adapter le nom de réseau dans `docker-compose.yml` (voir section 2).
4. Builder et démarrer :
   ```bash
   cd ~/docker/books-tracker
   docker compose up -d --build
   ```
5. Vérifier que le conteneur tourne et répond :
   ```bash
   docker compose ps
   curl http://127.0.0.1:3300/healthz
   ```

### Build ARM64

Le `Dockerfile` utilise l'image `node:20-bookworm-slim`, disponible en `arm64`
avec des binaires précompilés pour `better-sqlite3` (pas besoin de toolchain de
compilation dans l'image finale). `docker compose build` sur le Pi construira
directement l'image pour son architecture -- rien de spécial à faire.

## 4. Ajouter la route dans le Cloudflare Tunnel

Dans le dashboard Cloudflare Zero Trust (`Networks > Tunnels`), sur le tunnel
existant qui route déjà tes autres sous-domaines :

1. **Public Hostname** → **Add a public hostname**
2. Subdomain: `books`, Domain: `beaujour.me`
3. Service: `HTTP` → `books:3300`
   (le nom `books` correspond au `container_name` défini dans `docker-compose.yml` ;
   ça fonctionne car `cloudflared` et `books` sont sur le même réseau Docker)
4. Enregistrer

L'application Cloudflare Access que tu as déjà configurée pour
`books.beaujour.me` (policy "Admin Only" sur ton email) s'applique automatiquement
dès que le hostname existe -- rien à faire côté application, l'authentification
est entièrement gérée en amont par Cloudflare.

Teste ensuite `https://books.beaujour.me` : tu devrais être redirigé vers la page
de connexion Cloudflare Access, puis atterrir sur l'app une fois authentifié.

## 5. Installer la PWA sur le téléphone (Fairphone /e/OS)

1. Ouvrir `https://books.beaujour.me` dans le navigateur (Chrome ou tout
   navigateur basé Chromium disponible sur /e/OS)
2. Se connecter via Cloudflare Access
3. Menu du navigateur → **Ajouter à l'écran d'accueil** / **Installer l'application**

L'app s'ouvre alors en plein écran, comme une app native, avec les mêmes données
que sur ordinateur (tout est stocké côté serveur, rien en local sur le téléphone).

## Import CSV depuis OpenReads

Dans l'onglet **Import**, choisis le fichier CSV exporté depuis OpenReads (ou tout
export avec une colonne titre). Les colonnes suivantes sont détectées
automatiquement (insensible à la casse) :

| Champ         | En-têtes reconnus (exemples)                              |
|---------------|-------------------------------------------------------------|
| titre         | Title, Book Title, Name                                     |
| auteur        | Author, Authors                                              |
| ISBN          | ISBN, ISBN13, ISBN10                                         |
| statut        | Status, Reading Status, Shelf                                 |
| note          | Rating, My Rating, Score, Stars                               |
| pages         | Pages, Page Count, Number of Pages                            |
| début lecture | Start Date, Date Started                                       |
| fin lecture   | Finish Date, Date Read, Date Finished                          |
| tags          | Tags, Genres, Shelves, Bookshelves                             |
| notes/avis    | Notes, Review, My Review, Description                         |

Si ton export OpenReads utilise d'autres intitulés de colonnes que ceux
ci-dessus, ajoute-les simplement dans
`server/utils/importMapping.js` (tableau `FIELD_ALIASES`) -- aucune autre
modification n'est nécessaire. Le résultat de l'import affiche le nombre de
lignes importées/ignorées et le détail des colonnes détectées, pour vérifier
que le mapping est correct avant de se fier aux données importées.

Les valeurs de statut sont elles aussi normalisées de façon similaire (variantes
comme "Read"/"Finished"/"Completed" → `finished`) ; ajuste `STATUS_ALIASES` dans
le même fichier si besoin.

## Sauvegarde

Toutes les données vivent dans un seul fichier SQLite :
`/mnt/data/books/books.db` (+ fichiers `-wal`/`-shm` du mode WAL). Une sauvegarde
simple :

```bash
sqlite3 /mnt/data/books/books.db ".backup /mnt/data/books/backup-$(date +%F).db"
```

À inclure dans ta routine de sauvegarde existante du Pi (celle qui couvre déjà
Nextcloud/Immich), par exemple via une tâche cron.
