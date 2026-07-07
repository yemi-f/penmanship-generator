# CLAUDE.md — InkCard

This file is read by the coding agent at the start of every session. Follow everything here without exception.

---

## What This Project Is

InkCard generates personalized greeting cards and postcards with text rendered in a real human's handwriting style. Users sign in with Google, manage a library of handwriting samples, create cards, preview them in a 3D viewer, and share via a private link.

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

### 3. Never write on the design image

The design image (Image A) is a static B2 asset. It is never modified, never passed to a generation call, never composited onto. The handwriting is generated onto a plain surface (Image B) only.

### 4. No Pillow compositing

There is no image-on-image operation anywhere in the pipeline. Image B is generated directly by the model onto a plain background. Do not introduce Pillow compositing.

### 5. B2 is the only data store

No SQLite. No Redis. No Postgres. No in-memory state that needs to persist. If something needs to persist, it goes in B2 as a JSON or image object.

### 6. All user assets via presigned URLs

Never expose raw B2 paths for anything under `users/`. Always generate presigned URLs with 1-hour TTL at read time. Design images and default style previews are the only public B2 objects.

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
card-designs/{design_slug}.png
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
users/{user_id}/cards/{card_id}/writing-face.png
```

Do not invent new paths. If a new persistent object is needed, confirm the path convention matches this layout.

---

## Card Status Lifecycle

```
pending → complete
pending → failed
```

`meta.json` is written with `status: "pending"` before generation starts. It is updated to `"complete"` or `"failed"` after the generation call returns. Never leave a card in `"pending"` indefinitely — always update on error.

---

## SSE Stream Contract

The SSE stream at `GET /api/cards/{card_id}/stream` emits exactly these event types:

```
event: status    data: { "step": "generating" | "storing", "pct": 0–100 }
event: complete  data: { "writing_face_url": "...", "design_url": "...", "share_url": "..." }
event: error     data: { "message": "..." }
```

Do not add new event types without updating this file and the frontend SSE handler.

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
