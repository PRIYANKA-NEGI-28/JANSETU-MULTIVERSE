# JanSetu Multiverse — Monorepo Migration Map & Specification

**Document Version:** 1.0.0  
**Date:** November 23, 2026  
**Target Architecture:** `pnpm` Workspace Monorepo  
**Source Layout:** Hackathon Root Multi-Surface Repository  

---

## 1. Executive Summary & Objectives

The JanSetu Multiverse codebase currently suffers from a "dual-personality" root structure:
- Two conflicting root package manifests: `package.json` (Vite Web) and `package-expo.json` (Expo Mobile).
- Fragmented business logic duplicated across root `lib/` and `src/lib/`.
- Mixed backend and AI scripts inside `jansetu-backend/`.
- Isolated IoT Python scripts in `IOT/python/` with missing Arduino firmware (`sketch/`).

This document provides an exhaustive, feature-complete migration map from the current layout to a modern **`pnpm` Monorepo**. Following this map ensures that **zero existing or intended features are lost**, all broken imports are corrected, duplicate code is eliminated into shared internal packages, and each application retains an independent, cleanly typed build target.

---

## 2. Target Monorepo Architecture Overview

```text
JANSETU-MULTIVERSE/
├── .github/                      # CI/CD workflows (lint, typecheck, build, test)
├── apps/
│   ├── api/                      # Node.js + Express + WebSocket backend engine
│   │   ├── ai/                   # Python NLP grievance & RTI drafting pipelines
│   │   ├── middleware/           # Upload (Multer), sanitization, auth middleware
│   │   ├── routers/              # Express API route controllers
│   │   ├── ws/                   # Real-time WebSocket broadcasting singleton
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── server.js
│   ├── mobile/                   # Expo SDK 52 React Native mobile application
│   │   ├── app/                  # Expo Router layout & screens (tabs, modals)
│   │   ├── assets/               # Mobile icons, splash screens, adaptive icons
│   │   ├── components/           # Mobile-specific UI (SimpleHeatMap, etc.)
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   ├── metro.config.js
│   │   ├── package.json
│   │   ├── tailwind.config.js
│   │   └── tsconfig.json
│   └── web/                      # Vite + React 18 + Tailwind CSS web portal
│       ├── public/               # Public assets, logos, branding
│       ├── src/
│       │   ├── components/       # Navbars, animations, error boundaries
│       │   ├── contexts/         # LocationContext, ToastContext, DashboardContext
│       │   ├── hooks/            # useWebSocket hook
│       │   ├── pages/            # 8 core views (Home, Submit, Track, etc.)
│       │   ├── types/            # Web-specific presentation types
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── index.html
│       ├── package.json
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   ├── db/                       # Database persistence & query layer
│   │   ├── src/
│   │   │   ├── firebase.ts       # Firestore client, collections, CRUD, auto-escalation
│   │   │   ├── schemas.ts        # Typed interfaces for Firestore documents
│   │   │   └── index.ts          # Barrel exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/                   # Universal business logic & datasets
│       ├── src/
│       │   ├── ai/
│       │   │   └── aiAnalyzer.ts # Client-side rule-based NLP classifier & urgency scorer
│       │   ├── constants/
│       │   │   └── locations.ts  # 50+ Delhi & Ghaziabad municipal areas & wards
│       │   ├── i18n/
│       │   │   ├── dictionaries.ts # Consolidated English & Hindi translation matrix
│       │   │   └── index.ts
│       │   ├── types/
│       │   │   ├── complaint.ts  # Canonical complaint, officer, hazard interfaces
│       │   │   ├── auth.ts       # Auth user & credential interfaces
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── iot/
│   ├── python/                   # Linux MPU edge gateway agent
│   │   ├── config.py
│   │   ├── logger.py
│   │   ├── main.py
│   │   ├── sender.py
│   │   └── requirements.txt
│   └── sketch/                   # Arduino UNO Q C++ firmware
│       ├── communication.cpp
│       ├── communication.h
│       ├── fsm.cpp
│       ├── fsm.h
│       ├── outputs.cpp
│       ├── outputs.h
│       ├── sensors.cpp
│       ├── sensors.h
│       └── sketch.ino
├── docs/                         # Architecture, migration, API documentation
│   ├── MIGRATION_MAP.md
│   └── templates/
├── .env.example                  # Root umbrella environment template
├── .gitignore                    # Comprehensive repository gitignore
├── package.json                  # Root monorepo workspace manifest
├── pnpm-workspace.yaml           # pnpm workspace package definitions
├── tsconfig.base.json            # Base TypeScript compiler options
└── README.md                     # Consolidated project documentation
```

---

## 3. Comprehensive File-by-File Migration Matrix

| Current Hackathon Path | Target Monorepo Path | Transformation / Action Required |
| :--- | :--- | :--- |
| **Root Configurations** | | |
| `package.json` | `apps/web/package.json` | Scoped to `@jansetu/web`. Remove mobile and backend dependencies. Add `"@jansetu/shared": "workspace:*"`. |
| `package-expo.json` | `apps/mobile/package.json` | Scoped to `@jansetu/mobile`. Add `"@jansetu/shared": "workspace:*"`. Remove broken Supabase dependencies. |
| `package-web-backup.json` | *Delete* | Obsolete backup file. Safe to discard. |
| `vite.config.ts` | `apps/web/vite.config.ts` | Configure Vite for `apps/web`. Maintain `/api` proxy to `http://localhost:3000`. |
| `app.json` | `apps/mobile/app.json` | Maintain Expo configuration for `com.jansetu.app`. |
| `metro.config.js` | `apps/mobile/metro.config.js` | Maintain NativeWind configuration for `apps/mobile`. |
| `babel.config.js` | `apps/mobile/babel.config.js` | Maintain Expo Babel preset. |
| `tailwind.config.js` | `apps/web/tailwind.config.js` | Configure Tailwind scanning paths inside `apps/web/`. |
| `tailwind.config.expo.js` | `apps/mobile/tailwind.config.js` | Configure Tailwind scanning paths inside `apps/mobile/`. |
| `global.css` | `apps/web/src/global.css` & `apps/mobile/global.css` | Duplicate or link CSS utilities into both frontend apps. |
| `index.html` | `apps/web/index.html` | Maintain HTML root entry for Vite. |
| `nativewind-env.d.ts` | `apps/mobile/nativewind-env.d.ts` | Maintain NativeWind type definitions. |
| `tsconfig.app.json` | `apps/web/tsconfig.json` | Extends `tsconfig.base.json`. |
| `tsconfig.expo.json` | `apps/mobile/tsconfig.json` | Extends `tsconfig.base.json`. |
| `tsconfig.node.json` | `apps/web/tsconfig.node.json` | Extends `tsconfig.base.json`. |
| `tsconfig.json` | `tsconfig.base.json` (Root) | Shared base compiler settings for all workspace packages. |
| **Backend Engine (`jansetu-backend/`)** | | |
| `jansetu-backend/server.js` | `apps/api/server.js` | Server entrypoint. Import db layer from `@jansetu/db`. |
| `jansetu-backend/package.json` | `apps/api/package.json` | Scoped to `@jansetu/api`. Add `"@jansetu/db": "workspace:*"`. |
| `jansetu-backend/routers/complaintRouter.js` | `apps/api/routers/complaintRouter.js` | Maintain multipart ingestion and WebSocket broadcast. |
| `jansetu-backend/routers/sensorRouter.js` | `apps/api/routers/sensorRouter.js` | Maintain IoT fault ingestion and WebSocket broadcast. |
| `jansetu-backend/routers/dashboardRouter.js` | `apps/api/routers/dashboardRouter.js` | Maintain RPC action dispatcher. Fix status update route. |
| `jansetu-backend/routers/adminRouter.js` | `apps/api/routers/adminRouter.js` | Maintain admin reporting routes. |
| `jansetu-backend/routers/drafterRouter.js` | `apps/api/routers/drafterRouter.js` | Replace hardcoded Windows paths with dynamic `python3` runner. |
| `jansetu-backend/routers/grievanceRouter.js` | `apps/api/routers/grievanceRouter.js` | Replace hardcoded Windows paths with dynamic `python3` runner. |
| `jansetu-backend/middleware/upload.js` | `apps/api/middleware/upload.js` | Configure upload storage path under `apps/api/uploads/`. |
| `jansetu-backend/utils/catchAsync.js` | `apps/api/utils/catchAsync.js` | Maintain async error wrapper. |
| `jansetu-backend/ws/broadcast.js` | `apps/api/ws/broadcast.js` | Maintain WebSocket singleton and broadcasting. |
| `jansetu-backend/db/firebase.js` | `packages/db/src/firebase.ts` | Move core persistence into `@jansetu/db`. Typed in TypeScript. |
| `jansetu-backend/db/graph.js` | `packages/db/src/legacy/graph.js` | Archive legacy Neo4j driver code. |
| `jansetu-backend/db/sqlite.js` | `packages/db/src/legacy/sqlite.js` | Archive legacy SQLite queries. |
| `jansetu-backend/db/dateSanitizer.js` | `apps/api/middleware/dateSanitizer.js` | Move to API middleware. |
| `jansetu-backend/clear_data.js` | `apps/api/scripts/clear_data.js` | Utility script. |
| `jansetu-backend/test_escalation.js` | `apps/api/scripts/test_escalation.js` | Test script for Firestore SLA auto-escalation. |
| `jansetu-backend/ai/grievance_officer.py` | `apps/api/ai/grievance_officer.py` | Python 3 NLP pipeline. Maintain regex/rule-based fallback. |
| `jansetu-backend/ai/rti_drafter.py` | `apps/api/ai/rti_drafter.py` | Python 3 RTI drafter. Maintain Section 6(1) fallback. |
| `jansetu-backend/ai/llm_bridge.py` | `apps/api/ai/experimental/llm_bridge.py` | Mark as experimental prototype. |
| `jansetu-backend/ai/yolo_bridge.py` | `apps/api/ai/experimental/yolo_bridge.py` | Mark as experimental prototype. |
| `jansetu-backend/ai/models/` | `apps/api/ai/models/` | Maintain model directory structure with README on weight provisioning. |
| **Shared Libraries (`lib/` and `src/lib/`)** | | |
| `src/lib/locations.ts` & `lib/locations.ts` | `packages/shared/src/constants/locations.ts` | Deduplicate into single canonical municipal dataset. |
| `src/lib/i18n.ts` & `lib/i18n.ts` | `packages/shared/src/i18n/dictionaries.ts` | Deduplicate into single consolidated bilingual dictionary. |
| `src/lib/aiAnalyzer.ts` & `lib/aiAnalyzer.ts` | `packages/shared/src/ai/aiAnalyzer.ts` | Deduplicate rule-based classifier into shared package. |
| `src/types/index.ts` & `lib/neo4j.ts` interfaces | `packages/shared/src/types/index.ts` | Extract shared interfaces (`Complaint`, `Officer`, `HazardReport`). |
| `src/lib/auth.ts` | `apps/web/src/lib/auth.ts` & `apps/mobile/lib/auth.ts` | Move local credential authentication into web & mobile clients. |
| `src/lib/langContext.tsx` | `apps/web/src/contexts/LangContext.tsx` | Web-specific language context (using `localStorage`). Fix type errors. |
| `lib/langContext.tsx` | `apps/mobile/lib/langContext.tsx` | Mobile-specific language context (using `AsyncStorage`). |
| `src/lib/neo4j.ts` | `apps/web/src/services/apiClient.ts` | Rename to reflect actual role: API Client talking to `/api/dashboard`. |
| `lib/neo4j.ts` | `apps/mobile/lib/apiClient.ts` | Rename to reflect actual role. Strip deleted Supabase headers. |
| **Web Frontend (`src/`)** | | |
| `src/main.tsx` | `apps/web/src/main.tsx` | Maintain client entrypoint. |
| `src/App.tsx` | `apps/web/src/App.tsx` | Maintain page router and layout container. |
| `src/index.css` | `apps/web/src/index.css` | Maintain styling. |
| `src/contexts/` | `apps/web/src/contexts/` | `LocationContext`, `ToastContext`, `DashboardContext`. |
| `src/hooks/useWebSocket.ts` | `apps/web/src/hooks/useWebSocket.ts` | Maintain WebSocket singleton hook. |
| `src/components/*` | `apps/web/src/components/*` | Navbars, headers, animations, ErrorBoundary. |
| `src/pages/*` | `apps/web/src/pages/*` | All 8 core pages (Home, Submit, Track, HazardMap, RTI, IoT, Grievance, Admin). |
| `public/*` | `apps/web/public/*` | Logos, imagery, and static assets. |
| **Mobile Application (`app/`)** | | |
| `app/_layout.tsx` | `apps/mobile/app/_layout.tsx` | Root layout with GestureHandler and Stack. |
| `app/(tabs)/_layout.tsx` | `apps/mobile/app/(tabs)/_layout.tsx` | 6-tab bottom navigation layout. |
| `app/(tabs)/index.tsx` | `apps/mobile/app/(tabs)/index.tsx` | Mobile Home screen. |
| `app/(tabs)/submit.tsx` | `apps/mobile/app/(tabs)/submit.tsx` | Mobile complaint filing screen. Remove broken Supabase import. |
| `app/(tabs)/track.tsx` | `apps/mobile/app/(tabs)/track.tsx` | Mobile complaint tracking screen. |
| `app/(tabs)/hazardmap.tsx` | `apps/mobile/app/(tabs)/hazardmap.tsx` | Mobile SVG hazard map screen. |
| `app/(tabs)/rti.tsx` | `apps/mobile/app/(tabs)/rti.tsx` | Mobile RTI generator screen. |
| `app/(tabs)/admin.tsx` | `apps/mobile/app/(tabs)/admin.tsx` | Mobile admin heat map screen. |
| `app/login.tsx` | `apps/mobile/app/login.tsx` | Replace deleted Supabase auth with local/Firebase mobile auth. |
| `app/admin-login.tsx` | `apps/mobile/app/admin-login.tsx` | Admin PIN modal. |
| `app/components/SimpleHeatMap.tsx` | `apps/mobile/components/SimpleHeatMap.tsx` | Mobile SVG heat map visualization. |
| `assets/*` | `apps/mobile/assets/*` | App icon, splash screen, adaptive icon, favicon. |
| **IoT Edge Gateway (`IOT/`)** | | |
| `IOT/README.md` | `iot/README.md` | IoT edge documentation. |
| `IOT/app.yaml` | `iot/app.yaml` | Arduino App descriptor. |
| `IOT/python/*` | `iot/python/*` | MPU edge gateway (`main.py`, `sender.py`, `config.py`, `logger.py`). |
| `sketch/` *(Missing in root)* | `iot/sketch/*` | Scaffold missing C++ firmware (`sketch.ino`, `fsm.cpp`, `communication.cpp`). |
| **Build Artifacts & Tests** | | |
| `dist/` | *Delete from git* | Build output; must be generated dynamically via `pnpm build`. |
| `expo-export-test/` | *Delete from git* | Test export output; must not be tracked in version control. |
| `dummy.jpg` | *Delete* | Unused test image artifact. |

---

## 4. Workspaces & Dependency Configuration

### 4.1 Root `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 4.2 Shared Internal Package Declarations

#### `packages/shared/package.json`
```json
{
  "name": "@jansetu/shared",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.3"
  }
}
```

#### `packages/db/package.json`
```json
{
  "name": "@jansetu/db",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "firebase-admin": "^13.10.0",
    "@jansetu/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.5.3",
    "@types/node": "^20.0.0"
  }
}
```

#### `apps/api/package.json`
```json
{
  "name": "@jansetu/api",
  "version": "1.0.0",
  "private": true,
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@jansetu/db": "workspace:*",
    "@jansetu/shared": "workspace:*",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "ws": "^8.21.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

#### `apps/web/package.json`
```json
{
  "name": "@jansetu/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@jansetu/shared": "workspace:*",
    "@types/leaflet": "^1.9.21",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.344.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-leaflet": "^4.2.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2"
  }
}
```

#### `apps/mobile/package.json`
```json
{
  "name": "@jansetu/mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@jansetu/shared": "workspace:*",
    "@react-native-async-storage/async-storage": "1.23.1",
    "clsx": "^2.1.0",
    "expo": "~52.0.0",
    "expo-asset": "~11.0.5",
    "expo-clipboard": "~7.0.0",
    "expo-constants": "~17.0.0",
    "expo-font": "~13.0.0",
    "expo-haptics": "~14.0.0",
    "expo-image-picker": "~16.0.6",
    "expo-linking": "~7.0.0",
    "expo-local-authentication": "~15.0.0",
    "expo-location": "~18.0.0",
    "expo-router": "~4.0.0",
    "expo-speech": "~13.0.1",
    "expo-status-bar": "~2.0.0",
    "lucide-react-native": "^0.344.0",
    "nativewind": "4.1.23",
    "react": "18.3.1",
    "react-native": "0.76.9",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0",
    "react-native-svg": "15.8.0",
    "tailwind-merge": "^2.2.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.12",
    "typescript": "~5.3.0"
  }
}
```

---

## 5. Migration Execution Phases & Verification Gates

### Phase 1: Workspace Scaffolding & Git Hygiene
1. Create root `pnpm-workspace.yaml`.
2. Untrack committed build artifacts from git index without deleting source code:
   ```bash
   git rm -r --cached dist expo-export-test node_modules
   ```
3. Commit updated `.gitignore`.

### Phase 2: Extract `@jansetu/shared` and `@jansetu/db`
1. Scaffold `packages/shared/` and `packages/db/`.
2. Move and consolidate `locations.ts`, `i18n.ts`, `aiAnalyzer.ts`, and core types into `packages/shared/src/`.
3. Move `firebase.js` from `jansetu-backend/db/` into `packages/db/src/firebase.ts`.
4. **Verification Gate:** `pnpm --filter @jansetu/shared typecheck` and `pnpm --filter @jansetu/db typecheck` must pass with zero errors.

### Phase 3: Migrate Backend Engine (`apps/api`)
1. Move `jansetu-backend/` files into `apps/api/`.
2. Link dependencies to `@jansetu/db` and `@jansetu/shared`.
3. Fix hardcoded Windows paths in `grievanceRouter.js` and `drafterRouter.js` to dynamic `process.env.PYTHON_BIN || 'python3'`.
4. Fix PATCH endpoint path in `dashboardRouter.js`.
5. **Verification Gate:** Run `node -c apps/api/server.js` and boot backend on port 3000 to verify health endpoint `/health`.

### Phase 4: Migrate Web Portal (`apps/web`)
1. Move `src/`, `public/`, `index.html`, `vite.config.ts`, `tailwind.config.js` into `apps/web/`.
2. Link dependency to `@jansetu/shared`.
3. Update imports from `../lib/...` to `@jansetu/shared`.
4. Fix `src/lib/langContext.tsx` type constraint bug (`T: typeof t.en` -> `T: (typeof t)['en'] | (typeof t)['hi']`).
5. Fix AdminDashboard status patch URL (`/api/dashboard/complaint/:id`).
6. **Verification Gate:** Run `pnpm --filter @jansetu/web typecheck` and `pnpm --filter @jansetu/web build`. Production bundle must compile cleanly.

### Phase 5: Migrate Mobile Application (`apps/mobile`)
1. Move `app/`, `assets/`, `app.json`, `metro.config.js`, `babel.config.js`, `tailwind.config.expo.js` into `apps/mobile/`.
2. Link dependency to `@jansetu/shared`.
3. Delete broken `lib/supabase` imports in `app/login.tsx` and `app/(tabs)/submit.tsx`.
4. Wire mobile authentication to local user credentials (`lib/auth.ts`) or Firebase.
5. **Verification Gate:** Run `pnpm --filter @jansetu/mobile typecheck`.

### Phase 6: Realignment of IoT Gateway & Firmware (`iot/`)
1. Move `IOT/` to `iot/`.
2. Retain Python edge gateway in `iot/python/`.
3. Scaffold missing Arduino C++ firmware in `iot/sketch/` matching the FSM specification documented in `IOT/README.md`.
4. **Verification Gate:** Run `python3 -m py_compile iot/python/*.py`.

### Phase 7: End-to-End System Validation
1. Start backend: `pnpm --filter @jansetu/api start`.
2. Start web frontend: `pnpm --filter @jansetu/web dev`.
3. Test end-to-end flow:
   - File complaint on web with voice transcription and image upload.
   - Verify WebSocket pushes `new_complaint` to Dashboard and IoT Monitor.
   - Send simulated IoT fault to `POST /api/sensor`.
   - Verify auto-created complaint and active sensor anomaly.
   - Verify RTI Drafter and Grievance Officer produce formal dual-language outputs.
