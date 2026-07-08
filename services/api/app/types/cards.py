from typing import Literal

from pydantic import BaseModel, Field, model_validator


class CardCreateRequest(BaseModel):
    card_type: Literal["postcard", "greeting_card"]
    orientation: Literal["landscape", "portrait"]
    design_slug: str
    handwriting_style: str
    message: str = Field(max_length=500, min_length=1)

    @model_validator(mode="after")
    def _postcard_is_always_landscape(self) -> "CardCreateRequest":
        if self.card_type == "postcard" and self.orientation != "landscape":
            raise ValueError("postcard orientation must be landscape")
        return self


class CardMeta(BaseModel):
    card_id: str
    user_id: str
    created_at: str
    card_type: str
    orientation: str
    design_slug: str
    design_url: str
    handwriting_style: str
    handwriting_label: str
    message: str
    status: str
    writing_face_url: str | None
    share_token: str
