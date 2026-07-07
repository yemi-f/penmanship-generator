#!/usr/bin/env python3
"""One-time deploy-time script: generates the five default handwriting-style
swatches and six card-design images, and uploads them to B2 as public assets.

Prompts are sourced from PROMPTS.md. Do not run this against production
assets casually — it overwrites the canonical public images.
"""

import io
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent / "services" / "api"
sys.path.insert(0, str(API_ROOT))

from PIL import Image  # noqa: E402

from app.repo import store  # noqa: E402
from app.repo.pipelines import generate_image  # noqa: E402
from app.types.catalog import CARD_DESIGNS, DEFAULT_STYLES  # noqa: E402

STYLE_PROMPTS = {
    "casual": (
        "Casual everyday print handwriting, written with a ballpoint pen. Slightly uneven letter sizing and "
        "baseline — some letters taller or shorter than others. Natural variation in spacing between words. "
        "Ink is a consistent dark blue or black. The writing looks relaxed and spontaneous, like a note "
        "dashed off quickly but still legible."
    ),
    "cursive": (
        "Elegant flowing cursive handwriting, written with a fountain pen. Letters are fully connected with "
        "smooth joining strokes. Consistent forward slant of approximately 10–15 degrees. Natural ink variation — "
        "slightly thicker on downstrokes, thinner on upstrokes. Even, measured baseline. The writing looks "
        "considered and graceful, like a personal letter written with care."
    ),
    "neat-print": (
        "Precise, careful block print handwriting, written with a fine-tip pen. Letters are upright with no slant. "
        "Even, consistent letter sizing and spacing. Clean uniform strokes with no ink bleed. The writing looks "
        "deliberate and easy to read, like someone who takes pride in their penmanship."
    ),
    "bold-marker": (
        "Bold expressive handwriting written with a wide felt-tip marker. Thick, confident strokes. Slightly "
        "uneven baseline — the writer is not being precious about perfect alignment. Letters are large and "
        "well-spaced. Ink is deep black. The writing has energy and presence, like a note left in a hurry "
        "but with confidence."
    ),
    "tiny-script": (
        "Small, delicate handwriting written with a fine-tip pen or fine rollerball. Compact letter spacing "
        "and tight line spacing. Light, thin strokes. The letters are legible but small — as if the writer "
        "is being economical with space. The overall impression is careful, quiet, and intimate."
    ),
}

DESIGN_PROMPTS = {
    "minimal-white": (
        "A clean, elegant postcard front. Pure white background. A single thin light grey rectangular border "
        "inset 40px from all edges. No text, no illustrations, no patterns. Minimalist and sophisticated."
    ),
    "kraft-paper": (
        "A postcard front with a warm kraft paper texture. Natural brown recycled paper with visible fibres "
        "and subtle variation in tone. Slight vignette at the edges. No text, no illustrations. "
        "The paper should look tactile and authentic."
    ),
    "floral-watercolour": (
        "A postcard front with a soft watercolour botanical border. Delicate flowers and leaves painted in "
        "muted pinks, greens, and creams frame all four edges, leaving a large clear centre area. "
        "Loose, impressionistic brushwork. No text. The centre is clean white for content."
    ),
    "vintage-stamp": (
        "A postcard front with a vintage postage aesthetic. Cream background with a decorative engraved-style "
        "border in deep navy or burgundy. Small illustrated corner ornaments in the style of classic postage "
        "stamps. A faint aged paper texture. No text. Elegant and nostalgic."
    ),
    "bold-color": (
        "A postcard front with a bold solid colour block. Deep teal background filling the entire card. "
        "A clean white margin of approximately 60px on all sides creates a frame. "
        "No illustrations, no patterns, no text. Striking and modern."
    ),
    "linen-texture": (
        "A postcard front with a fine woven linen fabric texture. Off-white/ecru base with a subtle grid "
        "of fine threads visible across the surface. Soft and tactile in appearance. "
        "No illustrations, no border, no text. Understated and premium."
    ),
}

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
    for slug, style_prompt in STYLE_PROMPTS.items():
        prompt = (
            f"Plain white background. {style_prompt}\n\n"
            'Write the following text exactly as given:\n'
            '"The quick brown fox jumps over the lazy dog"'
        )
        print(f"[swatch] generating {slug}...")
        raw = generate_image(prompt, model="gpt-image-2-generate", size=SWATCH_GENERATE_SIZE)
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
