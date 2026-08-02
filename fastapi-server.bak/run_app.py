import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'routers'))
# Fix relative imports by making them absolute
import main
main.app
import uvicorn
uvicorn.run(main.app, host='0.0.0.0', port=5000)
