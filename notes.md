# Projekt
Single-repo React/node aplikace s lokalni sqlite databazi.

# Oznameni
Tenhle projetk je "demo" aplikace, umyslne byli opomenuty funkcionality jako hesla pro jednodusi navigovani aplikace (ty by se totiz ziskavali z emailu). 

# Technologie
Front-end: React, TypeScript, Vite
Back-end: Node, TypeScript, Express, SQLite

- React: industry standard pro front-end
- Vite: uzitecny frontend builder
- Node: pro low-traffic backend idealni
- TypeScript: alespon o neco spolehlivejsi nez javascript
- Express: REST API goto
- SQLite: proc neco davat na internet kdyz muze byt lokalne
- Nginx + Docker: proxy reseni

# Tree

muni-test/
├── apps/
│   ├── api/                     API + databaze + gate
│   │   ├── src/
│   │   │   ├── index.ts         server, otevre databazi a naplni ji
│   │   │   ├── app.ts           routy a stit (vsechno za gate)
│   │   │   ├── auth.ts          tokeny, heslo, role
│   │   │   ├── config.ts        nastaveni z prostredi
│   │   │   ├── db.ts            tabulky v SQLite
│   │   │   ├── store.ts         pristup k datum
│   │   │   ├── sqlite.ts        node:sqlite
│   │   │   ├── backup.ts        zaloha databaze
│   │   │   ├── backup-cli.ts    jedna zaloha / obnoveni
│   │   │   ├── backup-loop.ts   zaloha kazdou hodinu
│   │   │   ├── paths.ts         kde jsou CSV
│   │   │   ├── rateLimit.ts     omezeni pocatecnich pokusu
│   │   │   ├── roles.ts         admin / vedouci / zamestnanec
│   │   │   ├── normalizer/      CSV -> JSON
│   │   │   ├── routes/          auth, dashboard, admin, normalize
│   │   │   └── __tests__/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                     panel
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx          gate -> login -> pohled
│       │   ├── api.ts           klient, tokeny v localStorage
│       │   ├── components/      Panel, StatTile, Badge, Button, ...
│       │   ├── pages/           Gate, Login, Employee, Manager, Admin
│       │   └── lib/format.ts    ceske nazvy a datumy
│       ├── Dockerfile
│       ├── nginx.conf           /api -> api:3000
│       └── package.json
├── packages/
│   └── src/                    sdilene typy
├── data/                       CSV soubory (prvni naplneni DB)
├── docker-compose.yml          api + web + backup
├── .env.example
└── package.json
(ai gen.)

# AI vyuziti
Z duvodu casoveho limitu jsem se rozhodnl pro rozsahle vyuziti AI za ucelem zrychleni vyvoje.  
Specificky pro data normalizer,zaklad front-end UI, dokumentaci (temer vsechny komenty),  
init. nastaveni projektu(porad si nepamatuju configy), db zalohy a reseni docker compose.
Testy (hlavne normalizeru) byly prakticky ciste napsane s AI, nicmene pod prisnymi  
instrukcemi a naslednou kontrolou.
Pouzite nastroje: 
- opencode (manager)
- deepseak (model)
- supermaven (prakticky extenze lsp - ~gpt-2)
Opravy: 
front-end:
- problemy s responzivitou
- opravy spelovani
back-end:
- ascii problemy
- neprehledne rozdeleni
- dockerizace, zejmena databaze

# Ostatni nastroje
- OpenWebUI
- NeoVim
- git
- docker
- hetzner cloud

# Zaver
Obecne si v programovani uzivam resemi komplexnich automatizaci a systemu kolem nich,  
nicmene kvuli mim cilum s timto projektem tato mentalita byla vymenena za maximalizaci  
mnozstvi codu a zaroven minimalizaci bugu. Musim ale rict, ze finalni produkt se za me docela povedl,  
4h prace se vsim vsudy neni vubec spatne.

# Cas
- brainstrom + 30min zalozeni projektu (session 1)
- 2h prace na hlanvi casti (session 2)
- 20min oprava nvim lsp  (session 2)
- ? pre-prod checky
- ? deploy 
