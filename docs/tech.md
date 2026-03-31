技术文档：

此Agent应用使用Python语言进行后端Agent流的编写

Chrome插件：TypeScript，Service Worker，使用WXT来进行构建，UI使用React + Tailwind CSS。依赖只需要wxt、react、react-dom、tailwindcss、typescript



后端：

使用FastAPI。

LLM的调用直接使用openai的规范库，并且使用tool use和function calling的方式去网页搜索、注册Agentic项目现有的Agent或者工具

核心依赖：fastapi、uvicorn、sqlalchemy[asyncio]、asyncpg、
alembic、pgvector、pydantic、openai、
sentence-transformers（如果本地embedding）、
httpx、pydantic-settings（管理环境api key）、tqdm、loguru



数据库ORM：SQLAlchemy 2.0 + asyncpg

向量数据库：pgvector

Embedding模型：openai 的 text-embedding-3-small（调动API）

任务队列：FastAPI的BackgroundTasks

项目结构管理：使用uv进行init和add依赖