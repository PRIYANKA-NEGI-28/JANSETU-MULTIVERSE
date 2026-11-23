# JanSetu Multiverse — Production Deployment & Free-Tier Provisioning Guide

**Version:** 1.0.0  
**Effective Date:** November 24, 2026  
**Target Infrastructure:** Zero-Cost Free-Tier Stack  
**Maintainer:** JanSetu Core Infrastructure Team (`devops@jansetu.gov.in`)

---

## 1. Architecture Topology Overview

JanSetu Multiverse is engineered to run at scale entirely within enterprise-grade **always-free or generous developer tiers**:

```
                              ┌─────────────────────────────────────────┐
                              │           Cloudflare Edge CDN           │
                              ├────────────────────┬────────────────────┤
                              │ Cloudflare Pages   │ Cloudflare Workers │
                              │ (apps/web)         │ (apps/api)         │
                              └─────────┬──────────┴─────────┬──────────┘
                                        │                    │
              ┌─────────────────────────┼────────────────────┼─────────────────────────┐
              │                         │                    │                         │
              ▼                         ▼                    ▼                         ▼
      ┌───────────────┐         ┌───────────────┐    ┌───────────────┐         ┌───────────────┐
      │ Neon Postgres │         │ Upstash Redis │    │ Upstash QStash│         │ Cloudflare R2 │
      │ Serverless DB │         │ Rate Limiting │    │ Async Triage  │         │ Media Storage │
      └───────────────┘         └───────────────┘    └───────────────┘         └───────────────┘
              ▲                                                                        ▲
              │                                                                        │
              └─────────────────────────┬──────────────────────────────────────────────┘
                                        │
                              ┌─────────┴─────────┐
                              │  Expo EAS Mobile  │
                              │  (apps/mobile)    │
                              └───────────────────┘
```

---

## 2. Free-Tier Service Matrix

| Service | Provider | Free Allowance | Role in JanSetu |
| :--- | :--- | :--- | :--- |
| **Relational Database** | [Neon Postgres](https://neon.tech) | 0.5 GB storage, serverless compute, PITR | Canonical DB: users, sessions, complaints, clusters, audit logs |
| **API Edge Gateway** | [Cloudflare Workers](https://workers.cloudflare.com) | 100,000 requests/day, 10ms CPU/req | Serverless Hono API engine (`apps/api`) |
| **Web SPA Hosting** | [Cloudflare Pages](https://pages.cloudflare.com) | Unlimited bandwidth & requests | Static Vite React single-page portal (`apps/web`) |
| **Object Storage** | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) | 10 GB storage, 1M Class A, 10M Class B ops/mo, $0 egress | Citizen hazard photos, voice notes, generated RTI PDFs |
| **Rate Limiting** | [Upstash Redis](https://upstash.com) | 10,000 commands/day, persistent memory | Sliding-window edge IP rate limiter |
| **Job Queue & Crons** | [Upstash QStash](https://upstash.com/docs/qstash) | 500 messages/day, retry backoff | Asynchronous AI triage jobs & 15-min SLA cron scanner |
| **Realtime Broadcast** | [Ably Realtime](https://ably.com) | 6M messages/month, 200 peak connections | Live WebSocket pushes for complaints & IoT alerts |
| **AI Inference** | Google Gemini / Groq | Free developer tiers (15 RPM / 30 RPM) | Intelligent classification, transcription, and RTI drafting |
| **Mobile Build CI** | [Expo EAS](https://expo.dev/eas) | 30 free Android cloud builds/month | Standalone installable Android APK preview builds |

---

## 3. Step-by-Step Free-Tier Provisioning Guide

### Step 3.1: Neon Serverless PostgreSQL
1. Sign up at [neon.tech](https://neon.tech) and create a project named `jansetu-multiverse` in region `ap-southeast-1` (Singapore) or closest to your target jurisdiction.
2. Note your connection string in Pooled mode:
   ```text
   postgresql://[user]:[password]@[endpoint]-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Run Drizzle database schema migrations from the repository root:
   ```bash
   DATABASE_URL="<your_neon_connection_string>" pnpm --filter @jansetu/db push
   ```
4. Verify table creation (`users`, `sessions`, `accounts`, `verifications`, `complaints`, `clusters`, `complaint_events`, `officer_profiles`, `wards`, `iot_devices`, `iot_events`).

---

### Step 3.2: Upstash Redis & QStash
1. Sign up at [console.upstash.com](https://console.upstash.com).
2. **Create Redis Database:**
   - Name: `jansetu-ratelimit`
   - Primary Region: matching your Neon database.
   - Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. **QStash Configuration:**
   - Navigate to QStash in the Upstash console.
   - Copy `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`.

---

### Step 3.3: Cloudflare R2 Media Storage
1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) and navigate to **R2 Object Storage**.
2. Click **Create Bucket**:
   - Bucket Name: `jansetu-media-prod`
   - Location: Automatic
3. Under bucket settings, enable a **Custom Domain** or use the free `r2.dev` public development URL (e.g. `https://media.jansetu.gov.in`).
4. Generate R2 API Tokens under Account Settings -> R2 API Tokens with `Object Read & Write` permissions. Record `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.

---

### Step 3.4: Ably Realtime WebSockets
1. Sign up at [ably.com](https://ably.com) and create an app named `JanSetu Realtime`.
2. Under API Keys, copy your Root API key (`ABLY_API_KEY`).
3. JanSetu API automatically exchanges this key for short-lived, scoped client capability tokens via `GET /api/v1/realtime/token`.

---

### Step 3.5: AI Provider Keys (Optional but Recommended)
- **Google Gemini:** Get a free API key at [aistudio.google.com](https://aistudio.google.com) (`GEMINI_API_KEY`).
- **Groq:** Get a free ultra-fast Llama-3 / Whisper API key at [console.groq.com](https://console.groq.com) (`GROQ_API_KEY`).
- *Note:* If neither key is provided, JanSetu automatically activates its built-in rule-based classifier and dual-language Section 6(1) RTI template engine.

---

## 4. Deploying the Backend API (`apps/api`)

1. Install Wrangler CLI:
   ```bash
   pnpm --filter @jansetu/api exec wrangler login
   ```
2. Provision production secrets securely in Cloudflare:
   ```bash
   pnpm --filter @jansetu/api exec wrangler secret put DATABASE_URL --env production
   pnpm --filter @jansetu/api exec wrangler secret put BETTER_AUTH_SECRET --env production
   pnpm --filter @jansetu/api exec wrangler secret put UPSTASH_REDIS_REST_URL --env production
   pnpm --filter @jansetu/api exec wrangler secret put UPSTASH_REDIS_REST_TOKEN --env production
   pnpm --filter @jansetu/api exec wrangler secret put QSTASH_CURRENT_SIGNING_KEY --env production
   pnpm --filter @jansetu/api exec wrangler secret put QSTASH_NEXT_SIGNING_KEY --env production
   pnpm --filter @jansetu/api exec wrangler secret put ABLY_API_KEY --env production
   pnpm --filter @jansetu/api exec wrangler secret put GEMINI_API_KEY --env production
   pnpm --filter @jansetu/api exec wrangler secret put GROQ_API_KEY --env production
   pnpm --filter @jansetu/api exec wrangler secret put SENTRY_DSN --env production
   pnpm --filter @jansetu/api exec wrangler secret put IOT_DEVICE_SECRETS --env production
   ```
3. Deploy the worker:
   ```bash
   pnpm --filter @jansetu/api exec wrangler deploy --env production
   ```
4. Verify the deployment:
   ```bash
   curl -i https://jansetu-api-prod.[your-subdomain].workers.dev/health
   ```

---

## 5. Deploying the Web Application (`apps/web`)

### Method A: Cloudflare Pages Git Integration (Recommended)
1. In Cloudflare Dashboard, go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
2. Select the `JANSETU-MULTIVERSE` repository.
3. Configure build settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `pnpm --filter @jansetu/web build`
   - **Build Output Directory:** `apps/web/dist`
   - **Root Directory:** `/` (leave empty or `/`)
4. Set Environment Variables:
   - `VITE_API_URL`: `https://jansetu-api-prod.[your-subdomain].workers.dev`
   - `VITE_SENTRY_DSN`: `[optional_sentry_dsn]`
5. Click **Save and Deploy**. Cloudflare automatically applies SPA routing via `apps/web/public/_redirects` and asset caching via `apps/web/public/_headers`.

### Method B: Direct CLI Deployment
```bash
# 1. Build web application locally
pnpm --filter @jansetu/web build

# 2. Deploy directly to Cloudflare Pages
pnpm dlx wrangler pages deploy apps/web/dist --project-name jansetu-web
```

---

## 6. Building the Mobile Android APK (`apps/mobile`)

JanSetu uses Expo Application Services (EAS) free tier to compile installable Android APKs without requiring Android Studio or Google Play Developer fees.

1. Install EAS CLI and authenticate:
   ```bash
   pnpm dlx eas-cli login
   ```
2. Link your project:
   ```bash
   cd apps/mobile && pnpm dlx eas-cli project:init
   ```
3. Run the free APK preview build:
   ```bash
   pnpm dlx eas-cli build --platform android --profile preview
   ```
4. EAS compiles the project in the cloud and provides a direct QR code / download URL to install the `.apk` on physical Android devices.

---

## 7. Automated Post-Deployment Verification

Run the automated smoke test script against your live production API:

```bash
# Verify against local dev server
pnpm smoke-test

# Verify against live deployed Cloudflare Worker
API_URL="https://jansetu-api-prod.[your-subdomain].workers.dev" pnpm smoke-test
```

The smoke test suite verifies:
1. `GET /health` service health and uptime.
2. `GET /api/v1/meta` and `/api/v1/meta/stats` public metadata and civic statistics.
3. Better Auth session resolution and role token simulation.
4. Spatial ward lookup (`GET /api/v1/geo/resolve-ward`).
5. Citizen complaint intake, idempotency replay, and tracking retrieval with strict PII redaction.
6. IoT cryptographic edge HMAC verification and signature rejection.
7. Admin RBAC route authorization gates (401 on unauthenticated, 403 on citizen, 200 on admin).
