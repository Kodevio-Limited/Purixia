#!/bin/sh
set -e

echo ">> Waiting for PostgreSQL (${DB_HOST:-db}:${DB_PORT:-5432})"
python - <<'PY'
import os, socket, sys, time
host = os.environ.get('DB_HOST', 'db')
port = int(os.environ.get('DB_PORT', '5432'))
deadline = time.time() + 60
while True:
    try:
        with socket.create_connection((host, port), timeout=5):
            print(f'>> PostgreSQL reachable at {host}:{port}')
            break
    except OSError as exc:
        if time.time() > deadline:
            print(f'>> ERROR: PostgreSQL not reachable at {host}:{port}: {exc}', file=sys.stderr)
            sys.exit(1)
        time.sleep(2)
PY

# Seed product/banner images shipped in the image into the persistent media
# volume on first boot only (never overwrite merchant uploads).
if [ -d /app/media_seed ] && ! find /app/media -type f 2>/dev/null | grep -q .; then
  echo ">> Seeding shipped media into persistent volume"
  cp -a /app/media_seed/. /app/media/
fi

echo ">> Running migrations"
python manage.py migrate --noinput --settings=core.settings.prod

echo ">> Ensuring admin superuser exists"
python manage.py ensure_admin --settings=core.settings.prod 2>/dev/null || true

echo ">> Collecting static files"
python manage.py collectstatic --noinput --settings=core.settings.prod 2>/dev/null || true

echo ">> Starting Gunicorn"
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3