from fastapi import APIRouter, Depends

from app.repo import store
from app.repo.store import check_connection
from app.runtime.auth import current_user
from app.types.catalog import CARD_DESIGNS, DEFAULT_STYLES

router = APIRouter()


@router.get("/health")
def health() -> dict[str, bool]:
    return {"b2_connected": check_connection()}


@router.get("/api/me")
def me(user_id: str = Depends(current_user)) -> dict:
    return store.get_json(f"users/{user_id}/profile.json")


@router.get("/api/designs")
def designs(user_id: str = Depends(current_user)) -> dict:
    return {
        "designs": [
            {
                "slug": d["slug"],
                "label": d["label"],
                "url": store.public_url(f"card-designs/{d['slug']}.png"),
            }
            for d in CARD_DESIGNS
        ]
    }


@router.get("/api/samples")
def samples(user_id: str = Depends(current_user)) -> dict:
    defaults = [
        {
            "slug": s["slug"],
            "label": s["label"],
            "preview_url": store.public_url(f"handwriting-samples/default/{s['slug']}-preview.png"),
        }
        for s in DEFAULT_STYLES
    ]
    saved = []
    for sample_id in store.read_index(f"users/{user_id}/handwriting-samples/index.json"):
        meta = store.get_json(f"users/{user_id}/handwriting-samples/{sample_id}/meta.json")
        meta["sample_url"] = store.presign_url(f"users/{user_id}/handwriting-samples/{sample_id}/sample.png")
        saved.append(meta)
    return {"defaults": defaults, "saved": saved}
