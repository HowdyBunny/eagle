

开发阶段：不使用tauri打包：
后端：
```bash
cd backend
uv sync                              # 安装依赖
cp .env.example .env && vim .env      # 配置环境变量
uv run alembic upgrade head           # 执行迁移
cd backend
uv run python main.py --dev     # 启动服务（开发）
```

前端和extension：
```bash
cd extension # 或者 cd frontend
pnpm install
pnpm dev          # dev server at http://localhost:5173
pnpm build        # prod bundle into dist/

# 如果想看Tauri窗口
cd frontend && pnpm tauri dev
```




构建App阶段：
```bash
# 1. 打后端
cd backend
uv run pyinstaller eagle-backend.spec --noconfirm

# 2. 打整个 app（会自动复制 backend/dist 到 src-tauri/binaries 并打进 bundle）
cd ../frontend
pnpm tauri build
```
`pnpm tauri build` 在 macOS 上同时产出两样东西：
- frontend/src-tauri/target/release/bundle/macos/Eagle.app — 可直接运行的 .app
- frontend/src-tauri/target/release/bundle/dmg/Eagle_0.1.0_aarch64.dmg — 可双击挂载的磁盘镜像




License
This project is licensed under the AGPL-3.0 License - see the LICENSE file for details.