from fastapi import APIRouter, Depends

from app.repo import store
from app.repo.store import check_connection
from app.runtime.auth import current_user

router = APIRouter()


@router.get("/health")
def health() -> dict[str, bool]:
    return {"b2_connected": check_connection()}


@router.get("/api/me")
def me(user_id: str = Depends(current_user)) -> dict:
    return store.get_json(f"users/{user_id}/profile.json")
