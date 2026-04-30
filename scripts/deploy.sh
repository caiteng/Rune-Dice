#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/rune-dice/app}"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-}"
COMPOSE_CMD=(docker compose up -d --build)

log() {
  echo "[deploy] $*"
}

prune_dangling_images() {
  log "清理悬空镜像（<none>）"
  if docker image prune -f; then
    log "镜像清理完成"
  else
    log "镜像清理失败，继续部署（不影响主流程）"
  fi
}

rollback() {
  if [ -z "${PREV_COMMIT:-}" ]; then
    log "部署失败且无可回滚版本，请人工检查"
    exit 1
  fi

  log "部署失败，回滚到上一版本: $PREV_COMMIT"
  git reset --hard "$PREV_COMMIT"

  log "使用回滚版本重新启动容器"
  "${COMPOSE_CMD[@]}"

  log "已完成回滚: $(git rev-parse --short HEAD)"
}

if [ ! -d "$APP_DIR" ]; then
  log "app 目录不存在: $APP_DIR"
  log "请先执行 scripts/server-init.sh"
  exit 1
fi

cd "$APP_DIR"

if [ ! -d .git ]; then
  if [ -z "$REPO_URL" ]; then
    log "目录不是 git 仓库，且未提供 REPO_URL"
    exit 1
  fi
  log "首次拉代码到 $APP_DIR"
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

PREV_COMMIT="$(git rev-parse HEAD 2>/dev/null || true)"
log "当前版本: ${PREV_COMMIT:-unknown}"

log "拉取最新代码: origin/$BRANCH"
git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
NEW_COMMIT="$(git rev-parse HEAD)"
log "目标版本: $NEW_COMMIT"

log "开始构建并启动容器"
prune_dangling_images
if "${COMPOSE_CMD[@]}"; then
  prune_dangling_images
  log "部署成功: $(git rev-parse --short HEAD)"
  exit 0
fi

rollback
