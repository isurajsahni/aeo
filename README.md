# AEO Audit

Audit a website's **Answer Engine Optimization** readiness: how well it can be found, understood and cited by AI assistants such as ChatGPT, Claude, Perplexity and Gemini. Built for agencies auditing client websites.

> **Status: Phase 4 of 5.** Auth, projects, a 31-check audit engine (single page or site crawl) on a BullMQ queue, live progress, history, trends and comparison, plus AI visibility testing across ChatGPT, Claude, Perplexity and Gemini (category F).
> Next: competitor comparison, white-label PDF export and scheduled re-audits (Phase 5).

## Stack

| Layer | Tech |
|---|---|
| Client | React 19, Vite, React Router, Tailwind CSS 4, lucide-react (Recharts from Phase 2) |
| Server | Node.js 20.19+, Express 5 (ES modules), Mongoose, zod, pino |
| Auth | JWT in an httpOnly `SameSite=Lax` cookie, bcrypt |
| Infra | MongoDB 7, Redis 7 (BullMQ from Phase 3) via docker-compose |

## Getting started

### 1. Prerequisites

- Node.js **20.19 or newer** (`node -v`)
- Docker Desktop, *or* local MongoDB and Redis (`brew install mongodb-community redis`)

### 2. Install and configure

```bash
npm install
cp .env.example .env
```

Then set `JWT_SECRET` in `.env` to a long random value:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Install headless Chromium (for the JavaScript-rendering check)

```bash
npx playwright install chromium-headless-shell
```

Without it, audits still run; the "Content visible without JavaScript" check is just skipped.

Optional: add a free [PageSpeed Insights API key](https://developers.google.com/speed/docs/insights/v5/get-started) as `PAGESPEED_API_KEY` in `.env`. Without it Google's shared quota is usually exhausted and the Core Web Vitals check is skipped.

### 4. Start MongoDB and Redis

```bash
npm run services:up      # docker compose up -d
```

No Docker? `npm run db:local` starts a local MongoDB (data persisted in `server/storage/mongo`) and `npm run redis:local` a local Redis, each in its own terminal. Without Redis the app still runs: audits fall back to an in-process runner (see *Job queue* below).

### 5. Seed a demo account (optional)

```bash
npm run seed
```

This creates a demo user and an "Example Co" project. The login comes from `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` in `.env`. The script is idempotent and resets the demo password each time it runs.

### 6. Run the app

```bash
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:4000/api (health check: `/api/health`)

In development, Vite proxies `/api` to the server, so the auth cookie is same-origin.

## Scripts (run from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | API (with `node --watch`) and client together |
| `npm test` | Server Jest suite (spins up an in-memory MongoDB; no Docker needed) |
| `npm run seed` | Create or reset the demo user and project |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the API without watch mode |
| `npm run services:up` / `services:down` | Start/stop MongoDB + Redis containers |
| `npm run db:local` / `redis:local` | Local MongoDB / Redis without Docker (dev only) |
| `npm run worker` | Standalone audit worker (with `RUN_WORKER=false` on the API) |

## Project structure

```
client/                 React app (Vite)
  src/api/              fetch wrapper (ApiError, 401 handling) and endpoint helpers
  src/context/          AuthContext (session state)
  src/components/       ui/ primitives, layout/ shell + route guards, projects/
  src/pages/            route-level pages
server/
  app.js                Express app factory (used by tests)
  server.js             boot, DB connect, graceful shutdown
  config/               zod-validated env config, MongoDB connection
  models/               Mongoose models (users, projects; more per phase)
  validators/           zod request schemas
  routes/ controllers/ services/   HTTP layer → thin controllers → business logic
  middleware/           auth, validation, errors, rate limits, helmet/CORS
  utils/                AppError, logger, jwt, domain normalization
  audit/ providers/ queues/        audit engine, AI providers and jobs (Phases 2–5)
  scripts/seed.js
  tests/
```

## API

All responses are JSON. Errors always look like this:

```json
{ "error": { "message": "Please check the highlighted fields", "code": "VALIDATION_ERROR", "details": [{ "path": "domain", "message": "…" }] } }
```

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | – | DB status |
| POST | `/api/auth/register` | – | `{ name, email, password }`, sets session cookie |
| POST | `/api/auth/login` | – | `{ email, password }`, sets session cookie |
| POST | `/api/auth/logout` | – | clears cookie |
| GET | `/api/auth/me` | ✓ | current user |
| GET | `/api/projects` | ✓ | your projects, most recently updated first |
| POST | `/api/projects` | ✓ | `{ name, domain, competitors?, notes? }` |
| GET | `/api/projects/:id` | ✓ | |
| PATCH | `/api/projects/:id` | ✓ | any subset of the create fields |
| DELETE | `/api/projects/:id` | ✓ | also deletes its audits |
| GET | `/api/projects/:id/audits` | ✓ | audit history (no check payloads) |
| POST | `/api/projects/:id/audits` | ✓ | `{ url?, mode?: 'single' \| 'site', maxPages? }`: starts an audit (202). Defaults to a single-page audit of the homepage; the URL must be on the project domain. 409 if one is already running |
| GET | `/api/audits/:id` | ✓ | full results: scores, fixes, checks |
| GET | `/api/audits/:id/status` | ✓ | lightweight progress for polling |
| GET | `/api/audits/:id/events` | ✓ | Server-Sent Events: `progress` events until a final `done` |
| GET | `/api/audits/:id/pages` | ✓ | per-page results, worst first (no check payloads) |
| GET | `/api/audits/:id/pages/:pageId` | ✓ | one page with all its check results |
| GET/POST | `/api/projects/:id/prompts` | ✓ | list / add target prompts `{ text, location?: { city, region, country }, active? }` |
| PATCH/DELETE | `/api/projects/:id/prompts/:promptId` | ✓ | edit, pause or delete a prompt |
| GET | `/api/visibility/providers` | ✓ | AI assistants configured on this server |
| POST | `/api/projects/:id/visibility-runs` | ✓ | `{ providers?, runsPerPrompt?, promptIds? }`: starts a test (202); 409 if one is running |
| GET | `/api/projects/:id/visibility-runs` | ✓ | test history with headline rates |
| GET | `/api/visibility/runs/:id` (`/status`) | ✓ | full summary (or lightweight progress) |
| GET | `/api/visibility/runs/:id/results?prompt=&provider=` | ✓ | the stored answers with their analysis |
| DELETE | `/api/audits/:id` | ✓ | |

Domains can be entered as `example.com` or as a full URL. They are stored as a bare lowercase hostname. Localhost, private-network suffixes, raw IP addresses and non-http(s) schemes are rejected. The Phase 2 crawler adds DNS-level SSRF checks on every request and after every redirect.

## How an audit works

1. **Gather** (`server/audit/context.js`): the only module that touches the network. It reads robots.txt (and stops if our crawler token `AEOAuditBot` is disallowed), fetches the page, `/llms.txt`, the sitemap and the `http://` variant, then renders the page in headless Chromium and calls PageSpeed Insights in parallel.
2. **Check** (`server/audit/checks/**`): each check is a pure function of that context, so it can be unit-tested with an HTML fixture. It returns `{ id, category, title, status, score, weight, details, recommendation, impact, effort }`.
3. **Score** (`server/audit/scoring`): weighted category scores, an overall 0-100 score, a letter grade, an impact-vs-effort fix list and a plain-English summary.

Weights and grade bands live in [`server/config/scoring.json`](server/config/scoring.json). Edit them without touching code. To add a check: create a module with `defineCheck()`, register it in `server/audit/checks/index.js`, and give it a weight.

| Category | Checks |
|---|---|
| A. AI Crawler Access | AI bots in robots.txt (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot), indexability (noindex/nosnippet), raw vs JS-rendered content, sitemap + lastmod freshness, llms.txt |
| B. Structured Data | JSON-LD validity, Organization/LocalBusiness (+ sameAs), required fields for Organization, LocalBusiness, FAQPage, HowTo, Article/BlogPosting, Product, BreadcrumbList and Person, content-type schema, schema dates, breadcrumbs |
| C. Answer-Ready Content | Direct answers under headings (8-60 words), question-style headings, lists/tables/FAQ, heading hierarchy, content depth, freshness, Flesch readability |
| D. Trust & Authority | Author byline/bio, About and Contact pages, reviews/testimonials, outbound citations, privacy policy |
| E. Technical Basics | HTTPS + redirect + HSTS, status/redirect chain, title and meta description length, Core Web Vitals, canonical, Open Graph, lang/viewport |

Checks that don't apply (e.g. bylines on a homepage) are marked *not applicable* and excluded from the score.

### AI visibility (category F)

On a project's **AI visibility** page you add target prompts, such as "best dentist in Ludhiana", with an optional city and country. A test asks every active prompt *N* times (default 3) to each selected assistant, with web search on, the way a customer would ask it. Each answer is checked for:

- a **brand mention**: the project name, the domain, its first label, and any extra brand names on the project, matched as whole words
- the **position** among the answer's list items, if it's a ranked list
- whether the client's **domain is cited** as a source, and where in the source list
- **competitors** mentioned, from the project's competitor domains
- **sentiment** around the mention, from a word list (no extra model call)

Results are **rates over repeated asks**, not yes/no: a mention rate and citation rate per assistant, per prompt, and per prompt × assistant, plus share of voice against competitors. Every answer is stored and can be read in the UI.

| Provider | API | Default model (override with `*_MODEL`) |
|---|---|---|
| OpenAI (ChatGPT) | Responses API + `web_search` tool | `gpt-5.5` |
| Anthropic (Claude) | Messages API + `web_search_20260209`, server-side refusal fallbacks | `claude-opus-5-5` |
| Perplexity | Sonar API (`/v1/sonar`), search built in | `sonar` |
| Google (Gemini) | Interactions API + `google_search` | `gemini-3.8-flash` |

A provider is enabled when its API key is set; `VISIBILITY_PROVIDERS` restricts the set. Adapters live in `server/providers/` behind one interface (`ask({ prompt, location }) -> { text, citations, model, usage }`), so adding a provider is one class plus one line in the registry. Each request uses web search and is billed to your keys; the run dialog shows the request count first, and `VISIBILITY_MAX_CALLS_PER_RUN` caps it.

**Scoring:** an audit includes category F from the project's latest completed test no older than `VISIBILITY_MAX_AGE_DAYS` (default 30). It has five checks: mention rate (full marks at 60%), citation rate (40%), assistant coverage, share of voice (50%), and sentiment. With no recent test they're skipped and category F doesn't affect the score.

### Site crawls

A site crawl audits up to `maxPages` pages (default 25, cap `MAX_CRAWL_PAGES`). It visits the start page's links first, then sitemap URLs, then links found on later pages, staying on the same host and skipping files and app paths such as `/cart` and `/wp-admin`. robots.txt is respected for our crawler token. JavaScript rendering runs on the first `RENDER_MAX_PAGES` pages, and Core Web Vitals on the start page only.

Each page runs every check. Results are combined per check: **page** checks are averaged across the pages where they apply, count as passing only if every page passes, and list the worst pages; **site** checks (llms.txt, sitemap, HTTPS, Core Web Vitals) come from the start page. Every page's own results are stored and shown in the report's pages table.

### Job queue

Audits run as BullMQ jobs in Redis, with job id = audit id, so the same audit is never queued twice. Jobs survive restarts, and a crashed or stalled job is retried once. The worker runs inside the API process by default (`RUN_WORKER=true`); set it to false and run `npm run worker` to process audits on a separate machine. With `QUEUE_DRIVER=auto` (the default) the API uses an in-process runner when Redis is unreachable, and logs a warning. Use `QUEUE_DRIVER=bullmq` in production to require Redis.

Live progress reaches the browser over Server-Sent Events. The stream reads progress from MongoDB, so it works wherever the worker runs. The client falls back to polling if a proxy blocks the stream.

### Crawler safety

- **SSRF protection:** only http(s) on standard ports; no credentials in URLs; localhost and private, reserved, link-local and CGNAT addresses (including IPv4-mapped IPv6) are refused. The check runs inside the HTTP agent's DNS lookup on **every connection, including each redirect hop**, which also blocks DNS rebinding. Headless-browser subrequests pass through the same guard.
- **Limits:** request timeout, a maximum response size, a maximum number of redirects, and a cap on concurrent audits.
- **Politeness:** a clear User-Agent, robots.txt respected (including `Crawl-delay`, capped at 10s) and a per-host delay between requests.

## Security notes

- Passwords are hashed with bcrypt (`BCRYPT_ROUNDS`, default 12). Login failures return the same error and take the same time whether or not the email exists.
- The session JWT lives in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Together with the CORS allowlist (`CLIENT_ORIGIN`), this protects state-changing routes against CSRF.
- helmet sets security headers; the API sends a `default-src 'none'` CSP.
- Rate limits: 600 requests per 15 minutes per IP on the API, and 20 per 15 minutes on login/register. Behind a proxy, set `TRUST_PROXY` so client IPs are correct.
- Every project query is scoped to its owner. Another user's project returns 404, which also hides that it exists.

## Deploying: Vercel (frontend) + Render or Railway (API)

Vercel serves the React app; the API runs as a Docker container on Railway (it needs a long-running process for background audits and headless Chromium, which Vercel functions can't provide). Vercel proxies `/api/*` to Railway, so the browser only ever talks to your Vercel domain and the session cookie stays first-party.

```
browser ──► your-domain (Vercel) ──/api/*──► Railway (Express + Chromium) ──► MongoDB Atlas
```

1. **MongoDB Atlas**: create a free M0 cluster and a database user. Under *Network Access* allow `0.0.0.0/0` (Railway has no fixed IPs on the starter plans). Copy the `mongodb+srv://...` connection string and add a database name, e.g. `/aeo_audit`.
2. **API host.** **Render:** *New → Blueprint →* pick the repo; `render.yaml` configures the service, generates `JWT_SECRET` and asks for the rest (Starter plan or above; Free sleeps when idle). **Railway:** *New Project → Deploy from GitHub repo*. It builds the `Dockerfile` (see `railway.json`). Set these variables:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Atlas connection string |
   | `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `CLIENT_ORIGIN` | your Vercel URL, e.g. `https://audit.youragency.com` |
   | `TRUST_PROXY` | `2` (Vercel proxy + Railway proxy) |
   | `SERVE_CLIENT` | `false` (Vercel serves the UI) |
   | `ALLOW_REGISTRATION` / `SIGNUP_ALLOWLIST` | e.g. `true` + `@youragency.com` |
   | `PAGESPEED_API_KEY` | optional, recommended |

   Give the service at least **1 GB RAM** (Chromium), then *Settings → Networking → Generate Domain* and copy the hostname.
3. **vercel.json**: replace `REPLACE-WITH-RAILWAY-API-HOST` with the API hostname (e.g. `aeo-audit-api.onrender.com`) and push.
4. **Vercel** (frontend): *Add New → Project →* import the repo, leave the root directory as the repo root. `vercel.json` sets the install/build commands and output. Add your custom domain under *Settings → Domains*.
5. **Lock down sign-ups**: register your own account, then set `ALLOW_REGISTRATION=false` (or keep an allowlist) on Railway.

Every push to `main` redeploys both. The server refuses to start in production with the placeholder `JWT_SECRET`, a localhost `CLIENT_ORIGIN`, or insecure cookies.

**Single-host alternative:** the same Docker image serves the UI too (`SERVE_CLIENT=true`, the default in production), so you can skip Vercel and point your domain at Railway or any Docker host.
