"""All S3StorageBackend calls live here. No other module may import genblaze_s3."""

import json
from functools import lru_cache
from typing import Any

from genblaze_s3 import S3StorageBackend

from app.config.settings import settings


@lru_cache
def _backend() -> S3StorageBackend:
    return S3StorageBackend.for_backblaze(
        settings.b2_bucket_name,
        region=settings.b2_region,
        key_id=settings.b2_key_id,
        app_key=settings.b2_application_key,
        auto_lifecycle=True,
    )


def check_connection() -> bool:
    try:
        _backend()
        return True
    except Exception:
        return False


def upload_file(key: str, data: bytes, *, content_type: str | None = None) -> None:
    _backend().put(key, data, content_type=content_type)


def get_object(key: str) -> bytes:
    return _backend().get(key)


def object_exists(key: str) -> bool:
    return _backend().exists(key)


def get_object_etag(key: str) -> str | None:
    meta = _backend().head(key)
    return meta.etag if meta else None


def delete_object(key: str) -> None:
    _backend().delete(key)


def presign_url(key: str, *, expires_in: int = 3600) -> str:
    return _backend().presigned_get_url(key, expires_in=expires_in)


def public_url(key: str) -> str:
    return _backend().get_durable_url(key)


def put_json(key: str, obj: Any) -> None:
    upload_file(key, json.dumps(obj).encode("utf-8"), content_type="application/json")


def get_json(key: str) -> Any:
    return json.loads(get_object(key))


def read_index(key: str) -> list[str]:
    if not _backend().exists(key):
        return []
    return get_json(key)


def prepend_index(key: str, item_id: str) -> None:
    ids = read_index(key)
    ids.insert(0, item_id)
    put_json(key, ids)


def remove_from_index(key: str, item_id: str) -> None:
    ids = read_index(key)
    if item_id in ids:
        ids.remove(item_id)
        put_json(key, ids)


def write_share_token(share_token: str, *, user_id: str, card_id: str) -> None:
    put_json(f"share-tokens/{share_token}.json", {"user_id": user_id, "card_id": card_id})


def read_share_token(share_token: str) -> dict[str, str] | None:
    key = f"share-tokens/{share_token}.json"
    if not _backend().exists(key):
        return None
    return get_json(key)
