# web

The panel. A gray-scale React app without a router - the state of the app says
which view is shown.

## The views

| View     | Who        | What is shown                                                                                         |
| -------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| Gate     | everybody  | The password of the panel - it opens the whole app.                                                   |
| Login    | everybody  | E-mail only - behind the open gate.                                                                   |
| Employee | `employee` | The trainings of the person, the next session, what is missing.                                       |
| Manager  | `manager`  | The team, the courses of the team, who has to catch up, and the training plan with the warnings.      |
| Admin    | `admin`    | Everybody, the catalogue, the sessions, the completed trainings and the whole training plan - with the buttons to change them. |

The role comes from the API (it is derived from the data), the panel only
switches the view.

## How it is put together

```text
src/
  api.ts            the API client (the tokens live in localStorage)
  App.tsx           the shell: the gate, the login gate, the header, the role switch
  components/       Panel, StatTile, Badge, Button, Field, Modal, Table, TrainingPlan
  lib/format.ts     the Czech names and the date formatting
  pages/            GatePage, LoginPage, EmployeePage, ManagerPage, AdminPage
  pages/admin/      the tabs of the admin (people, courses, sessions, trainings, plan)
```

The types of the API live in `@app/shared`, so the frontend uses exactly the
same shapes as the backend.

## The gate and the login

The app has two steps:

1. **The gate** (`pages/GatePage.tsx`) - one password for the whole panel. The
   API answers with a token, which is kept in `localStorage` and sent in the
   `X-Access-Token` header with every request. Without it the API gives
   nothing away, so the whole panel is shut.
2. **The login** (`pages/LoginPage.tsx`) - the e-mail address of the person.
   The API answers with the session token, which is kept in `localStorage` and
   sent in the `Authorization` header.

The password of the gate is set on the server (`PANEL_PASSWORD`). In the local
development (without `PANEL_PASSWORD` on the server) it is `muni2026` - the
gate shows it only in the development build.

The button *Zamknout panel* throws both tokens away and the gate asks again.

There are three useful accounts:

| E-mail                             | Role     |
| ---------------------------------- | -------- |
| `jitka.simkova@vzorova.example`    | admin    |
| `tereza.urbanova@vzorova.example`  | manager  |
| `katerina.kopecka@vzorova.example` | employee |

## Scripts

```bash
pnpm dev        # vite on :5173, /api is proxied to :3000
pnpm build      # tsc -b && vite build
pnpm lint       # eslint
```

## In the docker setup

The panel is built by vite and served by nginx (`apps/web/Dockerfile`). The
nginx passes everything under `/api` to the API container, so the browser only
needs one address and there is nothing to configure in the build - the API
client always asks for `/api/...`.

```bash
# the whole setup (API, panel and backup)
docker compose up -d --build

# the panel is then on http://localhost:8080
```
