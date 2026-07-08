#!/usr/bin/env python3
"""One-time deploy-time script: generates the five default handwriting-style
swatches and six card-design images, and uploads them to B2 as public assets.

Prompts are sourced from PROMPTS.md (via app.service.prompts). Do not run
this against production assets casually — it overwrites the canonical
public images.
"""

import io
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent / "services" / "api"
sys.path.insert(0, str(API_ROOT))

from PIL import Image  # noqa: E402

from app.repo import store  # noqa: E402
from app.repo.pipelines import generate_image  # noqa: E402
from app.service.prompts import DESIGN_PROMPTS, STYLE_PROMPTS, build_swatch_prompt  # noqa: E402
from app.types.catalog import CARD_DESIGNS, DEFAULT_STYLES  # noqa: E402

# Generation sizes must be multiples of 16 and >= 655360 total px (gpt-image-2
# constraints). Target canvas sizes (800x300, 1800x1200) don't satisfy that,
# so we generate at the nearest compliant size and resize down to spec.
SWATCH_GENERATE_SIZE = "1360x512"
SWATCH_TARGET_SIZE = (800, 300)

DESIGN_GENERATE_SIZE = "1808x1200"
DESIGN_TARGET_SIZE = (1800, 1200)


def _resize_png(raw: bytes, target_size: tuple[int, int]) -> bytes:
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    resized = image.resize(target_size, Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format="PNG")
    return buf.getvalue()


def generate_swatches() -> None:
    assert set(STYLE_PROMPTS) == {s["slug"] for s in DEFAULT_STYLES}, "STYLE_PROMPTS out of sync with catalog"
    for slug in STYLE_PROMPTS:
        print(f"[swatch] generating {slug}...")
        raw = generate_image(build_swatch_prompt(slug), model="gpt-image-2-generate", size=SWATCH_GENERATE_SIZE)
        png = _resize_png(raw, SWATCH_TARGET_SIZE)
        key = f"handwriting-samples/default/{slug}-preview.png"
        store.upload_file(key, png, content_type="image/png")
        print(f"[swatch] uploaded {key} ({len(png)} bytes)")


def generate_designs() -> None:
    assert set(DESIGN_PROMPTS) == {d["slug"] for d in CARD_DESIGNS}, "DESIGN_PROMPTS out of sync with catalog"
    for slug, prompt in DESIGN_PROMPTS.items():
        print(f"[design] generating {slug}...")
        raw = generate_image(prompt, model="gpt-image-2-generate", size=DESIGN_GENERATE_SIZE)
        png = _resize_png(raw, DESIGN_TARGET_SIZE)
        key = f"card-designs/{slug}.png"
        store.upload_file(key, png, content_type="image/png")
        print(f"[design] uploaded {key} ({len(png)} bytes)")


if __name__ == "__main__":
    generate_swatches()
    generate_designs()
    print("Done.")
