# JanSetu Multiverse — Comprehensive Project State & Architectural Audit

**Audit Date:** November 23, 2026  
**Auditor:** Principal Software Architect  
**Repository Working Directory:** `/Users/apple/Desktop/JANSETU-MULTIVERSE`  
**Current Git Branch:** `main` (Commit: `11b91e3`)

---

## 1. Executive Summary

JanSetu Multiverse is a hybrid multi-surface civic intelligence platform spanning:
1. **Web Application (`src/`)**: A Vite + React 18 + Tailwind CSS single-page application providing bilingual citizen grievance reporting, statutory RTI drafting, live hazard mapping, IoT telemetry tracking, and an administrative control center.
2. **Backend Engine (`jansetu-backend/`)**: A Node.js Express server with WebSocket broadcasting and Firebase Firestore data persistence, handling complaint registration, SLA escalations, IoT sensor alerts, and invoking Python-based NLP drafting pipelines.
3. **Mobile Application (`app/` & `lib/`)**: An Expo (React Native 0.76) mobile application designed for on-the-go grievance submission, SVG hazard heat mapping, and RTI generation.
4. **IoT Edge Gateway (`IOT/`)**: A Linux MPU Python agent intended to interface with an Arduino UNO Q microcontroller monitoring streetlight hardware via LDR sensors.

### Key Audit Findings
- **Database Reality**: The platform originally utilized Neo4j and SQLite, but migrated to **Firebase Firestore** (`jansetu-backend/db/firebase.js`). The Neo4j driver (`db/graph.js`) and SQLite adapter (`db/sqlite.js`) are completely unused by active routers. Frontend clients named `neo4j.ts` are actually RPC clients to Express endpoints connected to Firestore.
- **Supabase Abandonment**: In commit `43ca617c8a4`, Supabase Edge Functions and `lib/supabase.ts` were deleted. However, mobile screens (`app/login.tsx`, `app/(tabs)/submit.tsx`) still attempt to import `lib/supabase`, creating critical build failures on mobile.
- **AI/ML Pipelines**: The claimed Qwen GGUF and YOLOv11 DLC models stored in `jansetu-backend/ai/models/` are **Git LFS pointer files (134 and 133 bytes)** lacking actual weights. Python runners in `grievanceRouter.js` and `drafterRouter.js` hardcode local Windows paths (`C:\LocalAI\...`). However, both `grievance_officer.py` and `rti_drafter.py` implement robust, deterministic rule- and template-based fallbacks that function without the LLM models. `ai/yolo_bridge.py` and `ai/llm_bridge.py` are dead code, never called by any router.
- **Missing IoT Firmware**: The `sketch/` directory referenced in `README.md` and `IOT/README.md` (containing Arduino C++ `.ino` and `.cpp` firmware) does not exist in the repository or git history.
- **WebSockets**: Actively implemented and functioning between `jansetu-backend/ws/broadcast.js` and the Web frontend (`src/hooks/useWebSocket.ts` and `src/contexts/DashboardContext.tsx`). Not implemented on mobile.

---

## 2. Verified File-by-File Architecture Inventory

### 2.1 Root Configuration & Build Files
- [`package.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/package.json): Web frontend manifest for Vite + React 18. Defines scripts: `dev`, `build`, `lint`, `preview`, `typecheck`. Dependencies include Leaflet, React-Leaflet, Lucide-React, Tailwind CSS.
- [`package-expo.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/package-expo.json): Expo React Native manifest (`jansetu-mobile`). Configured for Expo SDK 52, NativeWind 4.1, Expo Router 4.0.
- [`package-web-backup.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/package-web-backup.json): Legacy web manifest backup.
- [`vite.config.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/vite.config.ts): Vite build configuration with React plugin and proxy mapping `/api` -> `http://localhost:3000`.
- [`app.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app.json): Expo application manifest for `JanSetu` (`com.jansetu.app`). Defines permissions for `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, and `CAMERA`.
- [`tsconfig.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/tsconfig.json): Root TypeScript project references configuration.
- [`tsconfig.app.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/tsconfig.app.json): Strict TypeScript configuration for web code in `src/`.
- [`tsconfig.expo.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/tsconfig.expo.json): TypeScript configuration for mobile code in `app/` and `lib/`.
- [`tsconfig.node.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/tsconfig.node.json): TypeScript configuration for Vite/Node toolchain.
- [`metro.config.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/metro.config.js): Expo Metro bundler config wrapped with NativeWind.
- [`babel.config.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/babel.config.js): Babel preset configuration for Expo + NativeWind.
- [`tailwind.config.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/tailwind.config.js): Web Tailwind configuration scanning `index.html` and `src/**/*.{js,ts,jsx,tsx}`.
- [`tailwind.config.expo.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/tailwind.config.expo.js): Mobile Tailwind configuration scanning `app/**` and `lib/**`.
- [`global.css`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/global.css): Global CSS containing Tailwind utility directives.
- [`index.html`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/index.html): Web entry HTML mounting `#root` to `src/main.tsx`.

### 2.2 Backend Engine (`jansetu-backend/`)
- [`jansetu-backend/server.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/server.js): Server entrypoint. Boots Express app, initializes Firebase via `initFirebase()`, attaches WebSocket server via `initWebSocket(server)`, sets hourly auto-escalation interval (`runEscalationCheck()`), binds routers, and listens on `0.0.0.0:3000`.
- [`jansetu-backend/package.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/package.json): Backend dependencies: `express`, `firebase-admin`, `ws`, `cors`, `multer`, `dotenv`, `better-sqlite3`, `neo4j-driver`.
- [`jansetu-backend/routers/complaintRouter.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/routers/complaintRouter.js): Handles `POST /api/complaint`. Parses multipart/form-data images via Multer, maps field names, creates complaints in Firestore, and broadcasts `new_complaint` to WebSocket clients.
- [`jansetu-backend/routers/sensorRouter.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/routers/sensorRouter.js):
  - `GET /api/sensor`: Returns active `FAULT` sensor anomalies from Firestore.
  - `POST /api/sensor`: Ingests IoT payload (`device_id`, `status`, `type`). If `FAULT`, creates both an automated complaint and a sensor alert, broadcasting `new_complaint` and `new_sensor_alert`. Ignores `RESOLVED` status.
- [`jansetu-backend/routers/dashboardRouter.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/routers/dashboardRouter.js):
  - `POST /api/dashboard`: RPC action dispatcher (`getComplaintByNumber`, `getAllComplaints`, `getUserComplaints`, `seedOfficers`, `getAllOfficers`, `getOfficersByDepartment`, `assignOfficer`, `escalateComplaint`, `updateStatus`, `runEscalationCheck`, `getDepartmentStats`, `getGraphStats`). Broadcasts `complaint_updated` on state changes.
  - `GET /api/dashboard`: Aggregates active complaints list and summary statistics.
  - `PATCH /api/dashboard/complaint/:id`: Updates complaint status and broadcasts update.
  - `GET /api/dashboard/clear`: Wipes Firestore collections (`complaints`, `sensor_alerts`, `officers`, `assignments`).
- [`jansetu-backend/routers/adminRouter.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/routers/adminRouter.js):
  - `GET /api/admin/stats/department`: Returns department resolution metrics.
  - `GET /api/admin/stats/graph`: Returns complaint cluster and hotspot counts.
  - `GET /api/admin/dashboard`: Combined admin summary data.
  - `POST /api/admin/escalation/check`: Triggers manual escalation scan.
- [`jansetu-backend/routers/drafterRouter.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/routers/drafterRouter.js): `POST /api/drafter`. Spawns `ai/rti_drafter.py` to generate legal Section 6(1) RTI applications, saves draft in Firestore, and returns result.
- [`jansetu-backend/routers/grievanceRouter.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/routers/grievanceRouter.js):
  - `POST /api/grievance`: Spawns `ai/grievance_officer.py` to parse messy citizen text into structured 3-section legal grievance drafts, saves to Firestore, and returns JSON.
  - `GET /api/grievance/history`: Retrieves past grievance drafts.
- [`jansetu-backend/db/firebase.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/db/firebase.js): Primary persistence layer. Reads service account from `FIREBASE_SERVICE_ACCOUNT` env var or `firebase-service-account.json`. Operates collections: `complaints`, `sensor_alerts`, `officers`, `assignments`, `grievance_drafts`, `rti_drafts`. Implements SLA auto-escalation (>48 hrs) and officer seeding. Includes mock mode fallback.
- [`jansetu-backend/db/graph.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/db/graph.js): **Dead Code.** Contains Neo4j connection pool and Cypher queries. Not invoked by any active router.
- [`jansetu-backend/db/sqlite.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/db/sqlite.js): **Dead Code.** Contains SQLite table schemas and synchronous queries. Not invoked by any active router.
- [`jansetu-backend/db/dateSanitizer.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/db/dateSanitizer.js): Helper middleware to sanitize Neo4j date objects in Express JSON responses.
- [`jansetu-backend/ws/broadcast.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/ws/broadcast.js): Singleton WebSocket server attached to HTTP server. Runs 30-second ping/pong heartbeat and exposes `broadcast(type, data)`.
- [`jansetu-backend/middleware/upload.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/middleware/upload.js): Multer disk storage handler saving uploaded complaint attachments into `jansetu-backend/uploads/` with a 10MB limit.
- [`jansetu-backend/utils/catchAsync.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/utils/catchAsync.js): Express middleware wrapper forwarding asynchronous promise errors to `next()`.
- [`jansetu-backend/ai/grievance_officer.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/ai/grievance_officer.py): Grievance NLP pipeline. Strips conversational fluff, extracts dates/locations/remedies via regex, classifies against 15 municipal departments, escalates urgency, attempts local `llama_cpp` inference, and falls back to deterministic templates generating Analysis Report, English Draft, and Hindi Draft.
- [`jansetu-backend/ai/rti_drafter.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/ai/rti_drafter.py): RTI drafting script. Formulates discrete Section 6(1) RTI queries, checks BPL exemptions, and produces dual-language statutory applications (English and Hindi).
- [`jansetu-backend/ai/llm_bridge.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/ai/llm_bridge.py): **Dead Code.** Attempts LM Studio API call at `localhost:1234` or simulated fallback. Not imported by any router.
- [`jansetu-backend/ai/yolo_bridge.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/ai/yolo_bridge.py): **Dead Code.** Attempts ONNX Runtime execution with Qualcomm QNN on DLC model or simulated keyword fallback. Not imported by any router.
- [`jansetu-backend/clear_data.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/clear_data.js): Utility script to purge legacy Neo4j and SQLite records.
- [`jansetu-backend/test_escalation.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/test_escalation.js): Utility script to insert 50-hour-old test complaints into Firestore to test auto-escalation.

### 2.3 Web Frontend (`src/`)
- [`src/main.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/main.tsx): Client entrypoint. Wraps root with `ErrorBoundary`, `ToastProvider`, and `App`.
- [`src/App.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/App.tsx): Main application container. Manages local user authentication state (`AuthUser`), preloader splash animation, navigation routing between 8 pages, `LocationProvider`, `DashboardProvider`, and responsive headers/navbars.
- [`src/types/index.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/types/index.ts): TypeScript definitions for pages, locations, and components.
- [`src/lib/auth.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/lib/auth.ts): In-memory authentication provider with hardcoded credentials (`citizen` / `admin`, password `123456`).
- [`src/lib/neo4j.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/lib/neo4j.ts): Dashboard RPC client communicating with backend endpoint `/api/dashboard`. Dispatches calls for complaints, departments, graphs, officers, and escalations.
- [`src/lib/aiAnalyzer.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/lib/aiAnalyzer.ts): Pure client-side rule-based NLP engine. Matches keywords against 15 civic issue types, scores urgency based on safety hazards, detects Hindi/English, and generates concise summaries.
- [`src/lib/locations.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/lib/locations.ts): Municipal dataset covering 50+ localities across Delhi and Ghaziabad mapped to wards and coordinates.
- [`src/lib/i18n.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/lib/i18n.ts): Complete bilingual (English & Hindi) translation matrix for all web UI views.
- [`src/lib/langContext.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/lib/langContext.tsx): React context for language toggle ('en' | 'hi'), persisted in `localStorage`.
- [`src/contexts/LocationContext.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/contexts/LocationContext.tsx): React context managing browser geolocation permissions and GPS coordinates.
- [`src/contexts/ToastContext.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/contexts/ToastContext.tsx): UI toast notification provider with auto-dismiss.
- [`src/contexts/DashboardContext.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/contexts/DashboardContext.tsx): Real-time global dashboard state. Fetches `/api/dashboard` and `/api/sensor`, and subscribes to WebSocket events (`new_complaint`, `new_sensor_alert`, `sensor_resolved`, `complaint_updated`).
- [`src/hooks/useWebSocket.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/hooks/useWebSocket.ts): Singleton WebSocket client with automatic exponential reconnect connecting to `ws://localhost:3000`.
- [`src/components/`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/components/):
  - `Navbar.tsx`: Desktop fixed header with branding, navigation links, language switcher, user status, logout.
  - `MobileHeader.tsx`: Mobile viewport top header.
  - `BottomNav.tsx`: Mobile viewport fixed bottom navigation bar.
  - `ErrorBoundary.tsx`: React class error boundary.
  - `ScrollReveal.tsx`, `TextReveal.tsx`, `MouseInteractions.tsx`, `CountUp.tsx`, `TricolorWaves.tsx`: Interactive micro-animations and patriotic styling.
- [`src/pages/`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/pages/):
  - `LoginPage.tsx`: Citizen and admin login portal using `src/lib/auth.ts`.
  - `Home.tsx`: Landing page with statistics ticker, 4-step workflow guide, features grid, recent complaints feed, and action links.
  - `SubmitComplaint.tsx`: Multilingual grievance filing. Step 1 (Personal details), Step 2 (Voice input via Web Speech API in Hindi/English, rule-based AI analyzer, mandatory photo attachment, dual-language legal complaint letter generator and downloader), Step 3 (Area and ward selection). Submits multipart FormData to `POST /api/complaint`.
  - `TrackComplaint.tsx`: Public tracking portal by complaint reference number or citizen phone number. Displays status timeline, cluster size, and graph relationship view.
  - `AdminDashboard.tsx`: Administrative operations console. Tabbed views for Complaints, Departments, Graph Hotspots, and Officer Assignments. Includes SLA escalation scanner and officer allocation modals.
  - `HazardMap.tsx`: Interactive Leaflet map plotting clustered civic hazards, severity filters (Critical, High, Medium, Low), critical zones list, and hazard submission modal with image upload and GPS geo-tagging.
  - `RTIDrafter.tsx`: 5-step statutory RTI application builder under Section 6(1). Calls `POST /api/drafter` with fallback to local legal serializer. Allows copy, print, and download.
  - `IoTDashboard.tsx`: Streetlight telemetry monitoring console. Fetches `/api/sensor` and subscribes to WebSocket events. Displays active faults, device status, and real-time event logs.
  - `GrievanceOfficer.tsx`: Dual-language grievance drafting assistant. Supports voice-to-text or raw text input, calling `POST /api/grievance` to generate Section 1 (Analysis Report), Section 2 (Formal English Draft), and Section 3 (Formal Hindi Draft).

### 2.4 Mobile Application (`app/` & `lib/`)
- [`app/_layout.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/_layout.tsx): Root layout with `GestureHandlerRootView`, `LangProvider`, `StatusBar`, and Expo Router Stack.
- [`app/(tabs)/_layout.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/(tabs)/_layout.tsx): Mobile bottom tab bar configuring 6 tabs: Home (`index`), File (`submit`), Track (`track`), Hazards (`hazardmap`), RTI (`rti`), and Admin (`admin`).
- [`app/(tabs)/index.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/(tabs)/index.tsx): Mobile home dashboard displaying metrics, how-it-works, features, and recent complaint cards.
- [`app/(tabs)/submit.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/(tabs)/submit.tsx): Mobile complaint filing screen with speech-to-text simulation, rule-based AI analyzer, city/area selectors, and formal letter generator.
- [`app/(tabs)/track.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/(tabs)/track.tsx): Mobile status tracking with visual timeline, cluster indicator, and Cypher-like relationship representation.
- [`app/(tabs)/hazardmap.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/(tabs)/hazardmap.tsx): Custom SVG projected map rendering hazard clusters, GPS location tagging via `expo-location`, camera photo capture via `expo-image-picker`, and report modal.
- [`app/(tabs)/rti.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/(tabs)/rti.tsx): 4-step mobile RTI wizard with Section 6(1) legal draft generation and clipboard copy.
- [`app/(tabs)/admin.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/(tabs)/admin.tsx): Mobile admin view featuring `SimpleHeatMap`, summary statistics, and manual SLA escalation trigger.
- [`app/components/SimpleHeatMap.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/components/SimpleHeatMap.tsx): Reusable SVG coordinate projection map component plotting complaint hotspots.
- [`app/login.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/login.tsx): Citizen auth modal screen. **Broken due to missing `lib/supabase.ts`.**
- [`app/admin-login.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/admin-login.tsx): Admin PIN authentication modal verifying password `jansetu2024` stored in `AsyncStorage`.
- [`lib/locations.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/lib/locations.ts): Locality and ward dataset for mobile.
- [`lib/i18n.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/lib/i18n.ts): Mobile translation dictionary (missing newly added web keys).
- [`lib/langContext.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/lib/langContext.tsx): Mobile language context using `@react-native-async-storage/async-storage`.
- [`lib/aiAnalyzer.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/lib/aiAnalyzer.ts): Client-side rule-based NLP analyzer for mobile.
- [`lib/neo4j.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/lib/neo4j.ts): Mobile API client communicating with `EXPO_PUBLIC_NEO4J_PROXY_URL` using Supabase auth headers.

### 2.5 IoT Edge Gateway (`IOT/`)
- [`IOT/README.md`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/README.md): Documentation for the Arduino UNO Q streetlight monitoring edge gateway.
- [`IOT/app.yaml`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/app.yaml): Arduino App descriptor.
- [`IOT/python/main.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/python/main.py): Linux MPU Python agent. Polls MCU via `arduino.app_utils.Bridge.call("get_status")`. On `FAULT_CONFIRMED`, queues a `FAULT` event; on transition back to `NORMAL`, queues a `RESOLVED` event.
- [`IOT/python/sender.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/python/sender.py): Resilient background worker thread managing an event queue with exponential backoff sending HTTPS POST payloads to the cloud.
- [`IOT/python/config.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/python/config.py): Configuration loader reading `BACKEND_URL`, defaulting to `https://jansetu-multiverse.onrender.com/api/sensor`.
- [`IOT/python/logger.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/python/logger.py): Configures stdout logging.
- [`IOT/python/requirements.txt`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/python/requirements.txt): Declares `requests>=2.28.0`.
- `sketch/`: **Missing from repository.** No C++ Arduino firmware files (`communication.cpp`, `fsm.cpp`, `sketch.ino`) exist.

---

## 3. Technology Implementation Verification Matrix

| Technology | Claim in `README.md` | Actual Code Implementation Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Firebase Firestore** | Primary database for real-time complaint analytics & persistence. | **Actively Used & Core Backend DB** | Used in `jansetu-backend/db/firebase.js` across all active routers (`complaintRouter`, `sensorRouter`, `dashboardRouter`, `adminRouter`, `drafterRouter`, `grievanceRouter`). Handles auto-escalations, officer seeding, and complaint queries. |
| **WebSockets** | Real-time status updates for complaint lifecycle and IoT alerts. | **Actively Used on Web & Backend** (Missing on Mobile) | Server boots WebSocket on port 3000 in `server.js` via `broadcast.js`. Broadcasts `new_complaint`, `new_sensor_alert`, `complaint_updated`. Web client connects in `src/hooks/useWebSocket.ts`, consumed in `DashboardContext.tsx` and `IoTDashboard.tsx`. Mobile app has no WebSocket client. |
| **Neo4j** | Graph AI connecting citizens, complaints, locations, and departments with Cypher queries. | **Dead Code / Abandoned** | Backend driver exists in `db/graph.js`, but no router imports or calls it. Server only logs env vars. Frontend files named `neo4j.ts` actually make REST calls to `/api/dashboard`, which routes to Firestore. |
| **Supabase** | Mobile app authentication and client SDK. | **Broken / Deleted / Half-implemented** | `lib/supabase.ts` and `supabase/` directory were deleted in commit `43ca617c8a4`. Mobile files `app/login.tsx` and `app/(tabs)/submit.tsx` have broken imports to `lib/supabase`. Web app uses in-memory local auth (`src/lib/auth.ts`). |
| **Qwen (LLM)** | Local Qwen GGUF model for complaint classification and RTI generation. | **Half-implemented / Blocked by LFS (Fallback Active)** | Model file `ai/models/qwen/Qwen3-0.6B-Q4_0.gguf` is a 134-byte Git LFS pointer. Routers hardcode Windows paths `C:\LocalAI\...`. However, `grievance_officer.py` and `rti_drafter.py` contain complete regex/rule/template fallbacks that execute reliably. |
| **YOLO (v11)** | Edge anomaly & hazard object detection on Qualcomm NPU. | **Dead Code / Uncalled** | Model file `ai/models/yolo/yolov11_det.dlc` is a 133-byte Git LFS pointer. `ai/yolo_bridge.py` exists with keyword simulation, but is never imported or called by any router or frontend. |
| **Sarvam AI** | Speech-to-text multi-dialect voice complaint filing. | **Non-existent / Marketing Copy Only** | `EXPO_PUBLIC_SARVAM_API_KEY` in README.md. Zero code calls Sarvam. Web uses browser native Web Speech API; mobile uses `expo-speech` (TTS). Translation strings refer to "Sarvam AI Voice Input" purely as label copy. |
| **Gemini AI** | AI analysis listed in environment variables. | **Non-existent** | `EXPO_PUBLIC_GEMINI_API_KEY` listed in README.md. Zero imports, SDK packages, or API requests to Gemini anywhere in the repository. |

---

## 4. Feature Preservation Checklist

The following existing features and routes are fully implemented and must be strictly preserved during any future refactoring:

### Web Application (`src/`)
- [ ] **Authentication Gate (`src/pages/LoginPage.tsx`)**: Citizen (`citizen`) and Admin (`admin`) role selection with local auth in `src/lib/auth.ts`.
- [ ] **Home Dashboard (`src/pages/Home.tsx`)**: Hero section, live animated metrics (total, resolved, pending, escalated), 4-step workflow, features grid, recent complaints live feed, and tool navigation cards.
- [ ] **Complaint Filing (`src/pages/SubmitComplaint.tsx`)**:
  - Voice recording via Web Speech API (`webkitSpeechRecognition`) in Hindi and English with live transcription.
  - Client-side AI classification via `src/lib/aiAnalyzer.ts` (15 categories, urgency scoring, summary generation).
  - Mandatory photographic evidence upload via HTML5 file input.
  - Dual-language formal legal complaint letter generator with preview and `.txt` download in English and Hindi.
  - Locality and ward selection auto-filling from `src/lib/locations.ts`.
  - Multipart form submission to `POST /api/complaint`.
- [ ] **Complaint Tracking (`src/pages/TrackComplaint.tsx`)**:
  - Reference number search (e.g. `JS-2026...`).
  - Citizen telephone complaint history lookup via `getUserComplaints()`.
  - Visual status progression timeline (Pending -> Assigned -> In Progress -> Resolved / Escalated).
  - Graph cluster and similarity count indicators.
- [ ] **Hazard Map (`src/pages/HazardMap.tsx`)**:
  - Interactive React-Leaflet map with custom marker clusters.
  - Hazard filtering by type (wire, pothole, flood, collapse, fire hazard, street light) and severity (Low, Medium, High, Critical).
  - Critical zones leaderboard.
  - Citizen hazard report modal with camera/photo upload and GPS geolocation.
- [ ] **Statutory RTI Drafter (`src/pages/RTIDrafter.tsx`)**:
  - 5-step statutory application builder compliant with Section 6(1) of RTI Act 2005.
  - Below Poverty Line (BPL) fee waiver logic.
  - Integration with `POST /api/drafter` with local legal serialization fallback.
  - Copy to clipboard, print layout, and text file export.
- [ ] **IoT Node Monitor (`src/pages/IoTDashboard.tsx`)**:
  - Real-time telemetry feed polling `GET /api/sensor`.
  - Live WebSocket updates for `new_sensor_alert` and `sensor_resolved`.
  - Active fault count and system status indicator.
  - Telemetry logs table with device ID, status, type, location, and timestamp.
- [ ] **Grievance Officer AI (`src/pages/GrievanceOfficer.tsx`)**:
  - Voice recording or raw text citizen complaint entry.
  - Calls `POST /api/grievance` generating 3-section output: Section 1 (Analysis Report), Section 2 (Formal English Draft), Section 3 (Formal Hindi Draft).
  - Tabbed preview with copy, print, and download actions.
- [ ] **Admin Operations Console (`src/pages/AdminDashboard.tsx`)**:
  - Tabbed interface: Complaints, Departments, Graph Hotspots, Officer Management.
  - Status and urgency filters.
  - Real-time status update dropdowns.
  - Manual SLA auto-escalation trigger (`POST /api/admin/escalation/check`).
  - Officer seeding and complaint assignment modals.
- [ ] **Global Web Contexts**:
  - `LocationContext`: Geolocation handling.
  - `ToastContext`: Custom alerts and warnings.
  - `DashboardContext`: Real-time WebSocket complaint and sensor state management.
  - `LangContext`: Seamless English/Hindi language toggle with `localStorage` persistence.

### Mobile Application (`app/` & `lib/`)
- [ ] **Navigation & Layout (`app/(tabs)/_layout.tsx`)**: 6-tab bottom navigation (Home, File, Track, Hazards, RTI, Admin).
- [ ] **Mobile Home (`app/(tabs)/index.tsx`)**: Hero metrics, workflow guide, recent complaint cards.
- [ ] **Mobile Submission (`app/(tabs)/submit.tsx`)**: Voice input via `expo-speech`, rule-based AI analyzer, area/ward selection, formal letter generation.
- [ ] **Mobile Tracking (`app/(tabs)/track.tsx`)**: Number search, status timeline, graph relationship viewer, cluster indicator.
- [ ] **Mobile Hazard Map (`app/(tabs)/hazardmap.tsx`)**: Custom SVG coordinate-projected map, GPS coordinate extraction via `expo-location`, camera image attachment via `expo-image-picker`.
- [ ] **Mobile RTI Drafter (`app/(tabs)/rti.tsx`)**: 4-step mobile wizard with clipboard export.
- [ ] **Mobile Admin Heat Map (`app/(tabs)/admin.tsx` & `app/components/SimpleHeatMap.tsx`)**: SVG cluster heat map, summary statistics, manual escalation trigger.
- [ ] **Admin Security (`app/admin-login.tsx`)**: Admin PIN protection (`jansetu2024`) with attempt limits.

### Backend Engine (`jansetu-backend/`)
- [ ] **Server Bootstrap (`server.js`)**: Combined Express + WebSocket server on port 3000 with 1-hour auto-escalation cron.
- [ ] **Complaint Router (`routers/complaintRouter.js`)**: Multipart image uploads via Multer, Firestore complaint creation, WebSocket broadcasting.
- [ ] **Sensor Router (`routers/sensorRouter.js`)**: IoT fault telemetry interception, automatic complaint creation, sensor alert logging, WebSocket broadcasting.
- [ ] **Dashboard Router (`routers/dashboardRouter.js`)**: RPC action dispatcher, dashboard data aggregation, complaint status patching, database wiping.
- [ ] **Admin Router (`routers/adminRouter.js`)**: Department statistics, graph hotspots, manual escalation scan.
- [ ] **AI Routers (`routers/drafterRouter.js`, `routers/grievanceRouter.js`)**: RTI and Grievance drafting pipelines with legal template fallbacks and Firestore draft persistence.
- [ ] **Database Adapter (`db/firebase.js`)**: Firestore collections (`complaints`, `sensor_alerts`, `officers`, `assignments`, `grievance_drafts`, `rti_drafts`), auto-escalation logic (>48h), mock mode fallback.
- [ ] **WebSocket Broadcast (`ws/broadcast.js`)**: Broadcast dispatcher for `new_complaint`, `new_sensor_alert`, `complaint_updated`.

### IoT Edge Gateway (`IOT/`)
- [ ] **MPU Python Controller (`IOT/python/main.py`)**: State polling via RouterBridge RPC (`Bridge.call("get_status")`), fault transition detection (`FAULT_CONFIRMED`, `NORMAL`).
- [ ] **Resilient Event Sender (`IOT/python/sender.py`)**: Daemon worker thread with exponential backoff retry mechanism.
- [ ] **Configuration Loader (`IOT/python/config.py`)**: Environment variable resolution for backend endpoint.

---

## 5. Identified Bugs, Deficiencies, and Technical Debt

### 5.1 Broken Imports & Missing Files
1. **Missing `lib/supabase.ts`**:
   - `app/login.tsx:6`: `import { supabase } from '../lib/supabase';`
   - `app/(tabs)/submit.tsx:14`: `import { supabase } from '../../lib/supabase';`
   - Cause: Deleted in commit `43ca617c8a4`. Fails mobile bundling and compilation.
2. **Missing IoT Firmware (`sketch/`)**:
   - `sketch/` folder referenced in `README.md` and `IOT/README.md` is absent from the filesystem.

### 5.2 Hardcoded Environment Paths
1. **Windows Local Python & Model Paths**:
   - `jansetu-backend/routers/grievanceRouter.js` (line 34): Spawns `C:\LocalAI\qai-env\Scripts\python.exe`.
   - `jansetu-backend/routers/grievanceRouter.js` (line 21): Passes `--model C:\Users\qcwor\Desktop\JanSetu-MultiVerse\JANSETU-MULTIVERSE\jansetu-backend\ai\models\qwen\Qwen3-0.6B-Q4_0.gguf`.
   - `jansetu-backend/routers/drafterRouter.js` (line 17): Spawns `C:\LocalAI\qai-env\Scripts\python.exe` with `C:\Users\qcwor\...` model path.
   - `test_qwen.py` (line 4): Hardcodes `C:\Users\qcwor\...`.
   - Impact: Fails on macOS, Linux, and cloud containers (Render). Must be replaced with `python3` / environment-aware paths.

### 5.3 Git LFS Pointer Model Placeholders
1. `jansetu-backend/ai/models/qwen/Qwen3-0.6B-Q4_0.gguf`: 134 bytes (Git LFS pointer).
2. `jansetu-backend/ai/models/yolo/yolov11_det.dlc`: 133 bytes (Git LFS pointer).
   - Impact: Running `llama_cpp` or ONNX on these files causes runtime parse errors. The Python fallbacks currently prevent total failure.

### 5.4 Backend Routing Mismatch
1. **Admin Dashboard Status Update 404**:
   - In `src/pages/AdminDashboard.tsx` (line 91), status updates call `fetch('/api/complaint/' + id, { method: 'PATCH' })`.
   - In `jansetu-backend`, `complaintRouter.js` only defines `POST /`. The PATCH endpoint is located at `/api/dashboard/complaint/:id` in `dashboardRouter.js`.
   - Impact: Status updates from the web admin table fail with 404 Not Found.

### 5.5 Inconsistent Backend Endpoint URLs
1. `src/pages/GrievanceOfficer.tsx`: `import.meta.env.VITE_API_BASE || 'http://localhost:3000'`
2. `src/lib/neo4j.ts`: `import.meta.env.VITE_BACKEND_URL || ''`
3. `src/pages/RTIDrafter.tsx`, `src/pages/IoTDashboard.tsx`, `src/pages/SubmitComplaint.tsx`: Direct `/api/...` calls relying on Vite proxy.
4. `IOT/python/config.py`: Hardcodes fallback `https://jansetu-multiverse.onrender.com`.
5. `IOT/python/sender.py` (line 82): Unused variable `location = '/api/sensor-alert'` while `config.py` targets `/api/sensor`.

### 5.6 Code Duplication Between Root and Src
- `lib/aiAnalyzer.ts` vs `src/lib/aiAnalyzer.ts`: Near-identical copies with minor keyword differences.
- `lib/locations.ts` vs `src/lib/locations.ts`: Exact duplicate files.
- `lib/i18n.ts` vs `src/lib/i18n.ts`: Diverged. `src/lib/i18n.ts` contains additional keys (`admin_stats_sidebar`, `admin_heatmap_description`) missing in `lib/i18n.ts`, causing mobile TypeScript errors.
- `lib/neo4j.ts` vs `src/lib/neo4j.ts`: Diverged. `lib/neo4j.ts` still includes Supabase header logic.

### 5.7 Web TypeScript Compiler Warnings/Errors
Running `pnpm typecheck` (`tsc --noEmit -p tsconfig.app.json`) reports 11 errors:
- `src/lib/langContext.tsx:9`: Type `T: typeof t.en` causes type incompatibility when passing `t['hi']`.
- Unused variables violating `noUnusedLocals` / `noUnusedParameters` in `ErrorBoundary.tsx`, `ToastContext.tsx`, `useWebSocket.ts`, `AdminDashboard.tsx`, `IoTDashboard.tsx`, and `SubmitComplaint.tsx`.

### 5.8 Package Manager Collision
The repository root contains both Web and Expo configurations. Attempting to run mobile commands with web `node_modules` installed results in 84 module resolution errors. Swapping `package.json` manually is error-prone and should eventually be structured as a proper monorepo workspace.

---

## 6. Security and Hygiene Audit Findings

### 6.1 Committed Credentials & Secrets in Git History
1. **Committed Supabase JWT Anon Key & Project URL**:
   - Commit `bd30e4149a2c63a5927623b1ca5fabe78897bfba` committed live Supabase project URL (`https://gzuvwqosslryjcldzoyl.supabase.co`) and an anon JWT API key directly in `src/lib/supabase.ts` and `lib/supabase.ts`.
   - While files were removed from the working tree in commit `43ca617c8a4`, they remain permanently in Git history.
   - **Remediation**: The user must immediately rotate the Supabase anon/service keys in the Supabase Dashboard if this project is active.
2. **Current Working Tree Credentials**:
   - `firebase-service-account.json` is **not** committed in the working tree.
   - No local uncommitted `.env` files with live production secrets were detected.

### 6.2 In-Code Hardcoded Credentials & Fallback Passwords
1. **Admin Portal Password**:
   - [`app/admin-login.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/app/admin-login.tsx) (line 9): `const ADMIN_PASSWORD = 'jansetu2024';`
   - Hardcoded in plaintext within the mobile client bundle.
2. **In-Memory Web Authentication Passwords**:
   - [`src/lib/auth.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/lib/auth.ts) (lines 14, 21): Plaintext password `'123456'` for `'citizen'` and `'admin'`.
3. **Database Fallback Passwords**:
   - [`jansetu-backend/db/graph.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/db/graph.js) (line 7) & [`jansetu-backend/clear_data.js`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/clear_data.js) (line 5): Hardcodes fallback `'password'` for Neo4j credentials (`neo4j://localhost:7687`, user: `neo4j`).

### 6.3 Hardcoded Remote & Local URLs
1. **Production Render Backend Hardcoded in IoT Edge**:
   - [`IOT/python/config.py`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/python/config.py) (line 9): Hardcodes fallback `https://jansetu-multiverse.onrender.com`.
2. **Hardcoded Localhost Endpoints in Frontend**:
   - [`src/pages/GrievanceOfficer.tsx`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/pages/GrievanceOfficer.tsx) (line 39): Fallback to `http://localhost:3000`.
   - [`src/hooks/useWebSocket.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/src/hooks/useWebSocket.ts) (line 21): Hardcodes `ws://localhost:3000`.
   - [`vite.config.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/vite.config.ts) (line 10): Proxy target hardcoded to `http://localhost:3000`.

### 6.4 Git Index Bloat & Large Binaries (Hygiene Audit)
1. **9,831 Tracked Files in `node_modules/` in Git Index**:
   - The root `node_modules/` directory was committed to the repository index prior to commit `11b91e3`.
   - Running `git ls-files node_modules | wc -l` confirms 9,831 tracked dependency files, cluttering the index and causing git operational slowdown.
2. **Tracked Build Artifacts & Compiled Bytecode**:
   - `expo-export-test/`: Entire test export directory is committed in git index, including a **6.3 MB compiled Hermes bytecode file** (`expo-export-test/bundles/android-1cb58cfb559ba79b5c21966a987efcf7.hbc`).
   - `dist/`: Web production build output directory is tracked in git index.
3. **Duplicate Large Media Assets**:
   - Identical 1.15 MB static PNG banner files exist across `public/images/`, `dist/images/`, and `expo-export-test/images/`.
4. **Git LFS Model Pointers**:
   - `jansetu-backend/ai/models/qwen/Qwen3-0.6B-Q4_0.gguf` (134 bytes) and `jansetu-backend/ai/models/yolo/yolov11_det.dlc` (133 bytes) are Git LFS pointer stubs lacking backing model storage.

### 6.5 Secrets Requiring Immediate User Rotation
1. **Supabase Project Credentials**:
   - Invalidate/rotate the Anon Public Key and Service Role Key associated with project `gzuvwqosslryjcldzoyl.supabase.co` in the Supabase management console.
2. **Admin PIN / Passwords**:
   - Replace `'jansetu2024'` in `app/admin-login.tsx` and `'123456'` in `src/lib/auth.ts` with environment-injected secrets (`EXPO_PUBLIC_ADMIN_PIN`, `ADMIN_PASSWORD`).
3. **Render Backend CORS & Tokens**:
   - Ensure the backend hosted at `https://jansetu-multiverse.onrender.com` requires authentication and enforces strict CORS origins rather than allowing unauthenticated arbitrary telemetry.

---

## 7. Repository Hygiene & Migration Artifacts Created

During this audit phase, the following governance and configuration artifacts were created:
1. **Clean Root [`.gitignore`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.gitignore)**:
   - Comprehensive rules covering node modules, build artifacts (`dist/`, `expo-export-test/`, `.expo/`), environment files (`.env*`), Firebase service account credentials (`*firebase*.json`), binary model weights (`*.gguf`, `*.dlc`, `*.pt`, `*.onnx`), database files (`*.sqlite`, `*.db`), and OS metadata.
2. **Standardized Environment Templates**:
   - Umbrella root: [`.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.env.example)
   - Backend: [`jansetu-backend/.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/jansetu-backend/.env.example)
   - Web: [`.env.web.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.env.web.example)
   - Mobile: [`.env.mobile.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.env.mobile.example)
   - IoT Gateway: [`IOT/python/.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/IOT/python/.env.example)
   - Target Monorepo Templates: [`docs/templates/apps-api.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/templates/apps-api.env.example), [`docs/templates/apps-web.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/templates/apps-web.env.example), [`docs/templates/apps-mobile.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/templates/apps-mobile.env.example), [`docs/templates/iot-python.env.example`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/templates/iot-python.env.example).
3. **Monorepo Migration Specification ([`docs/MIGRATION_MAP.md`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/docs/MIGRATION_MAP.md))**:
   - Exhaustive directory and feature migration plan mapping current code into `apps/web`, `apps/mobile`, `apps/api`, `packages/shared`, `packages/db`, `iot/sketch`, and `iot/python`.
   - Defined workspace dependency manifests, cross-boundary exports, and a 7-phase step-by-step execution roadmap with automated verification gates.

---

## 8. Inspection Commands Executed

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

# 8. Security audit: Inspect tracked files for secrets, credentials, and credentials patterns
git ls-files | grep -iE '(\.env|secret|firebase|service[-_]account|\.pem|\.key|\.p12|\.keystore)'
git grep -nEi '(api[-_]?key|secret|password|jwt|bearer)' -- ':(exclude)node_modules' ':(exclude)dist' ':(exclude)expo-export-test'

# 9. Hygiene audit: Inspect large tracked files and build artifacts
git ls-files | grep -E '^(node_modules/|dist/|expo-export-test/)' | head -n 30
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

## 9. Phase 0 Monorepo Initialization Summary

### 9.1 Overview & Architecture Decision
- **Status:** Complete (November 23, 2026)
- **Monorepo Engine:** `pnpm` workspaces (`pnpm@11.24.0`) + Turborepo (`turbo 2.11.13`).
- **Legacy Source Strategy:** All active hackathon source folders (`src/`, `app/`, `lib/`, `jansetu-backend/`, `IOT/`) remain **100% intact and untouched in-place** at the repository root. They serve as authoritative reference implementations until each application is systematically migrated during Phases 2–6.
- **File-Swapping Hack Retirement:** The fragile practice of overwriting root `package.json` with `package-expo.json` is officially retired. Legacy manifests have been safely archived in `legacy/` (`package-web.json`, `package-expo.json`, `package-web-backup.json`, `package-lock.json`).

### 9.2 Initialized Workspace Structure
The monorepo contains 5 initialized, strictly-typed packages:
1. [`packages/shared`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared): `@jansetu/shared` (TypeScript source package, exported directly to workspace consumers).
2. [`packages/db`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db): `@jansetu/db` (Persistence layer, depends on `@jansetu/shared`).
3. [`apps/api`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api): `@jansetu/api` (Backend Express engine, depends on `@jansetu/db` and `@jansetu/shared`).
4. [`apps/web`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web): `@jansetu/web` (Vite citizen portal, depends on `@jansetu/shared`).
5. [`apps/mobile`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/mobile): `@jansetu/mobile` (Expo React Native app, depends on `@jansetu/shared`).

### 9.3 Verification Results
- **`pnpm install`**: Resolved and linked 5 workspace packages via `workspace:*` dependencies with zero errors.
- **`pnpm typecheck`** (`turbo run typecheck`): 5/5 packages compiled cleanly with `tsc --noEmit` in 1.74s.
- **`pnpm lint`** (`turbo run lint`): 5/5 packages passed ESLint flat configuration in 1.02s with zero warnings.
- **`pnpm build`** (`turbo run build`): 5/5 packages built successfully in 2.50s.

### 9.4 Unresolved Issues / Known Technical Debt (Postponed to Application Phases)
1. Legacy hackathon root source code still contains known issues documented in Section 5 (mobile Supabase crash, backend Windows paths, web TypeScript lint issues). These remain isolated from the new workspace apps and will be resolved as each app is migrated.
2. Git tracking: 9,831 files in `node_modules/` and build artifacts (`expo-export-test/`, `dist/`) remain in git index history until staged for removal.

### 9.5 Phase 1 Entry Checklist
- [x] Root `pnpm-workspace.yaml` and `turbo.json` created and validated.
- [x] Root `packageManager` pinned to `pnpm@11.24.0` in root `package.json`.
- [x] Shared `tsconfig.base.json`, `eslint.config.js`, and `.prettierrc.json` configured.
- [x] Legacy manifests archived in `legacy/`; root file-swapping hack retired.
- [x] All 5 workspace packages created with valid manifests and zero-`any` entrypoints.
- [x] `pnpm install` and `pnpm typecheck` passing across the workspace.
- [x] Completed Phase 1: Consolidate `@jansetu/shared` constants, types, schemas, and i18n dictionaries.

---

## 10. Phase 1 Implementation Summary (`@jansetu/shared`)

### 10.1 Overview & Implemented Capabilities
- **Status:** Complete (November 23, 2026)
- **Target Package:** [`packages/shared`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared) (`@jansetu/shared`)
- **Key Modules Implemented:**
  1. **Roles & Permission Helpers ([`src/roles/index.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/roles/index.ts))**:
     - Roles: `citizen`, `ward_officer`, `dept_head`, `admin`
     - Permissions map `ROLE_PERMISSIONS` and helper functions: `hasPermission(role, permission)`, `getRolePermissions(role)`, and `canTransitionStatus(role, from, to)`
  2. **Departments & Categories ([`src/domain/`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/domain))**:
     - 16 civic departments typed as `DepartmentName` and validated via `DepartmentSchema`
     - 16 complaint issue categories typed as `ComplaintCategory` and validated via `ComplaintCategorySchema`
     - 4 urgency levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) with numerical priority weights
  3. **Status State Machine ([`src/domain/status.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/domain/status.ts))**:
     - Complete lifecycle states: `PENDING`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `ESCALATED`, `REOPENED`
     - Immutable transitions matrix `VALID_STATUS_TRANSITIONS` and transition validator `isValidStatusTransition(from, to)`
  4. **SLA Policy Engine ([`src/domain/sla.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/domain/sla.ts))**:
     - Baseline resolution hours by urgency: `CRITICAL` (12h), `HIGH` (24h), `MEDIUM` (48h), `LOW` (72h)
     - Hazardous category overrides: `Electricity Hazard` (6h), `Fire Hazard` (6h), `Sewage` (18h), `Water Supply` (18h)
     - Calculation functions: `calculateSlaDeadline()`, `calculateRemainingSlaMs()`, `isSlaBreached()`, and `isSlaWarning()`
  5. **Zod Validation Schemas ([`src/schemas/`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/schemas))**:
     - `CreateComplaintSchema` (input normalization, coordinate boundary validation, phone regex)
     - `UpdateClusterStatusSchema` (status patching with notes & officer ID)
     - `RtiDraftInputSchema` (RTI Act 2005 Section 6(1) parameters, BPL exemption fields)
     - `IotEventPayloadSchema` & `IotHeartbeatPayloadSchema` (telemetry fault/heartbeat schema)
  6. **Bilingual i18n Dictionary ([`src/i18n.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/shared/src/i18n.ts))**:
     - Merged superset of both legacy `src/lib/i18n.ts` and `lib/i18n.ts` containing 474 unique keys
     - 100% key parity between English (`t.en`) and Hindi (`t.hi`) with dynamic template interpolations preserved

### 10.2 Unit Test Results (`vitest run`)
```text
$ vitest run
 ✓ src/__tests__/i18n.test.ts (4 tests)
 ✓ src/__tests__/sla.test.ts (7 tests)
 ✓ src/__tests__/status-transitions.test.ts (7 tests)
 ✓ src/__tests__/schemas.test.ts (11 tests)

 Test Files  4 passed (4)
      Tests  29 passed (29)
   Duration  360ms
```

### 10.3 Phase 2 Entry Gate
- [x] `@jansetu/shared` compiles cleanly (`tsc --noEmit`) with zero inferred `any`.
- [x] 29 unit tests pass in Vitest validating schemas, transitions, SLA math, and i18n parity.
- [x] Turborepo `pnpm typecheck` and `pnpm lint` pass across all 5 workspace packages.
- [x] Completed Phase 2: Configured `@jansetu/db` with Drizzle ORM and PostGIS spatial support.

---

## 11. Phase 2 Implementation Summary (Drizzle ORM & PostGIS Database Layer — `@jansetu/db`)

### 11.1 Overview & Architecture Decision
- **Status:** Complete (November 23, 2026)
- **Target Package:** [`packages/db`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db) (`@jansetu/db`)
- **Technology Stack:**
  - ORM: `drizzle-orm` (0.45.4) + `drizzle-kit` (0.31.11)
  - Driver: `@neondatabase/serverless` (1.2.1)
  - Spatial Engine: PostGIS with SRID 4326 (`Point` and `MultiPolygon` geometry types)
  - Authentication Integration: Better Auth relational tables (`users`, `sessions`, `accounts`, `verifications`)

### 11.2 Complete Relational + Geospatial Schema Implemented
1. **Authentication (Better Auth Compatible)**:
   - [`src/schema/users.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/users.ts): `users` (roles: `citizen`, `ward_officer`, `dept_head`, `admin`), `sessions`, `accounts` (OAuth/credentials), and `verifications`.
2. **Administrative & Municipal Spatial Foundation**:
   - [`src/schema/departments.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/departments.ts): `departments` (unique `name` and `code`, `default_sla_hours`).
   - [`src/schema/wards.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/wards.ts): `wards` with `boundary` typed as `geometry(MultiPolygon, 4326)`.
3. **Core Civic Intelligence & Clustering**:
   - [`src/schema/clusters.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/clusters.ts): `complaint_clusters` with `centroid` typed as `geometry(Point, 4326)`, `complaint_count`, and `last_activity_at`.
   - [`src/schema/complaints.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/complaints.ts): `complaints` containing:
     - `exact_location`: `geometry(Point, 4326)` for internal municipal dispatch.
     - `public_location`: `geometry(Point, 4326)` for privacy-jittered public maps.
     - `idempotency_key`: Unique constraint preventing duplicate submissions.
     - `tracking_code`: Human-readable public query identifier (`JS-YYYYMMDD-XXXX`).
     - `sla_due_at`: Calculated SLA deadline timestamp.
   - `complaint_events`: Immutable audit trail tracking state machine transitions and officer actions.
4. **IoT Telemetry & Legal Operations**:
   - [`src/schema/iot.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/iot.ts): `iot_devices` (`device_uid`, `location` as `geometry(Point, 4326)`, `battery_level`) and `iot_telemetry` time-series logs.
   - [`src/schema/rti.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/rti.ts): `rti_applications` storing statutory RTI drafts, Section 6(1) query arrays, and BPL exemption records.
5. **Entity Relations**:
   - [`src/schema/relations.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/schema/relations.ts): Drizzle relational graph connecting users, departments, wards, clusters, complaints, events, and IoT devices.

### 11.3 Required Indexes & Constraints Verified
- **GIST Spatial Indexes**:
  - `idx_wards_boundary` on `wards USING gist (boundary)`
  - `idx_clusters_centroid` on `complaint_clusters USING gist (centroid)`
  - `idx_complaints_public_location` on `complaints USING gist (public_location)`
  - `idx_iot_devices_location` on `iot_devices USING gist (location)`
- **Unique Indexes**:
  - `idx_complaints_tracking_code` on `complaints (tracking_code)`
  - `idx_complaints_idempotency_key` on `complaints (idempotency_key)`
  - `idx_iot_devices_device_uid` on `iot_devices (device_uid)`
- **Composite Query Indexes**:
  - `idx_complaints_ward_dept_status` on `complaints (ward_id, department_id, status)`
  - `idx_complaints_status_sla_due` on `complaints (status, sla_due_at)` for SLA breach background cron queries
  - `idx_clusters_dept_ward_status` on `complaint_clusters (department_id, ward_id, status)`
  - `idx_events_complaint_created` on `complaint_events (complaint_id, created_at)`

### 11.4 Generated Drizzle SQL Migration
- Initial migration file: [`packages/db/drizzle/0000_famous_black_tarantula.sql`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/drizzle/0000_famous_black_tarantula.sql)
- Verified includes `CREATE EXTENSION IF NOT EXISTS postgis;` at line 1, followed by 12 table definitions, foreign keys, unique constraints, and all GIST/btree indexes.

### 11.5 Typed Query & Geospatial Helpers
Implemented in [`packages/db/src/helpers/spatial.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/helpers/spatial.ts):
1. `resolveWardByCoords(db, lat, lng)`: Evaluates `ST_Contains(wards.boundary, ST_SetSRID(ST_MakePoint(lng, lat), 4326))` to map citizen coordinates to exact ward.
2. `findNearbyOpenCluster(db, lat, lng, departmentId, radiusMeters, windowDays)`: Uses `ST_DWithin` on geography types to find active clusters within distance.
3. `buildResolveWardSql(lat, lng)` & `buildNearbyClusterSql(lat, lng, departmentId, radiusMeters, windowDays)`: Modular SQL expression builders enabling isolated testing of PostGIS clauses and parameter binding order.
4. `obfuscatePublicCoords(lat, lng)`: Deterministically snaps coordinates to a ~50m spatial grid (`PRIVACY_GRID_STEP = 0.0005`) to protect citizen residential privacy.

### 11.6 Idempotent Database Seed Script
Implemented in [`packages/db/src/seed.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/packages/db/src/seed.ts) (runnable via `pnpm --filter @jansetu/db db:seed`):
1. **Core Municipal Departments (6)**:
   - Streetlights: `Municipal Corporation - Electrical Division` (`विद्युत एवं स्ट्रीटलाइट विभाग`, `ELEC`, 24h SLA)
   - Roads: `Public Works Department (PWD)` (`लोक निर्माण विभाग (पीडब्ल्यूडी)`, `PWD`, 24h SLA)
   - Sanitation: `Municipal Corporation - Sanitation Department` (`स्वच्छता एवं ठोस अपशिष्ट प्रबंधन विभाग`, `SAN`, 48h SLA)
   - Water Supply: `Delhi Jal Board / Water Supply Department` (`दिल्ली जल बोर्ड / जल आपूर्ति विभाग`, `DJB`, 18h SLA)
   - Drainage/Sewerage: `Municipal Corporation - Sewerage Division` (`जल निकासी एवं सीवरेज विभाग`, `SEW`, 18h SLA)
   - Electricity: `Electricity Distribution Company (DISCOM)` (`विद्युत वितरण कंपनी (डिस्कॉम)`, `DISCOM`, 6h SLA)
2. **Municipal Wards (4)**:
   - Mayur Vihar (`ward-04`, East Delhi)
   - Indirapuram (`ward-12`, Ghaziabad Zone 2)
   - Connaught Place (`ward-21`, New Delhi Central)
   - Civil Lines (`ward-08`, North Delhi)
   - Each with realistic PostGIS `SRID=4326;MULTIPOLYGON(...)` boundaries.
3. **Demo Accounts (6)**:
   - Admin: `admin@jansetu.gov.in` (`admin` role)
   - Department Head: `head.electrical@jansetu.gov.in` (`dept_head` role, Electrical Division)
   - Ward Officers (2): `officer.ward04@jansetu.gov.in` (Ward 04), `officer.ward12@jansetu.gov.in` (Ward 12)
   - Citizens (2): `pooja.sharma@example.com` (Ward 12), `rahul.mehra@example.com` (Ward 04)
   - Passwords hashed via PBKDF2-SHA512 (10,000 iterations) and stored in Better Auth `accounts` table.
4. **Sample IoT Hardware & Telemetry**:
   - `UNO_Q_01` (Indirapuram, `FAULT` status) with SHA-256 HMAC hardware secret and optical LDR fault telemetry.
   - `UNO_Q_02` (Mayur Vihar, `NORMAL` status) with heartbeat telemetry.
5. **Sample Clustered Complaints & Audit Trail**:
   - Cluster: `cluster-indirapuram-elec` on Kala Patthar Road (`IN_PROGRESS`).
   - Complaints: `JS-20261123-0101` (Citizen complaint) and `JS-20261123-0102` (Automated IoT fault complaint), both with SLA deadlines and `complaint_events` audit logs.

### 11.7 Verification Results & Commands
- **Unit & Query Builder Tests**:
  - `@jansetu/shared`: 4 test files, 29 tests passing (`vitest run` in 417ms).
  - `@jansetu/db`: 2 test files, 6 tests passing, 1 test cleanly reported skipped (`vitest run` in 592ms).
    - `spatial.test.ts`: 4/4 passing (deterministic snapping, <50m boundary, micro-jitter grouping).
    - `integration.test.ts`: 2/2 query builder tests passing (PostGIS `ST_Contains` and `ST_DWithin` clause compilation and parameter bindings); live DB suite cleanly reports skipped when `DATABASE_URL` is unset with explicit guidance.
- **Turborepo Workspace Verification**:
  ```bash
  $ pnpm test
  Tasks: 2 successful, 2 total (35 passed, 1 skipped)
  Time: 1.118s

  $ pnpm typecheck
  Tasks: 5 successful, 5 total (0 errors)
  Time: 1.329s

  $ pnpm lint
  Tasks: 5 successful, 5 total (0 errors, 0 warnings)
  Time: 884ms
  ```

### 11.8 Next Phase Entry Gate (Backend API Core)
- [x] `@jansetu/shared` contracts, Zod schemas, SLA policies, and i18n verified.
- [x] `@jansetu/db` Drizzle schema, PostGIS types, and migration SQL verified.
- [x] Idempotent database seed script (`packages/db/src/seed.ts`) populating departments, wards, accounts, IoT devices, and complaints.
- [x] Query builder and integration tests verified (with clean skip handling when `DATABASE_URL` is omitted).
- [x] Turborepo `pnpm test`, `pnpm typecheck`, and `pnpm lint` passing across all 5 workspace packages.
- [x] Completed: Initialize `apps/api` core using Hono + TypeScript configured for Cloudflare Workers, foundational middlewares, and cached metadata routes.

---

## 12. Phase 2 Implementation Summary (Hono Core Backend Engine — `apps/api`)

### 12.1 Overview & Architecture Decisions
- **Status:** Complete (November 23, 2026)
- **Target Package:** [`apps/api`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api) (`@jansetu/api`)
- **Framework & Runtime:** Hono v4 + TypeScript targeting Cloudflare Workers runtime via `wrangler` (`nodejs_compat`).
- **Configuration Artifacts:**
  - [`apps/api/wrangler.toml`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/wrangler.toml): Configured with `compatibility_date = "2024-11-01"`, `compatibility_flags = ["nodejs_compat"]`, and environment variables `NODE_ENV`, `LOG_LEVEL`, and `CORS_ORIGIN`.
  - [`apps/api/tsconfig.json`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/tsconfig.json): Configured with `@cloudflare/workers-types` and Node types under `tsconfig.base.json`.

### 12.2 Foundational Middleware Inventory
1. **Strict Zod Environment Validation ([`src/config/env.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/config/env.ts))**:
   - `EnvSchema` validates `NODE_ENV`, `PORT`, `LOG_LEVEL`, `CORS_ORIGIN`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`.
   - Executes validation on boot (`getBootEnv()`) and attaches validated configuration to Hono context via `envMiddleware`.
2. **Structured JSON Logger & Request ID Correlation ([`src/middleware/logger.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/logger.ts))**:
   - Reuses incoming `X-Request-ID` or generates cryptographically secure `crypto.randomUUID()`.
   - Propagates `X-Request-ID` on response headers and context.
   - Emits structured JSON logs containing timestamp, level, method, path, status, latency (`durationMs`), client IP, and User-Agent.
   - Automatically redacts sensitive authentication headers (`authorization`, `cookie`, `x-api-key`) and PII patterns (emails, Indian 10-digit phone numbers, and keys like `password`, `token`, `secret`, `aadhar`, `credit_card`).
3. **Global RFC 7807/9457 Error Handling ([`src/middleware/error-handler.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/error-handler.ts))**:
   - Implements `HttpError` subclass for declarative status, titles, and detail messages.
   - Converts Zod validation failures into 400 Bad Request problem documents with granular field errors.
   - Global 404 not-found handler returns RFC Problem Details with path instance and request ID.
   - Strict production privacy: Stack traces and internal error messages are completely stripped when `NODE_ENV === 'production'`.
4. **Strict CORS Allowlist & Security Headers ([`src/middleware/cors.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/cors.ts))**:
   - Parses allowed origin lists from `CORS_ORIGIN` (e.g. `http://localhost:5173,http://localhost:3000`).
   - Reflects headers only for allowed origins with credentials and `Vary: Origin`. Rejects unauthorized `OPTIONS` preflight with 403 Forbidden.
   - Attaches strict security headers to all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Content-Security-Policy: default-src 'none'; frame-ancestors 'none';`.
5. **Upstash Redis Sliding-Window Rate Limiter ([`src/middleware/rate-limiter.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/rate-limiter.ts))**:
   - Leverages `@upstash/ratelimit` when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are provided.
   - Features thread-safe, self-cleaning `InMemorySlidingWindowRateLimiter` fallback for local dev and automated tests.
   - Decorates responses with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
   - Rejects throttled requests with 429 Too Many Requests, `Retry-After` header, and RFC Problem Details.

### 12.3 Route Handlers & Redis Caching
1. **Health Check Route ([`src/routes/health.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/health.ts))**:
   - `GET /health`: Returns `{ status: 'healthy', timestamp, version: '1.0.0', uptime }` with `Cache-Control: no-store`.
2. **Civic Metadata Route ([`src/routes/meta.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/meta.ts))**:
   - `GET /api/v1/meta`: Returns 16 bilingual civic departments with code and SLA defaults, 16 complaint categories, and urgency SLA policies.
   - Cached via `CacheService` abstraction ([`src/services/cache.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/services/cache.ts)) in Redis (or in-memory fallback) with 1-hour TTL (`CACHE_TTL_SECONDS = 3600`).
   - Returns cache indicator header: `X-Cache: HIT` or `X-Cache: MISS`.

### 12.4 Authentication, RBAC, and Response Serializers
1. **Better Auth Integration ([`src/auth/index.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/auth/index.ts))**:
   - Integrates `better-auth` backed by `@jansetu/db` Drizzle schema (`users`, `sessions`, `accounts`, `verifications`).
   - Supports email/password, session cookies for Vite Web, and bearer token header (`bearer()` plugin) plus `@better-auth/expo` plugin for Expo Mobile.
   - User schema augmented with `role` (`citizen`, `ward_officer`, `dept_head`, `admin`), `wardId`, `departmentId`, and `phone`.
   - Exposes `/api/auth/**` route ([`src/routes/auth.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/routes/auth.ts)) handling auth endpoints natively in Hono.
2. **Reusable RBAC & Scope Middleware ([`src/middleware/auth.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/middleware/auth.ts))**:
   - `requireAuth`: Enforces valid session; rejects unauthenticated requests with 401 Problem Details.
   - `requireRole(...roles)`: Enforces role permissions; rejects unauthorized role escalation with 403 Forbidden.
   - `requireWardOrDeptScope(resolver?)`: Strictly enforces municipal boundaries. Ward officers can only mutate clusters within their assigned `wardId` (and assigned `departmentId`); rejects cross-ward mutations with 403 Forbidden. Department heads are scoped to their `departmentId`. Citizens are forbidden from mutating municipal scopes; admins retain unrestricted access.
3. **Strict Response Serializers ([`src/serializers/`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/serializers))**:
   - `PublicComplaintDto`: Exposes privacy-jittered `publicLocation` (`lat`, `lng`), tracking code, category, urgency, status, and SLA timestamps. Strictly strips `exactLocation`, reporter name, phone, email, citizen ID, raw text, and assigned officer ID.
   - `OfficerComplaintDto`: Exposes internal `exactLocation` and reporter contact info exclusively to authorized municipal officers and complaint owners.
   - `serializeComplaint(entity, user)`: Dynamic serializer dispatching Public vs Officer DTO based on caller identity (admin, assigned ward officer, dept head, or complaint author).
   - `serializeCluster(entity, user)`: Strips internal officer notes and assignments from public cluster responses.

### 12.5 Verification Results
- **`apps/api` Vitest Test Suite**:
  ```text
  $ vitest run
   ✓ src/__tests__/health.test.ts (3 tests)
   ✓ src/__tests__/logger-env.test.ts (5 tests)
   ✓ src/__tests__/error-handler.test.ts (4 tests)
   ✓ src/__tests__/meta.test.ts (2 tests)
   ✓ src/__tests__/cors.test.ts (6 tests)
   ✓ src/__tests__/rate-limiter.test.ts (3 tests)
   ✓ src/__tests__/auth-rbac.test.ts (13 tests)
   ✓ src/__tests__/serializers.test.ts (12 tests)

   Test Files  8 passed (8)
        Tests  48 passed (48)
     Duration  1.76s
  ```
- **Cloudflare Wrangler Dry-Run**:
  ```text
  $ pnpm --filter @jansetu/api exec wrangler deploy --dry-run
  Total Upload: 1244.50 KiB / gzip: 198.97 KiB
  Your Worker has access to bindings: env.NODE_ENV, env.LOG_LEVEL, env.CORS_ORIGIN
  --dry-run: exiting now. (Code 0)
  ```
- **Monorepo Global Verification**:
  ```text
  $ pnpm typecheck && pnpm lint && pnpm test
  Tasks: 5 successful across typecheck (0 errors)
  Tasks: 5 successful across lint (0 warnings, 0 errors)
  Tasks: 3 successful across test (83 passed, 1 skipped)
  ```
