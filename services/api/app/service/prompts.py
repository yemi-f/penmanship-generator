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
    "bold-marker": (
        "Bold expressive handwriting written with a wide felt-tip marker. Thick, confident strokes. Slightly "
        "uneven baseline — the writer is not being precious about perfect alignment. Letters are large and "
        "well-spaced. Ink is deep black. The writing has energy and presence, like a note left in a hurry "
        "but with confidence."
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
        "A plain flat sheet of white writing paper, filling the canvas edge to edge, with no visible fold, "
        "crease, spine, binding, or page edge — just a single continuous flat surface. Soft natural lighting. "
        "Portrait orientation. The handwritten message begins near the top of the panel with a generous top "
        "margin and comfortable left and right margins. No illustrations, no border, no decorative elements — "
        "plain writing paper only."
    ),
    "greeting_card:landscape": (
        "A plain flat sheet of white writing paper, filling the canvas edge to edge, with no visible fold, "
        "crease, spine, binding, or page edge — just a single continuous flat surface. Soft natural lighting. "
        "Landscape orientation. The handwritten message begins near the top of the panel with a generous top "
        "margin and comfortable left and right margins. No illustrations, no border, no decorative elements — "
        "plain writing paper only."
    ),
}

DESIGN_SURFACE_FRAGMENTS = {
    "postcard": "A postcard front, filling the entire canvas edge to edge.",
    "greeting_card:portrait": (
        "The outside front cover of a greeting card, portrait orientation, filling the entire canvas edge to edge."
    ),
    "greeting_card:landscape": (
        "The outside front cover of a greeting card, landscape orientation, filling the entire canvas edge to edge."
    ),
}


def _escape(text: str) -> str:
    return text.strip().replace('"', '\\"')


def _full_message(message: str, sign_off: str | None) -> str:
    if not sign_off or not sign_off.strip():
        return message
    return f"{message.strip()}\n\n{sign_off.strip()}"


def _sign_off_guidance(card_type: str, sign_off: str | None) -> str:
    if not sign_off or not sign_off.strip():
        return ""
    guidance = (
        " The sign-off/closing line above should be written in the same handwriting style and ink as the "
        "rest of the message, not visually distinguished as a separate signature block."
    )
    if card_type == "greeting_card":
        guidance += (
            " Position the sign-off toward the right side of the panel, the way a signature naturally "
            "trails at the end of a handwritten letter."
        )
    return guidance


def _addressing_fragment(recipient_name: str | None) -> str:
    if not recipient_name or not recipient_name.strip():
        return ""
    return (
        f'\n\nIn the address-lines area on the right half, address the postcard to "{_escape(recipient_name)}". '
        "Invent a realistic-looking but entirely fictional US or Canadian mailing address for this recipient "
        "— a street address, then city and state/province and ZIP/postal code — and write it beneath the name "
        "across the three address lines. Do not use any real person's actual address."
    )


def surface_fragment(card_type: str, orientation: str) -> str:
    if card_type == "postcard":
        return SURFACE_FRAGMENTS["postcard"]
    return SURFACE_FRAGMENTS[f"greeting_card:{orientation}"]


def build_generate_prompt(
    *,
    card_type: str,
    orientation: str,
    style_slug: str,
    message: str,
    recipient_name: str | None = None,
    sign_off: str | None = None,
) -> str:
    """Prompt for gpt-image-2-generate (default styles, prompt only)."""
    return (
        f"{surface_fragment(card_type, orientation)}\n\n"
        f"Handwriting style: {STYLE_PROMPTS[style_slug]}\n\n"
        "Write the following text exactly as given, word for word, with no additions or omissions:\n"
        f'"{_escape(_full_message(message, sign_off))}"'
        f"{_sign_off_guidance(card_type, sign_off)}"
        f"{_addressing_fragment(recipient_name)}"
    )


def build_edit_prompt(
    *,
    card_type: str,
    orientation: str,
    message: str,
    recipient_name: str | None = None,
    sign_off: str | None = None,
) -> str:
    """Prompt for gpt-image-2-edit (saved samples, reference image supplied separately)."""
    return (
        f"{surface_fragment(card_type, orientation)}\n\n"
        "Replicate the handwriting style shown in the reference image as precisely as possible. "
        "Match the letter forms, slant, stroke weight, spacing, and any distinctive quirks of the "
        "reference handwriting. Do not blend in any other handwriting style.\n\n"
        "Write the following text exactly as given, word for word, with no additions or omissions:\n"
        f'"{_escape(_full_message(message, sign_off))}"'
        f"{_sign_off_guidance(card_type, sign_off)}"
        f"{_addressing_fragment(recipient_name)}"
    )


def design_surface_fragment(card_type: str, orientation: str) -> str:
    if card_type == "postcard":
        return DESIGN_SURFACE_FRAGMENTS["postcard"]
    return DESIGN_SURFACE_FRAGMENTS[f"greeting_card:{orientation}"]


def build_design_prompt(*, card_type: str, orientation: str, description: str) -> str:
    """Prompt for Image A (design), always gpt-image-2-generate, prompt only."""
    return f"{design_surface_fragment(card_type, orientation)}\n\n{description.strip()}"
