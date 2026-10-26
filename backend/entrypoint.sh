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

# Migrations run from every replica at boot would race when scaling out.
# Keep MIGRATE_ON_BOOT=1 (default) for the single-replica / first boot, and set
# MIGRATE_ON_BOOT=0 on the extra replicas once the schema is applied.
if [ "${MIGRATE_ON_BOOT:-1}" = "0" ]; then
  echo ">> MIGRATE_ON_BOOT=0 — skipping migrate (the one-shot migrate service owns the schema)"
else
  echo ">> Running migrations"
  python manage.py migrate --noinput --settings=core.settings.prod
fi

# The Django admin is NOT bootstrapped from the environment (no ADMIN_* vars).
# Create it once and manage its password in the admin / changepassword:
#   python manage.py createsuperuser --settings=core.settings.prod

echo ">> Collecting static files"
python manage.py collectstatic --noinput --settings=core.settings.prod 2>/dev/null || true

echo ">> Starting Gunicorn"
exec gunicorn core.wsgi:application --config /app/gunicorn.conf.py
