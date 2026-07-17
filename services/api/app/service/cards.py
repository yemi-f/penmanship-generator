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
from app.service.prompts import build_design_prompt, build_edit_prompt, build_generate_prompt
from app.types.cards import CardCreateRequest, CardMeta, DesignPreviewCreateRequest
from app.types.catalog import DEFAULT_STYLES

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
    handwriting_label = _resolve_handwriting_label(user_id, req.handwriting_style)

    card_id = generate_nanoid(size=12)
    share_token = generate_nanoid(size=24)

    meta = CardMeta(
        card_id=card_id,
        user_id=user_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        card_type=req.card_type,
        orientation=req.orientation,
        design_description=req.design_description,
        design_url=None,
        handwriting_style=req.handwriting_style,
        handwriting_label=handwriting_label,
        message=req.message,
        status="pending",
        writing_face_url=None,
        share_token=share_token,
        design_preview_id=req.design_preview_id,
        recipient_name=req.recipient_name,
        sign_off=req.sign_off,
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


def _generate_design_face(card_type: str, orientation: str, description: str) -> bytes:
    generate_size, target_size = _CANVAS[orientation]
    prompt = build_design_prompt(card_type=card_type, orientation=orientation, description=description)
    raw = pipelines.generate_image(prompt, model=GENERATE_MODEL, size=generate_size)
    return _resize_png(raw, target_size)


def create_design_preview(user_id: str, req: DesignPreviewCreateRequest) -> tuple[str, str]:
    design_png = _generate_design_face(req.card_type, req.orientation, req.design_description)
    preview_id = generate_nanoid(size=12)
    preview_key = f"users/{user_id}/design-previews/{preview_id}.png"
    store.upload_file(preview_key, design_png, content_type="image/png")
    return preview_id, store.presign_url(preview_key)


async def _reuse_design_preview(user_id: str, meta: dict) -> bytes | None:
    preview_id = meta.get("design_preview_id")  # .get(), not [...] — cards predating this feature have no such key
    if not preview_id:
        return None

    preview_key = f"users/{user_id}/design-previews/{preview_id}.png"
    try:
        if not await run_in_threadpool(store.object_exists, preview_key):
            return None
        design_png = await run_in_threadpool(store.get_object, preview_key)
    except Exception:
        logger.warning("design preview reuse failed, generating live preview_id=%s", preview_id, exc_info=True)
        return None

    try:
        await run_in_threadpool(store.delete_object, preview_key)
    except Exception:
        logger.warning("design preview cleanup failed preview_id=%s", preview_id, exc_info=True)

    return design_png


async def _generate_writing_face(user_id: str, meta: dict, generate_size: str) -> bytes:
    # .get(), not [...] — cards predating this feature have no such keys
    recipient_name = meta.get("recipient_name")
    sign_off = meta.get("sign_off")

    if meta["handwriting_style"].startswith("saved:"):
        sample_id = meta["handwriting_style"].removeprefix("saved:")
        sample_key = f"users/{user_id}/handwriting-samples/{sample_id}/sample.png"
        reference_image_url = store.presign_url(sample_key)
        prompt = build_edit_prompt(
            card_type=meta["card_type"],
            orientation=meta["orientation"],
            message=meta["message"],
            recipient_name=recipient_name,
            sign_off=sign_off,
        )
        return await run_in_threadpool(
            pipelines.generate_image_edit,
            prompt,
            model=EDIT_MODEL,
            size=generate_size,
            reference_image_url=reference_image_url,
        )

    style_slug = meta["handwriting_style"].removeprefix("default:")
    prompt = build_generate_prompt(
        card_type=meta["card_type"],
        orientation=meta["orientation"],
        style_slug=style_slug,
        message=meta["message"],
        recipient_name=recipient_name,
        sign_off=sign_off,
    )
    return await run_in_threadpool(pipelines.generate_image, prompt, model=GENERATE_MODEL, size=generate_size)


async def stream_generation(user_id: str, card_id: str) -> AsyncIterator[str]:
    # Existence is checked by the route before this generator starts (a 404 raised
    # mid-stream can't produce a clean HTTP status — headers are already sent).
    meta_key = f"users/{user_id}/cards/{card_id}/meta.json"
    meta = store.get_json(meta_key)

    try:
        generate_size, target_size = _CANVAS[meta["orientation"]]

        yield _sse("status", {"step": "generating", "pct": 5})

        design_png = await _reuse_design_preview(user_id, meta)
        if design_png is None:
            design_png = await run_in_threadpool(
                _generate_design_face, meta["card_type"], meta["orientation"], meta["design_description"]
            )

        yield _sse("status", {"step": "generating", "pct": 35})

        writing_raw = await _generate_writing_face(user_id, meta, generate_size)

        yield _sse("status", {"step": "generating", "pct": 65})

        writing_png = await run_in_threadpool(_resize_png, writing_raw, target_size)

        yield _sse("status", {"step": "storing", "pct": 80})

        design_key = f"users/{user_id}/cards/{card_id}/design-face.png"
        writing_face_key = f"users/{user_id}/cards/{card_id}/writing-face.png"
        await run_in_threadpool(store.upload_file, design_key, design_png, content_type="image/png")
        await run_in_threadpool(store.upload_file, writing_face_key, writing_png, content_type="image/png")
        design_url = store.presign_url(design_key)
        writing_face_url = store.presign_url(writing_face_key)

        meta["status"] = "complete"
        meta["design_url"] = design_url
        meta["writing_face_url"] = writing_face_url
        store.put_json(meta_key, meta)

        yield _sse("status", {"step": "storing", "pct": 100})
        yield _sse(
            "complete",
            {
                "writing_face_url": writing_face_url,
                "design_url": design_url,
                "share_url": f"/share/{meta['share_token']}",
            },
        )
    except Exception as exc:
        logger.error("card generation failed card_id=%s", card_id, exc_info=True)
        meta["status"] = "failed"
        store.put_json(meta_key, meta)
        yield _sse("error", {"message": str(exc)})
