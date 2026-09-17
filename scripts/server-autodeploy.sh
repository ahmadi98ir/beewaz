#!/usr/bin/env bash
set -Eeuo pipefail

# Canonical Beewaz auto-deploy bridge.
# Polls Cloudflare R2 for the latest build SHA, rebuilds the already-assembled
# standalone bundle into the image name currently used by Coolify, recreates
# only the Beewaz service, verifies local HTTP health, and rolls back on failure.

R2_BASE="https://pub-304fa4e803c8406fa2617521a41f0971.r2.dev"
STATE_FILE="/var/lib/beewaz-deploy/last-sha"
LOCK_FILE="/run/lock/beewaz-autodeploy.lock"
HEALTH_PORT="3000"
BUILD_TAG_PREFIX="beewaz-deploy"
ROLLBACK_TAG="beewaz-rollback:previous"

log() {
  local msg="[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"
  echo "$msg"
  logger -t beewaz-deploy -- "$msg" 2>/dev/null || true
}

for cmd in curl docker tar flock mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || { log "ERROR: missing command: $cmd"; exit 1; }
done

touch "$LOCK_FILE"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

mkdir -p "$(dirname "$STATE_FILE")"
TMP_DIR="$(mktemp -d /tmp/beewaz-deploy.XXXXXX)"
TARBALL="$TMP_DIR/beewaz-build.tar.gz"
BUILD_DIR="$TMP_DIR/bundle"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

SHA="$(curl -fsSL --max-time 15 "$R2_BASE/sha.txt" | tr -d '[:space:]')"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  log "ERROR: invalid SHA from R2: '$SHA'"
  exit 1
fi

CURRENT="$(cat "$STATE_FILE" 2>/dev/null || true)"
if [[ "$SHA" == "$CURRENT" ]]; then
  exit 0
fi

log "New build detected: $SHA"

curl -fsSL --max-time 180 --retry 3 --retry-delay 5 \
  -o "$TARBALL" "$R2_BASE/beewaz-build.tar.gz"

tar -tzf "$TARBALL" >/dev/null
mkdir -p "$BUILD_DIR"
tar -xzf "$TARBALL" -C "$BUILD_DIR"
[[ -f "$BUILD_DIR/Dockerfile" ]] || { log "ERROR: Dockerfile missing from bundle"; exit 1; }

mapfile -t CONTAINERS < <(
  docker ps \
    --filter 'label=coolify.projectName=beewaz' \
    --filter 'label=coolify.environmentName=production' \
    --format '{{.Names}}'
)

if [[ "${#CONTAINERS[@]}" -ne 1 ]]; then
  log "ERROR: expected exactly one Beewaz production container, found ${#CONTAINERS[@]}"
  exit 1
fi

CONTAINER="${CONTAINERS[0]}"
IMAGE_NAME="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
OLD_IMAGE_ID="$(docker inspect -f '{{.Image}}' "$CONTAINER")"
COMPOSE_WORKDIR="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$CONTAINER")"
COMPOSE_SERVICE="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$CONTAINER")"

if [[ -z "$IMAGE_NAME" || -z "$COMPOSE_WORKDIR" || -z "$COMPOSE_SERVICE" ]]; then
  log "ERROR: missing Coolify/Compose metadata on $CONTAINER"
  exit 1
fi
if [[ ! -d "$COMPOSE_WORKDIR" ]]; then
  log "ERROR: compose workdir not found: $COMPOSE_WORKDIR"
  exit 1
fi

BUILD_TAG="${BUILD_TAG_PREFIX}:${SHA}"
log "Building $BUILD_TAG for service $COMPOSE_SERVICE"
docker build -t "$BUILD_TAG" "$BUILD_DIR"
NEW_IMAGE_ID="$(docker image inspect -f '{{.Id}}' "$BUILD_TAG")"

# Keep exactly one easy rollback tag and only then move the image tag expected
# by the Coolify-generated compose file.
docker tag "$OLD_IMAGE_ID" "$ROLLBACK_TAG"
docker tag "$BUILD_TAG" "$IMAGE_NAME"

recreate_service() {
  (
    cd "$COMPOSE_WORKDIR"
    docker compose up -d --force-recreate --no-deps --pull never "$COMPOSE_SERVICE"
  )
}

rollback() {
  log "ROLLBACK: restoring previous image $OLD_IMAGE_ID"
  docker tag "$OLD_IMAGE_ID" "$IMAGE_NAME"
  recreate_service || log "ERROR: rollback recreate failed"
}

if ! recreate_service; then
  log "ERROR: compose recreate failed"
  rollback
  exit 1
fi

healthy=0
for _ in $(seq 1 30); do
  sleep 2
  STATUS="$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || true)"
  RUNNING_IMAGE_ID="$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)"
  if [[ "$STATUS" == "running" && "$RUNNING_IMAGE_ID" == "$NEW_IMAGE_ID" ]]; then
    CONTAINER_IP="$(docker inspect -f '{{with index .NetworkSettings.Networks "coolify"}}{{.IPAddress}}{{end}}' "$CONTAINER" 2>/dev/null || true)"
    if [[ -n "$CONTAINER_IP" ]] && curl -fsS --max-time 5 "http://${CONTAINER_IP}:${HEALTH_PORT}/" >/dev/null; then
      healthy=1
      break
    fi
  fi
done

if [[ "$healthy" -ne 1 ]]; then
  log "ERROR: new container did not become healthy; rolling back"
  rollback
  exit 1
fi

STATE_TMP="${STATE_FILE}.tmp"
printf '%s\n' "$SHA" > "$STATE_TMP"
mv "$STATE_TMP" "$STATE_FILE"
docker image rm "$BUILD_TAG" >/dev/null 2>&1 || true

log "Deploy successful: sha=$SHA image=$NEW_IMAGE_ID container=$CONTAINER"
