# muni-test

The panel of the training records of a municipality. A gray-scale web panel
with three views (admin, manager, employee), a gate in front of it and a
SQLite database behind it.

| Part                 | What it is                                                  |
| -------------------- | ----------------------------------------------------------- |
| `apps/api`           | The API with the database, the gate and the login.          |
| `apps/web`           | The panel (React + vite).                                   |
| `packages`           | The types that both sides use.                              |
| `data/`              | The CSV files the database is filled with the first time.   |
| `docker-compose.yml` | The whole setup: API, panel and the backup of the database. |

The details are in the README of the parts:

- [`apps/api/README.md`](apps/api/README.md) - the API, the gate, the roles,
  the database and the backup.
- [`apps/web/README.md`](apps/web/README.md) - the panel and its views.

## The local development

```bash
pnpm install
pnpm dev
```

The API is on `:3000`, the panel on `:5173` (it asks the API through the
proxy of vite). Without `PANEL_PASSWORD` the gate opens with `muni2026`.

```bash
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

## The docker setup

Everything runs in three containers:

| Container | What it does                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `api`     | The API with the database. It is not published - only the panel can talk to it.                             |
| `web`     | nginx with the built panel. It passes `/api` to the API. It is the only thing that is open to the internet. |
| `backup`  | Takes a backup of the database every hour.                                                                  |

The database is **one SQLite file** in the volume `db` (`/data/app.db`), so the
data survives a restart of the containers. The backups go into the volume
`backups`.

```bash
cp .env.example .env

# the password of the gate - everybody uses the same one
sed -i "s|^PANEL_PASSWORD=.*|PANEL_PASSWORD=tvoje-heslo|" .env

# the key the sessions are signed with - a random one
sed -i "s|^PANEL_SECRET=.*|PANEL_SECRET=$(openssl rand -hex 32)|" .env

docker compose up -d --build
```

The example file has `change-me` in both places. The server says so in the log
and the panel is not safe to publish until both of them are changed.

The panel is then on `http://localhost:8080` (or whatever `WEB_PORT` says).

### The settings

They are read from the file `.env` next to `docker-compose.yml` - only
`docker compose` reads it, the local development (`pnpm dev`) runs with the
built in defaults.

| Variable         | Meaning                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| `PANEL_PASSWORD` | The password of the gate - the same for everybody.                                    |
| `PANEL_SECRET`   | The key the sessions are signed with. Without it every restart ends all the sessions. |
| `WEB_ORIGIN`     | The address of the panel, e.g. `https://skoleni.mesto.cz`.                            |
| `WEB_PORT`       | The port the panel is published on.                                                   |
| `TRUST_PROXY`    | How many proxies are in front of the API - `1` behind nginx.                          |
| `BACKUP_MINUTES` | How many minutes are between two backups (60 = every hour).                           |
| `BACKUP_KEEP`    | How many backups are kept (48 = two days).                                            |

### The commands

```bash
docker compose up -d --build   # start everything
docker compose ps               # what is running
docker compose logs -f api      # the log of the API
docker compose restart          # a restart - the data stays
docker compose down             # stop everything (the volumes stay)
```

### The backup

The `backup` container makes a backup of the database every hour and keeps the
newest 48 of them (two days). The backup is a fresh, packed SQLite file - it
can be read while the API is writing.

```bash
# what is in the backup volume
docker compose exec backup node apps/api/dist/backup-cli.js --list

# a backup now
docker compose exec backup node apps/api/dist/backup-cli.js
```

### Putting a backup back

The API has to be stopped first, otherwise it keeps writing into the old file.
The file to put back is one of the ones from the list above.

```bash
docker compose stop api
docker compose exec backup node apps/api/dist/backup-cli.js --restore /backups/skoleni-2026-10-21T13-34-42-826Z.sqlite3
docker compose start api
```

The data goes back to the state of that backup.

### The data itself

The database is filled from the CSV files in `data/` the **first** time the
container starts (they are mounted read only at `/seed`). After that the
database is the truth - the CSV files are never read again, so a restart does
not throw away what was changed in the panel.

To start over with the CSV files again:

```bash
docker compose down
docker volume rm muni-test_db
docker compose up -d
```

## On the server (VPS)

### 1. Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out and in again
```

### 2. The files

```bash
git clone <the repository> /opt/muni-test
cd /opt/muni-test
cp .env.example .env
```

Fill in `.env` - the file, not the shell, because `docker compose` is the one
that reads it:

```bash
sed -i "s|^PANEL_PASSWORD=.*|PANEL_PASSWORD=tvoje-heslo|" .env
sed -i "s|^PANEL_SECRET=.*|PANEL_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^WEB_ORIGIN=.*|WEB_ORIGIN=https://skoleni.mesto.cz|" .env
sed -i "s|^WEB_PORT=.*|WEB_PORT=8080|" .env
```

The file may be edited by hand as well. A `change-me` in the password or in the
secret means that everybody knows it - change both of them before the panel
goes online.

### 3. Start

```bash
docker compose up -d --build
docker compose ps
```

### 4. The address

The panel is served by nginx on port 8080. Put a TLS proxy in front of it -
for example a small nginx on the host, or Caddy:

```nginx
# /etc/nginx/sites-available/muni-test
server {
    listen 443 ssl http2;
    server_name skoleni.mesto.cz;

    ssl_certificate     /etc/letsencrypt/live/skoleni.mesto.cz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/skoleni.mesto.cz/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The API itself is never published - only nginx inside the docker network can
talk to it. The database is not published at all.

### 5. The backups

The backups are in the volume `backups`. They are only as safe as the disk
they are on, so a copy of them should go somewhere else - for example once a
day to another machine:

```bash
docker compose exec backup node apps/api/dist/backup-cli.js --list
docker run --rm -v muni-test_backups:/backups -v "$HOME:/target" alpine \
  tar czf /target/muni-backup-$(date +%F).tar.gz -C /backups .
```

### 6. The updates

```bash
cd /opt/muni-test
git pull
docker compose up -d --build
```

The database stays where it is - it is in the volume, not in the image.

## What is in the data

The database is filled from the four CSV files in `data/`:

| File                      | What it holds            |
| ------------------------- | ------------------------ |
| `zamestnanci.csv`         | 174 people               |
| `katalog_skoleni.csv`     | 10 courses               |
| `terminy_skoleni.csv`     | 34 sessions              |
| `absolvovana_skoleni.csv` | 2850 completed trainings |

The role of every person comes from the data: the one nobody reports to is
the `admin`, everybody whose e-mail is used as the manager of somebody else is
a `manager`, the rest are `employees`.
