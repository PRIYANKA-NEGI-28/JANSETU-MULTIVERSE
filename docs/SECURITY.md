# JanSetu Multiverse — Security Architecture & Threat Model

**Document Version:** 1.0.0  
**Effective Date:** November 24, 2026  
**Classification:** Public Engineering & Civic Trust Standard  
**Maintainer:** JanSetu Core Security Architecture Group (`security@jansetu.gov.in`)

---

## 1. Executive Summary & Security Philosophy

JanSetu Multiverse is a mission-critical civic intelligence infrastructure connecting millions of citizens to municipal authorities (MCD, GDA, PWD, DISCOM). Because citizen grievances contain sensitive real-world telemetry—including domestic home addresses, precise GPS coordinates, contact details, and voice recordings—the platform enforces **Privacy by Design**, **Zero Trust**, and **Defense in Depth**.

### Core Tenets
1. **Zero Secret Footprint in Clients:** Neither web nor mobile bundles contain API keys, administrative passwords, or unauthenticated backend proxies.
2. **Citizen Location Privacy:** Exact GPS coordinates and citizen contact PII are never returned over public endpoints. Public maps receive spatially obfuscated grid-snapped centroids.
3. **Mandatory Metadata Scrubbing:** All photos uploaded by citizens have camera and GPS EXIF metadata stripped on the client device before network transmission.
4. **Cryptographic Edge Verification:** IoT hardware communicates via HMAC-SHA256 signatures with nonce/timestamp replay protection.
5. **Strict Schema & Type Enforcement:** Every mutation endpoint validates payloads using Zod schemas with RFC 7807 structured problem responses.

---

## 2. STRIDE Threat Model Matrix

| Threat Category | Potential Attack Vector | JanSetu Countermeasure & Implementation | Verification Method |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates a municipal officer or admin to alter grievance records. | Better Auth session verification; multi-factor RBAC (`requireRole`); session cookies with `HttpOnly` and `SameSite=Strict`. | `apps/api/src/__tests__/auth-rbac.test.ts` |
| **Spoofing (IoT)** | Attacker injects fraudulent sensor faults to manipulate public infrastructure alarms. | Strict HMAC-SHA256 signature verification (`X-Device-Signature`) using device pre-shared keys. | `apps/api/src/__tests__/iot-routes.test.ts` |
| **Tampering** | Rogue user modifies complaint status or escalates priority maliciously. | Role-based transitions (`requireWardOrDeptScope`), server-calculated SLA deadlines, and immutable audit logs. | `apps/api/src/__tests__/clusters-admin-geo.test.ts` |
| **Repudiation** | Officer denies resolving or dismissing a citizen grievance cluster. | Immutable state transitions recorded with `actorId`, `actorRole`, `fromStatus`, `toStatus`, and timestamps. | `apps/api/src/services/complaint-store.ts` |
| **Information Disclosure** | Scraping public APIs to harvest citizen home addresses, phone numbers, or emails. | Dedicated response serializers (`PublicComplaintDto`) strictly omitting exact coordinates and contact PII. | `apps/api/src/__tests__/serializers.test.ts` |
| **Denial of Service** | Flooding intake routes with large files, voice notes, or rapid automated spam. | Upstash Redis sliding-window rate limiting; presigned upload limits (5MB images, 10MB audio); magic-byte checks. | `apps/api/src/__tests__/rate-limiter.test.ts` |
| **Elevation of Privilege** | Citizen user attempts to call administrative triage or analytics endpoints. | RBAC middleware (`requireRole('admin', 'dept_head', 'ward_officer')`) blocking non-privileged tokens with 403 Forbidden. | `apps/api/src/__tests__/clusters-admin-geo.test.ts` |

---

## 3. Data Classification & Spatial Privacy

JanSetu categorizes all incoming and stored data into three distinct security tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA CLASSIFICATION TIERS                       │
├──────────────────┬─────────────────────────────┬───────────────────────┤
│ Tier 1: Public   │ Tier 2: Privileged (PII)    │ Tier 3: Admin / Audit │
├──────────────────┼─────────────────────────────┼───────────────────────┤
│ • Public Coords  │ • Exact GPS Coords          │ • Officer Notes       │
│ • Category/Title │ • Citizen Full Name         │ • SLA Breach Metrics  │
│ • Urgency Level  │ • Phone & Email             │ • Escalation Logs     │
│ • Cluster Counts │ • Voice Audio Recordings    │ • HMAC Secrets        │
└──────────────────┴─────────────────────────────┴───────────────────────┘
```

### 3.1 Spatial Obfuscation Algorithm
To prevent tracking individual citizens to their specific households, public APIs enforce grid-snapping via `obfuscatePublicCoords`:
- Public coordinates are truncated to 4 decimal places (~11-meter precision) and snapped to a ~50-meter municipal centroid.
- Exact sub-meter GPS coordinates are accessible **only** to assigned ward officers, department heads, administrators, or the original citizen applicant.

### 3.2 Response Serialization Pipeline
All API responses pass through pure serializers (`apps/api/src/serializers/complaint.ts`):
```typescript
export function serializeComplaint(entity: ComplaintEntity, user?: AuthUser | null): PublicComplaintDto | OfficerComplaintDto {
  if (canAccessPrivilegedComplaint(entity, user)) {
    return serializeOfficerComplaint(entity);
  }
  return serializePublicComplaint(entity);
}
```
Unauthenticated or citizen users viewing complaints outside their own ownership receive `PublicComplaintDto`, where `exactLocation`, `citizenPhone`, `citizenEmail`, `citizenName`, and `rawText` are fundamentally absent.

---

## 4. Media Sanitization & Binary Verification

Photos taken by smartphone cameras inherently embed sensitive Exchangeable Image File Format (EXIF) metadata, including GPS coordinates (`GPSLatitude`, `GPSLongitude`), device serial numbers, and timestamps.

### 4.1 Client-Side EXIF Stripping
- **Web Portal:** [`apps/web/src/lib/imageCompression.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/web/src/lib/imageCompression.ts) executes client-side WebP compression with `preserveExif: false`. It includes an automatic fallback to HTML5 Canvas re-rasterization (`ctx.drawImage`), ensuring zero EXIF tags exit the citizen's browser.
- **Mobile App:** [`apps/mobile/src/lib/imageCompressor.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/mobile/src/lib/imageCompressor.ts) uses `ImageManipulator.manipulateAsync` to re-encode camera captures onto a native clean JPEG bitmap surface.

### 4.2 Server-Side Magic Byte Verification
To defeat spoofed MIME headers and malicious polyglot file uploads, [`apps/api/src/services/storage.ts`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/apps/api/src/services/storage.ts) inspects raw binary magic headers on all uploads:
- **JPEG:** `FF D8 FF`
- **PNG:** `89 50 4E 47` (`\x89PNG`)
- **WebP:** `52 49 46 46` ('RIFF') with `57 45 42 50` ('WEBP')
- **WebM (Audio):** `1A 45 DF A3` (EBML header)
- **WAV (Audio):** `52 49 46 46` ('RIFF') with `57 41 56 45` ('WAVE')
- **MP4 / M4A (Audio):** `66 74 79 70` ('ftyp') at byte offset 4

Files failing binary header checks or exceeding hard limits (5MB for images, 10MB for audio) are rejected with `400 Bad Request`.

---

## 5. IoT Edge Gateway Cryptographic Security

Edge streetlight nodes communicate with `/api/v1/iot/*` via cryptographically signed packets:

```
[Edge Device]                                            [Cloud API Gateway]
     │                                                            │
     ├─ Compute HMAC-SHA256(secret, deviceId + timestamp + body) ─┤
     │                                                            │
     ├─ POST /api/v1/iot/events ─────────────────────────────────>│
     │  Headers: X-Device-Id, X-Device-Timestamp,                 ├─ Verify Timestamp Drift (<=300s)
     │           X-Device-Signature                               ├─ Check In-Memory Rate Limit (60/min)
     │                                                            ├─ Constant-Time Signature Match
     │                                                            ├─ Idempotency Check (seq/key)
     │<─ 200 OK (Fault Processed / Cluster Updated) ──────────────┤
```

- **Replay Protection:** Rejects any request with timestamp drift greater than 300 seconds (`MAX_TIMESTAMP_DRIFT_MS = 300_000`).
- **Timing Attack Mitigation:** Signature comparisons execute using constant-time string matching (`crypto.timingSafeEqual`).
- **Hardware Isolation:** Zero cloud secrets or private certificates are stored in firmware source; keys are provisioned per device ID in `IOT_DEVICE_SECRETS`.

---

## 6. Sentry Error Tracking & PII Scrubbing

Error telemetry across `apps/api`, `apps/web`, and `apps/mobile` integrates Sentry with rigorous automated redaction:

1. **Graceful Disablement:** If `SENTRY_DSN`, `VITE_SENTRY_DSN`, or `EXPO_PUBLIC_SENTRY_DSN` is empty or unset, all clients operate in zero-overhead no-op mode without throwing exceptions or initiating network calls.
2. **Pre-Send Scrubbing Pipeline:**
   - **Citizen Email:** Matches standard email format and masks to `[REDACTED_EMAIL]`.
   - **Phone Numbers:** Matches 10-digit Indian numbers (with optional `+91`) and masks to `[REDACTED_PHONE]`.
   - **Identity Numbers:** Masks 12-digit Aadhaar patterns (`[REDACTED_AADHAAR]`) and 10-character PAN patterns (`[REDACTED_PAN]`).
   - **Network Privacy:** Strips client IP addresses (`event.user.ip_address = null`).
   - **Credential Protection:** Strips `Authorization`, `Cookie`, `Set-Cookie`, and `apiKey` headers entirely.

---

## 7. Disaster Recovery & Backup Strategy

JanSetu maintains a dual-layer disaster recovery strategy:

### 7.1 Automated Point-in-Time Recovery (PITR)
- **Primary Engine:** Neon Serverless PostgreSQL with Write-Ahead Logging (WAL) archiving.
- **RPO (Recovery Point Objective):** < 5 minutes.
- **Instant Branch Recovery:** In the event of catastrophic data corruption, administrators can instantiate a recovery branch via Neon CLI:
  ```bash
  neonctl branches create \
    --project-id "$NEON_PROJECT_ID" \
    --name "pitr-incident-recovery" \
    --timestamp "2026-11-23T18:00:00Z"
  ```

### 7.2 Scheduled Cold Storage Snapshots
- **Automation:** Scheduled GitHub Actions workflow [`.github/workflows/db-backup.yml`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/.github/workflows/db-backup.yml) runs weekly on Sunday at 02:00 UTC.
- **Execution Script:** [`scripts/db-backup.sh`](file:///Users/apple/Desktop/JANSETU-MULTIVERSE/scripts/db-backup.sh) generates compressed `pg_dump` archives with SHA-256 checksums.
- **Cold Storage:** Archives are synced to an encrypted Cloudflare R2 private bucket with a 30-day automated lifecycle retention policy.
- **Restoration Command:**
  ```bash
  gzip -dc backups/jansetu_db_YYYYMMDD_HHMMSS.sql.gz | psql "$DATABASE_URL"
  ```

---

## 8. Incident Response & Vulnerability Disclosure

Security vulnerabilities should be reported directly to the core engineering team:
- **Security Contact:** `security@jansetu.gov.in`
- **PGP Key ID:** `0x4A8F291E7C6B3D10`
- **SLA for Initial Triage:** Within 24 hours.
- **SLA for Security Patch Release:** Within 72 hours for critical/high vulnerabilities.
