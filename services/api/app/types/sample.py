from pydantic import BaseModel


class SampleMeta(BaseModel):
    sample_id: str
    user_id: str
    created_at: str
    label: str
    sample_url: str
    sample_thumb_url: str | None = None
