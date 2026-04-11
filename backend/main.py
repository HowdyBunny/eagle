import multiprocessing
import sys

import uvicorn

PORT = 52777
IS_DEV = "--dev" in sys.argv

if __name__ == "__main__":
    # Required for PyInstaller bundles: stops child processes spawned by
    # any lib using `multiprocessing` from re-running the uvicorn entry point.
    multiprocessing.freeze_support()

    if IS_DEV:
        # Reload requires a string import path so uvicorn can reload the module.
        uvicorn.run("app.main:app", host="127.0.0.1", port=PORT, reload=True)
    else:
        # Static import so PyInstaller's analyzer can see the dependency.
        from app.main import app

        uvicorn.run(app, host="127.0.0.1", port=PORT)
