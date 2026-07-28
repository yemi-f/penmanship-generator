from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from nanoid import generate as generate_nanoid

from app.repo import store
from app.repo.store import check_connection
from app.runtime.auth import current_user
from app.service import cards as cards_service
from app.types.catalog import DEFAULT_STYLES
from app.types.cards import CardCreateRequest, CardUpdateRequest, DesignPreviewCreateRequest
from app.types.sample import SampleMeta

router = APIRouter()

ALLOWED_SAMPLE_CONTENT_TYPES = {"image/png", "image/jpeg"}
MAX_SAMPLE_BYTES = 5 * 1024 * 1024


def _refresh_card_urls(meta: dict, base: str) -> None:
    """Presign design_url/writing_face_url for a complete card, or null them out.

    Mutates meta in place. The null-out branch matters for cards created before
    the design-generation architecture change: their stored meta.json may still
    carry a stale design_url (from the old always-set-at-creation static-preset
    scheme) even when status != "complete" — without this, a failed legacy card
    would present a design_url pointing at a real (but irrelevant) image.
    """
    if meta["status"] == "complete":
        meta["design_url"] = store.presign_url(f"{base}/design-face.png")
        meta["writing_face_url"] = store.presign_url(f"{base}/writing-face.png")
    else:
        meta["design_url"] = None
        meta["writing_face_url"] = None


@router.get("/health")
def health() -> dict[str, bool]:
    return {"b2_connected": check_connection()}


@router.get("/api/me")
def me(user_id: str = Depends(current_user)) -> dict:
    return store.get_json(f"users/{user_id}/profile.json")


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


@router.post("/api/design-previews")
def create_design_preview(req: DesignPreviewCreateRequest, user_id: str = Depends(current_user)) -> dict:
    preview_id, design_url = cards_service.create_design_preview(user_id, req)
    return {"design_preview_id": preview_id, "design_url": design_url}


@router.post("/api/cards")
def create_card(req: CardCreateRequest, user_id: str = Depends(current_user)) -> dict:
    meta = cards_service.create_card(user_id, req)
    return {"card_id": meta.card_id, "share_token": meta.share_token}


@router.patch("/api/cards/{card_id}")
def update_card(card_id: str, req: CardUpdateRequest, user_id: str = Depends(current_user)) -> dict:
    return cards_service.update_card(user_id, card_id, req)


@router.get("/api/cards/{card_id}/update-stream")
def stream_card_update(
    card_id: str,
    regenerate_design: bool,
    regenerate_writing: bool,
    user_id: str = Depends(current_user),
) -> StreamingResponse:
    if not store.object_exists(f"users/{user_id}/cards/{card_id}/meta.json"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="card not found")
    return StreamingResponse(
        cards_service.stream_update(user_id, card_id, regenerate_design, regenerate_writing),
        media_type="text/event-stream",
    )


@router.get("/api/cards")
def list_cards(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(current_user),
) -> dict:
    all_ids = store.read_index(f"users/{user_id}/cards/index.json")
    page_ids = all_ids[offset : offset + limit]

    cards = []
    for card_id in page_ids:
        meta_key = f"users/{user_id}/cards/{card_id}/meta.json"
        if not store.object_exists(meta_key):
            continue
        meta = store.get_json(meta_key)
        _refresh_card_urls(meta, f"users/{user_id}/cards/{card_id}")
        cards.append(meta)

    return {"cards": cards, "total": len(all_ids)}


@router.get("/api/cards/{card_id}/stream")
def stream_card(card_id: str, user_id: str = Depends(current_user)) -> StreamingResponse:
    if not store.object_exists(f"users/{user_id}/cards/{card_id}/meta.json"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="card not found")
    return StreamingResponse(
        cards_service.stream_generation(user_id, card_id),
        media_type="text/event-stream",
    )


@router.get("/api/cards/{card_id}")
def get_card(card_id: str, user_id: str = Depends(current_user)) -> dict:
    meta_key = f"users/{user_id}/cards/{card_id}/meta.json"
    if not store.object_exists(meta_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="card not found")

    meta = store.get_json(meta_key)
    _refresh_card_urls(meta, f"users/{user_id}/cards/{card_id}")
    return meta


@router.delete("/api/cards/{card_id}")
def delete_card(card_id: str, user_id: str = Depends(current_user)) -> dict:
    meta_key = f"users/{user_id}/cards/{card_id}/meta.json"
    if not store.object_exists(meta_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="card not found")

    meta = store.get_json(meta_key)
    store.delete_object(meta_key)
    store.delete_object(f"users/{user_id}/cards/{card_id}/design-face.png")
    store.delete_object(f"users/{user_id}/cards/{card_id}/writing-face.png")
    store.remove_from_index(f"users/{user_id}/cards/index.json", card_id)
    store.delete_object(f"share-tokens/{meta['share_token']}.json")

    return {"deleted": True}


def _texture_response(request: Request, key: str, *, private: bool) -> Response:
    etag = store.get_object_etag(key)
    if etag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="texture not found")
    cache_control = f"{'private' if private else 'public'}, max-age=0, must-revalidate"
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag, "Cache-Control": cache_control})
    return Response(
        content=store.get_object(key),
        media_type="image/png",
        headers={"ETag": etag, "Cache-Control": cache_control},
    )


@router.get("/api/cards/{card_id}/textures/{face}")
def get_card_texture(
    request: Request, card_id: str, face: Literal["design", "writing"], user_id: str = Depends(current_user)
) -> Response:
    filename = "design-face.png" if face == "design" else "writing-face.png"
    key = f"users/{user_id}/cards/{card_id}/{filename}"
    return _texture_response(request, key, private=True)


@router.get("/api/share/{share_token}")
def get_share(share_token: str) -> dict:
    resolved = store.read_share_token(share_token)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="share link not found")

    meta_key = f"users/{resolved['user_id']}/cards/{resolved['card_id']}/meta.json"
    if not store.object_exists(meta_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="card not found")

    meta = store.get_json(meta_key)
    base = f"users/{resolved['user_id']}/cards/{resolved['card_id']}"
    _refresh_card_urls(meta, base)
    return {
        "card_type": meta["card_type"],
        "orientation": meta["orientation"],
        "design_url": meta["design_url"],
        "writing_face_url": meta["writing_face_url"],
        "created_at": meta["created_at"],
    }


@router.get("/api/share/{share_token}/textures/{face}")
def get_share_texture(request: Request, share_token: str, face: Literal["design", "writing"]) -> Response:
    resolved = store.read_share_token(share_token)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="share link not found")

    filename = "design-face.png" if face == "design" else "writing-face.png"
    key = f"users/{resolved['user_id']}/cards/{resolved['card_id']}/{filename}"
    return _texture_response(request, key, private=False)
