#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo ">>> Building backend..."
cd backend
uv run pyinstaller eagle-backend.spec --noconfirm
cd ..

echo ">>> Building frontend (Tauri)..."
cd frontend
pnpm tauri build
cd ..

echo ">>> Packaging DMG..."
bash scripts/package-dmg.sh

echo ">>> Done."
