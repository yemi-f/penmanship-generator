from typing import Literal

from pydantic import BaseModel, Field, model_validator


class _SurfaceFields(BaseModel):
    card_type: Literal["postcard", "greeting_card"]
    orientation: Literal["landscape", "portrait"]

    @model_validator(mode="after")
    def _postcard_is_always_landscape(self) -> "_SurfaceFields":
        if self.card_type == "postcard" and self.orientation != "landscape":
            raise ValueError("postcard orientation must be landscape")
        return self


class DesignPreviewCreateRequest(_SurfaceFields):
    design_description: str = Field(max_length=500, min_length=1)


class CardCreateRequest(_SurfaceFields):
    design_description: str = Field(max_length=500, min_length=1)
    handwriting_style: str
    message: str = Field(max_length=500, min_length=1)
    design_preview_id: str | None = None


class CardMeta(BaseModel):
    card_id: str
    user_id: str
    created_at: str
    card_type: str
    orientation: str
    design_description: str
    design_url: str | None
    handwriting_style: str
    handwriting_label: str
    message: str
    status: str
    writing_face_url: str | None
    share_token: str
    design_preview_id: str | None = None
