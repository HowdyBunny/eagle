#!/bin/bash
# Eagle 安装脚本 — 在 DMG 里双击即可运行

set -e

APP_NAME="Eagle.app"
INSTALL_DIR="/Applications"
INSTALL_PATH="$INSTALL_DIR/$APP_NAME"

# 找到 Eagle.app（与本脚本在同一目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/$APP_NAME"

if [ ! -d "$SOURCE" ]; then
  echo "❌ 找不到 $APP_NAME，请确保在 Eagle 安装盘（DMG）中运行此脚本。"
  read -rp "按 Enter 退出…"
  exit 1
fi

echo "🦅 正在安装 Eagle…"

# 如果旧版本存在，先删除
if [ -d "$INSTALL_PATH" ]; then
  echo "   检测到旧版本，正在覆盖…"
  rm -rf "$INSTALL_PATH"
fi

cp -r "$SOURCE" "$INSTALL_DIR/"
echo "   已复制到 /Applications"

echo "🔓 移除系统隔离限制…"
xattr -cr "$INSTALL_PATH"

echo ""
echo "✅ 安装完成！Eagle 已就绪，可以从启动台或 /Applications 中打开。"
echo ""
read -rp "按 Enter 关闭此窗口…"
