import uuid
from urllib.request import urlopen

import pytest

from app.repo import store


@pytest.fixture
def prefix():
    p = f"_test/{uuid.uuid4().hex}"
    yield p
    try:
        store.delete_object(f"{p}/file.bin")
    except Exception:
        pass
    try:
        store.delete_object(f"{p}/data.json")
    except Exception:
        pass
    try:
        store.delete_object(f"{p}/index.json")
    except Exception:
        pass


def test_upload_and_get_object_roundtrip(prefix):
    key = f"{prefix}/file.bin"
    store.upload_file(key, b"hello inkcard", content_type="application/octet-stream")
    assert store.get_object(key) == b"hello inkcard"


def test_delete_object_removes_it(prefix):
    key = f"{prefix}/file.bin"
    store.upload_file(key, b"to be deleted")
    store.delete_object(key)
    with pytest.raises(Exception):
        store.get_object(key)


def test_put_and_get_json_roundtrip(prefix):
    key = f"{prefix}/data.json"
    payload = {"card_id": "abc123", "status": "pending"}
    store.put_json(key, payload)
    assert store.get_json(key) == payload


def test_presign_url_serves_uploaded_content(prefix):
    key = f"{prefix}/file.bin"
    store.upload_file(key, b"presigned content", content_type="text/plain")
    url = store.presign_url(key, expires_in=60)
    assert url.startswith("http")
    with urlopen(url) as resp:
        assert resp.read() == b"presigned content"


def test_index_read_prepend_remove(prefix):
    key = f"{prefix}/index.json"
    assert store.read_index(key) == []

    store.prepend_index(key, "id_1")
    assert store.read_index(key) == ["id_1"]

    store.prepend_index(key, "id_2")
    assert store.read_index(key) == ["id_2", "id_1"]

    store.remove_from_index(key, "id_1")
    assert store.read_index(key) == ["id_2"]


def test_share_token_write_and_read_roundtrip():
    token = uuid.uuid4().hex
    store.write_share_token(token, user_id="user_1", card_id="card_1")
    try:
        assert store.read_share_token(token) == {"user_id": "user_1", "card_id": "card_1"}
    finally:
        store.delete_object(f"share-tokens/{token}.json")


def test_read_share_token_missing_returns_none():
    assert store.read_share_token(f"nonexistent-{uuid.uuid4().hex}") is None
