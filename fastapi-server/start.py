import sys, importlib, os
sys.path.insert(0, os.path.dirname(__file__))
importlib.invalidate_caches()
import uvicorn
from idx_fastapi.main import app
uvicorn.run(app, host='127.0.0.1', port=5000)
