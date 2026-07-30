# PROMPTS.md — Penmanship

Canonical prompts for all image generation calls. Do not modify prompts without updating this file. Prompts are consumed by `pipelines.py`.

---

## Model Routing

| Condition | Model | Reference image |
|-----------|-------|-----------------|
| `handwriting_style` starts with `"saved:"` (Image B) | `gpt-image-2-edit` | Yes — presigned URL to `users/{user_id}/handwriting-samples/{sample_id}/sample.png`, passed via the `image` param. Never inline base64 — see Invariants below. |
| `handwriting_style` starts with `"default:"` (Image B) | `gpt-image-2-generate` | No |
| Image A (design), always | `gpt-image-2-generate` | No — there is no reference-image concept for designs |

---

## Surface Prompt Fragments

These fragments describe the physical surface the handwriting appears on. They are combined with the style prompt and the message to form the full generation prompt. Select the correct fragment based on `card_type`.

### Postcard back

```
A standard postcard back. Plain cream/off-white background. A thin vertical line divides the card in half. 
On the right half: three evenly spaced horizontal lines for the address, a small rectangular stamp box 
outline in the top-right corner, and a faint circular postmark stamp overlapping the stamp box. 
The left half is reserved for a handwritten message with generous top and left margins. 
No illustrations, no artwork, no decorative elements other than the postcard layout described.
```

### Greeting card inside (portrait)

```
A plain flat sheet of white writing paper, filling the canvas edge to edge, with no visible fold, 
crease, spine, binding, or page edge — just a single continuous flat surface. Soft natural lighting. 
Portrait orientation. The handwritten message begins near the top of the panel with a generous top 
margin and comfortable left and right margins. No illustrations, no border, no decorative elements — 
plain writing paper only.
```

### Greeting card inside (landscape)

```
A plain flat sheet of white writing paper, filling the canvas edge to edge, with no visible fold, 
crease, spine, binding, or page edge — just a single continuous flat surface. Soft natural lighting. 
Landscape orientation. The handwritten message begins near the top of the panel with a generous top 
margin and comfortable left and right margins. No illustrations, no border, no decorative elements — 
plain writing paper only.
```

---

## Default Style Prompts

Used with `gpt-image-2-generate` only. No reference image is passed.

Each prompt is combined with a surface fragment and the message. The full prompt structure is:

```
{surface_fragment}

Handwriting style: {style_prompt}

Write the following text exactly as given, word for word, with no additions or omissions:
"{message}"
```

### Sign-off and addressing additions

Two optional fields extend the base prompt above: `sign_off` (both card types — required for postcards, optional for greeting cards) and `recipient_name` (postcard only, required). When present, the prompt structure becomes:

```
{surface_fragment}

Handwriting style: {style_prompt}

Write the following text exactly as given, word for word, with no additions or omissions:
"{message}

{sign_off}" The sign-off/closing line above should be written in the same handwriting style and
ink as the rest of the message, not visually distinguished as a separate signature block.[
Greeting cards only: Position the sign-off toward the right side of the panel, the way a
signature naturally trails at the end of a handwritten letter.]

In the address-lines area on the right half, address the postcard to "{recipient_name}". Invent a
realistic-looking but entirely fictional US or Canadian mailing address for this recipient — a
street address, then city and state/province and ZIP/postal code — and write it beneath the name
across the three address lines. Do not use any real person's actual address.
```

The `{sign_off}` paragraph appears whenever `sign_off` is provided, for either card type. The right-alignment sentence (bracketed above) is appended only when `card_type == "greeting_card"` — postcards keep the plain style-only guidance, since the postcard's message column is the narrower left half of a landscape card and a right-aligned closing there would likely look cramped. The `{recipient_name}`/addressing paragraph only ever appears for postcards — greeting cards have no address-lines area, and the frontend never collects a recipient name for them. When a field is absent, its paragraph is omitted entirely and the rest of the prompt is unaffected.

### `casual`

```
Casual everyday print handwriting, written with a ballpoint pen. Slightly uneven letter sizing and 
baseline — some letters taller or shorter than others. Natural variation in spacing between words. 
Ink is a consistent dark blue or black. The writing looks relaxed and spontaneous, like a note 
dashed off quickly but still legible.
```

### `cursive`

```
Elegant flowing cursive handwriting, written with a fountain pen. Letters are fully connected with 
smooth joining strokes. Consistent forward slant of approximately 10–15 degrees. Natural ink variation — 
slightly thicker on downstrokes, thinner on upstrokes. Even, measured baseline. The writing looks 
considered and graceful, like a personal letter written with care.
```

### `bold-marker`

```
Bold expressive handwriting written with a wide felt-tip marker. Thick, confident strokes. Slightly 
uneven baseline — the writer is not being precious about perfect alignment. Letters are large and 
well-spaced. Ink is deep black. The writing has energy and presence, like a note left in a hurry 
but with confidence.
```

---

## Custom Sample Prompt (gpt-image-2-edit)

Used when `handwriting_style` starts with `"saved:"`. The reference image (the user's handwriting sample) is passed to the model alongside this prompt.

```
{surface_fragment}

Replicate the handwriting style shown in the reference image as precisely as possible. 
Match the letter forms, slant, stroke weight, spacing, and any distinctive quirks of the 
reference handwriting. Do not blend in any other handwriting style.

Write the following text exactly as given, word for word, with no additions or omissions:
"{message}"
```

Same postcard-only sign-off and addressing additions described above apply here too — `build_edit_prompt` takes the identical `recipient_name`/`sign_off` parameters as `build_generate_prompt`.

---

## Invariants (enforced in pipelines.py)

- `{message}` is always injected verbatim. Never paraphrase, summarise, or alter the user's message.
- The phrase `"word for word, with no additions or omissions"` must appear in every prompt, for both models.
- The surface fragment is always included. Never generate a writing face without specifying the surface.
- For `gpt-image-2-edit`: always pass the reference image. Never call edit without it.
- For `gpt-image-2-generate`: never pass a reference image. Prompt only.
- Reference images for `gpt-image-2-edit` are passed as a presigned URL string in the `image` param — never as inline base64/bytes. `step.params` is hashed and persisted into manifests, and `genblaze_core` scans it for credential-shaped strings; a base64 image blob is long and high-entropy enough to coincidentally match one of those patterns (observed in practice: it matched the Backblaze application-key pattern).
- `{design_description}` is injected verbatim (stripped, not quote-escaped) for Image A — it isn't wrapped in quotes like `{message}` is, so no need to escape embedded quotes.
- `{recipient_name}` (postcard only) is injected verbatim (quote-escaped, same as `{message}`), but only inside the separate addressing paragraph: `address the postcard to "{recipient_name}"`. It is never part of the `{message}` "word for word" quoted block.
- `{sign_off}` (postcard only) is injected verbatim, joined into the same quoted `"..."` block as `{message}` (separated by a blank line) — both are covered by the one "word for word" instruction. A guidance sentence noting the sign-off should be written in the same style/ink is appended *outside* the quotes — it's an instruction to the model, not literal text to render.
- The postcard address itself is the one deliberate exception to "always verbatim": it is never supplied by the user and never computed server-side — the prompt instructs the model to invent a realistic-looking fictional US/Canada address, so that part of the prompt is intentionally *not* a "word for word" quoted block.
- `recipient_name` is only ever non-null for `card_type == "postcard"` (the frontend never collects it for greeting cards), so the addressing prompt addition is a no-op for greeting cards. `sign_off` is required (non-null, enforced by a request-time validator) for postcards but optional for both card types otherwise — greeting cards may or may not have one, and the sign-off prompt addition applies to either card type whenever it's present.
- The right-alignment sentence within the sign-off guidance is `card_type`-conditional (`_sign_off_guidance(card_type, sign_off)` in `prompts.py`), not a separate field — greeting cards get it, postcards don't.

---

## Swatch Preview Generation

**Changed from the original spec.** The five default style preview swatches were originally
generated once via `gpt-image-2-generate` at deploy time and uploaded to B2 as public objects
(`handwriting-samples/default/{style_slug}-preview.png`). Since these images never change, routing
them through a paid third-party generation call — and the resulting quality (particularly `cursive`
and `neat-print` not reading as genuinely handwritten) — wasn't worth it for a fixed asset. They are
now real static images committed directly into the repo at
`apps/web/public/handwriting-samples/{style_slug}-preview.png` and served by Next.js, not generated
or B2-backed at all. These are still display-only — never used in card generation. The five original
B2 objects are still sitting in B2, unreferenced by any code; they were not deleted, just abandoned,
same as the six stock design images below.

Canvas: 800 × 300 px (landscape strip, suitable for a UI swatch).

---

## Design Image (Image A) Generation — per card, at request time

**Changed from the original spec.** Image A was originally six pre-generated stock designs
(`card-designs/{design_slug}.png`), picked from a preset catalog and never regenerated. It is now
generated per card from a user-supplied `design_description`, the same way Image B is generated
from the handwriting style — see `app/service/prompts.py::build_design_prompt`. The six stock
images are still sitting in B2, unreferenced by any code; they were not deleted, just abandoned.

Always `gpt-image-2-generate`, prompt-only — there is no reference-image / "saved" concept for
designs. Canvas: 1800 × 1200 px for postcards and landscape greeting cards, 1200 × 1800 px for
portrait greeting cards (same generate-then-resize handling as Image B, since gpt-image-2 can't
generate those exact dimensions directly).

Surface fragment selected by `card_type`/`orientation`, same pattern as the handwriting surface
fragments above:

### Postcard front

```
A postcard front, filling the entire canvas edge to edge.
```

### Greeting card outside cover (portrait)

```
The outside front cover of a greeting card, portrait orientation, filling the entire canvas edge to edge.
```

### Greeting card outside cover (landscape)

```
The outside front cover of a greeting card, landscape orientation, filling the entire canvas edge to edge.
```

Full prompt structure:

```
{design_surface_fragment}

{design_description}
```

`design_description` is the user's free text, injected verbatim (stripped of leading/trailing
whitespace) — no quote-wrapping, no "word for word" constraint (that constraint is specific to
rendering the handwritten message exactly; the design is an open-ended illustration prompt).

---

## Notes for pipelines.py

- Always strip leading/trailing whitespace from `{message}` before injection
- If `message` contains double quotes, escape them before injecting into the prompt string
- Log the full assembled prompt at DEBUG level before every API call
- On generation failure, log the full error response from GMICloud before raising
