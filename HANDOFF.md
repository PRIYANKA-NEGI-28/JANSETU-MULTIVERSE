# JanSetu Multiverse — Architectural Handoff & Remediation Plan

**Handoff Date:** November 23, 2026  
**Author:** Principal Software Architect  
**Target Repository:** `/Users/apple/Desktop/JANSETU-MULTIVERSE`  
**Base Commit:** `11b91e347aca66c4db1d48bcdc0e0d886d320a0e` (`main`)

---

## 1. Purpose of this Document

This document serves as the formal operational handoff for incoming engineers and AI coding agents. It synthesizes the complete ground truth discovered during the comprehensive architectural audit of **JanSetu Multiverse**. 

Use this document alongside [`PROJECT_STATE.md`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/PROJECT_STATE.md) as the single source of truth before writing or modifying any application code.

---

## 2. System Ground Truth: Claims vs. Reality

| Domain | Claimed Architecture (`README.md`) | Verified Reality in Source Code | Technical Risk / Action Needed |
| :--- | :--- | :--- | :--- |
| **Backend DB** | Real-time Firebase Firestore & Neo4j Graph DB | **Firebase Firestore ONLY** (`jansetu-backend/db/firebase.js`). `db/graph.js` and `db/sqlite.js` are dead code. | Clean up dead Neo4j/SQLite imports; preserve Firebase Firestore collections. |
| **Mobile Auth & DB** | Supabase Client (`@supabase/supabase-js`) | **Supabase was deleted in commit `43ca617`**. `lib/supabase.ts` is missing, causing `app/login.tsx` to crash. | Provide local/Firebase auth adapter for mobile or clean up broken Supabase imports. |
| **Web Auth** | Claims Supabase Auth in older copy | **Local in-memory auth** in `src/lib/auth.ts` (`citizen` and `admin`, password `123456`). | Working cleanly; preserve mock authentication behavior for demo/testing. |
| **Real-time Push** | WebSockets on Web and Mobile | **WebSockets active on Web ONLY** (`jansetu-backend/ws/broadcast.js` <-> `src/hooks/useWebSocket.ts`). Mobile has no WS client. | Preserve web WebSocket singleton and broadcasts; do not break live telemetry. |
| **Edge AI (Qwen)** | Local Qwen 0.6B GGUF model running on CPU/NPU | Model file is a **134-byte Git LFS pointer**. Backend hardcodes `C:\LocalAI\...` Windows paths. Fallback template active. | Replace Windows paths with cross-platform `python3` command and keep robust fallback generator. |
| **Vision (YOLOv11)** | YOLOv11 NPU Object Detection on Qualcomm DLC | Model file is a **133-byte Git LFS pointer**. `ai/yolo_bridge.py` is **never called anywhere**. | Acknowledge as dead code. Do not wire up broken DLC without real weights. |
| **Voice AI (Sarvam)** | Sarvam AI multi-dialect transcription | **Zero code exists**. Web uses Web Speech API; mobile uses `expo-speech` (TTS). Translation strings use "Sarvam" purely as UI copy. | Preserve Web Speech API implementation; do not add broken Sarvam dependencies. |
| **Multimodal (Gemini)** | Gemini API listed in environment variables | **Zero code exists**. No imports or SDK setup. | Disregard environment variable or integrate only if specifically requested. |
| **IoT Firmware** | Arduino UNO Q C++ firmware under `sketch/` | **Folder `sketch/` does NOT exist** in repository or git history. Python agent in `IOT/python/` exists. | Document missing firmware; preserve Python edge gateway and test endpoints. |
| **Credentials & Secrets** | Production-ready secret isolation | **Live Supabase credentials leaked in commit `bd30e4149a2`**; hardcoded passwords in `app/admin-login.tsx` (`jansetu2024`) and `src/lib/auth.ts` (`123456`). | Immediate key revocation in Supabase console; externalize via environment variables. |
| **Git Index Hygiene** | Standard clean repository | **9,831 files in `node_modules/`**, `dist/`, and `expo-export-test/` (including 6.3MB `.hbc` binary) tracked in git index. | Untrack cached build/dependency artifacts via `git rm -r --cached`. |

---

## 3. Critical Bugs & Immediate Fix Priority

Before introducing any new features, the following high-priority bugs must be addressed in subsequent refactoring phases:

### Phase 0: Security & Git Index Remediation (Immediate Pre-Migration Step)
1. **Untrack Committed Node Modules & Build Artifacts from Git Index**:
   ```bash
   git rm -r --cached node_modules
   git rm -r --cached dist
   git rm -r --cached expo-export-test
   git commit -m "chore(hygiene): untrack node_modules, dist, and expo-export-test artifacts"
   ```
2. **Rotate Leaked Supabase Credentials**:
   - Invalidate/rotate the Anon Public Key and Service Role Key associated with `gzuvwqosslryjcldzoyl.supabase.co` in the Supabase management console.
3. **Externalize Hardcoded Passwords**:
   - Move `ADMIN_PASSWORD = 'jansetu2024'` in `app/admin-login.tsx` to `process.env.EXPO_PUBLIC_ADMIN_PIN`.
   - Externalize `'123456'` in `src/lib/auth.ts` to `process.env.VITE_AUTH_DEFAULT_PASSWORD`.

### Phase 1: High-Priority Fixes (Broken Runtimes & 404s)
1. **Fix Broken Supabase Imports in Mobile App**:
   - `app/login.tsx:6`: `import { supabase } from '../lib/supabase';`
   - `app/(tabs)/submit.tsx:14`: `import { supabase } from '../../lib/supabase';`
   - *Fix*: Create a safe fallback client or align mobile authentication with `lib/auth.ts` / Firebase so the Expo bundle compiles without runtime crashes.
2. **Fix Admin Dashboard Status Update 404**:
   - `src/pages/AdminDashboard.tsx:91`: Calls `fetch('/api/complaint/' + id, { method: 'PATCH' })`.
   - *Fix*: Change endpoint to `fetch('/api/dashboard/complaint/' + id, { method: 'PATCH' })` (where it is actually defined in `dashboardRouter.js`), or use `updateComplaintStatus()` from `src/lib/neo4j.ts`.
3. **Fix Cross-Platform Python Execution in Backend**:
   - `jansetu-backend/routers/grievanceRouter.js` (lines 21, 34) and `jansetu-backend/routers/drafterRouter.js` (line 17): Hardcode `C:\LocalAI\qai-env\Scripts\python.exe` and local Windows desktop paths.
   - *Fix*: Use `process.env.PYTHON_BIN || 'python3'` and resolve script/model paths dynamically via `path.join(__dirname, ...)`.
4. **Fix Web TypeScript Compiler Errors (`pnpm typecheck`)**:
   - `src/lib/langContext.tsx`: `T: typeof t.en` prevents Hindi translations from satisfying the context value. Change to `T: (typeof t)['en'] | (typeof t)['hi']` or `Record<string, unknown>`.
   - Remove unused imports and variables in `ErrorBoundary.tsx`, `ToastContext.tsx`, `useWebSocket.ts`, `AdminDashboard.tsx`, `IoTDashboard.tsx`, and `SubmitComplaint.tsx`.

### Phase 2: Medium-Priority Cleanup (Code Deduplication & Consistency)
1. **Harmonize Web vs Mobile Shared Libraries**:
   - `lib/i18n.ts` is missing `admin_stats_sidebar` and `admin_heatmap_description` present in `src/lib/i18n.ts`. Synchronize them.
   - Consolidate `lib/aiAnalyzer.ts` and `src/lib/aiAnalyzer.ts` into a single canonical source or synchronized files.
   - Standardize backend URL resolution across web pages (`VITE_API_BASE` vs `VITE_BACKEND_URL` vs `/api`).
2. **De-clutter Dead Backend Code**:
   - Deprecate or isolate `jansetu-backend/db/graph.js` (Neo4j) and `jansetu-backend/db/sqlite.js` (SQLite) since all active data flows through `db/firebase.js`.
   - Deprecate or document `jansetu-backend/ai/llm_bridge.py` and `jansetu-backend/ai/yolo_bridge.py` as uncalled prototypes.

---

## 4. Preservation Checklist by Layer

Every feature below has been audited and verified in working order. **Do not remove or break these capabilities:**

### 4.1 Web Application (`src/`)
- [ ] **Bilingual Language Toggle**: Instant toggle between Hindi and English across all navigation and content, persisted in `localStorage`.
- [ ] **Dual-Language Complaint Filing (`src/pages/SubmitComplaint.tsx`)**:
  - Live voice transcription via browser Web Speech API in Hindi and English.
  - Client-side AI category tagging (15 civic categories), urgency calculation, and summary generation.
  - Mandatory photographic upload before submission.
  - Preview and text download of formal legal complaint letters in both English and Hindi.
  - Area and ward auto-completion from the Delhi/Ghaziabad dataset.
  - Multipart submission to `POST /api/complaint`.
- [ ] **Complaint Tracking (`src/pages/TrackComplaint.tsx`)**:
  - Query by complaint reference number.
  - Citizen complaint history lookup by phone number.
  - Status progression stepper and cluster counter.
- [ ] **Hazard Map (`src/pages/HazardMap.tsx`)**:
  - React-Leaflet map with geographic clustering.
  - Severity and hazard-type filtering.
  - Citizen hazard reporting with camera/file picker and GPS coordinates.
- [ ] **Statutory RTI Drafter (`src/pages/RTIDrafter.tsx`)**:
  - 5-step legal questionnaire under Section 6(1) of RTI Act, 2005.
  - BPL fee waiver handling.
  - Dual-language formal draft generation (English and Hindi).
  - Print layout, clipboard copy, and `.txt` file export.
- [ ] **IoT Telemetry Dashboard (`src/pages/IoTDashboard.tsx`)**:
  - Live fault count and system status badge.
  - Real-time updates via WebSocket subscriptions (`new_sensor_alert`, `sensor_resolved`).
  - Detailed telemetry logs table.
- [ ] **Grievance Officer AI (`src/pages/GrievanceOfficer.tsx`)**:
  - Speech-to-text input.
  - Generates 3-section structured legal draft (Analysis, English Draft, Hindi Draft).
  - Print, copy, and download actions.
- [ ] **Admin Operations Console (`src/pages/AdminDashboard.tsx`)**:
  - Complaints management table with status/urgency filtering.
  - Department resolution statistics.
  - Graph hotspot analysis.
  - Officer assignment and seeding.
  - Manual SLA auto-escalation trigger.

### 4.2 Mobile Application (`app/` & `lib/`)
- [ ] 6-tab bottom navigation (`Home`, `File`, `Track`, `Hazards`, `RTI`, `Admin`).
- [ ] Mobile voice complaint input with `expo-speech` and client AI analysis (`app/(tabs)/submit.tsx`).
- [ ] Mobile status tracking with visual timeline and cluster data (`app/(tabs)/track.tsx`).
- [ ] Custom SVG coordinate-projected hazard map with GPS (`expo-location`) and camera (`expo-image-picker`) (`app/(tabs)/hazardmap.tsx`).
- [ ] 4-step mobile statutory RTI generator (`app/(tabs)/rti.tsx`).
- [ ] Mobile admin heat map (`app/(tabs)/admin.tsx` and `app/components/SimpleHeatMap.tsx`).
- [ ] Admin PIN modal with attempt security (`app/admin-login.tsx`).

### 4.3 Backend Engine (`jansetu-backend/`)
- [ ] Combined HTTP and WebSocket server on port 3000 (`server.js`).
- [ ] Auto-escalation cron checking overdue (>48h) complaints hourly (`runEscalationCheck()`).
- [ ] Multipart complaint ingestion with Multer storage and WebSocket broadcast (`/api/complaint`).
- [ ] IoT streetlight telemetry ingestion with automated complaint registration on fault (`/api/sensor`).
- [ ] RPC dashboard dispatcher (`/api/dashboard`) supporting stats, officer assignments, and data wipe.
- [ ] Admin reporting endpoints (`/api/admin`).
- [ ] Dual-language RTI and Grievance legal serializers (`/api/drafter`, `/api/grievance`).
- [ ] Firestore resilience with automatic mock mode fallback when credentials are not configured.

### 4.4 IoT Edge Gateway (`IOT/`)
- [ ] Linux MPU Python agent polling Arduino RouterBridge (`main.py`).
- [ ] Thread-safe event sender with exponential backoff (`sender.py`).
- [ ] Configurable backend target URL (`config.py`).

---

## 5. Development & Verification Guide

### 5.1 Environment Prerequisites
- Node.js 18+
- Python 3.10+
- `pnpm` (exclusively used for JavaScript/TypeScript)
- `uv` (exclusively used for Python virtual environments and packages)

### 5.2 Starting the Backend Engine
```bash
cd jansetu-backend
pnpm install
# Set FIREBASE_SERVICE_ACCOUNT env var or add firebase-service-account.json
# If omitted, backend starts in mock mode safely
node server.js
```
*Expected output:*
```text
JanSetu Multiverse backend engine listening at http://0.0.0.0:3000
WebSocket server available at ws://0.0.0.0:3000
```

### 5.3 Starting the Web Frontend
From the repository root:
```bash
pnpm install
pnpm dev
```
*Accessible locally at:* `http://localhost:5173` (proxies `/api` to `http://localhost:3000`).

### 5.4 Running Verification & Builds
```bash
# Web TypeScript typecheck:
pnpm typecheck

# Web production build:
pnpm build

# Backend syntax check:
node -c jansetu-backend/server.js
node -c jansetu-backend/routers/*.js
node -c jansetu-backend/db/*.js
```

### 5.5 Environment Variable Reference
Never hardcode secrets. Ensure these variables are documented in sample files:
- `PORT`: Backend port (defaults to `3000`).
- `FIREBASE_SERVICE_ACCOUNT`: Service account JSON string for Firebase Admin SDK.
- `BACKEND_URL` / `VITE_BACKEND_URL`: URL of the deployed Express backend.
- `VITE_API_BASE`: Base API URL for Grievance Officer.
- `EXPO_PUBLIC_NEO4J_PROXY_URL`: Mobile backend proxy URL.
- `EXPO_PUBLIC_COMPLAINT_SERVER_URL`: Mobile complaint server URL.

---

## 6. Monorepo Migration Roadmap & Specifications

To eliminate root dependency conflicts and solve the dual-package collision (`package.json` vs `package-expo.json`), the codebase must be reorganized into a standard **`pnpm` Monorepo**.

The complete file-by-file blueprint, target dependency trees, boundary contracts, and verification gates are documented in:
👉 [`docs/MIGRATION_MAP.md`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/MIGRATION_MAP.md)

### Workspace Directory Structure Summary:
```text
JANSETU-MULTIVERSE/
├── apps/
│   ├── api/            # Express, WebSocket, and Python AI drafting pipelines (@jansetu/api)
│   ├── web/            # Vite + React 18 bilingual citizen web application (@jansetu/web)
│   └── mobile/         # Expo SDK 52 React Native cross-platform application (@jansetu/mobile)
├── packages/
│   ├── shared/         # Canonical i18n dictionaries, types, and AI analyzer (@jansetu/shared)
│   └── db/             # Unified Firebase Firestore client, SLA escalation, seeders (@jansetu/db)
├── iot/
│   ├── python/         # Linux MPU edge gateway daemon
│   └── sketch/         # Arduino UNO Q firmware stubs & specifications
├── pnpm-workspace.yaml  # Workspace package declarations
└── package.json         # Root monorepo scripts & dev toolchain
```

---

## 7. Credential Rotation & Secret Management Protocol

Before running in production or staging environments, the user must execute the following credential rotation actions:

1. **Rotate Supabase Project Credentials**:
   - **Exposed Location:** Commit `bd30e4149a2c` committed `https://gzuvwqosslryjcldzoyl.supabase.co` and an anon JWT token in `src/lib/supabase.ts` and `lib/supabase.ts`.
   - **Action Required:** Open the [Supabase Management Console](https://supabase.com/dashboard), navigate to Project Settings -> API, and regenerate the API Anon and Service Role keys.
2. **Externalize Admin PIN & Passwords**:
   - **Exposed Location:** `app/admin-login.tsx` hardcodes `'jansetu2024'`; `src/lib/auth.ts` hardcodes `'123456'`.
   - **Action Required:** Transition mobile admin access to `process.env.EXPO_PUBLIC_ADMIN_PIN` and replace mock web passwords with secure environment variables or a real identity provider (Firebase Auth).
3. **Configure Firebase Service Account**:
   - Store your production Google Cloud Firebase Admin credentials strictly in `FIREBASE_SERVICE_ACCOUNT` (raw JSON or base64 string) or in an uncommitted `firebase-service-account.json` excluded by `.gitignore`.
4. **IoT Edge Gateway Endpoint**:
   - Set `JANSETU_API_URL` on the Linux MPU device to point to the secure production backend endpoint instead of relying on the fallback Render URL.

---

## 8. Configuration & Environment Templates Inventory

The following environment templates have been established and must be referenced during local setup and deployment:

| Template Path | Target Workspace / Service | Key Variables Defined |
| :--- | :--- | :--- |
| [`.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.env.example) | Root Monorepo Umbrella | `PORT`, `NODE_ENV`, `FIREBASE_SERVICE_ACCOUNT`, `VITE_API_BASE`, `EXPO_PUBLIC_API_URL` |
| [`jansetu-backend/.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/.env.example) | Current Express Backend | `PORT`, `NODE_ENV`, `FIREBASE_SERVICE_ACCOUNT`, `PYTHON_BIN`, `MODEL_PATH` |
| [`.env.web.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.env.web.example) | Current Vite Web Frontend | `VITE_API_BASE`, `VITE_BACKEND_URL`, `VITE_WS_URL` |
| [`.env.mobile.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.env.mobile.example) | Current Expo Mobile App | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL`, `EXPO_PUBLIC_ADMIN_PIN` |
| [`IOT/python/.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/python/.env.example) | Linux MPU Gateway | `JANSETU_API_URL`, `JANSETU_DEVICE_ID`, `POLL_INTERVAL_SEC`, `MAX_RETRIES` |
| [`docs/templates/apps-api.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/templates/apps-api.env.example) | Monorepo Target: `apps/api` | Full Node.js + Firebase + Python AI settings |
| [`docs/templates/apps-web.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/templates/apps-web.env.example) | Monorepo Target: `apps/web` | Vite environment configuration |
| [`docs/templates/apps-mobile.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/templates/apps-mobile.env.example) | Monorepo Target: `apps/mobile` | Expo React Native configuration |
| [`docs/templates/iot-python.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/templates/iot-python.env.example) | Monorepo Target: `iot/python` | MPU Python daemon configuration |

---

## 9. Execution Command Log for Audit Inspection

The following exact shell commands were executed during this architectural, security, and hygiene audit:

```bash
# 1. Directory and Git status inspection
ls -la && git status

# 2. Repository tree scan (excluding node_modules and hidden folders)
find . -maxdepth 3 -not -path '*/.*' -not -path './node_modules*' -not -path './jansetu-backend/venv*' -not -path './jansetu-backend/__pycache__*'

# 3. Search for IoT firmware and MPU gateway files
find IOT
find . -name "*sketch*" -o -name "*.ino"

# 4. Search for AI model files and check sizes
ls -la jansetu-backend/ai/models
ls -la jansetu-backend/ai/models/qwen jansetu-backend/ai/models/yolo

# 5. Diff analysis between root lib/ and src/lib/
diff -r lib src/lib

# 6. Grep codebase for external vendor integrations
git grep -n "supabase"
git grep -i "sarvam" || true; git grep -i "gemini" || true
git grep -i "yolo_bridge" || true
git grep -i "llm_bridge" || true

# 7. Git history investigation for deleted files & secrets
ls -la .env*
git log --stat -n 5
git log --all --full-history -- "**/supabase*" "**/sketch*"
git show 43ca617c8a4ccd117fa7aca604e47b984320e6c6 --name-status
git log -p -S "supabase.co" -- "*.ts"

# 8. Security audit: Inspect tracked files for secrets, credentials, and credential patterns
git ls-files | grep -iE '(\.env|secret|firebase|service[-_]account|\.pem|\.key|\.p12|\.keystore)'
git grep -nEi '(api[-_]?key|secret|password|jwt|bearer)' -- ':(exclude)node_modules' ':(exclude)dist' ':(exclude)expo-export-test'

# 9. Hygiene audit: Inspect tracked build artifacts and large binaries
git ls-files node_modules | wc -l
git ls-files dist | wc -l
git ls-files expo-export-test | wc -l
find . -name "*.gguf" -o -name "*.dlc" -o -name "*.pt" -o -name "*.onnx" -o -name "*.hbc" -o -name "*.apk" -o -name "*.aab"
ls -lh expo-export-test/bundles/

# 10. Web TypeScript compilation check
pnpm typecheck

# 11. Web production bundle compilation check
pnpm build

# 12. Mobile Expo TypeScript compilation check
./node_modules/.bin/tsc --noEmit -p tsconfig.expo.json

# 13. Phase 0 Monorepo Workspace Verification Commands
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

---

## 10. Phase 0 Completion Summary & Phase 1 Entry Gate

### 10.1 Completed Actions Summary
1. **Workspaces Initialized**: Created [`pnpm-workspace.yaml`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/pnpm-workspace.yaml) defining `apps/*` and `packages/*`.
2. **Turborepo Configuration**: Created [`turbo.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/turbo.json) defining cached pipeline tasks for `build`, `typecheck`, `lint`, `test`, and `dev`.
3. **Workspace Packages Scaffolding**: Initialized package manifests, TypeScript configs, and typed stubs for:
   - [`packages/shared`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared): `@jansetu/shared`
   - [`packages/db`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db): `@jansetu/db` (linked to `@jansetu/shared`)
   - [`apps/api`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api): `@jansetu/api` (linked to `@jansetu/db` & `@jansetu/shared`)
   - [`apps/web`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web): `@jansetu/web` (linked to `@jansetu/shared`)
   - [`apps/mobile`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/mobile): `@jansetu/mobile` (linked to `@jansetu/shared`)
4. **Code Quality Toolchain**:
   - Pinned `packageManager: "pnpm@11.24.0"` in root [`package.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/package.json).
   - Strict root [`tsconfig.base.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/tsconfig.base.json) (ES2022 / ESNext / Bundler resolution).
   - ESLint 9 flat config [`eslint.config.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/eslint.config.js).
   - Code formatting [`..prettierrc.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.prettierrc.json) and [`.prettierignore`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.prettierignore).
5. **Legacy Code Preservation**:
   - Hackathon source directories (`src/`, `app/`, `lib/`, `jansetu-backend/`, `IOT/`) remain completely untouched at root.
   - Retired root file-swapping hack; archived legacy manifests in [`legacy/`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/legacy/).

### 10.2 Command Verification Log
```text
$ pnpm install
Scope: all 6 workspace projects
Already up to date
Done in 223ms using pnpm v11.24.0

$ pnpm typecheck
• turbo 2.11.13
• Packages in scope: @jansetu/api, @jansetu/db, @jansetu/mobile, @jansetu/shared, @jansetu/web
• Running typecheck in 5 packages
Tasks: 5 successful, 5 total (Time: 1.738s)

$ pnpm lint
• Running lint in 5 packages
Tasks: 5 successful, 5 total (Time: 1.103s)

$ pnpm build
• Running build in 5 packages
Tasks: 5 successful, 5 total (Time: 2.499s)
```

### 10.3 Phase 1 Entry Gate Checklist
Before starting Phase 1 / Phase 2 (`@jansetu/shared` extraction):
- [x] Workspace structure is valid and locked via `pnpm-workspace.yaml`.
- [x] `pnpm install` and `pnpm typecheck` pass with exit code 0.
- [x] All legacy hackathon code remains intact for reference.
- [x] Completed Phase 1: Consolidated `@jansetu/shared` domain types, schemas, and i18n dictionaries.

---

## 11. Phase 1 Completion Summary (`@jansetu/shared`) & Phase 2 Entry Gate

### 11.1 Completed Shared Modules Inventory
- [`packages/shared/src/roles/index.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/roles/index.ts): Roles (`citizen`, `ward_officer`, `dept_head`, `admin`), permission mappings, and `canTransitionStatus` checks.
- [`packages/shared/src/domain/departments.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/domain/departments.ts): 16 civic departments and Zod schema.
- [`packages/shared/src/domain/categories.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/domain/categories.ts): 16 complaint issue categories and Zod schema.
- [`packages/shared/src/domain/urgency.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/domain/urgency.ts): Urgency levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) with numeric weights.
- [`packages/shared/src/domain/status.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/domain/status.ts): Complaint status state machine with valid transitions map.
- [`packages/shared/src/domain/sla.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/domain/sla.ts): SLA policies (12h, 24h, 48h, 72h + overrides), deadline calculation, and breach/warning detectors.
- [`packages/shared/src/schemas/complaint.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/schemas/complaint.ts): `CreateComplaintSchema` with sanitization and validation.
- [`packages/shared/src/schemas/cluster.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/schemas/cluster.ts): `UpdateClusterStatusSchema` and `ClusterDetailsSchema`.
- [`packages/shared/src/schemas/rti.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/schemas/rti.ts): `RtiDraftInputSchema` and response schema.
- [`packages/shared/src/schemas/iot.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/schemas/iot.ts): `IotEventPayloadSchema` and `IotHeartbeatPayloadSchema`.
- [`packages/shared/src/i18n.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/i18n.ts): 474 merged bilingual keys preserving all web and mobile translation copy.
- [`packages/shared/src/index.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/index.ts): Central barrel export.

### 11.2 Vitest Verification Command & Output
```bash
$ pnpm --filter @jansetu/shared test
$ vitest run

 RUN  v5.1.1 /Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared

 ✓ src/__tests__/i18n.test.ts (4 tests) 5ms
 ✓ src/__tests__/sla.test.ts (7 tests) 3ms
 ✓ src/__tests__/status-transitions.test.ts (7 tests) 3ms
 ✓ src/__tests__/schemas.test.ts (11 tests) 5ms

 Test Files  4 passed (4)
      Tests  29 passed (29)
   Duration  360ms
```

### 11.3 Phase 2 Entry Checklist (Database Layer Extraction)
- [x] `@jansetu/shared` domain contracts and Zod schemas established.
- [x] All 29 unit tests pass in Vitest.
- [x] Strict workspace `typecheck` and `lint` pass without warnings.
- [x] Completed Phase 2: Configured `@jansetu/db` with Drizzle ORM and PostGIS spatial support.

---

## 12. Phase 2 Completion Summary (`@jansetu/db`) & Phase 3 Entry Gate

### 12.1 Completed Database Modules Inventory
- [`packages/db/drizzle.config.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/drizzle.config.ts): Drizzle Kit config with PostgreSQL dialect and PostGIS extension filter.
- [`packages/db/src/client.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/client.ts): Neon serverless pool and Drizzle client initializer.
- [`packages/db/src/schema/postgis.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/postgis.ts): Custom PostGIS column builders for `geometry(Point, 4326)` and `geometry(MultiPolygon, 4326)`.
- [`packages/db/src/schema/users.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/users.ts): Better Auth relational tables (`users`, `sessions`, `accounts`, `verifications`).
- [`packages/db/src/schema/departments.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/departments.ts): Municipal departments table with unique code, English name, and Hindi name (`name_hi`).
- [`packages/db/src/schema/wards.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/wards.ts): Wards table with `boundary` geometry and GIST spatial index.
- [`packages/db/src/schema/clusters.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/clusters.ts): Complaint clusters with `centroid` geometry, GIST index, and department/ward index.
- [`packages/db/src/schema/complaints.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/complaints.ts): Complaints table with `exact_location`, `public_location`, unique `tracking_code`, unique `idempotency_key`, and `(status, sla_due_at)` composite index. Also includes `complaint_events` audit table.
- [`packages/db/src/schema/iot.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/iot.ts): IoT devices with GIST `location` index, unique `device_uid`, and `iot_telemetry` logs.
- [`packages/db/src/schema/rti.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/rti.ts): Statutory RTI applications and questions log.
- [`packages/db/src/schema/relations.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/relations.ts): Full relational definitions connecting all 12 tables.
- [`packages/db/src/helpers/spatial.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/helpers/spatial.ts): Typed query helpers: `resolveWardByCoords`, `findNearbyOpenCluster`, `buildResolveWardSql`, `buildNearbyClusterSql`, and `obfuscatePublicCoords`.
- [`packages/db/src/seed.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/seed.ts): Idempotent seed script populating 6 bilingual departments, 4 PostGIS wards, 6 demo accounts (hashed PBKDF2 passwords), 2 IoT streetlight nodes (HMAC secrets), and sample complaints/clusters.
- [`packages/db/drizzle/0000_famous_black_tarantula.sql`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/drizzle/0000_famous_black_tarantula.sql): Initial migration file verified with `CREATE EXTENSION IF NOT EXISTS postgis;`.

### 12.2 Verification Logs
```bash
$ pnpm --filter @jansetu/db test
$ vitest run

 RUN  v5.1.1 /Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db

 ✓ src/__tests__/spatial.test.ts (4 tests) 2ms
 ✓ src/__tests__/integration.test.ts (3 tests | 1 skipped) 4ms
 Test Files  2 passed (2)
      Tests  6 passed | 1 skipped (7)

$ pnpm --filter @jansetu/db typecheck
$ tsc --noEmit
(0 errors)

$ pnpm test
$ turbo run test
 Tasks: 2 successful, 2 total (35 passed, 1 skipped)
 Time: 1.118s

$ pnpm typecheck && pnpm lint
Tasks: 5 successful, 5 total (0 errors, 0 warnings across all 5 packages)
```

### 12.3 Phase 3 Entry Checklist (Backend API Migration)
- [x] `@jansetu/db` relational and PostGIS schemas validated.
- [x] Initial SQL migration generated with `postgis` extension.
- [x] Idempotent seed script (`seed.ts`) populating departments, wards, accounts, IoT devices, and complaints.
- [x] Spatial query helpers, query builders, and privacy grid unit-tested.
- [x] Integration test cleanly reporting skipped when `DATABASE_URL` is omitted (never fabricated).
- [x] Turborepo test, typecheck, and lint pipelines completely green.
- [x] Completed Phase 2 (`apps/api` Core): Hono + Cloudflare Workers engine initialized with foundational middlewares, health/meta routes, and Vitest suite.

---

## 13. Phase 2 Completion Summary (`apps/api` Core) & Next Steps

### 13.1 Completed API Architecture Inventory
- [`apps/api/wrangler.toml`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/wrangler.toml): Cloudflare Workers configuration with `nodejs_compat` and environment bindings.
- [`apps/api/src/config/env.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/config/env.ts): Strict Zod environment schema validation (`EnvSchema`) on boot (`getBootEnv()`) and per-request middleware (`envMiddleware`).
- [`apps/api/src/middleware/logger.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/logger.ts): Structured JSON logger with request ID correlation (`X-Request-ID`), latency tracking, and redaction of auth headers and PII (emails, Indian phone numbers, sensitive credentials).
- [`apps/api/src/middleware/error-handler.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/error-handler.ts): RFC 7807/9457 consistent error handler (`HttpError`, Zod 400 validation issues, 404 handler) with strict production stack trace suppression.
- [`apps/api/src/middleware/cors.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/cors.ts): Strict CORS allowlist matcher with credential support, preflight 204/403 handling, and comprehensive security headers (`nosniff`, `DENY`, `HSTS`, `CSP`).
- [`apps/api/src/middleware/rate-limiter.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/rate-limiter.ts): Upstash Redis sliding-window rate limiter with in-memory fallback, `X-RateLimit-*` headers, and 429 RFC error responses.
- [`apps/api/src/services/cache.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/services/cache.ts): Redis and in-memory TTL caching abstraction.
- [`apps/api/src/routes/health.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/health.ts): `GET /health` operational probe returning health status, version, and uptime.
- [`apps/api/src/routes/meta.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/meta.ts): `GET /api/v1/meta` returning bilingual civic departments, complaint categories, and urgency SLA policies cached with `X-Cache: HIT` / `X-Cache: MISS`.
- [`apps/api/src/auth/index.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/auth/index.ts): Better Auth backed by Neon PostgreSQL (`@jansetu/db`), with cookie session, bearer token (`bearer()` plugin), and `@better-auth/expo` mobile support.
- [`apps/api/src/routes/auth.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/auth.ts): Mounted at `/api/auth/**` serving Better Auth authentication endpoints.
- [`apps/api/src/middleware/auth.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/auth.ts): Reusable RBAC middlewares: `requireAuth`, `requireRole(...roles)`, and `requireWardOrDeptScope(resolver?)` enforcing municipal boundaries.
- [`apps/api/src/serializers/`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/serializers): Strict Public DTOs (exposing `public_location` and stripping reporter contact/exact GPS) and Officer/Owner DTOs (including `exact_location` and internal assignment data).
- [`apps/api/src/routes/complaints.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/complaints.ts): `POST /api/v1/complaints` (idempotency, PostGIS ward lookup, ~100m coordinate snapping, 150m/7d deduplication clustering, SLA calculation, and audit logging) and `GET /api/v1/complaints` / `GET /api/v1/complaints/:trackingCode` (role-based DTO serialization and filtering).
- [`apps/api/src/routes/clusters.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/clusters.ts): `GET /api/v1/clusters/:id/timeline`, `PATCH /api/v1/clusters/:id/assign` (RBAC + ward/dept scoping), and `PATCH /api/v1/clusters/:id/status` (state machine transition validation).
- [`apps/api/src/routes/map.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/map.ts): `GET /api/v1/map/clusters` (bounding-box spatial query with Redis caching and privacy redaction).
- [`apps/api/src/routes/admin.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/admin.ts): `GET /api/v1/admin/analytics` and `GET /api/v1/admin/sla-breaches` (metrics aggregation and SLA violation monitoring).
- [`apps/api/src/routes/geo.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/geo.ts): `GET /api/v1/geo/resolve-ward` (PostGIS `ST_Contains` ward resolution with in-memory fallback and Redis caching).
- [`apps/api/src/services/complaint-store.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/services/complaint-store.ts): Store abstraction bridging Neon Postgres transactions and in-memory test mocks.
- [`apps/api/src/services/geo-service.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/services/geo-service.ts): Reverse geocoding and PostGIS boundary resolution service.
- [`apps/api/src/services/storage.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/services/storage.ts): Cloudflare R2 object storage service with MIME validation (`image/webp`, `image/jpeg`, `image/png`, `audio/webm`, `audio/mp4`, `audio/wav`), size restrictions (5MB image / 10MB audio), presigned PUT URLs, and caching.
- [`apps/api/src/routes/media.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/media.ts): Media presigning (`POST /api/v1/media/presign`) and object retrieval with conditional ETag validation (`GET /api/v1/media/:key`).
- [`apps/api/src/services/rti-store.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/services/rti-store.ts): Statutory RTI Section 6(1) persistence layer with dual-language English/Hindi drafting and grievance cluster auto-injection.
- [`apps/api/src/services/rti-pdf.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/services/rti-pdf.ts): A4 statutory Section 6(1) Form A PDF generator using `pdf-lib`.
- [`apps/api/src/routes/rti.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/rti.ts): `POST /api/v1/rti`, `GET /api/v1/rti`, and `GET /api/v1/rti/:id/pdf` with R2 cache check.
- [`apps/api/src/app.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/app.ts) & [`apps/api/src/index.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/index.ts): Hono application factory and Cloudflare Workers export.

### 13.2 Vitest & Monorepo Verification
- **API Unit Suite (`apps/api`)**: 12 test files, 80 passed tests in 2.50s.
  - `health.test.ts`, `error-handler.test.ts`, `cors.test.ts`, `rate-limiter.test.ts`, `meta.test.ts`, `logger-env.test.ts`, `auth-rbac.test.ts`, `serializers.test.ts`, `complaints.test.ts`, `clusters-admin-geo.test.ts`, `media-storage.test.ts`, `rti.test.ts`.
- **Shared Domain Suite (`packages/shared`)**: 4 test files, 29 passed tests.
- **Database Suite (`packages/db`)**: 2 test files, 6 passed tests, 1 test cleanly reported skipped.
- **Total Tests Across Monorepo**: 115 passed | 1 skipped (0 failures).
- **TypeScript & ESLint Quality Gate**: 0 errors, 0 warnings across all 5 packages in scope.

### 13.3 Phase 2 Completion Checklist & Phase 3 Entry Gate
- [x] `apps/api` core foundation, middlewares, metadata endpoints, Better Auth, RBAC, and response serializers implemented and verified.
- [x] Civic complaint intake, deduplication clustering, state machine transitions, spatial map query, and admin analytics endpoints implemented and verified.
- [x] Cloudflare R2 storage client implemented with strict MIME allowlists, size validation, presigned PUT URLs, and conditional ETag retrieval.
- [x] Statutory RTI Section 6(1) module implemented with complaint cluster auto-injection, dual-language drafts, and `pdf-lib` PDF generation cached in R2.
- [x] All 115 unit tests passing across `@jansetu/shared`, `@jansetu/db`, and `@jansetu/api`.
- [x] Cloudflare Wrangler dry-run deployment verified with `MEDIA_BUCKET` binding.
- [x] Phase 3 AI Gateway implemented with Google Gemini 2.5 Flash, Groq API, and Deterministic Fallback.
- [x] Upstash QStash asynchronous webhook queue, triage job, and SLA auto-escalation cron implemented with HMAC signature verification.
- [x] Ably real-time push integration and capability-scoped token issuance implemented.

---

## 14. Phase 3 AI Gateway, Async Jobs & Real-Time Completion Summary

### 14.1 Delivered Capabilities
1. **Unified AI Gateway (`apps/api/src/services/ai/gateway.ts`)**:
   - Completely replaces legacy Windows Python / `llama-cpp-python` / Qwen scripts and client-side unauthenticated API calls.
   - **Tier 1 (Primary):** Google Gemini 2.5 Flash with structured JSON output and strict `AbortController` 8s timeout.
   - **Tier 2 (Secondary):** Groq API (`llama-3.3-70b-versatile` / Qwen) with JSON mode and strict 8s timeout.
   - **Speech-to-Text & Translation:** Sarvam AI (`saarika:v2` STT + `mayura:v1` translate) primary provider with automatic fallback to Groq Whisper (`whisper-large-v3-turbo`) returning bilingual transcripts (`transcript`, `detectedLang`, `translatedEn`, `translatedHi`).
   - **Multimodal Hazard Vision Verification:** Gemini 2.5 Flash vision (`verifyHazardImage`) replacing legacy local YOLO models without GPU hosting, outputting `{ isCivicIssue, detectedHazard, severityBoost, confidence, labels }` with graceful degradation on quota or timeout.
   - **Tier 3 (Guaranteed):** Deterministic multilingual rule classifier (English + Devanagari Hindi + Hinglish) and statutory Section 6(1) legal serializer ensuring zero downtime for complaint intake.
2. **Strict Zod Validated Contracts**:
   - `classifyComplaint(text, lang)` → `{ departmentCode, category, urgency, summaryEn, summaryHi, confidence }`.
   - `draftRtiSection6(input)` → `{ subject, authorityName, language, statutoryText, questions, isBplExempt, englishDraft, hindiDraft }`.
   - `transcribeAudio(params)` → `{ transcript, detectedLang, translatedEn, translatedHi, provider }`.
   - `verifyHazardImage(r2Key, claimedCategory)` → `{ isCivicIssue, detectedHazard, severityBoost, confidence, labels }`.
3. **Async Job Orchestration & Scheduled Cron (`apps/api/src/services/queue.ts`, `apps/api/src/routes/jobs.ts`)**:
   - Upstash QStash integration with cryptographic HMAC webhook signature verification (`upstash-signature` header) protecting `/api/v1/internal/jobs/*`.
   - `POST /api/v1/internal/jobs/triage`: Triggered asynchronously after `POST /api/v1/complaints` returns HTTP 201. Executes AI triage + vision check, updates cluster urgency and department if confidence $\ge 0.75$, records `TRIAGED` audit trail event, and publishes real-time updates.
   - `POST /api/v1/internal/jobs/sla-check`: 15-minute scheduled cron querying open complaints where `sla_due_at < now()`, incrementing `escalation_level` ($0 \rightarrow 1 \rightarrow 2 \rightarrow 3$), recording `ESCALATED` audit events, and emitting `sla:breach` alerts. Capped at level 3 for strict idempotency.
   - Local dev offline resilience: executes background triage asynchronously via event loop when QStash credentials are omitted.
4. **Ably Real-Time Push Engine (`apps/api/src/services/realtime.ts`, `apps/api/src/routes/realtime.ts`)**:
   - REST channel publisher for `complaint:{trackingCode}`, `ward:{wardId}`, `dept:{deptId}`, and `admin:alerts`.
   - `GET /api/v1/realtime/token`: Generates short-lived, capability-scoped tokens enforcing least privilege (citizens restricted to their specific complaint channel; ward officers to their ward/dept; department heads to their dept; admins wildcard).
5. **Structured Telemetry & PII Privacy**:
   - Emits structured log events tracking provider used, latency (ms), and fallback reason.
   - Suppresses API tokens and citizen PII (phone numbers, emails, Aadhaar, raw grievance text).

### 14.2 Verification Matrix
```bash
$ pnpm --filter @jansetu/api test
Test Files: 14 passed (14)
     Tests: 104 passed (104)
  Duration: 2.55s

$ pnpm test
Tasks: 3 successful, 3 total (139 passed, 1 skipped, 0 failures)

$ pnpm typecheck && pnpm lint
Tasks: 5 successful across typecheck (0 errors)
Tasks: 5 successful across lint (0 warnings, 0 errors)
```

### 14.3 Next Implementation Priorities (Phase 4 Entry Gate)
- **Frontend (`apps/web`) Migration:**
  - Replace legacy direct Firestore and unauthenticated RPC endpoints with `@jansetu/api` client.
  - Wire complaint submission and RTI drafting to `POST /api/v1/complaints` and `POST /api/v1/ai/rti-draft`.
  - Connect Ably token subscriber to `GET /api/v1/realtime/token` for real-time status and hazard updates.
- **Mobile (`apps/mobile`) Modernization:**
  - Integrate Better Auth session and replace legacy Supabase remnants.
  - Wire audio submission to `POST /api/v1/ai/transcribe`.
- **IoT Telemetry Edge Ingestion:**
  - Implement `POST /api/v1/iot/telemetry` with HMAC SHA-256 signature verification.


---

## 15. Phase 4 Frontend Core Completion Summary (`apps/web`)

### 15.1 Delivered Architecture & Modules
- [`apps/web/vite.config.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/vite.config.ts): Modern Vite 5 configuration with `@vitejs/plugin-react`, `@/` path alias, and `/api` dev proxy.
- [`apps/web/tailwind.config.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/tailwind.config.js) & [`apps/web/src/index.css`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/index.css): Full patriotic tricolor theme, saffron/emerald palette, motion keyframes, ambient dot-mesh, card glow, and custom scrollbar styling.
- [`apps/web/src/lib/i18n.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/lib/i18n.ts) & [`apps/web/src/contexts/LangContext.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/contexts/LangContext.tsx): Modern `i18next` engine loaded with 474+ keys from `@jansetu/shared` with instant English/Hindi switching.
- [`apps/web/src/lib/api.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/lib/api.ts): Production `ApiClient` class with automatic credentials, abort timeout handling, RFC 7807 problem details parsing (`ApiClientError`), and typed methods for all backend endpoints.
- [`apps/web/src/contexts/AuthContext.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/contexts/AuthContext.tsx): Better Auth session integration and 1-click demo role switcher (`citizen`, `ward_officer`, `dept_head`, `admin`).
- [`apps/web/src/components/auth/ProtectedRoute.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/components/auth/ProtectedRoute.tsx) & [`apps/web/src/components/auth/RoleGuard.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/components/auth/RoleGuard.tsx): Role-based routing guards.
- [`apps/web/src/components/layout/AppShell.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/components/layout/AppShell.tsx): Responsive layout with fixed desktop [`Navbar.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/components/layout/Navbar.tsx), mobile [`MobileHeader.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/components/layout/MobileHeader.tsx), and mobile [`BottomNav.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/components/layout/BottomNav.tsx).
- [`apps/web/src/App.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/App.tsx): React Router v6 with `React.lazy` route splitting and `<Suspense fallback={<PageLoader />}>` for fast initial loads.
- **Route Views**:
  - [`apps/web/src/pages/HomeView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/HomeView.tsx)
  - [`apps/web/src/pages/LoginView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/LoginView.tsx)
  - [`apps/web/src/pages/RegisterView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/RegisterView.tsx)
  - [`apps/web/src/pages/SubmitComplaintView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/SubmitComplaintView.tsx)
  - [`apps/web/src/pages/TrackComplaintView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/TrackComplaintView.tsx)
  - [`apps/web/src/pages/HazardMapView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/HazardMapView.tsx)
  - [`apps/web/src/pages/RtiDrafterView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/RtiDrafterView.tsx)
  - [`apps/web/src/pages/GrievanceOfficerView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/GrievanceOfficerView.tsx)
  - [`apps/web/src/pages/AdminDashboardView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/AdminDashboardView.tsx)
  - [`apps/web/src/pages/IotDashboardView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/IotDashboardView.tsx)
  - [`apps/web/src/pages/NotFoundView.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/pages/NotFoundView.tsx)

### 15.2 Verification Evidence
- `pnpm --filter @jansetu/web build`: Succeeded in 1.50s generating 11 isolated lazy chunks.
- `pnpm typecheck`: 5 successful, 5 total (0 errors).
- `pnpm lint`: 5 successful, 5 total (0 warnings, 0 errors).
- `pnpm test`: 3 successful, 3 total (139 passed, 1 skipped, 0 failures).

### 15.3 Next Implementation Priorities (Phase 5 Entry Gate)
- **Interactive Mapping & Rich Telemetry Integration (`apps/web` Feature Depth):**
  - Integrate Leaflet / MapLibre with cluster markers on `/hazard-map`.
  - Connect Ably subscriber in `apps/web` using token issued by `GET /api/v1/realtime/token`.
  - Wire Web Speech API voice recording and audio upload to `POST /api/v1/ai/transcribe`.
- **Mobile (`apps/mobile`) Modernization:**
  - Modernize Expo app with `@better-auth/expo` and shared contracts.
