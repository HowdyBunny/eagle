后端：
```bash
cd backend
uv sync                              # 安装依赖
cp .env.example .env && vim .env      # 配置环境变量
uv run alembic upgrade head           # 执行迁移
cd backend && uv run python main.py     # 启动服务（开发）
```

前端：
```bash
pnpm install
cd frontend && pnpm dev          # dev server at http://localhost:5173
pnpm build        # prod bundle into dist/
```