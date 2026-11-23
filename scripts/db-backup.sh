#!/usr/bin/env bash
# ==============================================================================
# JanSetu Multiverse — Automated Database Backup & Disaster Recovery Script
# ==============================================================================
# Performs compressed schema + data snapshots with SHA-256 integrity checksums,
# automated local retention rotation, and optional Cloudflare R2 cold storage upload.
#
# Neon Point-in-Time Recovery (PITR) & Snapshot Restoration Guide:
# ------------------------------------------------------------------------------
# 1. Full Database Restoration from Snapshot:
#    gzip -dc backups/backup_YYYYMMDD_HHMMSS.sql.gz | psql "$DATABASE_URL"
#
# 2. Schema-only Restoration:
#    gzip -dc backups/backup_YYYYMMDD_HHMMSS.sql.gz | grep -v '^INSERT INTO' | psql "$DATABASE_URL"
#
# 3. Neon PITR Branch Restoration via Neon CLI:
#    neonctl branches create \
#      --project-id "$NEON_PROJECT_ID" \
#      --name "recovery-branch-$(date +%Y%m%d)" \
#      --timestamp "2026-11-23T18:00:00Z"
# ==============================================================================

set -euo pipefail

# 1. Configuration & Argument Resolution
DB_URL="${1:-${DATABASE_URL:-}}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_BASENAME="jansetu_db_${TIMESTAMP}.sql"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_BASENAME}.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

echo "=== [JanSetu] Starting Database Backup Pipeline [${TIMESTAMP}] ==="

if [[ -z "${DB_URL}" ]]; then
  echo "WARNING: DATABASE_URL is not set."
  echo "Running in dry-run mode / local mock backup creation."
  mkdir -p "${BACKUP_DIR}"
  cat << 'EOF' > "${BACKUP_DIR}/${BACKUP_BASENAME}"
-- JanSetu Civic Grievance Monorepo Database Mock Snapshot
-- Target: PostgreSQL / Neon Serverless Postgres
-- Schema: users, sessions, accounts, verifications, complaints, clusters, audit_logs
CREATE TABLE IF NOT EXISTS _backup_meta (
  id SERIAL PRIMARY KEY,
  snapshot_timestamp TIMESTAMPTZ DEFAULT NOW(),
  version VARCHAR(50) DEFAULT '1.0.0'
);
INSERT INTO _backup_meta (version) VALUES ('1.0.0');
EOF
  gzip -9 -f "${BACKUP_DIR}/${BACKUP_BASENAME}"
else
  # Ensure destination directory exists
  mkdir -p "${BACKUP_DIR}"

  echo "[1/4] Executing pg_dump against Postgres cluster..."
  if ! command -v pg_dump &> /dev/null; then
    echo "ERROR: pg_dump command not found. Please install postgresql-client." >&2
    exit 1
  fi

  # Run pg_dump excluding ownership and privilege noise for portable restores
  pg_dump "${DB_URL}" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --quote-all-identifiers \
    | gzip -9 > "${BACKUP_FILE}"
fi

# 2. Checksum and Integrity Verification
echo "[2/4] Verifying archive integrity and computing SHA-256..."
if ! gzip -t "${BACKUP_FILE}"; then
  echo "ERROR: Backup archive failed gzip integrity check!" >&2
  exit 1
fi

if command -v sha256sum &> /dev/null; then
  sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
elif command -v shasum &> /dev/null; then
  shasum -a 256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
else
  openssl dgst -sha256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
fi

BACKUP_SIZE="$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')"
echo "  ✓ Snapshot verified: ${BACKUP_FILE} (${BACKUP_SIZE})"
echo "  ✓ SHA-256: $(cat "${CHECKSUM_FILE}")"

# 3. Optional Cloudflare R2 / AWS S3 Cold Storage Upload
echo "[3/4] Checking offsite cold storage configuration..."
if [[ -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" && -n "${R2_BUCKET_NAME:-}" ]]; then
  echo "Uploading snapshot to Cloudflare R2 bucket: ${R2_BUCKET_NAME}..."
  R2_ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
  
  if command -v aws &> /dev/null; then
    AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
    aws s3 cp "${BACKUP_FILE}" "s3://${R2_BUCKET_NAME}/database-backups/${BACKUP_BASENAME}.gz" \
      --endpoint-url "${R2_ENDPOINT}"
    AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
    aws s3 cp "${CHECKSUM_FILE}" "s3://${R2_BUCKET_NAME}/database-backups/${BACKUP_BASENAME}.gz.sha256" \
      --endpoint-url "${R2_ENDPOINT}"
    echo "  ✓ Successfully uploaded to Cloudflare R2."
  else
    echo "NOTE: aws-cli is not installed; skipping R2 direct upload."
  fi
else
  echo "INFO: R2 credentials unset. Snapshot saved locally at ${BACKUP_FILE}."
fi

# 4. Local Retention Cleanup (prune archives older than RETENTION_DAYS)
echo "[4/4] Pruning snapshots older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -type f \( -name "*.sql.gz" -o -name "*.sha256" \) -mtime "+${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true

echo "=== [JanSetu] Database Backup Complete [Success] ==="
