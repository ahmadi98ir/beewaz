#!/bin/sh
set -e

# اطمینان از وجود پوشه uploads
mkdir -p /app/public/uploads/products
chown -R nextjs:nodejs /app/public/uploads 2>/dev/null || true

# DNS fix: api.sms.ir برای ارسال پیامک از داخل container
grep -q "api.sms.ir" /etc/hosts 2>/dev/null || echo "185.211.56.44 api.sms.ir" >> /etc/hosts

# اجرای migration قبل از start — fail closed: اگر migration واقعاً fail شود،
# سرور اصلاً start نمی‌شود تا روی schema ناقص/نامعلوم ترافیک سرو نشود.
echo "[entrypoint] ── Migration ─────────────────────────"
if [ -f /app/migrate.mjs ]; then
  if ! node /app/migrate.mjs; then
    echo "[entrypoint] ❌ migrate.mjs failed — refusing to start against a schema in an unknown state" >&2
    exit 1
  fi
else
  echo "[entrypoint] ❌ migrate.mjs not found — refusing to start without migration guarantees" >&2
  exit 1
fi
echo "[entrypoint] ────────────────────────────────────────"

echo "[entrypoint] Starting Next.js..."
exec node server.js
