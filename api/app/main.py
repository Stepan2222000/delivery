from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import create_pool
from .storage import create_minio
from .routes import auth as auth_routes
from .routes import parcels as parcels_routes
from .routes import shipments as shipments_routes
from .routes import settings as settings_routes
from .routes import photos as photos_routes
from .routes import excel as excel_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await create_pool()
    app.state.minio = create_minio()
    try:
        yield
    finally:
        await app.state.pool.close()


app = FastAPI(title="Delivery API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_routes.router)
app.include_router(parcels_routes.router)
app.include_router(shipments_routes.router)
app.include_router(settings_routes.router)
app.include_router(photos_routes.router)
app.include_router(excel_routes.router)


@app.get("/healthz")
async def healthz():
    async with app.state.pool.acquire() as conn:
        version = await conn.fetchval("SELECT version()")
    buckets = [b.name for b in app.state.minio.list_buckets()]
    return {"ok": True, "pg": version.split(",")[0], "minio_buckets": buckets}
