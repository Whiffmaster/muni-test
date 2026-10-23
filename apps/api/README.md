# @app/api

Backend for the training app. It contains the **login** (behind a password),
the **panel** (dashboard) for the three roles, the **administration** endpoints
and the **data normalizer**, which turns the raw CSV exports in `data/` (and the
files the frontend uploads) into JSON objects with predictable dates, names,
amounts and identifiers.

## The settings

The panel is meant to run on a public server, so everything that protects it
comes from the environment:

| Variable         | Meaning                                                               | Default                             |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `PANEL_PASSWORD` | The password of the gate - the same for everybody.                    | `muni2026` (with a warning)         |
| `PANEL_SECRET`   | The key the sessions are signed with.                                 | random per start (warning)          |
| `WEB_ORIGIN`     | The addresses the web panel may be served from (comma separated).     | every address (warning)             |
| `TRUST_PROXY`    | How many proxies are in front of the API.                             | `loopback`                          |
| `PORT`           | The port of the API.                                                  | `3000`                              |
| `DB_PATH`        | Where the SQLite file lives.                                          | `data/app.db` next to the CSV files |
| `SEED_DIR`       | The folder with the CSV files - used only when the database is empty. | the `data/` folder                  |
| `BACKUP_DIR`     | Where the backups of the database are written.                        | `backups`                           |
| `BACKUP_MINUTES` | How many minutes are between two backups.                             | `60`                                |
| `BACKUP_KEEP`    | How many backups are kept.                                            | `48`                                |

When `PANEL_PASSWORD` or `PANEL_SECRET` is missing, the server says so in the
log and uses the built in password / a random key. A random key means that
every restart ends all the sessions - set `PANEL_SECRET` to keep them. The
placeholders from the example file (`change-me`) are refused the same way - they
are public, everybody would know them.

```bash
PANEL_PASSWORD="nejtajnejsi-heslo" \
PANEL_SECRET="$(openssl rand -hex 32)" \
WEB_ORIGIN="https://skoleni.mesto.cz" \
pnpm --filter @app/api start
```

## The panel

### The gate

The panel is behind one password - the gate. It is the first thing a visitor
sees. Behind it everybody logs in with their own e-mail address.

| Method | Route              | Description                                   |
| ------ | ------------------ | --------------------------------------------- |
| `POST` | `/api/auth/access` | `{ "password": "..." }` -> `{ accessToken }`. |

```bash
curl -X POST http://localhost:3000/api/auth/access \
  -H "Content-Type: application/json" \
  -d '{"password":"muni2026"}'
```

The answer is a token that goes into the `X-Access-Token` header of every
other request. It is good for seven days; after ten wrong tries the address
is put on hold for five minutes and the server answers with `429` and a
`Retry-After` header.

### The login

Behind the open gate the login of the person needs only the e-mail address -
the server looks the person up in the data and works out the role.

| Method | Route             | Description                                |
| ------ | ----------------- | ------------------------------------------ |
| `POST` | `/api/auth/login` | `{ "email": "..." }` -> `{ token, user }`. |
| `GET`  | `/api/auth/me`    | The person behind the token -> `{ user }`. |

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Access-Token: $ACCESS" \
  -d '{"email":"jitka.simkova@vzorova.example"}'
```

The token goes into the `Authorization` header of every other request:

```bash
curl http://localhost:3000/api/dashboard \
  -H "X-Access-Token: $ACCESS" \
  -H "Authorization: Bearer $TOKEN"
```

### How the panel is protected

| Threat                          | What stops it                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Somebody goes around the gate   | Every endpoint except `/api/auth/access` and `/api/health` needs the gate token - the dashboard, the administration and the normalizer as well.                              |
| Somebody makes up a token       | The tokens are signed with `PANEL_SECRET` (`HMAC-SHA256`) - a made up or changed token is refused. The gate token and the token of the person cannot be used for each other. |
| Somebody guesses the password   | The check is slow (`scrypt`), the address is put on hold after ten tries.                                                                                                    |
| An employee wants to add people | The writes are behind `requireAdmin` - only the admin gets `201`/`200`, everybody else `403`.                                                                                |
| An employee wants to see more   | The dashboard is built from the role, which is worked out from the data on **every** request. An employee gets only their own trainings, a manager only their team.          |
| Somebody floods the normalizer  | The normalizer is behind the gate and the login as well, so only logged in people can send the big files.                                                                    |
| Another site uses the API       | The API answers only the addresses in `WEB_ORIGIN`.                                                                                                                          |

The answers say what went wrong: `code: "access-required"` means the gate is
closed again, `code: "login-required"` means only the session of the person is
over.

### Roles

The role is **derived from the data**, not from a configuration:

| Role       | Who                                                |
| ---------- | -------------------------------------------------- |
| `admin`    | the manager on top of the hierarchy (nobody above) |
| `manager`  | everybody whose e-mail is used as `vedouci_email`  |
| `employee` | everybody else                                     |

The role is worked out again on every request, so a token can never grant more
than the person really has.

### Dashboard

| Method | Route            | Description                                        |
| ------ | ---------------- | -------------------------------------------------- |
| `GET`  | `/api/dashboard` | Everything the panel shows, depending on the role. |

One endpoint for all three roles keeps the client simple. The answer contains
the logged in user, the numbers in the header and the parts the role may see:

- **employee** – `myTrainings`: every course of the catalogue with its state
  (`valid`, `expiring`, `expired`, `missing`, `not-required`), until when it is
  valid, and the next session of the course.
- **manager** – `team` (the people reporting to the manager, with what is
  missing), `teamTrainings` (the courses of the whole team), and their part of
  the training plan (`trainingPlan`, `trainingPlanSummary`,
  `trainingWarnings`).
- **admin** – `employees`, `courses`, `sessions` and `trainings`, plus the
  whole training plan and every capacity warning.

### The training plan

`trainingPlan` is the ideal queue for the courses people still have to do:

1. Everybody who needs a course (expired, expiring within 60 days or missing)
   is put in one queue for that course.
2. The queue is ordered by urgency - the qualification that runs out first is
   at the front, somebody who never did the course is at the back.
3. The people are then given the soonest upcoming session that still has a
   free seat. No seat is handed out twice.

The plan is built over everybody at once, so two teams are never promised the
same seat. A manager only gets the part that belongs to their team, the admin
gets all of it.

When the seats are not enough for everybody who needs the course, a warning is
made for each person **without a seat whose qualification runs out within 60
days** (an already expired one counts as well). The warning is `critical` when
the qualification is already expired or ends within 30 days, otherwise it is a
`warning`. The manager of those people and the admin get it in
`trainingWarnings`.

### Administration

Only the admin may use these endpoints - everybody else gets `403`, and the
role is never taken from the client, it is always looked up in the data.

| Method   | Route                      | Description                         |
| -------- | -------------------------- | ----------------------------------- |
| `GET`    | `/api/admin/employees`     | Everybody.                          |
| `POST`   | `/api/admin/employees`     | Adds a person.                      |
| `PATCH`  | `/api/admin/employees/:id` | Changes a person.                   |
| `DELETE` | `/api/admin/employees/:id` | Removes a person and its trainings. |
| `GET`    | `/api/admin/courses`       | The catalogue.                      |
| `POST`   | `/api/admin/courses`       | Adds a course.                      |
| `DELETE` | `/api/admin/courses/:code` | Removes a course.                   |
| `GET`    | `/api/admin/sessions`      | The sessions.                       |
| `POST`   | `/api/admin/sessions`      | Adds a session.                     |
| `DELETE` | `/api/admin/sessions/:id`  | Removes a session.                  |
| `GET`    | `/api/admin/trainings`     | The completed trainings.            |
| `POST`   | `/api/admin/trainings`     | Adds a completed training.          |
| `DELETE` | `/api/admin/trainings/:id` | Removes a completed training.       |

### How the state of a training is worked out

For every course of the catalogue and every person:

1. Is the course mandatory? (`requiredFor` of the catalogue - everybody, a
   department, a position or nobody.)
2. The newest record of that person for that course decides.
3. If the record has no `platnost_do`, the validity of the course from the
   catalogue is used (`completedAt + validityMonths`).
4. The state follows from the end of the validity: in the past -> `expired`, in
   less than 60 days -> `expiring`, otherwise `valid`. No record at all ->
   `missing`.
5. The next session is the soonest upcoming one that still has a free seat.

### Where the data lives

The data is in **one SQLite file** - `src/db.ts` makes the tables, `src/store.ts`
is the only place that talks to them. The routes know nothing about the
database, so it can be moved without touching them.

The file is opened in the WAL mode (`journal_mode = WAL`), so the API can write
while the backup reads. The write ahead log (`app.db-wal`) belongs to the
database and has to stay next to it.

When the server starts:

1. the file is opened (and the tables are made if they are not there yet),
2. if there is not a single person in the database, the CSV files from
   `SEED_DIR` are read in - the whole import happens in one transaction,
3. from then on the file is the truth. The CSV files are only the starting
   point and are never read again.

```bash
# a database of its own
# (the paths are relative to apps/api, because that is where the script runs)
DB_PATH=/tmp/panel.db SEED_DIR=../../data pnpm --filter @app/api dev
```

A folder with `SEED_DIR` that holds no CSV file is a mistake - the server says
so and stops instead of coming up with an empty panel. Without `SEED_DIR` the
folder with the CSV files is searched for upwards from the working directory,
so the same command works from the root of the project as well.

The CSV files contain fifteen rows of `absolvovana_skoleni.csv` twice - the
same line, the same id. The database keeps one of them, so the count of the
completed trainings is a bit lower than the number of lines in the file.

## The database

```bash
# what is in it
sqlite3 data/app.db "SELECT COUNT(*) FROM employees; SELECT COUNT(*) FROM trainings;"

# when was it filled
sqlite3 data/app.db "SELECT * FROM meta;"
```

The tables are `employees`, `courses`, `sessions`, `trainings` and `meta`.

## The backup

The database is one file, so the backup is a copy of it - but a safe copy:
`VACUUM INTO` writes a fresh, packed file that needs no write ahead log and
can be made while the API is writing.

```bash
# one backup now (the database has to exist - run the server once first)
pnpm --filter @app/api backup

# what is in the backup folder
node apps/api/dist/backup-cli.js --list

# a backup back (the API has to be stopped before that)
node apps/api/dist/backup-cli.js --restore backups/skoleni-2026-10-21T13-34-42-826Z.sqlite3
```

The backups go into the folder `backups` next to the `data` folder, so they
are found no matter from which folder the command is started. `BACKUP_DIR`
changes that.

`pnpm --filter @app/api backup:loop` runs the backup over and over again -
every `BACKUP_MINUTES` minutes - and throws away the copies that are older than
`BACKUP_KEEP`. That is what the `backup` container in the compose file does.

The backup only reads the database, so it may run while the API works. It is
started half a minute after the container, so the database is filled first.

## Data normalizer

### Endpoints

The normalizer is behind the gate and the login - the files are big, so only
the people who are logged in may send them.

| Method | Route                   | Description                                                   |
| ------ | ----------------------- | ------------------------------------------------------------- |
| `GET`  | `/api/normalize/kinds`  | Lists the datasets the normalizer understands.                |
| `POST` | `/api/normalize`        | `multipart/form-data`, one or more files in the `file` field. |
| `POST` | `/api/normalize/raw`    | The CSV as the request body (`text/csv`).                     |
| `GET`  | `/api/normalize/sample` | Normalizes the CSV files that ship in `data/`.                |

The dataset is detected from the header line; an explicit kind may be forced
with the `kind` form field, the `?kind=` query parameter or the `X-Data-Kind`
header.

```bash
# upload one file
curl -X POST http://localhost:3000/api/normalize \
  -H "X-Access-Token: $ACCESS" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data/zamestnanci.csv"

# upload all files at once, the answer also contains the cross checks
curl -X POST http://localhost:3000/api/normalize \
  -H "X-Access-Token: $ACCESS" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data/zamestnanci.csv" \
  -F "file=@data/katalog_skoleni.csv" \
  -F "file=@data/terminy_skoleni.csv" \
  -F "file=@data/absolvovana_skoleni.csv"
```

### Answer

```jsonc
{
  "results": [
    {
      "kind": "zamestnanci",
      "meta": {
        "kind": "zamestnanci",
        "source": "zamestnanci.csv",
        "encoding": "utf-8",     // utf-8 | windows-1250 | utf-16le | ...
        "delimiter": ",",
        "rowCount": 174,
        "warningCount": 4,
        "normalizedAt": "2026-10-21T12:08:34.307Z"
      },
      "header": ["id_zamestnance", "jmeno", "..."],
      "rows": [ /* the normalized objects */ ],
      "warnings": [
        {
          "row": 121,
          "column": "email",
          "code": "invalid-email",
          "level": "warning",
          "message": "not a valid e-mail address",
          "value": "lucie.fialova@vzorova,example"
        }
      ]
    }
  ],
  "datasets": { /* the rows grouped by kind */ },
  "crossCheck": { /* only when more than one dataset was sent */ }
}
```

Warnings are informational: a value that could not be normalized becomes
`null` and the reason is listed in `warnings`.

- `level: "error"` – the row could not be read at all.
- `level: "warning"` – the value was dropped (`invalid-date`, `invalid-email`,
  `unparsable-number`, `unparsable-name`, ...).
- `level: "info"` – the value was normalized, but something was unusual
  (`placeholder-date`, `excel-serial`, `repeated-header`, `not-a-record`).

### Cross checks

When several datasets are sent at once they are compared with each other:

- `unknownCourseCodes` – training codes that are not in the catalogue.
- `unknownEmployeeIds` – employees in the training records that do not exist.
- `duplicateEmployeeIds` – employees that appear twice.
- `overbookedSessions` – sessions with more bookings than seats.
- `employeeIdsWithoutTrainingRecord` – active employees without any training.

## What the normalizer fixes

The source files are not consistent, so the normalizer cleans them up:

### Files

- The delimiter is detected per file (`,` and `;` are both used).
- The encoding is detected per file: UTF-8 (with or without BOM) or
  Windows-1250, which `absolvovana_skoleni.csv` uses.
- Quoted fields may contain the delimiter, line breaks and doubled quotes.
- A header line repeated in the middle of a file is skipped.
- Rows that are not records - notes, comments (`# ...`) and the total row
  (`Celkem;;;;;;2865;`) at the end of a file - are skipped and reported as
  `not-a-record`.

### Dates

Always `YYYY-MM-DD` or `null`.

| Source                     | Result       |
| -------------------------- | ------------ |
| `2024-10-04`               | `2024-10-04` |
| `7. 2. 2025`, `07.10.2024` | `2025-02-07` |
| `43552` (Excel serial)     | `2019-03-28` |
| `31. 9. 2026` (not a date) | `null`       |
| `1900-01-01` (placeholder) | `null`       |

### Amounts

Always a number or `null`.

| Source     | Result |
| ---------- | ------ |
| `450,00`   | `450`  |
| `1 300,00` | `1300` |
| `2 100 Kč` | `2100` |
| `450,- Kč` | `450`  |
| `zdarma`   | `0`    |

### Names

`firstName` / `lastName` / `fullName` are always "first last", no matter how
the source file ordered them (`absolvovana_skoleni.csv` writes the surname
first). Casing is fixed: `LUCIE` becomes `Lucie`, `růžička` becomes `Růžička`.

### Departments

Mapped onto one canonical name, so that `správa budov`, `SPRÁVA BUDOV` and
`Sprava budov` all become `Správa budov`. The diacritic-free `departmentKey`
is there for grouping and filtering.

### E-mail addresses

Trimmed, inner spaces removed, lower-cased. Invalid addresses are flagged.

### Training codes

Upper-cased, separators normalized (`POZ OCH` becomes `POZ-OCH`), so they can
be matched against the catalogue.

### Catalogue validity

`24` stays `24` months, `2 roky` becomes `24` months and the original wording
stays in `validityText`.

## Usage from the code

```ts
import { normalizeCsvBuffer } from "@app/api"; // or the local path

const result = normalizeCsvBuffer(fileBuffer, { kind: "zamestnanci" });
result.rows;      // Employee[]
result.warnings;  // NormalizeWarning[]
```

The types of the rows live in `@app/shared`, so the frontend can use exactly
the same shapes.

## Scripts

```bash
pnpm dev         # tsx watch src/index.ts
pnpm build       # tsup -> dist/
pnpm test        # vitest
pnpm typecheck   # tsc -p .
pnpm backup      # one backup of the database
pnpm backup:loop # a backup every BACKUP_MINUTES minutes
```
