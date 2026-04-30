#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/rune-dice/app}"
DATA_DIR="/opt/rune-dice/data"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"

install_pkg_if_missing() {
  local cmd="$1"
  local pkg="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "[init] $cmd 已安装，跳过"
    return
  fi

  echo "[init] 安装 $pkg"
  apt-get update
  apt-get install -y "$pkg"
}

install_docker_if_needed() {
  if command -v docker >/dev/null 2>&1; then
    echo "[init] Docker 已安装，跳过"
    return
  fi

  echo "[init] 安装 Docker（官方脚本）"
  curl -fsSL https://get.docker.com | sh

  if [ -n "${SUDO_USER:-}" ]; then
    usermod -aG docker "$SUDO_USER" || true
  fi
}

install_compose_if_needed() {
  if docker compose version >/dev/null 2>&1; then
    echo "[init] Docker Compose 插件已可用，跳过"
    return
  fi

  echo "[init] 安装 Docker Compose 插件"
  apt-get update
  apt-get install -y docker-compose-plugin
}

if [ "$(id -u)" -ne 0 ]; then
  echo "[init] 请使用 root 执行（例如 sudo bash scripts/server-init.sh）"
  exit 1
fi

if [ -z "$REPO_URL" ]; then
  echo "[init] 请先设置 REPO_URL，例如:"
  echo "  REPO_URL='https://github.com/caiteng/Rune-Dice.git' bash scripts/server-init.sh"
  exit 1
fi

install_pkg_if_missing curl curl
install_pkg_if_missing git git
install_docker_if_needed
install_compose_if_needed

mkdir -p "$APP_DIR" "$DATA_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "[init] 克隆仓库到 $APP_DIR"
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "[init] 仓库已存在，拉取最新 $BRANCH"
  git -C "$APP_DIR" fetch --prune origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

echo "[init] 首次构建并启动"
cd "$APP_DIR"
docker compose up -d --build

echo "[init] 初始化完成"
echo "[init] 后续自动部署将直接调用 $APP_DIR/scripts/deploy.sh"
