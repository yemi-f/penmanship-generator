import io
import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone

from fastapi import HTTPException, status
from nanoid import generate as generate_nanoid
from PIL import Image
from starlette.concurrency import run_in_threadpool

from app.repo import pipelines, store
from app.service.prompts import build_edit_prompt, build_generate_prompt
from app.types.cards import CardCreateRequest, CardMeta
from app.types.catalog import CARD_DESIGNS, DEFAULT_STYLES

logger = logging.getLogger(__name__)

GENERATE_MODEL = "gpt-image-2-generate"
EDIT_MODEL = "gpt-image-2-edit"

# gpt-image-2 requires sizes that are multiples of 16 with >=655360 total px;
# 1800 isn't a multiple of 16, so we generate at the nearest compliant size
# and resize down to the spec canvas (see Phase 4 for the same constraint).
_CANVAS = {
    "landscape": ("1808x1200", (1800, 1200)),
    "portrait": ("1200x1808", (1200, 1800)),
}


def _design_label(design_slug: str) -> None:
    if not any(d["slug"] == design_slug for d in CARD_DESIGNS):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown design_slug: {design_slug}")


def _resolve_handwriting_label(user_id: str, handwriting_style: str) -> str:
    if handwriting_style.startswith("default:"):
        slug = handwriting_style.removeprefix("default:")
        style = next((s for s in DEFAULT_STYLES if s["slug"] == slug), None)
        if style is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown default style: {slug}")
        return style["label"]

    if handwriting_style.startswith("saved:"):
        sample_id = handwriting_style.removeprefix("saved:")
        meta_key = f"users/{user_id}/handwriting-samples/{sample_id}/meta.json"
        if not store.object_exists(meta_key):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"sample not found: {sample_id}")
        return store.get_json(meta_key)["label"]

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="handwriting_style must start with 'default:' or 'saved:'")


def create_card(user_id: str, req: CardCreateRequest) -> CardMeta:
    _design_label(req.design_slug)
    handwriting_label = _resolve_handwriting_label(user_id, req.handwriting_style)

    card_id = generate_nanoid(size=12)
    share_token = generate_nanoid(size=24)
    design_url = store.public_url(f"card-designs/{req.design_slug}.png")

    meta = CardMeta(
        card_id=card_id,
        user_id=user_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        card_type=req.card_type,
        orientation=req.orientation,
        design_slug=req.design_slug,
        design_url=design_url,
        handwriting_style=req.handwriting_style,
        handwriting_label=handwriting_label,
        message=req.message,
        status="pending",
        writing_face_url=None,
        share_token=share_token,
    )

    store.put_json(f"users/{user_id}/cards/{card_id}/meta.json", meta.model_dump())
    store.prepend_index(f"users/{user_id}/cards/index.json", card_id)
    store.write_share_token(share_token, user_id=user_id, card_id=card_id)

    return meta


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _resize_png(raw: bytes, target_size: tuple[int, int]) -> bytes:
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    resized = image.resize(target_size, Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format="PNG")
    return buf.getvalue()


async def stream_generation(user_id: str, card_id: str) -> AsyncIterator[str]:
    # Existence is checked by the route before this generator starts (a 404 raised
    # mid-stream can't produce a clean HTTP status — headers are already sent).
    meta_key = f"users/{user_id}/cards/{card_id}/meta.json"
    meta = store.get_json(meta_key)

    try:
        yield _sse("status", {"step": "generating", "pct": 10})

        generate_size, target_size = _CANVAS[meta["orientation"]]

        if meta["handwriting_style"].startswith("saved:"):
            sample_id = meta["handwriting_style"].removeprefix("saved:")
            sample_key = f"users/{user_id}/handwriting-samples/{sample_id}/sample.png"
            reference_image = await run_in_threadpool(store.get_object, sample_key)
            reference_content_type = await run_in_threadpool(store.content_type, sample_key) or "image/png"
            prompt = build_edit_prompt(
                card_type=meta["card_type"], orientation=meta["orientation"], message=meta["message"]
            )
            raw = await run_in_threadpool(
                pipelines.generate_image_edit,
                prompt,
                model=EDIT_MODEL,
                size=generate_size,
                reference_image=reference_image,
                reference_content_type=reference_content_type,
            )
        else:
            style_slug = meta["handwriting_style"].removeprefix("default:")
            prompt = build_generate_prompt(
                card_type=meta["card_type"],
                orientation=meta["orientation"],
                style_slug=style_slug,
                message=meta["message"],
            )
            raw = await run_in_threadpool(pipelines.generate_image, prompt, model=GENERATE_MODEL, size=generate_size)

        yield _sse("status", {"step": "generating", "pct": 60})

        png = await run_in_threadpool(_resize_png, raw, target_size)

        yield _sse("status", {"step": "storing", "pct": 80})

        writing_face_key = f"users/{user_id}/cards/{card_id}/writing-face.png"
        await run_in_threadpool(store.upload_file, writing_face_key, png, content_type="image/png")
        writing_face_url = store.presign_url(writing_face_key)

        meta["status"] = "complete"
        meta["writing_face_url"] = writing_face_url
        store.put_json(meta_key, meta)

        yield _sse("status", {"step": "storing", "pct": 100})
        yield _sse(
            "complete",
            {
                "writing_face_url": writing_face_url,
                "design_url": meta["design_url"],
                "share_url": f"/share/{meta['share_token']}",
            },
        )
    except Exception as exc:
        logger.error("card generation failed card_id=%s", card_id, exc_info=True)
        meta["status"] = "failed"
        store.put_json(meta_key, meta)
        yield _sse("error", {"message": str(exc)})
