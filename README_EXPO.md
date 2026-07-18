# JanSetu — Expo Mobile App Setup Guide

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli` (or use `npx expo`)
- Expo Go installed on your phone (iOS / Android)

---

## Step 1 — Use the Expo package.json

This project has **two** separate package.json files:
- `package.json` → for the **web** (Vite/React) version
- `package-expo.json` → for the **mobile** (Expo) version

You must **rename / copy** before installing:

```bash
# Back up original
cp package.json package-web.json

# Use the Expo package file
cp package-expo.json package.json

# Install dependencies
npm install
```

---

## Step 2 — Environment Variables

The `.env.expo` file already has the correct credentials pre-filled.

Expo reads files named `.env` by default. **Copy the Expo env file:**

```bash
cp .env.expo .env
```

> **Important:** The variables use the `EXPO_PUBLIC_` prefix so they are
> exposed to client code on mobile (equivalent to `VITE_` for web builds).

---

## Step 3 — Start the Development Server

```bash
npx expo start
```

Then scan the QR code with the **Expo Go** app on your phone.

---

## Common Errors & Fixes

### "Something went wrong" on launch
Usually caused by one of:
1. Environment variables not copied (Step 2 above)
2. Wrong `package.json` — make sure you're using the Expo one (Step 1)
3. Dependencies not installed — run `npm install`

### Metro bundler errors about missing modules
Run:
```bash
npx expo install --fix
```

### NativeWind / Tailwind classes not applying
The `global.css` is imported in `app/_layout.tsx`. Make sure `metro.config.js`
is present (it is) and run `npx expo start --clear` to clear the cache.

### iOS build requires microphone/camera permissions
These are already declared in `app.json` → `expo.ios.infoPlist` and
`expo.android.permissions`.

---

## Project Structure (Expo)

```
app/
  _layout.tsx          ← Root layout (GestureHandler + LangProvider)
  (tabs)/
    _layout.tsx        ← Bottom tab navigator
    index.tsx          ← Home screen
    submit.tsx         ← File a complaint
    track.tsx          ← Track a complaint
    hazardmap.tsx      ← Hazard map & reports
    rti.tsx            ← RTI application drafter
    admin.tsx          ← Admin dashboard
  login.tsx            ← Citizen auth (modal)
  admin-login.tsx      ← Admin auth (modal)
lib/
  supabase.ts          ← Supabase client (uses AsyncStorage)
  neo4j.ts             ← Neo4j proxy calls
  aiAnalyzer.ts        ← AI complaint analysis
  langContext.tsx      ← Language toggle (EN / HI)
  i18n.ts              ← Translations
  locations.ts         ← Ward / area data
```

---

## Packages Added (vs original package-expo.json)

| Package | Reason |
|---|---|
| `@react-native-async-storage/async-storage` | Required by Supabase auth + lang storage |
| `expo-clipboard` | Used in RTI drafter to copy generated text |
