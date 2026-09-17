#!/usr/bin/env bash
set -Eeuo pipefail

cat >&2 <<'EOF'
This installer is deprecated.

Beewaz production now uses the pull-based systemd bridge installed by:
  sudo bash scripts/setup-cron.sh

Do not reinstall the legacy image receiver. It previously depended on
hard-coded credentials and stale application identifiers.
EOF

exit 1
