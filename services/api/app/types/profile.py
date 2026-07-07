from pydantic import BaseModel


class Profile(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str
    created_at: str
