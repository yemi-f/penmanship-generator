from fastapi import APIRouter

from app.repo.store import check_connection

router = APIRouter()


@router.get("/health")
def health() -> dict[str, bool]:
    return {"b2_connected": check_connection()}
