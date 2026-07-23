# CLAUDE.md — Penmanship

This file is read by the coding agent at the start of every session. Follow everything here without exception.

---

## What This Project Is

Penmanship generates personalized greeting cards and postcards with text rendered in a real human's handwriting style. Users sign in with Google, manage a library of handwriting samples, create cards, preview them in a 3D viewer, and share via a private link.

Full specification: `IMPLEMENTATION.md`. Read it before writing any code.

---

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind, shadcn/ui, `@react-three/fiber`, `@react-three/drei`
- **Auth:** NextAuth.js v5, Google provider, JWT sessions
- **Backend:** FastAPI, Pydantic v2, Genblaze Core
- **Image generation:** GMICloud via `genblaze-gmicloud`
- **Storage:** Backblaze B2 via `genblaze-s3`
- **Streaming:** Server-Sent Events
- **No database of any kind**

---

## Non-Negotiable Rules

Break any of these and the build is wrong regardless of whether it works.

### 1. Layer invariant

```
genblaze_*        → pipelines.py ONLY
boto3 / botocore  → NEVER imported directly, anywhere
S3StorageBackend  → store.py ONLY
backend()         → store.py ONLY
```

Run `pnpm check:structure` after every change. If it fails, fix it before proceeding.

### 2. Model routing

```
handwriting_style starts with "saved:"   → gpt-image-2-edit   (reference image from B2)
handwriting_style starts with "default:" → gpt-image-2-generate (prompt only, no image)
```

Never alter the model slugs. Never pass a reference image for default styles. Never use prompt-only for saved styles.

Image A (design) always uses `gpt-image-2-generate`, prompt-only, from `design_description` — there is no "saved" concept for designs, so this routing table doesn't apply to it.

Reference images for `gpt-image-2-edit` must be passed as a URL (presigned B2 URL) in the `image` param, never as inline base64/bytes. `step.params` is hashed and persisted into manifests; genblaze_core scans it for credential-shaped strings and a base64 image blob can coincidentally match one of those patterns (this happened in practice — a base64 blob matched the B2-application-key pattern `K005[A-Za-z0-9+/]{20,}` purely by chance).

### 3. Image A and Image B are generated independently, never composited

Image A (front design, from the user's free-text description) and Image B (handwriting face) are each generated directly by the model onto their own canvas. Neither is ever passed to the other's generation call, and neither is ever pasted onto the other. Two independent generations per card, never one image built from another.

> Changed from the original spec: Image A was a static pre-generated B2 asset picked from a preset catalog. It is now generated per-card from a user-supplied `design_description`, the same way Image B is generated from the handwriting style. The "never composited" half of the original rule is unchanged — only the "static asset" half changed.

### 4. No Pillow compositing

There is no image-on-image operation anywhere in the pipeline. Image A and Image B are each generated directly by the model onto a plain/blank canvas. Pillow is used only for single-image resizing (gpt-image-2 requires generation sizes that are multiples of 16 with ≥655,360 total px, which the spec's exact canvas dimensions don't satisfy — generate at the nearest compliant size, then resize down), never to paste one image onto another.

### 5. B2 is the only data store

No SQLite. No Redis. No Postgres. No in-memory state that needs to persist. If something needs to persist, it goes in B2 as a JSON or image object.

### 6. All user assets via presigned URLs

Never expose raw B2 paths for anything under `users/`. Always generate presigned URLs with 1-hour TTL at read time. Default style previews are the only public B2 objects — Image A (design) is now generated per-card and lives under `users/`, so it is presigned like every other user asset, not public.

### 7. NEXTAUTH_SECRET is shared

Set identically in `apps/web/.env` and `services/api/.env`. FastAPI uses it to verify NextAuth JWTs. Never hardcode it. Never commit it.

### 8. Postcard is always landscape

Never show an orientation toggle for postcards. Greeting cards have portrait/landscape selection; postcards do not.

### 9. Message max 500 characters

Enforce on both the client (textarea `maxLength` + counter) and the server (Pydantic field validator). Reject at the API level if exceeded.

### 10. Share page is always public

`/share/[share_token]` must never require authentication. Recipients do not have accounts. The middleware must explicitly exclude this route from session checks.

---

## B2 Path Conventions

```
# Shared public assets
handwriting-samples/default/{style_slug}-preview.png

# Share token lookup
share-tokens/{share_token}.json   → { user_id, card_id }

# Per-user (always presigned, never public)
users/{user_id}/profile.json
users/{user_id}/handwriting-samples/index.json
users/{user_id}/handwriting-samples/{sample_id}/meta.json
users/{user_id}/handwriting-samples/{sample_id}/sample.png
users/{user_id}/cards/index.json
users/{user_id}/cards/{card_id}/meta.json
users/{user_id}/cards/{card_id}/design-face.png
users/{user_id}/cards/{card_id}/writing-face.png
users/{user_id}/design-previews/{design_preview_id}.png
```

Do not invent new paths. If a new persistent object is needed, confirm the path convention matches this layout.

`card-designs/{design_slug}.png` (the six Phase 4 stock designs) is no longer part of the active system — Image A is now generated per-card, not picked from a preset. Those six objects are still sitting in B2, unreferenced by any code; they were not deleted, just abandoned. Ignore them.

`design-previews/{design_preview_id}.png` is a flat object — no `meta.json`, no `index.json`. Nothing worth persisting about a preview, and it's never listed in any UI. See "Design Preview Pre-generation" below.

---

## Design Preview Pre-generation

To make card creation feel faster, Image A (design) generation can start early: `POST /api/design-previews` (stateless, no card required — just `card_type`/`orientation`/`design_description`) generates Image A immediately and stores it at `users/{user_id}/design-previews/{design_preview_id}.png`, returning `{design_preview_id, design_url}`. The frontend fires this the moment the user leaves the Design step, overlapping generation with however long they spend on the Message step.

`CardCreateRequest` accepts an optional `design_preview_id`. When present, `stream_generation` tries to reuse that object (a plain copy into `design-face.png`, no GMICloud call) instead of generating Image A live. **This reuse attempt must never fail card creation** — if the preview is missing, stale, or errors on read, fall through to live generation exactly as if no `design_preview_id` had been given. On successful reuse the preview object is deleted; on fallback it's simply abandoned.

This feature is intentionally invisible to both the SSE Stream Contract (still only `status`/`complete`/`error`, no new event types) and the Card Status Lifecycle (still only `pending → complete/failed`) — a design preview is never itself a card and carries no status.

There is no cleanup for abandoned previews (flow never reaches the Message step, or the user goes back and changes the description, orphaning the earlier one) — accepted tech debt, same category as an abandoned `pending` card.

---

## 3D Viewer Texture Loading — why textures don't use presigned URLs

B2 presigned URLs have no CORS headers (confirmed: no `Access-Control-Allow-Origin`, `OPTIONS` preflight returns 403), and `genblaze_s3` exposes no bucket CORS configuration. A plain `<img>` tag doesn't care — but WebGL texture uploads (`@react-three/fiber`/`drei`'s `useTexture`) are stricter and will fail (tainted-canvas security error) against a cross-origin response lacking CORS headers.

Fix: card images used as 3D textures are never loaded from B2 directly. Instead:
- `GET /api/cards/{card_id}/textures/{design|writing}` (owner, authenticated) and `GET /api/share/{share_token}/textures/{design|writing}` (public) stream the raw PNG bytes through our own FastAPI backend, which already sends CORS headers via `main.py`'s `CORSMiddleware`.
- The **public** share-view texture URLs can be passed straight to `useTexture` — no auth needed, our CORS headers make them fetchable directly.
- The **owner** view can't do that (the endpoint requires a Bearer token, which a texture loader can't attach) — so it fetches via `apiFetch`, converts the response to a `Blob`, and passes a `URL.createObjectURL(blob)` (same-origin, no CORS concern at all) to `useTexture` instead. See `lib/useBlobTextureUrl.ts`.

Downloads (the "Download design"/"Download handwriting" buttons) are unaffected by any of this — a plain `<a href download>` is just navigation, not a scripted cross-origin read, so they still use the ordinary presigned URLs from `GET /api/cards/{card_id}` / `GET /api/share/{share_token}`.

---

## Card Status Lifecycle

```
pending → complete
pending → failed
complete → pending → complete   (editing an existing card via PATCH /api/cards/{card_id})
complete → pending → failed     (edit regeneration fails)
```

`meta.json` is written with `status: "pending"` before generation starts. It is updated to `"complete"` or `"failed"` after the generation call returns. Never leave a card in `"pending"` indefinitely — always update on error. Editing an already-`"complete"` card (see "Editing a Card" below) re-enters this same lifecycle from `"pending"`.

---

## SSE Stream Contract

The SSE stream at `GET /api/cards/{card_id}/stream` emits exactly these event types:

```
event: status    data: { "step": "generating" | "storing", "pct": 0–100 }
event: complete  data: { "writing_face_url": "...", "design_url": "...", "share_url": "..." }
event: error     data: { "message": "..." }
```

Do not add new event types without updating this file and the frontend SSE handler.

`GET /api/cards/{card_id}/update-stream?regenerate_design={bool}&regenerate_writing={bool}` is a second endpoint reusing this identical event contract — it does not introduce new event types. It's paired with `PATCH /api/cards/{card_id}` (see "Editing a Card" below): the PATCH writes the new text fields and returns which image(s) actually changed, then this stream regenerates only those.

---

## Editing a Card

`PATCH /api/cards/{card_id}` lets the owner change `design_description`, `message`, `recipient_name`, and `sign_off` on an existing card — not `card_type`/`orientation`/`handwriting_style` (unsupported; would need a full recreate). It diffs the request against the stored `meta.json`, writes the new values, sets `status` back to `"pending"`, and returns `{"regenerate_design": bool, "regenerate_writing": bool}` — `regenerate_design` is true only if `design_description` changed; `regenerate_writing` is true if `message`, `recipient_name`, or `sign_off` changed (all three feed the same writing-face prompt). The caller then opens `GET /api/cards/{card_id}/update-stream` with those two flags as query params, which regenerates only the image(s) that actually changed and reuses the other's existing B2 object untouched — never regenerate both unconditionally, that doubles real GMICloud cost/time for a one-field edit.

---

## Index Files

Both `users/{user_id}/cards/index.json` and `users/{user_id}/handwriting-samples/index.json` are JSON arrays of IDs, newest-first. The write pattern is always: read → prepend (or remove) → write back. There is no cap on either index.

The share token lookup object at `share-tokens/{share_token}.json` is written once at card creation and never updated.

---

## What Not To Do

- Do not introduce a database of any kind
- Do not import boto3 or botocore directly
- Do not call genblaze functions outside pipelines.py
- Do not call S3StorageBackend outside store.py
- Do not composite images server-side with Pillow
- Do not pass a reference image when using `gpt-image-2-generate`
- Do not pass prompt-only when using `gpt-image-2-edit`
- Do not expose user assets via public B2 URLs
- Do not show orientation toggle for postcards
- Do not require auth on `/share/[share_token]`
- Do not leave cards in `pending` status on error

---

## Before Starting Any Phase

1. Re-read `IMPLEMENTATION.md` section for that phase
2. Run `pnpm check:structure` to confirm the current state is clean
3. Run existing tests to confirm nothing is broken
4. Only then begin the phase

## After Completing Any Phase

1. Run `pnpm check:structure` — fix any violations before moving on
2. Run all tests — fix any failures before moving on
3. Confirm every acceptance criterion in `IMPLEMENTATION.md` is met
4. Do not begin the next phase until all criteria pass
