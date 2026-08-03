# Books — suivi de lecture auto-hébergé

PWA façon Goodreads/OpenReads : ajout de livres via recherche Open Library ou
manuellement, statuts (à lire / en cours / terminé / abandonné), notes, tags,
dates de lecture, stats, et import CSV (format Goodreads/OpenReads).

Stack volontairement légère pour tourner sur un Raspberry Pi 5 (4 Go RAM)
partagé avec d'autres services :

- **Backend** : Node.js 22 + Express, un seul conteneur, pas de build step.
- **Base de données** : SQLite via le module natif `node:sqlite` (aucune
  compilation native ARM requise, contrairement à `better-sqlite3`).
- **Frontend** : HTML/CSS/JS vanilla (pas de framework, pas de bundler),
  servi directement par Express. PWA installable (manifest + service worker).
- **Pas d'authentification applicative** : gérée en amont par Cloudflare
  Access.

## Structure

```
books-pwa/
├── src/
│   ├── server.js          # Express app, routing, static files
│   ├── db.js               # Connexion SQLite + schéma (CREATE TABLE IF NOT EXISTS)
│   ├── lib/
│   │   ├── books.js         # Normalisation + gestion des tags
│   │   └── csvImport.js     # Mapping colonnes CSV -> modèle interne
│   └── routes/
│       ├── books.js         # CRUD /api/books
│       ├── tags.js          # /api/tags
│       ├── openlibrary.js   # Proxy recherche /api/openlibrary/search
│       ├── stats.js         # /api/stats
│       └── import.js        # /api/import (upload CSV)
├── public/                 # Frontend statique (index.html, css/, js/, icons/)
├── data/                   # SQLite DB (monté en volume Docker, gitignored)
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 1. Tester en local (sans Docker)

```bash
cd books-pwa
npm install
npm run dev        # node --watch, redémarre sur chaque modif
```

Ouvre http://localhost:3000 — la base SQLite est créée automatiquement dans
`books-pwa/data/books.db`.

> Le flag `--experimental-sqlite` est nécessaire (déjà dans les scripts npm
> `start`/`dev`). Node ≥ 22.5 est requis.

## 2. Tester avec Docker (toujours en local)

```bash
cd books-pwa
cp .env.example .env
# Pour un test local isolé, crée un réseau bridge simple :
docker network create booktest
sed -i 's/DOCKER_NETWORK=proxy/DOCKER_NETWORK=booktest/' .env

# Décommente la section "ports" dans docker-compose.yml pour accéder
# à l'app directement sur http://localhost:3000 pendant le test.

docker compose up -d --build
docker compose logs -f
```

Vérifie `curl http://localhost:3000/api/health` puis ouvre l'app dans le
navigateur. Une fois satisfait, recommente/retire la section `ports` (elle
n'est pas nécessaire en prod puisque le tunnel Cloudflare parlera directement
au conteneur via le réseau Docker).

> Cette session n'a pas de démon Docker disponible pour builder l'image
> ici — j'ai donc validé toute la logique applicative (API, SQLite, import
> CSV, service des fichiers statiques) directement avec `node`. Le
> Dockerfile ne fait qu'installer les dépendances npm et lancer le même
> `server.js` sur une image `node:22-bookworm-slim` (qui a des builds
> officiels arm64) — à builder/vérifier une fois sur le Pi.

## 3. Déployer sur le Raspberry Pi

```bash
# Sur le Pi
cd /chemin/vers/macrosapp   # ou clone dédié
git pull
cd books-pwa

mkdir -p /mnt/data/books
cp .env.example .env
nano .env   # ajuste DOCKER_NETWORK (voir ci-dessous)
```

### Trouver le nom du réseau Docker de cloudflared

Le tunnel Cloudflare doit pouvoir résoudre `books` en DNS Docker, donc le
conteneur `books` doit rejoindre le **même réseau** que ton conteneur
`cloudflared` :

```bash
docker network ls
docker inspect cloudflared --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool
```

Mets le nom trouvé dans `DOCKER_NETWORK` (dans `.env`). Si `cloudflared` est
sur le réseau par défaut de ton compose Nginx Proxy Manager (souvent
`nginx-proxy-manager_default` ou similaire), utilise ce nom-là. Le réseau
doit déjà exister (`external: true` dans `docker-compose.yml`) — ce
docker-compose ne le crée pas, il le rejoint.

### Build et lancement

```bash
docker compose up -d --build
docker compose logs -f books
```

Vérifie que le conteneur a bien rejoint le réseau attendu :

```bash
docker network inspect <nom-du-reseau> | grep -A3 '"books"'
```

## 4. Route Cloudflare Tunnel

Dans le dashboard **Cloudflare Zero Trust → Networks → Tunnels** → sélectionne
ton tunnel existant → onglet **Public Hostname** → **Add a public hostname** :

| Champ | Valeur |
|---|---|
| Subdomain | `books` |
| Domain | `beaujour.me` |
| Path | *(vide)* |
| Type | `HTTP` |
| URL | `books:3000` |

`books` est le nom du service Docker Compose (= nom du conteneur), résolu
via le réseau Docker partagé — pas besoin d'IP ni de port publié sur l'hôte.

Vérifie ensuite que ton application Cloudflare Access ("Admin Only") couvre
bien le domaine `books.beaujour.me` (Application domain), c'est déjà
configuré côté Cloudflare d'après ton message donc rien à faire de plus ici.

Teste enfin `https://books.beaujour.me` — tu devrais atterrir sur l'écran de
connexion Cloudflare Access (ton email), puis sur l'app une fois authentifié.

## 5. Ajouter la PWA à l'écran d'accueil

- **Android (/e/OS, Chrome ou navigateur basé Chromium)** : ouvre
  `https://books.beaujour.me`, menu ⋮ → "Ajouter à l'écran d'accueil" /
  "Installer l'application".
- **Ordinateur (Chrome/Edge)** : icône d'installation dans la barre
  d'adresse, ou menu → "Installer Books".

Les données sont stockées côté serveur (SQLite sur le Pi), donc tu retrouves
la même bibliothèque sur toutes tes installations.

## 6. Import CSV (OpenReads / Goodreads)

L'import (`/api/import`, onglet "Import" de l'app) reconnaît les en-têtes de
l'export standard Goodreads (que OpenReads lit/écrit pour rester
compatible) : `Title`, `Author`, `ISBN13`/`ISBN`, `My Rating`,
`Exclusive Shelf`, `Date Read`, `Bookshelves`, `Number of Pages`,
`My Review`, etc. — voir la liste complète dans `src/lib/csvImport.js`
(`FIELD_ALIASES`).

Après import, la réponse inclut `recognizedColumns` : si une colonne de ton
fichier n'apparaît pas dedans, elle n'a pas été reconnue — ouvre le CSV,
compare ses en-têtes à `FIELD_ALIASES`, et ajoute l'alias manquant (c'est une
simple liste de chaînes, pas besoin de toucher au reste du code).

Par défaut, les doublons (même ISBN, ou même titre + auteur déjà en base)
sont ignorés — décoche la case dans l'UI pour forcer un import complet.

## 7. Sauvegarde

Toute la donnée est dans un seul fichier : `/mnt/data/books/books.db` (plus
ses fichiers `-wal`/`-shm` le temps que le conteneur tourne — SQLite est en
mode WAL). Façon la plus simple et sûre de sauvegarder, avec un court arrêt
du conteneur pour garantir un fichier cohérent :

```bash
cd books-pwa
docker compose stop books
cp /mnt/data/books/books.db ~/backups/books-$(date +%F).db
docker compose start books
```

À automatiser via un cron sur le Pi, vers ton système de backup habituel
(le même que celui que tu utilises probablement déjà pour Nextcloud/Immich).

## 8. Mettre à jour l'app plus tard

```bash
cd books-pwa
git pull
docker compose up -d --build
```

Le schéma SQLite (`src/db.js`) utilise `CREATE TABLE IF NOT EXISTS`, donc les
migrations basiques (nouvelles tables/colonnes que tu ajouterais toi-même
plus tard) doivent être écrites en `ALTER TABLE ... ADD COLUMN` idempotent
si besoin — rien à faire pour l'instant.
