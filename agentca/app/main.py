"""AgentCA — FastAPI Application (Production Ready, Rs.0/month)."""

from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    s = get_settings()
    logger.info(f"agentca_starting: env={s.app_env}")

    # Initialize Sentry (FREE error tracking)
    if s.sentry_dsn:
        try:
            import sentry_sdk
            sentry_sdk.init(dsn=s.sentry_dsn, traces_sample_rate=0.1)
            logger.info("sentry_initialized")
        except ImportError:
            logger.warning("sentry-sdk not installed")

    yield
    logger.info("agentca_shutdown")


# Create app
app = FastAPI(
    title="AgentCA",
    description="AI Autonomous Accountant for Indian MSMEs",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if not get_settings().is_production else None,
    redoc_url=None,
)

# CORS — explicit origins only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://agentca.pages.dev",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


# Global error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"unhandled_error: {request.url.path}")
    try:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc) if get_settings().app_debug else None},
    )


# Health check (for UptimeRobot keepalive)
@app.get("/health")
async def health():
    return {"status": "ok", "service": "agentca"}


# Register routers
from app.routers import webhook, invoices, transactions, gst, admin

app.include_router(webhook.router)
app.include_router(invoices.router)
app.include_router(transactions.router)
app.include_router(gst.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {
        "service": "AgentCA",
        "version": "1.0.0",
        "description": "AI Autonomous Accountant for Indian MSMEs",
        "status": "running",
    }


# ── Cron Endpoints (triggered by UptimeRobot or GitHub Actions) ──

@app.post("/api/cron/daily-summary")
async def cron_daily_summary(request: Request):
    """Send daily summaries to all active businesses. Trigger at 8 PM IST."""
    # Simple auth: check for a secret header
    secret = request.headers.get("x-cron-secret", "")
    if get_settings().is_production and secret != get_settings().whatsapp_verify_token:
        return {"error": "unauthorized"}

    from app.services.scheduler import run_daily_summaries
    count = await run_daily_summaries()
    return {"status": "ok", "summaries_sent": count}


@app.post("/api/cron/cleanup")
async def cron_cleanup(request: Request):
    """Cleanup old processed messages (idempotency table). Run weekly."""
    secret = request.headers.get("x-cron-secret", "")
    if get_settings().is_production and secret != get_settings().whatsapp_verify_token:
        return {"error": "unauthorized"}

    from app.database import get_db
    try:
        # Delete processed messages older than 7 days
        db = get_db()
        db.table("processed_messages").delete().lt(
            "processed_at",
            (date.today().isoformat())
        ).execute()
        return {"status": "ok", "action": "cleaned_old_messages"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


from datetime import date
