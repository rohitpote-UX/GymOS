#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# GYM BUSINESS OS — AUTOMATED DATABASE BACKUP & ROTATION SCRIPT
# -----------------------------------------------------------------------------
set -e

BACKUP_DIR="/var/backups/gym-business-os"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME=${DB_DATABASE:-"gym_business_os"}
DB_USER=${DB_USERNAME:-"gym_user"}
DB_PASS=${DB_PASSWORD:-""}
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting backup for database '${DB_NAME}'..."

if [ -n "${DB_PASS}" ]; then
  mysqldump -u "${DB_USER}" -p"${DB_PASS}" --single-transaction --quick "${DB_NAME}" | gzip > "${BACKUP_FILE}"
else
  mysqldump -u "${DB_USER}" --single-transaction --quick "${DB_NAME}" | gzip > "${BACKUP_FILE}"
fi

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Purge backups older than RETENTION_DAYS
echo "[$(date)] Purging database backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup rotation complete."
