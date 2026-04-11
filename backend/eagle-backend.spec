# PyInstaller spec for the Eagle FastAPI backend.
# Build with:   uv run pyinstaller eagle-backend.spec
# Output:       backend/dist/eagle-backend/  (onedir — an exe + _internal/)
#
# Onedir is used instead of onefile because ChromaDB + SQLAlchemy have large
# dynamic import graphs; onefile would extract ~200MB to a tmp dir on every
# launch, which is both slow and fragile.

from PyInstaller.utils.hooks import collect_all, collect_submodules, collect_data_files

# Libraries with heavy dynamic imports — collect_all pulls in submodules,
# datas (templates, metadata) and binaries (native .so / .dylib files).
datas, binaries, hiddenimports = [], [], []

for pkg in (
    "chromadb",
    "chromadb.telemetry",
    "chroma_hnswlib",
    "tokenizers",
    "opentelemetry",
    "posthog",
    "tiktoken",
    "tiktoken_ext",
    "onnxruntime",
    "sqlalchemy",
    "aiosqlite",
    "alembic",
    "pydantic",
    "pydantic_settings",
    "uvicorn",
    "fastapi",
    "starlette",
    "anyio",
    "httpx",
    "httpcore",
    "openai",
    "anthropic",
    "loguru",
    "tqdm",
    "send2trash",
):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        # Package might not be present on all platforms — skip silently.
        pass

# Grab every app.* submodule so FastAPI routers / SQLAlchemy models that are
# only imported dynamically (e.g. via register_routers) survive the bundle.
hiddenimports += collect_submodules("app")

# Ship Alembic migration scripts + ini alongside the exe. _resource_path() in
# app/main.py uses sys._MEIPASS to find these at runtime.
datas += [
    ("alembic", "alembic"),
    ("alembic.ini", "."),
]


a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Shrink the bundle — none of these are used by the backend.
        "tkinter",
        "matplotlib",
        "IPython",
        "jupyter",
        "notebook",
        "pytest",
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="eagle-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="eagle-backend",
)
