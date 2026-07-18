# Web App Auto-Geolocation Complaint Filing Plan

## Problem Statement
The web app's complaint filing page (`src/pages/SubmitComplaint.tsx`) currently requires users to manually select their location via a 3-step dropdown (City → Area → Ward). This is friction-heavy and error-prone. The user wants to:
1. Remove the manual location selection UI from the complaint page
2. Request browser geolocation permission when the app starts (after login)
3. Block complaint submission with a modal if location permission is denied
4. Automatically attach the device's GPS coordinates (lat/lng) to every complaint filed

## Goals
- Replace manual location input with automatic browser geolocation
- Enforce location permission as a hard requirement for filing complaints
- Maintain all existing complaint data flow (AI analysis, letter generation, etc.)
- Keep changes scoped to the web app only (no mobile/expo changes)

## Technical Approach

### 1. Location Context Provider
Create a new React context (`LocationContext`) that:
- Requests `navigator.geolocation` permission on app mount (after login)
- Stores `{ lat, lng, permission: 'granted' | 'denied' | 'prompt' | 'unavailable' | 'loading' }`
- Provides a `requestLocation()` helper to re-prompt if initially denied
- Handles browser-specific geolocation errors (permission denied, position unavailable, timeout)
- **Loading state**: `permission` starts as `'loading'` while the first `getCurrentPosition` call is in flight. The blocking modal must NOT render during `'loading'` — only show when status is definitively `'denied'` or `'unavailable'`.

### 2. App-Level Integration
Wrap the authenticated app in `LocationProvider` inside `src/App.tsx`. The provider triggers the geolocation request once when the user logs in / the app loads with an active session. Do NOT wrap the login gate — location is only needed after authentication.

### 3. SubmitComplaint Page Changes
- **Remove** the entire "Step 3: Location Details" section (city selector, area dropdown, ward read-only field)
- **Remove** `area`, `ward`, `city` from component state and form validation
- **Remove** imports of `LOCATIONS`, `CITY_OPTIONS`, `ChevronDown` from `src/lib/locations`
- **Keep** `MapPin` import if used elsewhere in the component (check before removing)
- **Remove** `filteredLocations` derived state
- **Add** a blocking modal that renders when `permission === 'denied' || permission === 'unavailable'`:
  - Overlay covering the complaint form
  - Title: `T.location_required_title`
  - Message: `T.location_required_msg`
  - Button: `T.location_grant_btn` → calls `requestLocation()`
  - Button: `T.location_go_back` → navigates to home
  - If `permission === 'unavailable'`, show additional text: "Your browser does not support geolocation."
- **Update** `handleSubmit` to append `lat` and `lng` to the FormData from the LocationContext
- **Update** validation: remove `!form.area || !form.ward` checks; keep name and text validation
- **Update** letter generation: remove the `Location: ${form.area}, ${form.ward}, ${form.city}` line entirely from both English and Hindi letters. Do not replace with "Current Location" — formal complaint letters should not contain vague location references.

### 4. Backend Adjustment
In `jansetu-backend/routers/complaintRouter.js`:
- Ensure `lat` and `lng` from `req.body` are parsed as valid floats before passing to `createComplaintNode`
- Current code: `const lat = req.body.lat !== undefined ? req.body.lat : 28.6139;`
- **Fix**: Use explicit float parsing with NaN guard:
  ```js
  const parsedLat = parseFloat(req.body.lat);
  const lat = !isNaN(parsedLat) ? parsedLat : 28.6139;
  const parsedLng = parseFloat(req.body.lng);
  const lng = !isNaN(parsedLng) ? parsedLng : 77.2090;
  ```

### 5. i18n Translations
Add new translation keys to `src/lib/i18n.ts` for both `en` and `hi`:
- `location_required_title`: "Location Access Required" / "स्थान पहुंच आवश्यक"
- `location_required_msg`: "Filing a complaint requires access to your location. Please enable location access in your browser and try again." / "शिकायत दर्ज करने के लिए आपके स्थान की पहुंच आवश्यक है। कृपया अपने ब्राउज़र में स्थान पहुंच सक्षम करें और पुनः प्रयास करें।"
- `location_grant_btn`: "Grant Location Access" / "स्थान पहुंच सक्षम करें"
- `location_go_back`: "Go Back" / "वापस जाएं"
- `location_unsupported`: "Your browser does not support geolocation." / "आपका ब्राउज़र जियोलोकेशन का समर्थन नहीं करता।"

**Remove** the now-unused location-related keys from BOTH `en` and `hi` sections:
- `submit_step3`
- `submit_city`
- `submit_area`
- `submit_ward`
- `submit_select_area`
- `submit_ward_auto`
- `submit_ward_hint`

## File-Level Changes

### Create
- `src/contexts/LocationContext.tsx` — New context provider for geolocation state

### Modify
- `src/App.tsx` — Add LocationProvider wrapper around authenticated app only
- `src/pages/SubmitComplaint.tsx` — Remove location UI, add blocking modal, send lat/lng, update letters
- `src/lib/i18n.ts` — Add location modal keys, remove unused location keys (en + hi)
- `jansetu-backend/routers/complaintRouter.js` — Parse lat/lng as floats with NaN guard

### Do NOT Touch
- Mobile app files (`app/`, `lib/neo4j.ts`, `lib/i18n.ts`, etc.)
- `src/lib/neo4j.ts` (web neo4j proxy — complaint submission bypasses this)
- Database schemas (already support lat/lng)
- AI analysis logic (`src/lib/aiAnalyzer.ts`)
- Any other pages (Track, Admin, HazardMap, RTI, Home, Login)
- `src/components/Navbar.tsx` (uses MapPin icon independently)

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| User denies geolocation initially | Blocking modal appears on SubmitComplaint; "Grant Location Access" button re-prompts |
| User clicks "Block" on browser prompt | Same as above; browser may not allow re-prompt — modal explains manual browser settings |
| Geolocation API unavailable (old browser) | `permission` set to `'unavailable'`; modal shows unsupported browser message |
| Geolocation timeout | Retry once with `enableHighAccuracy: false`; if still failing, treat as denied |
| User grants permission but GPS signal is weak | Accept whatever coordinates the browser returns (may be IP-based approx) |
| User navigates away before granting | Location state persists in context; modal shows on next visit to SubmitComplaint |
| Modal flashes during initial load | `permission` starts as `'loading'`; modal only renders for `'denied'` or `'unavailable'` |
| Backend receives empty string for lat/lng | NaN guard falls back to Delhi coordinates (28.6139, 77.2090) |

## Testing Approach
1. Load app → login → verify browser geolocation prompt appears
2. Deny permission → navigate to File Complaint → verify blocking modal appears (not during loading)
3. Click "Grant Location Access" → allow → verify modal disappears and form is accessible
4. Fill form, analyze, submit → verify Network tab shows `lat` and `lng` in FormData
5. Verify backend response contains the correct coordinates
6. Switch language to Hindi → verify modal text is in Hindi
7. Test letter generation no longer references area/ward/city
8. Test with geolocation disabled in browser settings → verify modal shows immediately with unsupported/denied message

## Risks & Tradeoffs
- **Browser re-prompt limitation**: Some browsers (Chrome) only allow one geolocation prompt per page load. If denied, the "Grant Location Access" button may not trigger a new prompt. Mitigation: modal includes instructions to manually enable location in browser settings.
- **Privacy concern**: Users may be uncomfortable sharing precise location. Mitigation: this is explicitly requested by the product owner as a hard requirement.
- **Existing backend data loss**: The backend `complaintRouter.js` currently ignores most fields sent by the frontend (citizenName, rawText, area, ward, etc.) and only saves id, issueType, lat, lng, imageUrl, urgency, status to Neo4j. This is pre-existing behavior and out of scope for this change.
- **Letter generation specificity**: Removing area/ward/city from letters makes them less specific. This is acceptable per product requirements — the complaint number and department routing are the primary resolution mechanisms.
- **HTTPS requirement**: `navigator.geolocation` requires HTTPS in production (except localhost). This is a deployment concern, not a code issue.

## Dependencies
No new dependencies required. Uses browser-native `navigator.geolocation` API.
