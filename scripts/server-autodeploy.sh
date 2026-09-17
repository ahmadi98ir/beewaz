#!/usr/bin/env bash
set -Eeuo pipefail

# Canonical Beewaz production auto-deploy bridge.
# GitHub Actions publishes ghcr.io/ahmadi98ir/beewaz-web:latest from main.
# This script pulls that image, dynamically discovers the current *running*
# Coolify service, recreates only Beewaz, verifies the new container locally,
# and automatically restores the previous image if activation fails.

SOURCE_IMAGE="ghcr.io/ahmadi98ir/beewaz-web:latest"
LOCK_FILE="/run/lock/beewaz-autodeploy.lock"
ROLLBACK_TAG="beewaz-rollback:previous"
HEALTH_PORT="3000"

log() {
  local msg="[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"
  echo "$msg"
  logger -t beewaz-deploy -- "$msg" 2>/dev/null || true
}

for cmd in docker curl flock; do
  command -v "$cmd" >/dev/null 2>&1 || {
    log "ERROR: missing command: $cmd"
    exit 1
  }
done

# Prevent overlapping timer/manual runs.
touch "$LOCK_FILE"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

# Locate only the currently running production app from stable Coolify labels.
# Coolify can leave stopped historical containers with the same labels after a
# recreate; including them would make discovery ambiguous. If production is
# not running, fail closed rather than guessing which stopped container to use.
mapfile -t CONTAINERS < <(
  docker ps \
    --filter 'label=coolify.projectName=beewaz' \
    --filter 'label=coolify.environmentName=production' \
    --format '{{.Names}}'
)

if [[ "${#CONTAINERS[@]}" -ne 1 ]]; then
  log "ERROR: expected exactly one running Beewaz production container, found ${#CONTAINERS[@]}"
  exit 1
fi

CONTAINER="${CONTAINERS[0]}"
IMAGE_NAME="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
OLD_IMAGE_ID="$(docker inspect -f '{{.Image}}' "$CONTAINER")"
COMPOSE_WORKDIR="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$CONTAINER")"
COMPOSE_SERVICE="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$CONTAINER")"

if [[ -z "$IMAGE_NAME" || -z "$OLD_IMAGE_ID" || -z "$COMPOSE_WORKDIR" || -z "$COMPOSE_SERVICE" ]]; then
  log "ERROR: missing Coolify/Compose metadata on $CONTAINER"
  exit 1
fi
if [[ ! -d "$COMPOSE_WORKDIR" ]]; then
  log "ERROR: compose workdir not found: $COMPOSE_WORKDIR"
  exit 1
fi

log "Checking $SOURCE_IMAGE"
if ! docker pull "$SOURCE_IMAGE"; then
  log "ERROR: failed to pull $SOURCE_IMAGE; production left unchanged"
  exit 1
fi
NEW_IMAGE_ID="$(docker image inspect -f '{{.Id}}' "$SOURCE_IMAGE")"

if [[ "$NEW_IMAGE_ID" == "$OLD_IMAGE_ID" ]]; then
  log "Already current: image=$NEW_IMAGE_ID container=$CONTAINER"
  exit 0
fi

log "New image detected: old=$OLD_IMAGE_ID new=$NEW_IMAGE_ID"

recreate_service() {
  (
    cd "$COMPOSE_WORKDIR"
    docker compose up -d \
      --force-recreate \
      --no-deps \
      --pull never \
      "$COMPOSE_SERVICE"
  )
}

rollback() {
  log "ROLLBACK: restoring previous image $OLD_IMAGE_ID"
  docker tag "$OLD_IMAGE_ID" "$IMAGE_NAME"
  if recreate_service; then
    log "ROLLBACK: previous image recreated"
  else
    log "ERROR: rollback recreate failed"
  fi
}

# Preserve the current working image before moving the compose-facing tag.
docker tag "$OLD_IMAGE_ID" "$ROLLBACK_TAG"
docker tag "$SOURCE_IMAGE" "$IMAGE_NAME"

if ! recreate_service; then
  log "ERROR: compose recreate failed"
  rollback
  exit 1
fi

# Wait up to ~60 seconds for the new Next.js container to finish migrations
# and serve HTTP directly on the Docker network. The public proxy is not used
# so a 200 here proves the recreated container itself is answering.
healthy=0
for ((attempt=1; attempt<=30; attempt++)); do
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
  log "ERROR: new container failed health verification; rolling back"
  rollback
  exit 1
fi

log "Deploy successful: image=$NEW_IMAGE_ID container=$CONTAINER"
