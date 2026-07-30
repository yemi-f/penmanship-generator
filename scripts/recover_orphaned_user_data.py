#!/usr/bin/env python3
"""One-off recovery script: merges cards/samples scattered across orphaned
users/{uuid}/ prefixes (created before the NextAuth stable-sub fix) into the
current, correct user_id.

Background: before the fix in apps/web/src/lib/auth.ts, NextAuth (no adapter
configured) minted a fresh random user_id on every sign-in instead of reusing
Google's stable account sub, so every sign-in session's cards/samples ended up
under a different, throwaway users/{uuid}/ prefix in B2.

Required manual sequence:
  1. Ship the auth.ts fix.
  2. Sign out and sign back in once, so a fresh users/{stable-sub}/profile.json
     is created -- this becomes the migration target (the newest matching
     profile by created_at).
  3. Run this script with --email, review the dry-run output, then re-run with
     --confirm to actually write.

Source objects are never deleted -- this only copies forward.
"""

import argparse
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent / "services" / "api"
sys.path.insert(0, str(API_ROOT))

from app.repo import store  # noqa: E402


def find_profiles_by_email(email: str) -> list[dict]:
    keys = store.list_keys("users/")
    profiles = []
    for key in keys:
        if not key.endswith("/profile.json"):
            continue
        profile = store.get_json(key)
        if profile.get("email") == email:
            profiles.append(profile)
    return profiles


def migrate_cards(source_user_id: str, target_user_id: str, confirm: bool) -> list[dict]:
    card_ids = store.read_index(f"users/{source_user_id}/cards/index.json")
    migrated = []
    for card_id in card_ids:
        meta_key = f"users/{source_user_id}/cards/{card_id}/meta.json"
        if not store.object_exists(meta_key):
            print(f"  [skip] {meta_key} missing")
            continue
        meta = store.get_json(meta_key)
        meta["user_id"] = target_user_id
        dst_prefix = f"users/{target_user_id}/cards/{card_id}"
        print(f"  card {card_id}: {source_user_id} -> {target_user_id}")
        if confirm:
            store.put_json(f"{dst_prefix}/meta.json", meta)
            for asset in ("design-face.png", "writing-face.png"):
                src = f"users/{source_user_id}/cards/{card_id}/{asset}"
                if store.object_exists(src):
                    store.copy_object(src, f"{dst_prefix}/{asset}")
            share_token = meta.get("share_token")
            if share_token:
                store.write_share_token(share_token, user_id=target_user_id, card_id=card_id)
        migrated.append(meta)
    return migrated


def migrate_samples(source_user_id: str, target_user_id: str, confirm: bool) -> list[dict]:
    sample_ids = store.read_index(f"users/{source_user_id}/handwriting-samples/index.json")
    migrated = []
    for sample_id in sample_ids:
        meta_key = f"users/{source_user_id}/handwriting-samples/{sample_id}/meta.json"
        if not store.object_exists(meta_key):
            print(f"  [skip] {meta_key} missing")
            continue
        meta = store.get_json(meta_key)
        meta["user_id"] = target_user_id
        dst_prefix = f"users/{target_user_id}/handwriting-samples/{sample_id}"
        print(f"  sample {sample_id}: {source_user_id} -> {target_user_id}")
        if confirm:
            store.put_json(f"{dst_prefix}/meta.json", meta)
            src = f"users/{source_user_id}/handwriting-samples/{sample_id}/sample.png"
            if store.object_exists(src):
                store.copy_object(src, f"{dst_prefix}/sample.png")
        migrated.append(meta)
    return migrated


def merged_index(existing: list[dict], migrated: list[dict], id_field: str) -> list[str]:
    by_id = {item[id_field]: item for item in existing + migrated}
    ordered = sorted(by_id.values(), key=lambda item: item["created_at"], reverse=True)
    return [item[id_field] for item in ordered]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default="yemifakorede@gmail.com")
    parser.add_argument("--confirm", action="store_true", help="actually write changes (default: dry run)")
    args = parser.parse_args()

    profiles = find_profiles_by_email(args.email)
    if len(profiles) < 2:
        print(f"Found {len(profiles)} profile(s) for {args.email} -- nothing to migrate.")
        print("Make sure you've signed in at least once after the auth.ts fix shipped.")
        return

    profiles.sort(key=lambda p: p["created_at"], reverse=True)
    target = profiles[0]
    sources = profiles[1:]
    target_user_id = target["user_id"]

    print(f"Target (newest): {target_user_id} (created_at={target['created_at']})")
    print(f"Sources ({len(sources)}): {[p['user_id'] for p in sources]}")
    if not args.confirm:
        print("\nDRY RUN -- pass --confirm to actually write changes.\n")

    all_migrated_cards: list[dict] = []
    all_migrated_samples: list[dict] = []
    for source in sources:
        source_user_id = source["user_id"]
        print(f"\n--- migrating from {source_user_id} ---")
        all_migrated_cards.extend(migrate_cards(source_user_id, target_user_id, args.confirm))
        all_migrated_samples.extend(migrate_samples(source_user_id, target_user_id, args.confirm))

    if args.confirm:
        existing_card_ids = store.read_index(f"users/{target_user_id}/cards/index.json")
        existing_cards = [
            store.get_json(f"users/{target_user_id}/cards/{cid}/meta.json") for cid in existing_card_ids
        ]
        new_card_index = merged_index(existing_cards, all_migrated_cards, "card_id")
        store.put_json(f"users/{target_user_id}/cards/index.json", new_card_index)

        existing_sample_ids = store.read_index(f"users/{target_user_id}/handwriting-samples/index.json")
        existing_samples = [
            store.get_json(f"users/{target_user_id}/handwriting-samples/{sid}/meta.json")
            for sid in existing_sample_ids
        ]
        new_sample_index = merged_index(existing_samples, all_migrated_samples, "sample_id")
        store.put_json(f"users/{target_user_id}/handwriting-samples/index.json", new_sample_index)

        print(f"\nDone. {len(all_migrated_cards)} card(s), {len(all_migrated_samples)} sample(s) migrated.")
    else:
        print(f"\nWould migrate {len(all_migrated_cards)} card(s), {len(all_migrated_samples)} sample(s).")
        print("Re-run with --confirm to write.")


if __name__ == "__main__":
    main()
