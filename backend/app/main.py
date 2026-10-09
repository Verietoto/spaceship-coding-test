"""FastAPI app: each feature module under app/modules/ contributes one router; the built React app is served at /."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .core import aiconfig, security, web
from .core.config import DIST, ENABLE_DOCS
from .modules.ai import router as ai
from .modules.analytics import router as analytics
from .modules.auth import repository as auth_repository
from .modules.auth import router as auth
from .modules.dashboards import router as dashboards
from .modules.knowledge import router as knowledge
from .modules.presets import router as presets
from .modules.schedules import router as schedules
from .modules.settings import router as backoffice
from .modules.settings import service as settings_service

MODULES = [auth, analytics, ai, dashboards, schedules, presets, knowledge, backoffice]


def create_app() -> FastAPI:
    security.require_session_secret()  # refuse to start with a guessable secret
    security.set_user_loader(auth_repository.session_user)  # core/ sits below the database layer: it is handed the lookup
    aiconfig.set_db_loader(settings_service.ai_overrides)  # the AI settings saved in the backoffice, over the environment's
    docs = {} if ENABLE_DOCS else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    app = FastAPI(title="Spaceship Logistics Dashboard", **docs)
    web.install(app)
    for module in MODULES:
        app.include_router(module.router)
    if DIST.exists():  # production: the built frontend; in dev, Vite serves it and proxies /api
        app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
    return app


app = create_app()
