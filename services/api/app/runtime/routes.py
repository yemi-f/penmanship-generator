from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from nanoid import generate as generate_nanoid

from app.repo import store
from app.repo.store import check_connection
from app.runtime.auth import current_user
from app.types.catalog import CARD_DESIGNS, DEFAULT_STYLES
from app.types.sample import SampleMeta

router = APIRouter()

ALLOWED_SAMPLE_CONTENT_TYPES = {"image/png", "image/jpeg"}
MAX_SAMPLE_BYTES = 5 * 1024 * 1024


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


@router.post("/api/samples")
async def upload_sample(
    file: UploadFile = File(...),
    label: str = Form(...),
    user_id: str = Depends(current_user),
) -> dict:
    if file.content_type not in ALLOWED_SAMPLE_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="file must be PNG or JPEG",
        )

    data = await file.read()
    if len(data) > MAX_SAMPLE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="file must be 5MB or smaller",
        )

    sample_id = generate_nanoid(size=12)
    sample_key = f"users/{user_id}/handwriting-samples/{sample_id}/sample.png"
    meta_key = f"users/{user_id}/handwriting-samples/{sample_id}/meta.json"

    store.upload_file(sample_key, data, content_type=file.content_type)
    sample_url = store.presign_url(sample_key)
    meta = SampleMeta(
        sample_id=sample_id,
        user_id=user_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        label=label,
        sample_url=sample_url,
    )
    store.put_json(meta_key, meta.model_dump())
    store.prepend_index(f"users/{user_id}/handwriting-samples/index.json", sample_id)

    return {"sample_id": sample_id, "sample_url": sample_url}


@router.delete("/api/samples/{sample_id}")
def delete_sample(sample_id: str, user_id: str = Depends(current_user)) -> dict:
    meta_key = f"users/{user_id}/handwriting-samples/{sample_id}/meta.json"
    if not store.object_exists(meta_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sample not found")

    store.delete_object(meta_key)
    store.delete_object(f"users/{user_id}/handwriting-samples/{sample_id}/sample.png")
    store.remove_from_index(f"users/{user_id}/handwriting-samples/index.json", sample_id)

    return {"deleted": True}
