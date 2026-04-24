from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import dividends, import_router, performance, portfolio, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="FramBourse API",
    description="Portfolio tracking dashboard — Raspberry Pi local deployment",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(portfolio.router)
app.include_router(dividends.router)
app.include_router(performance.router)
app.include_router(import_router.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
