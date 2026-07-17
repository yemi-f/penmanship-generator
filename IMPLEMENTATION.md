# Handwritten Card Generator — Implementation Document

> Implementation guide for an LLM coding agent. Follow sections in order. Complete all acceptance criteria before moving to the next phase.

---

## 0. What We Are Building

**Penmanship** — a web app where signed-in users generate personalized greeting cards and postcards with text rendered in a real human's handwriting. Users manage a library of saved handwriting samples, create cards using any saved sample, preview results in a 3D viewer, and share cards via a private link. Cards and handwriting samples are private to the user who created them; the share link gives the recipient read-only access to one card.

The pipeline follows the pattern established in [`backblaze-labs/genblaze-gmicloud-pipeline`](https://github.com/backblaze-labs/genblaze-gmicloud-pipeline):

- **Frontend:** Next.js 16 + React 19 + Tailwind + shadcn/ui
- **Auth:** NextAuth.js v5 with Google provider, JWT sessions (no database session store)
- **Backend:** FastAPI + Pydantic v2 + Genblaze Core
- **Image generation:** GMICloud via `genblaze-gmicloud` (`gpt-image-2-edit` for custom handwriting samples, `gpt-image-2-generate` for default styles)
- **Storage:** Backblaze B2 via `genblaze-s3`
- **Streaming:** Server-Sent Events from backend to browser
- **No database:** Backblaze B2 is the sole source of truth for all persistent state

---

## 1. Card Structure & Dimensions

### Critical rule

**The handwriting is never placed on top of a design image.** The design image is always a separate face from the writing surface. The writing surface is always plain (white, cream, or linen).

### Postcard

| Face | Content |
|------|---------|
| Front | Design image (illustration, artwork) |
| Back | Handwritten message (left half) + stamp box / address lines (right half) on a plain surface |

Orientation: **landscape only** (3:2). No orientation toggle.

Canvas: **1800 × 1200 px** per face.

### Greeting Card

| Face | Content |
|------|---------|
| Outside front | Design image (book cover) |
| Outside back | Plain, blank |
| Inside left | Blank |
| Inside right | Handwritten message on plain white/cream paper |

Orientation: **portrait or landscape** (user selects). Portrait default.

Canvas: **1200 × 1800 px** (portrait) or **1800 × 1200 px** (landscape) per panel.

---

## 2. Generation Targets

Two output images per card — only Image B is generated:

| | Postcard | Greeting Card |
|-|----------|---------------|
| **Image A** | Design template from B2 (not generated) | Design template from B2 (not generated) |
| **Image B** | Back face: plain background + postcard layout + handwriting (generated) | Inside right panel: plain background + handwriting (generated) |

---

## 3. Authentication

### Provider

Google Sign-In via NextAuth.js v5. JWT sessions — no database session store required. The JWT contains `{ sub, email, name, picture }`. `sub` is the canonical user ID used as the B2 path prefix for all user-owned assets.

### Session flow

- Unauthenticated users land on `/` (marketing/landing page) with a Sign in with Google button
- After sign-in, redirect to `/dashboard`
- All `/dashboard/*`, `/create`, `/card/*` routes require a valid session; unauthenticated requests redirect to `/`
- Share links (`/share/[card_id]`) are **public** — no session required for recipients

### JWT → FastAPI

The Next.js frontend passes the NextAuth JWT as a `Bearer` token on every API request to FastAPI. FastAPI verifies the token using the `NEXTAUTH_SECRET` shared between the two services. The `sub` claim is extracted and used as `user_id` for all B2 path operations.

FastAPI dependency:
```python
async def current_user(token: str = Depends(oauth2_scheme)) -> str:
    payload = jwt.decode(token, settings.nextauth_secret, algorithms=["HS256"])
    return payload["sub"]  # user_id
```

---

## 4. B2 Object Layout

B2 is the only data store. No SQLite, no Redis, no other database.

```
# Shared assets (read-only at runtime, uploaded once at deploy)
handwriting-samples/
  default/
    {style_slug}.png

card-designs/
  {design_slug}.png

# Per-user assets (private to each user)
users/
  {user_id}/
    profile.json
    handwriting-samples/
      index.json                        # Ordered list of sample_ids
      {sample_id}/
        meta.json
        sample.png
    cards/
      index.json                        # Ordered list of card_ids, newest first
      {card_id}/
        meta.json
        writing-face.png
```

### `profile.json`

```json
{
  "user_id": "string (Google sub)",
  "email": "string",
  "name": "string",
  "picture": "string (Google avatar URL)",
  "created_at": "ISO 8601 UTC"
}
```

Written on first sign-in if it does not already exist. Never overwritten after creation (profile updates are out of scope for MVP).

### Handwriting sample `meta.json`

```json
{
  "sample_id": "string (nanoid, 12 chars)",
  "user_id": "string",
  "created_at": "ISO 8601 UTC",
  "label": "string (user-provided name, e.g. 'My casual handwriting')",
  "sample_url": "string (B2 presigned URL, regenerated on read)"
}
```

### Handwriting sample `index.json`

```json
["sample_id_1", "sample_id_2", ...]
```

Ordered newest-first. No cap — users can have as many samples as they want.

### Card `meta.json`

```json
{
  "card_id": "string (nanoid, 12 chars)",
  "user_id": "string",
  "created_at": "ISO 8601 UTC",
  "card_type": "postcard | greeting_card",
  "orientation": "landscape | portrait",
  "design_slug": "string",
  "design_url": "string (B2 public URL)",
  "handwriting_style": "default:{slug} | saved:{sample_id}",
  "handwriting_label": "string (display name of the style used)",
  "message": "string (max 500 chars)",
  "status": "pending | complete | failed",
  "writing_face_url": "string (B2 presigned URL, null until complete)",
  "share_token": "string (random 24-char token for share link)"
}
```

### Card `index.json`

```json
["card_id_1", "card_id_2", ...]
```

Ordered newest-first. No cap.

---

## 5. Privacy Model

All user assets (handwriting samples, cards, writing faces) live under `users/{user_id}/` in B2. These objects are served via **presigned URLs** with a 1-hour TTL — they are never publicly accessible by direct URL.

The design images (`card-designs/`) and default style preview images (`handwriting-samples/default/*-preview.png`) are public B2 objects.

### Share links

Each card has a `share_token` (random 24-char string generated at card creation). The share page at `/share/[share_token]` is publicly accessible — no sign-in required for the recipient. The backend resolves the share token to a card by scanning the user's card index (or via a separate token→card_id lookup object in B2; see Phase 2).

The share page displays only the 3D viewer and download controls. It does not expose the user's identity or other cards.

---

## 6. Default Handwriting Styles

Five built-in styles. Each style is described entirely by a text prompt — no reference image is used or stored. Generation uses `gpt-image-2-generate`.

| Slug | Description | Generation prompt summary |
|------|-------------|--------------------------|
| `casual` | Relaxed everyday print | Casual, slightly uneven print handwriting, ballpoint pen on white paper, natural variation in letter size and spacing |
| `cursive` | Flowing connected cursive | Elegant connected cursive, fountain pen, consistent slant, smooth strokes with natural ink variation |
| `neat-print` | Careful block lettering | Precise, evenly spaced block print, fine-tip pen, upright letters, clean and legible |
| `bold-marker` | Wide-tip marker strokes | Bold, expressive handwriting, wide felt-tip marker, thick strokes, slightly uneven baseline |
| `tiny-script` | Small, delicate script | Small, delicate handwriting, fine-tip pen, compact letter spacing, light strokes |

Full prompts for each slug are defined in `PROMPTS.md`.

### Swatch images

Each default style has a **pre-generated example image** stored in B2 at `handwriting-samples/default/{style_slug}-preview.png`. These are generated once at deploy time and stored as public B2 objects. They are displayed in the UI as style swatches — they are never passed to the model at card generation time.

In the creation flow, defaults appear alongside the user's saved samples in a unified picker. Defaults are always available and never counted against the user.

---

## 7. Default Card Designs

Six built-in designs stored at `card-designs/` as public B2 objects.

| Slug | Description |
|------|-------------|
| `minimal-white` | Clean white with thin border |
| `kraft-paper` | Warm recycled-paper texture |
| `floral-watercolour` | Soft botanical watercolour border |
| `vintage-stamp` | Old postage aesthetic with corner stamps |
| `bold-color` | Solid deep colour block with white margins |
| `linen-texture` | Fine woven fabric texture |

---

## 8. Generation Pipeline

### Step 1 — Prepare

- Verify session; extract `user_id`.
- Resolve handwriting sample: if `saved:{sample_id}`, fetch `users/{user_id}/handwriting-samples/{sample_id}/sample.png` from B2. If `default:{slug}`, fetch `handwriting-samples/default/{slug}.png`.
- Generate `card_id` and `share_token`.
- Write initial `meta.json` with `status: "pending"`.
- Prepend `card_id` to `users/{user_id}/cards/index.json`.

### Step 2 — Generate writing face

Model routing is determined by `handwriting_style`:

```python
if handwriting_style.startswith("saved:"):
    # User has a custom reference image
    # Fetch sample.png from B2, pass as reference image
    # Use gpt-image-2-edit
else:
    # Default style — no reference image, prompt only
    # Use gpt-image-2-generate with the style prompt from PROMPTS.md
```

In both cases, the base prompt describes the target surface (postcard back layout or greeting card inside panel) and the user's message. The style is either injected via reference image (edit) or via prompt description (generate).

**Postcard back:** Plain cream background, postcard back layout (vertical dividing line, address lines right, stamp box top-right, light postmark), handwritten message in left half.

**Greeting card inside:** Plain white/cream background, handwritten message centred in panel with generous margins.

### Step 3 — Store & finalize

- Upload `writing-face.png` to `users/{user_id}/cards/{card_id}/writing-face.png`.
- Update `meta.json`: `status: "complete"`, `writing_face_url` (presigned, 1hr TTL).

---

## 9. Layer Invariant

- `genblaze_*` imports: **only** in `pipelines.py`
- `boto3` / `botocore`: **never** imported directly
- `S3StorageBackend` / `backend()`: **only** in `store.py`

Enforced by `scripts/check_structure.py` via `pnpm check:structure`. Build fails on violation.

---

## 10. API Endpoints

All endpoints except `/health` and `GET /api/share/[share_token]` require a valid Bearer JWT.

### Handwriting samples

**`POST /api/samples`** — Upload a new handwriting sample.

Request: `multipart/form-data` with `file` (PNG/JPEG) and `label` (string).

Response: `{ "sample_id": "string", "sample_url": "string" }`

**`GET /api/samples`** — List user's saved samples + defaults.

Response:
```json
{
  "defaults": [ { "slug": "...", "label": "...", "preview_url": "..." } ],
  "saved": [ { "sample_id": "...", "label": "...", "sample_url": "...", "created_at": "..." } ]
}
```

**`DELETE /api/samples/{sample_id}`** — Delete a saved sample and its B2 objects. Owner only. No restrictions — existing cards are unaffected since the writing face is already generated and stored.

### Cards

**`POST /api/cards`**

```json
{
  "card_type": "postcard | greeting_card",
  "orientation": "landscape | portrait",
  "design_slug": "string",
  "handwriting_style": "default:{slug} | saved:{sample_id}",
  "message": "string (max 500 chars)"
}
```

Response: `{ "card_id": "string", "share_token": "string" }`

**`GET /api/cards/{card_id}/stream`** — SSE generation progress.

```
event: status
data: {"step": "generating | storing", "pct": 0–100}

event: complete
data: {"writing_face_url": "...", "design_url": "...", "share_url": "/share/{share_token}"}

event: error
data: {"message": "..."}
```

**`GET /api/cards`** — User's card history, newest first.

Query params: `limit` (default 20, max 100), `offset`.

Response: `{ "cards": [ {...meta.json} ], "total": n }`

**`GET /api/cards/{card_id}`** — Single card meta. Owner only.

**`DELETE /api/cards/{card_id}`** — Delete card and its B2 objects. Owner only.

### Share (public, no auth)

**`GET /api/share/{share_token}`** — Resolve share token to card data.

Response: `{ "card_type": "...", "orientation": "...", "design_url": "...", "writing_face_url": "...", "created_at": "..." }`

`writing_face_url` and `design_url` are fresh presigned URLs (1hr TTL), generated at request time.

### Other

**`GET /api/designs`** — List card designs with public B2 URLs.

**`GET /health`** — B2 connectivity.

---

## 11. Frontend Routes

| Route | Auth required | Description |
|-------|--------------|-------------|
| `/` | No | Landing page with Sign in with Google |
| `/dashboard` | Yes | Card history + handwriting sample library |
| `/create` | Yes | Multi-step card creation flow |
| `/card/[card_id]` | Yes | Owner view: 3D viewer + manage |
| `/share/[share_token]` | No | Recipient view: 3D viewer + download |

---

## 12. Dashboard (`/dashboard`)

Two sections, tab-switched or stacked:

### My Cards

- Grid of card thumbnails (design image as thumbnail, fetched via presigned URL)
- Each card shows: design thumbnail, card type, date created, a copy-share-link button
- Click → `/card/[card_id]`
- Delete button per card (confirm modal)
- Paginated: 20 per page

### My Handwriting Samples

- List of saved samples: label, upload date, preview of the sample image
- Upload new sample button → label input + file upload (PNG/JPEG, max 5MB)
- Delete button per sample (confirm modal)

---

## 13. Creation Flow (`/create`)

Single page, step-based, no page reloads.

### Step 1 — Card type & orientation

- Toggle: **Postcard** / **Greeting Card**
- Postcard: always landscape, no toggle
- Greeting Card: **Portrait** / **Landscape** toggle

### Step 2 — Handwriting style

Unified picker showing:
- Section: **Default styles** — five swatches with labels
- Section: **My samples** — user's saved samples with labels and preview images
- **Upload new sample** inline option: file picker + label input, uploads via `POST /api/samples`, adds to "My samples" immediately

### Step 3 — Card design

Grid of design previews (public B2 URLs). Correct aspect ratio shown per selection.

### Step 4 — Message

Textarea, max 500 chars, character counter.

### Step 5 — Generate & preview

- `POST /api/cards` → SSE stream
- Progress: "Rendering handwriting…" → "Saving…"
- On complete: transition to 3D viewer inline

---

## 14. 3D Card Viewer

`@react-three/fiber` + `@react-three/drei`. Two components.

### `PostcardViewer`

Flat rectangular mesh (3:2 landscape), two faces:
- Front: design image texture
- Back: writing face texture

**Flip** button (or drag past 90°) toggles faces. Slow auto-rotate on load, stops on interaction. OrbitControls, touch supported.

### `GreetingCardViewer`

Open-book: two panels at ~150° apart, shared centre spine.
- Right panel: writing face texture
- Left panel: plain white

**Close/Open** toggle:
- Closed: single panel, outside front = design image
- Open: book shape, inside right = writing face

OrbitControls in both states.

### Controls

**Owner view** (`/card/[card_id]`):
- Download writing face PNG
- Download design PNG
- Copy share link
- Delete card

**Recipient view** (`/share/[share_token]`):
- Download writing face PNG
- Download design PNG
- "Make your own" → `/`

---

## 15. Environment Variables

```
# B2
B2_ENDPOINT=https://s3.<region>.backblazeb2.com
B2_REGION=<region>
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=

# GMICloud
GMI_API_KEY=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`NEXTAUTH_SECRET` is shared between Next.js and FastAPI for JWT verification.

---

## 16. Project Layout

```
penmanship/
├── apps/web/
│   └── src/
│       ├── app/
│       │   ├── page.tsx                        # Landing
│       │   ├── dashboard/page.tsx              # Dashboard
│       │   ├── create/page.tsx                 # Creation flow
│       │   ├── card/[card_id]/page.tsx         # Owner view
│       │   └── share/[share_token]/page.tsx    # Recipient view
│       ├── components/
│       │   ├── CardViewer3D/
│       │   │   ├── PostcardViewer.tsx
│       │   │   └── GreetingCardViewer.tsx
│       │   ├── CreateFlow/
│       │   ├── Dashboard/
│       │   │   ├── CardGrid.tsx
│       │   │   └── SampleLibrary.tsx
│       │   └── ui/
│       ├── lib/
│       │   ├── api.ts
│       │   ├── auth.ts                         # NextAuth config
│       │   └── types.ts
│       └── middleware.ts                        # Route protection
├── services/api/
│   └── app/
│       ├── repo/
│       │   ├── pipelines.py                    # ALL genblaze_* imports here only
│       │   └── store.py                        # ALL S3StorageBackend calls here only
│       ├── runtime/
│       │   └── routes.py
│       ├── types/
│       │   └── cards.py
│       └── config/
│           └── settings.py
├── scripts/
│   └── check_structure.py
├── .env.example
├── CLAUDE.md
├── AGENTS.md
├── pnpm-workspace.yaml
└── package.json
```

---

## 17. Build Phases

Run `pnpm check:structure` after every phase.

### Phase 1 — Scaffold & config

- Monorepo layout, `pnpm-workspace.yaml`, root `package.json`
- FastAPI with pydantic-settings, `.env` loading, `/health`
- Next.js with Tailwind, shadcn/ui
- `scripts/check_structure.py` + `pnpm check:structure`

**Acceptance:** `pnpm dev` runs both services. `/health` returns `{"b2_connected": true}`. Structure check passes.

### Phase 2 — B2 store layer

- `store.py`: `upload_file`, `get_object`, `put_json`, `get_json`, `delete_object`, `presign_url`
- Index helpers: read/prepend/write for both `cards/index.json` and `handwriting-samples/index.json`
- Share token lookup: `share-tokens/{share_token}.json` → `{ user_id, card_id }` written at card creation, read at share resolution
- pytest tests against B2

**Acceptance:** All store tests pass. No boto3 imports outside `store.py`.

### Phase 3 — Auth

- NextAuth.js v5 with Google provider, JWT sessions
- `middleware.ts` protecting `/dashboard`, `/create`, `/card/[card_id]`
- `/share/[share_token]` explicitly public
- FastAPI JWT verification dependency using `NEXTAUTH_SECRET`
- `profile.json` written to B2 on first sign-in
- Landing page at `/` with Sign in with Google

**Acceptance:** Sign-in flow works end-to-end. Protected routes redirect to `/` when unauthenticated. FastAPI rejects requests with invalid tokens. `profile.json` written to B2 on first sign-in.

### Phase 4 — Static assets in B2

- Upload five default handwriting samples to `handwriting-samples/default/`
- Upload six card design images to `card-designs/`
- `GET /api/designs` and `GET /api/samples` return correct data

**Acceptance:** Both endpoints return populated data. Default assets publicly accessible.

### Phase 5 — Handwriting sample management

- `POST /api/samples`: upload, store in B2, update index
- `GET /api/samples`: return defaults + user's saved samples with presigned URLs
- `DELETE /api/samples/{sample_id}`: delete from B2 and index, 409 if in use
- Dashboard "My Handwriting Samples" section: list, upload, delete

**Acceptance:** User can upload, view, and delete samples. Presigned URLs load correctly. Deleting a sample has no effect on previously generated cards.

### Phase 6 — Generation pipeline

- `pipelines.py`: generate writing face, store result, update card meta
- `POST /api/cards` and SSE stream endpoint
- Share token written to `share-tokens/{share_token}.json` at card creation
- End-to-end test: sign in, submit a card, stream events, confirm assets in B2

**Acceptance:** Full generation works end-to-end for authenticated user. `writing-face.png` in B2. `meta.json` complete. Share token resolvable.

### Phase 7 — Creation flow UI

- Five-step flow at `/create`
- Unified handwriting picker (defaults + saved samples + inline upload)
- Design picker, message textarea, SSE progress, inline 3D viewer on complete

**Acceptance:** Full creation flow works in browser. New sample uploaded inline appears in picker immediately.

### Phase 8 — 3D viewer

- `PostcardViewer`: flip, two faces
- `GreetingCardViewer`: open/close book
- Owner controls (download both, copy share link, delete)
- Recipient controls (download both, "make your own")

**Acceptance:** Both viewer types correct on desktop and mobile. Share link resolves correctly for unauthenticated recipient.

### Phase 9 — Dashboard

- Card history grid with thumbnails (presigned design URLs), pagination, delete
- Handwriting sample library (wired from Phase 5 UI work)

**Acceptance:** Dashboard loads user's cards and samples correctly. Delete works for both. Pagination works.

### Phase 10 — Polish & submit prep

- Error states, loading skeletons, empty states
- Mobile layout review
- README with setup, demo link, hackathon description

---

## 18. Key Constraints

- **Never write on the design image.** Handwriting is always on a plain face.
- **Postcard is always landscape.** No orientation toggle for postcards.
- **No Pillow compositing.** Writing face is generated directly by the model.
- **No database.** B2 is the only persistent store. JWT sessions require no DB.
- **Layer invariant is non-negotiable.** `genblaze_*` only in `pipelines.py`. `boto3` never directly. `S3StorageBackend` only in `store.py`.
- **Model routing is determined by handwriting style, never by anything else.** `saved:*` → `gpt-image-2-edit` with reference image. `default:*` → `gpt-image-2-generate` with prompt only. Do not alter either slug.
- **Default style swatch images are display-only.** They are pre-generated previews stored in B2, never passed to the model at card generation time.
- **Message max 500 characters.** Enforce client-side and server-side.
- **All user assets served via presigned URLs.** Never expose raw B2 paths for user-owned objects.
- **Share tokens are the only public access to user cards.** The share page does not expose user identity or other cards.
- **`NEXTAUTH_SECRET` is shared between Next.js and FastAPI.** Set identically in both `.env` files. Never commit it.
