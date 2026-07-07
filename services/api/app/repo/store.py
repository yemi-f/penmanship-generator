"""All S3StorageBackend calls live here. No other module may import genblaze_s3."""

from functools import lru_cache

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
