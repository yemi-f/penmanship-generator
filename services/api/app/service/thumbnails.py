import io

from PIL import Image


def make_thumbnail(raw: bytes, *, max_dimension: int = 480, quality: int = 75) -> bytes:
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    ratio = max_dimension / max(image.size)
    if ratio < 1:
        size = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
        image = image.resize(size, Image.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()
