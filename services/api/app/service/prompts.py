"""Canonical prompt text, sourced from PROMPTS.md. See that file before editing."""

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

SURFACE_FRAGMENTS = {
    "postcard": (
        "A standard postcard back. Plain cream/off-white background. A thin vertical line divides the card in half. "
        "On the right half: three evenly spaced horizontal lines for the address, a small rectangular stamp box "
        "outline in the top-right corner, and a faint circular postmark stamp overlapping the stamp box. "
        "The left half is reserved for a handwritten message with generous top and left margins. "
        "No illustrations, no artwork, no decorative elements other than the postcard layout described."
    ),
    "greeting_card:portrait": (
        "The inside right panel of an open greeting card. Plain white paper texture, soft natural lighting. "
        "Portrait orientation. The handwritten message begins near the top of the panel with a generous top margin "
        "and comfortable left and right margins, as if written naturally on the right page of an open card. "
        "No illustrations, no border, no decorative elements — plain writing paper only."
    ),
    "greeting_card:landscape": (
        "The inside right panel of an open greeting card. Plain white paper texture, soft natural lighting. "
        "Landscape orientation. The handwritten message begins near the top of the panel with a generous top margin "
        "and comfortable left and right margins, as if written naturally on the right page of an open card. "
        "No illustrations, no border, no decorative elements — plain writing paper only."
    ),
}


def _clean_message(message: str) -> str:
    return message.strip().replace('"', '\\"')


def surface_fragment(card_type: str, orientation: str) -> str:
    if card_type == "postcard":
        return SURFACE_FRAGMENTS["postcard"]
    return SURFACE_FRAGMENTS[f"greeting_card:{orientation}"]


def build_generate_prompt(*, card_type: str, orientation: str, style_slug: str, message: str) -> str:
    """Prompt for gpt-image-2-generate (default styles, prompt only)."""
    return (
        f"{surface_fragment(card_type, orientation)}\n\n"
        f"Handwriting style: {STYLE_PROMPTS[style_slug]}\n\n"
        "Write the following text exactly as given, word for word, with no additions or omissions:\n"
        f'"{_clean_message(message)}"'
    )


def build_edit_prompt(*, card_type: str, orientation: str, message: str) -> str:
    """Prompt for gpt-image-2-edit (saved samples, reference image supplied separately)."""
    return (
        f"{surface_fragment(card_type, orientation)}\n\n"
        "Replicate the handwriting style shown in the reference image as precisely as possible. "
        "Match the letter forms, slant, stroke weight, spacing, and any distinctive quirks of the "
        "reference handwriting. Do not blend in any other handwriting style.\n\n"
        "Write the following text exactly as given, word for word, with no additions or omissions:\n"
        f'"{_clean_message(message)}"'
    )


def build_swatch_prompt(style_slug: str) -> str:
    return (
        f"Plain white background. {STYLE_PROMPTS[style_slug]}\n\n"
        'Write the following text exactly as given:\n'
        '"The quick brown fox jumps over the lazy dog"'
    )
