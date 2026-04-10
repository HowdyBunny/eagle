import uvicorn
import sys

PORT = 52777
IS_DEV = "--dev" in sys.argv

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=PORT,
        reload=IS_DEV,
    )
