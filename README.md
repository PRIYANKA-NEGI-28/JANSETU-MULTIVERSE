# 🚀 JanSetu — Civic Issues. Resolved. Faster.

> JanSetu connects citizens, complaints, locations and departments using AI and graph intelligence — report a civic issue by voice in Hindi or English, and let the graph handle the rest.

---

## 📌 Problem & Domain

Civic issues like broken streetlights, potholes, waterlogging, and damaged infrastructure are hard to report and even harder to track. Complaints get filed into disconnected government silos with no visibility into who's responsible, no way to see clusters of related hazards in an area, and no accountability when a department sits on a complaint for months. Language is also a barrier — most portals only work in English.

JanSetu fixes this with a graph-powered system that links citizens, complaints, locations, and departments, so issues get routed correctly, duplicate/nearby reports get merged, and departments are scored on how well they actually resolve things.

**Themes Selected:**

- [ ] Human Experience & Productivity
- [ ] Climate & Sustainability Systems
- [ ] HealthTech & Bio Platforms
- [ ] Learning & Knowledge Systems
- [ ] Work, Finance & Digital Economy
- [ ] Infrastructure, Mobility & Smart Systems
- [ ] Trust, Identity & Security
- [ ] Media, Social & Interactive Platforms
- [x] Public Systems, Governance and Civic Tech
- [ ] Developer Tools & Software Infrastructure

## 🎯 Objective

JanSetu serves two groups:

- **Citizens** who want to report a civic issue quickly — by speaking naturally in Hindi or English — and actually see it get resolved instead of disappearing into a form nobody reads.
- **Government administrators / department officers** who need a single dashboard to triage complaints, assign officers, and see which departments are underperforming.

**Pain points solved:**
- Filing a complaint in English-only forms is a barrier for many citizens → voice input in Hindi/English (Sarvam AI)
- No way to see if an issue is part of a bigger cluster (e.g. many potholes in one zone) → live Hazard Map with auto-clustering
- No accountability once a complaint is filed → graph-computed department trust/resolution scores
- Escalating an ignored complaint is bureaucratic and confusing → automated RTI Drafter that generates a formal RTI application

---

## 🧠 Team & Approach

### Team Name:
`Unknows`

### Team Members:
- Ritu Raj Sinha (GitHub: [@Riturajsinha04](https://github.com/Riturajsinha04) / LinkedIn: `(https://www.linkedin.com/in/ritu-raj-sinha-191059368/?skipRedirect=true)` / Role: `[Team Lead]`)
- `[Rishav Raj — GitHub / LinkedIn / Role]`
- `[Divyansh Gupta — GitHub / LinkedIn / Role]`
- `[Rewas Khatri — GitHub / LinkedIn / Role]`

### Your Approach:
- Key challenges addressed: routing complaints to the correct department automatically, clustering related hazard reports by location, computing a fair accountability score per department from the complaint graph, and making the RTI process (usually a manual legal step) generate itself from an unresolved complaint.

 ## 🛠️ Tech Stack

### Core Technologies Used:
- **Frontend:** React (Vite) web app + Expo (React Native / Expo Router) mobile app, styled with Tailwind / NativeWind
- **Backend:** Supabase Edge Functions (Deno) — a `neo4j-proxy` function that securely proxies Cypher queries to Neo4j AuraDB
- **Database:** Two databases — Supabase Postgres (auth, departments, officers, complaints, RLS-secured) + Neo4j AuraDB (graph relationships for complaint clustering & department trust scores)
- **APIs:** Browser-native Web Speech API for Hindi/English voice-to-text input
- **Hosting:** Base44 `[confirm / add actual deployment host if different]`

### Additional Technologies Used (Optional):
- [ ] AI / ML — *(not currently — complaint categorization and RTI generation are rule-based/templated, not model-driven; uncheck unless you add a real AI call before submitting)*
- [ ] Web3 / Blockchain
- [ ] Cyber Security
- [x] Cloud — Supabase (Postgres + Auth + Edge Functions) and Neo4j AuraDB

---

## 🏆 Sponsored Track

- [ ] **Expo Track** – `[check if your mobile app was built with Expo]`
- [x] **Neo4j Track** – Neo4j AuraDB is the primary database. Citizens, complaints, locations, and departments are modeled as a graph, which powers: automatic complaint routing to the correct department, 300m-radius clustering of related hazard reports, and graph-computed accountability/trust scores per department.
- [ ] **Base44 Track** – `[confirm what part of the product was built/deployed on Base44]`

> Neo4j's graph model is central to JanSetu, not just a data store: relationships between entities (citizen → complaint → location → department) are what let us auto-cluster nearby hazards, auto-route complaints, and compute a department's trust score from its real resolution history rather than a static rating.

---

## ✨ Key Features

- ✅ **Voice-first complaint filing** — describe an issue by speaking in Hindi or English (Sarvam AI voice input), auto-transcribed into the complaint form
- ✅ **AI complaint analysis & auto-routing** — the system analyzes the complaint text and location and routes it to the correct government department automatically
- ✅ **Live Hazard Map** — reports within a 300m radius auto-cluster by severity (Critical/High/Medium/Low), so citizens and officials can see hotspots at a glance
- ✅ **Automated RTI Drafter** — generates a formal RTI (Right to Information) application against a specific authority when a complaint stalls, guided by a simple step-by-step form
- ✅ **Admin Dashboard with graph-computed trust scores** — department performance, resolution rates, and escalations are tracked and scored directly from the complaint graph, plus officer assignment and management tools
- ✅ **Bilingual throughout** — Hindi/English toggle across the whole app, not just the voice input

---

## 📽️ Demo & Deliverables

- **Demo Video Link (Mandatory):** `[https://youtu.be/BZOYOU46RYU]`
- **Deployment Link (Recommended):** `[https://jansetu-graph-ai.onrender.com]`
- **Pitch Deck / PPT (Optional):** `[Paste link if you have one]`

---

## ✅ Tasks & Bonus Checklist

- [ ] All team members completed the mandatory social task
- [X] Bonus Task 1 – Badge sharing
- [ ] Bonus Task 2 – Blog/article

*(Refer to Participant Manual for details)*

---

## 🧪 How to Run the Project

### Requirements:
- Node.js `[version]`
- A Neo4j AuraDB instance (or local Neo4j) — connection URI + credentials
- Sarvam AI API key (for voice transcription)
- `[Any other env vars/API keys — e.g. maps API key]`

### Local Setup:

---bash

# Clone the repo
git clone <your-repo-url>
cd <repo-folder>

# Install dependencies
npm install

# Run the dev server
npm run dev

---

## 🧬 Future Scope

- 📈 More integrations — direct integration with municipal complaint-management systems and government APIs
- 🛡️ Security enhancements — stronger verification for citizen and officer accounts, audit trails on escalations
- 🌐 Localization / broader accessibility — support for more regional Indian languages beyond Hindi/English, offline-first mobile support for low-connectivity areas

---

## 📎 Resources / Credits

- Neo4j AuraDB — graph database powering routing, clustering, and trust scores
- Sarvam AI — Hindi/English voice transcription
- Base44 — `[deployment/hosting — confirm exact usage]`
- Expo — `[if used for a mobile app]`
- `[Any icon sets, map tile providers, or other open-source libraries used]`

---

## 🏁 Final Words

`[Building JanSetu meant wiring together two very different databases — Supabase Postgres for
auth and structured data, and Neo4j AuraDB for the graph relationships that actually make the
product interesting (complaint clustering, department trust scores). Getting those two to talk
to each other securely, through a Supabase Edge Function acting as a Neo4j proxy, was one of
the trickier architecture decisions we made — and we went back later to tighten the RLS
policies and lock down a function that was more permissive than it should've been.

Supporting Hindi and English throughout — not just as a translated UI, but as something a
citizen could actually speak a complaint in — mattered to us because most civic complaint
tools assume English and a smartphone-literate user. A lot of the real people this is meant
to help are neither.]`
