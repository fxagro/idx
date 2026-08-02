import socketio

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

@sio.event
async def connect(sid, environ):
    print(f"Client connected to WebSocket: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
