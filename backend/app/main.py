from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import FRONTEND_URL

app = FastAPI(
    title="RUBWAY API",
    version="1.0.0",
    description="Backend API for EGP to RUB transfer operations",
)

allowed_origins = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}
if FRONTEND_URL:
    allowed_origins.add(FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
RECEIPTS_DIR = BASE_DIR / "uploads" / "receipts"
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/receipts", StaticFiles(directory=str(RECEIPTS_DIR)), name="receipts")

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"name": "RUBWAY API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
