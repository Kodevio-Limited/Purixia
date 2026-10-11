#!/bin/sh
# Purixia BD — PostgreSQL backup.
#
# Takes a compressed custom-format dump (`pg_restore`-compatible) and keeps
# the newest $BACKUP_KEEP dumps. Run it on the Dokploy host — daily via a
# Dokploy cron job or host cron; the exact command is in DEPLOYMENT.md
# ("Backups"). In short: run this file inside a postgres:16-alpine container
# attached to the compose network, with the db credentials in the environment
# and a host directory mounted at $BACKUP_DIR.
set -eu

: "${POSTGRES_DB:=purixia}"
: "${POSTGRES_USER:=purixia}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD (the same secret the db service uses)}"
: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${BACKUP_DIR:=/var/backups/purixia}"
: "${BACKUP_KEEP:=7}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/purixia-$STAMP.dump"

mkdir -p "$BACKUP_DIR"

export PGPASSWORD="$POSTGRES_PASSWORD"
pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
    --format=custom --compress=9 --no-owner --file="$FILE" "$POSTGRES_DB"
dump_status=$?
unset PGPASSWORD

if [ "$dump_status" -ne 0 ]; then
    rm -f "$FILE"
    echo "backup FAILED (pg_dump exit $dump_status)" >&2
    exit "$dump_status"
fi

# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/purixia-*.dump 2>/dev/null \
    | tail -n +"$((BACKUP_KEEP + 1))" \
    | xargs -r rm -f

echo "backup ok: $FILE"
