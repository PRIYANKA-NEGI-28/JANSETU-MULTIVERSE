# JanSetu Multiverse

A graph-powered multilingual civic intelligence platform that connects citizens, complaints, locations, and government departments to streamline infrastructure resolution.

---

## About

JanSetu Multiverse is a platform that simplifies civic issue reporting and tracking. It resolves routing inefficiency, lack of public accountability, and duplicate reports. The project serves citizens who want to report issues via voice or text in multiple regional Indian languages (including Hindi, English, and others), and administrators who monitor and assign complaints.

---

## Features

* Multilingual support with regional language interface toggles.
* Voice-to-text complaint submission in multiple regional Indian languages with auto-transcription.
* Rule-based automatic complaint analysis, urgency detection, and department routing.
* Interactive live maps featuring proximity-based complaint and sensor hazard clustering.
* Automated Right to Information (RTI) application generator with step-by-step query builder.
* Admin dashboard featuring regional heat maps, service level agreement (SLA) checking, and officer assignment.
* Active IoT sensor fault tracking, telemetry logging, and automated routing.

---

## Tech Stack

Frontend

* React
* Vite
* Tailwind CSS
* TypeScript
* Leaflet (Maps)
* Expo (React Native for Mobile)
* NativeWind

Backend

* Node.js
* Express
* Python (NPU LLM Bridge)

Database

* SQLite (Transactional storage)
* Neo4j (Graph relationships)

---

## Installation

### Prerequisites

* Node.js (version 18 or higher)
* Neo4j Database instance (local or AuraDB)
* Python 3
* `onnxruntime-genai` python package

### 1. Clone the repository

```bash
git clone https://github.com/PRIYANKA-NEGI-28/JANSETU-MULTIVERSE.git
cd JANSETU-MULTIVERSE
```

### 2. Set up the Backend

```bash
cd jansetu-backend
npm install
pip install onnxruntime-genai
```

The Snapdragon X Elite NPU LLM bridge expects the ONNX model directory to be located at `jansetu-backend/ai/models/llama-3.2-3b-onnx-npu`.

Configure your environment variables in a `.env` file inside the `jansetu-backend` directory (see [Environment Variables](#environment-variables)).

Start the backend server:

```bash
npm run dev
```

### 3. Set up the Web Frontend

Open a new terminal window at the project root directory and run:

```bash
npm install
npm run dev
```

The web application will run at `http://localhost:5173`.

### 4. Set up the Mobile Application (Optional)

Open a new terminal window at the project root directory. Rename the Expo configuration files, install dependencies, and start the Expo server:

```bash
cp package.json package-web.json
cp package-expo.json package.json
npm install
npm start
```

---

## Environment Variables

Create a `.env` file in the `jansetu-backend` directory with the following variables:

```env
PORT=3000
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_secure_password
```

For the web frontend, you can optionally configure:

```env
VITE_BACKEND_URL=https://jansetu-multiverse.onrender.com
```

---

## Project Structure

* `src/` - Web frontend application source code, components, and pages.
* `app/` - Expo mobile application layouts, screens, and routes.
* `jansetu-backend/` - Node.js Express server, routers, database adapters, and AI scripts.
* `lib/` - Shared business logic, neo4j adapters, and translation utilities.

---

## Future Improvements

* Integrate production NPU hardware acceleration for local LLM execution.
* Enable offline-first local database synchronization for low-connectivity regions.
* Expand multilingual voice-to-text support to cover all 22 scheduled Indian languages.

---

## Contributors

* Ritu Raj Sinha - 
* Rishav Raj -
* Divyansh Gupta - 
* Priyanka Negi - [priyankaviveknegi@gmail.com]
