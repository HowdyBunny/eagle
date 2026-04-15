#!/bin/bash
# package-dmg.sh
# 用法: bash scripts/package-dmg.sh
#
# 功能：
#   1. 找到 Tauri 已构建好的 Eagle.app
#   2. 创建一个新 DMG，包含 Eagle.app + "安装 Eagle.command"
#   3. 输出到 dist/Eagle-<version>.dmg

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_SRC="$PROJECT_ROOT/frontend/src-tauri/target/release/bundle/macos/Eagle.app"
INSTALLER_SRC="$SCRIPT_DIR/安装 Eagle.command"
DIST_DIR="$PROJECT_ROOT/dist"

# 读取版本号
VERSION=$(grep '"version"' "$PROJECT_ROOT/frontend/src-tauri/tauri.conf.json" \
  | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')

OUTPUT_DMG="$DIST_DIR/Eagle-$VERSION.dmg"
TMP_DIR="$(mktemp -d)"
MOUNT_DIR="$TMP_DIR/dmg_contents"

# ── 前置检查 ──────────────────────────────────────────────────────────────────
if [ ! -d "$APP_SRC" ]; then
  echo "❌ 未找到 Eagle.app，请先运行 Tauri build："
  echo "   cd frontend && pnpm tauri build"
  exit 1
fi

if [ ! -f "$INSTALLER_SRC" ]; then
  echo "❌ 未找到安装脚本：$INSTALLER_SRC"
  exit 1
fi

mkdir -p "$MOUNT_DIR" "$DIST_DIR"

# ── 打包 ──────────────────────────────────────────────────────────────────────
echo "▶ 复制 Eagle.app…"
cp -r "$APP_SRC" "$MOUNT_DIR/"

echo "▶ 复制安装脚本…"
cp "$INSTALLER_SRC" "$MOUNT_DIR/"
chmod +x "$MOUNT_DIR/安装 Eagle.command"

echo "▶ 创建 DMG (v$VERSION)…"
hdiutil create \
  -volname "Eagle $VERSION" \
  -srcfolder "$MOUNT_DIR" \
  -ov \
  -format UDZO \
  "$OUTPUT_DMG"

# ── 清理 ──────────────────────────────────────────────────────────────────────
rm -rf "$TMP_DIR"

echo ""
echo "✅ 打包完成：$OUTPUT_DMG"
echo "   发送这个 DMG 给用户，用户双击「安装 Eagle.command」即可完成安装，无需手动执行任何命令。"
