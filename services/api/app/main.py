from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.runtime.routes import router

app = FastAPI(title="InkCard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.frontend_origin.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
