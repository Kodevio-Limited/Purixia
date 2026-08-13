#!/bin/sh
set -e

echo ">> Preparing SQLite database (persistent path: $SQLITE_DB_PATH)"

# Determine if the persistent DB needs seeding. Reason to seed:
#   - the file does not exist yet, OR
#   - it exists but has no tables (e.g. an empty file left by an earlier run)
needs_seed=0
if [ ! -f "$SQLITE_DB_PATH" ]; then
  needs_seed=1
elif [ -f /app/db.sqlite3 ]; then
  tables=$(sqlite3 "$SQLITE_DB_PATH" ".tables" 2>/dev/null | wc -w)
  [ -z "$tables" ] || [ "$tables" -eq 0 ] && needs_seed=1 || true
fi

if [ "$needs_seed" -eq 1 ] && [ -f /app/db.sqlite3 ]; then
  echo ">> Empty/missing DB - seeding from /app/db.sqlite3"
  mkdir -p "$(dirname "$SQLITE_DB_PATH")"
  cp /app/db.sqlite3 "$SQLITE_DB_PATH"
  chmod 600 "$SQLITE_DB_PATH" || true
fi

# Ensure media files shipped in the image are visible at MEDIA_ROOT.
if [ -d /app/media ] && ! find /app/media -type f 2>/dev/null | grep -q .; then
  echo ">> (media dir is empty - check that images shipped in the image)"
fi

echo ">> Running migrations"
python manage.py migrate --noinput --settings=core.settings.prod

echo ">> Collecting static files"
python manage.py collectstatic --noinput --settings=core.settings.prod 2>/dev/null || true

echo ">> Starting Gunicorn"
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3