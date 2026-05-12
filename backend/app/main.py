from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.api.documents import router as documents_router
from app.api.automation import router as automation_router
from app.api.backup import router as backup_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="DocuVault",
    description="AI-Powered Document Management System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router)
app.include_router(automation_router)
app.include_router(backup_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "docuvault"}
