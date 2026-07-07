from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config.settings import settings
from app.repo import store
from app.types.profile import Profile

bearer_scheme = HTTPBearer()


def _ensure_profile(user_id: str, *, email: str, name: str, picture: str) -> None:
    key = f"users/{user_id}/profile.json"
    if store.object_exists(key):
        return
    profile = Profile(
        user_id=user_id,
        email=email,
        name=name,
        picture=picture,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    store.put_json(key, profile.model_dump())


async def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    try:
        payload = jwt.decode(credentials.credentials, settings.nextauth_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    _ensure_profile(
        user_id,
        email=payload.get("email") or "",
        name=payload.get("name") or "",
        picture=payload.get("picture") or "",
    )
    return user_id
