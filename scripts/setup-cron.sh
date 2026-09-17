#!/usr/bin/env bash
set -Eeuo pipefail

# Historical filename retained for compatibility. This now installs the
# canonical systemd timer instead of a cron job.
# Run as root from the repository checkout:
#   sudo bash scripts/setup-cron.sh

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run this installer with sudo/root" >&2
  exit 1
fi

SRC="$(cd "$(dirname "$0")" && pwd)/server-autodeploy.sh"
DST="/opt/beewaz-autodeploy.sh"
SERVICE="/etc/systemd/system/beewaz-autodeploy.service"
TIMER="/etc/systemd/system/beewaz-autodeploy.timer"

install -m 0755 "$SRC" "$DST"

cat > "$SERVICE" <<'EOF'
[Unit]
Description=Beewaz production auto-deploy poll
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/beewaz-autodeploy.sh
User=root
Group=root
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
# The GHCR-based bridge no longer writes deployment state under /var/lib.
# It only needs the Docker socket plus read/write access to Coolify's compose
# working directory and the existing runtime lock directory.
ReadWritePaths=/run/lock /data/coolify

[Install]
WantedBy=multi-user.target
EOF

cat > "$TIMER" <<'EOF'
[Unit]
Description=Poll GHCR for a new Beewaz production image every 2 minutes

[Timer]
OnBootSec=45s
OnUnitActiveSec=2min
AccuracySec=10s
Persistent=true
Unit=beewaz-autodeploy.service

[Install]
WantedBy=timers.target
EOF

# Remove the obsolete cron mechanism if it exists. Preserve unrelated entries.
if crontab -l >/tmp/beewaz-root-crontab.$$ 2>/dev/null; then
  grep -v 'beewaz-autodeploy' /tmp/beewaz-root-crontab.$$ | crontab -
  rm -f /tmp/beewaz-root-crontab.$$
fi

systemctl daemon-reload
systemctl reset-failed beewaz-autodeploy.service 2>/dev/null || true
systemctl enable --now beewaz-autodeploy.timer

echo "Installed: $DST"
systemctl status beewaz-autodeploy.timer --no-pager
systemctl list-timers beewaz-autodeploy.timer --no-pager
