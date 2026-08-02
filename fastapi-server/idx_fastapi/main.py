from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .routers import auth, stocks, portfolio, plans, dashboard, affiliate, sniper, brokers, android_compat, oms, screener, calendar, deposit, payment

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3004"], allow_origin_regex=r"https://.*\.mytriv\.com", 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .socket_manager import sio
import socketio

app.mount('/socket.io', socketio.ASGIApp(sio, socketio_path=''))
app.include_router(auth.router, prefix="/api")
app.include_router(auth.router, prefix="/api")

from .routers.auth import get_me, get_current_user

@app.get("/api/me")
def api_me(current_user=Depends(get_current_user)):
    return get_me(current_user)

@app.get("/api/me/transactions")
def api_me_transactions(current_user=Depends(get_current_user)):
    return {"success": True, "data": []}

@app.get("/api/stocks/ai/quota")
def api_stocks_ai_quota(current_user=Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "remaining": current_user.ai_quota,
            "used": getattr(current_user, "ai_usage", 0),
            "limit": getattr(current_user, "ai_limit", 10)
        }
    }

app.include_router(stocks.router, prefix="/api")
app.include_router(portfolio.router, prefix="/api")
app.include_router(plans.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(affiliate.router, prefix="/api")
app.include_router(sniper.router, prefix="/api")
app.include_router(brokers.router, prefix="/api/brokers")
app.include_router(android_compat.router, prefix="/api")
app.include_router(oms.router, prefix="/api")

from .routers import signals, finance, ksei_kpei, risk, system_ops, admin, leaderboard
app.include_router(finance.router, prefix="/api")
app.include_router(ksei_kpei.router, prefix="/api")
app.include_router(risk.router, prefix="/api")
app.include_router(system_ops.router, prefix="/api")
app.include_router(deposit.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(admin.router, prefix="/api/admin")
app.include_router(signals.router, prefix="/api")

try:
    from .routers import apu_ppt, custodian, reksadana
    app.include_router(apu_ppt.router, prefix="/api")
    app.include_router(custodian.router, prefix="/api")
    app.include_router(reksadana.router, prefix="/api/reksadana")
except ImportError as e:
    print("Warning: Could not import some routers:", e)

app.include_router(screener.router, prefix="/api/stocks")
app.include_router(calendar.router, prefix="/api/market")
app.include_router(payment.router, prefix="/api")

from .database import get_local_db, get_remote_db
from sqlalchemy import text

@app.get("/health")
@app.get("/api/health")
def health_check():
    results = {"local": None, "remote": None}
    try:
        db_gen = get_local_db()
        db = next(db_gen)
        db.execute(text("SELECT 1"))
        results["local"] = "ok"
        db.close()
    except Exception as e:
        results["local"] = str(e)
    try:
        db_gen = get_remote_db()
        db = next(db_gen)
        db.execute(text("SELECT 1"))
        results["remote"] = "ok"
        db.close()
    except Exception as e:
        results["remote"] = str(e)
    all_ok = all(v == "ok" for v in results.values())
    status_code = 200 if all_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if all_ok else "degraded",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "database": results
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)