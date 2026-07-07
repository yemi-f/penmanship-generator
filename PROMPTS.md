# PROMPTS.md — InkCard

Canonical prompts for all image generation calls. Do not modify prompts without updating this file. Prompts are consumed by `pipelines.py`.

---

## Model Routing

| Condition | Model | Reference image |
|-----------|-------|-----------------|
| `handwriting_style` starts with `"saved:"` | `gpt-image-2-edit` | Yes — `users/{user_id}/handwriting-samples/{sample_id}/sample.png` fetched from B2 |
| `handwriting_style` starts with `"default:"` | `gpt-image-2-generate` | No |

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
The inside right panel of an open greeting card. Plain white paper texture, soft natural lighting. 
Portrait orientation. The handwritten message begins near the top of the panel with a generous top margin 
and comfortable left and right margins, as if written naturally on the right page of an open card. 
No illustrations, no border, no decorative elements — plain writing paper only.
```

### Greeting card inside (landscape)

```
The inside right panel of an open greeting card. Plain white paper texture, soft natural lighting. 
Landscape orientation. The handwritten message begins near the top of the panel with a generous top margin 
and comfortable left and right margins, as if written naturally on the right page of an open card. 
No illustrations, no border, no decorative elements — plain writing paper only.
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

### `neat-print`

```
Precise, careful block print handwriting, written with a fine-tip pen. Letters are upright with no slant. 
Even, consistent letter sizing and spacing. Clean uniform strokes with no ink bleed. The writing looks 
deliberate and easy to read, like someone who takes pride in their penmanship.
```

### `bold-marker`

```
Bold expressive handwriting written with a wide felt-tip marker. Thick, confident strokes. Slightly 
uneven baseline — the writer is not being precious about perfect alignment. Letters are large and 
well-spaced. Ink is deep black. The writing has energy and presence, like a note left in a hurry 
but with confidence.
```

### `tiny-script`

```
Small, delicate handwriting written with a fine-tip pen or fine rollerball. Compact letter spacing 
and tight line spacing. Light, thin strokes. The letters are legible but small — as if the writer 
is being economical with space. The overall impression is careful, quiet, and intimate.
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

---

## Invariants (enforced in pipelines.py)

- `{message}` is always injected verbatim. Never paraphrase, summarise, or alter the user's message.
- The phrase `"word for word, with no additions or omissions"` must appear in every prompt, for both models.
- The surface fragment is always included. Never generate a writing face without specifying the surface.
- For `gpt-image-2-edit`: always pass the reference image. Never call edit without it.
- For `gpt-image-2-generate`: never pass a reference image. Prompt only.

---

## Swatch Preview Generation

Run once at deploy time to generate the five default style preview images stored in B2 at
`handwriting-samples/default/{style_slug}-preview.png`. These are display-only — never used in card generation.

Use `gpt-image-2-generate` with the following prompt structure per style:

```
Plain white background. {style_prompt}

Write the following text exactly as given:
"The quick brown fox jumps over the lazy dog"
```

Canvas: 800 × 300 px (landscape strip, suitable for a UI swatch).

---

## Card Design Generation (one-time)

The six card design images (`card-designs/{design_slug}.png`) are generated once and stored in B2 as 
public assets. They are never regenerated at runtime.

Use `gpt-image-2-generate` with the prompts below. Canvas: 1800 × 1200 px (postcard landscape).
For portrait greeting card variants, regenerate at 1200 × 1800 px.

### `minimal-white`

```
A clean, elegant postcard front. Pure white background. A single thin light grey rectangular border 
inset 40px from all edges. No text, no illustrations, no patterns. Minimalist and sophisticated.
```

### `kraft-paper`

```
A postcard front with a warm kraft paper texture. Natural brown recycled paper with visible fibres 
and subtle variation in tone. Slight vignette at the edges. No text, no illustrations. 
The paper should look tactile and authentic.
```

### `floral-watercolour`

```
A postcard front with a soft watercolour botanical border. Delicate flowers and leaves painted in 
muted pinks, greens, and creams frame all four edges, leaving a large clear centre area. 
Loose, impressionistic brushwork. No text. The centre is clean white for content.
```

### `vintage-stamp`

```
A postcard front with a vintage postage aesthetic. Cream background with a decorative engraved-style 
border in deep navy or burgundy. Small illustrated corner ornaments in the style of classic postage stamps. 
A faint aged paper texture. No text. Elegant and nostalgic.
```

### `bold-color`

```
A postcard front with a bold solid colour block. Deep teal background filling the entire card. 
A clean white margin of approximately 60px on all sides creates a frame. 
No illustrations, no patterns, no text. Striking and modern.
```

### `linen-texture`

```
A postcard front with a fine woven linen fabric texture. Off-white/ecru base with a subtle grid 
of fine threads visible across the surface. Soft and tactile in appearance. 
No illustrations, no border, no text. Understated and premium.
```

---

## Notes for pipelines.py

- Always strip leading/trailing whitespace from `{message}` before injection
- If `message` contains double quotes, escape them before injecting into the prompt string
- Log the full assembled prompt at DEBUG level before every API call
- On generation failure, log the full error response from GMICloud before raising
