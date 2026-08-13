#!/bin/sh
set -e

echo ">> Preparing SQLite database (persistent path: $SQLITE_DB_PATH)"

# Seed the persistent volume with the shipped database on first boot.
if [ ! -f "$SQLITE_DB_PATH" ] && [ -f /app/db.sqlite3 ]; then
  echo ">> No existing DB found - seeding from /app/db.sqlite3"
  mkdir -p "$(dirname "$SQLITE_DB_PATH")"
  cp /app/db.sqlite3 "$SQLITE_DB_PATH"
  chmod 600 "$SQLITE_DB_PATH" || true
fi

echo ">> Running migrations"
python manage.py migrate --noinput --settings=core.settings.prod

echo ">> Collecting static files"
python manage.py collectstatic --noinput --settings=core.settings.prod 2>/dev/null || true

echo ">> Starting Gunicorn"
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3