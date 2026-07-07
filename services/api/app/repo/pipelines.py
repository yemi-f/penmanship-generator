"""All genblaze_core / genblaze_gmicloud imports live here. No other module may import them."""

from urllib.request import urlopen

from genblaze_core import Modality, Pipeline
from genblaze_gmicloud import GMICloudImageProvider

from app.config.settings import settings


def generate_image(prompt: str, *, model: str, size: str) -> bytes:
    provider = GMICloudImageProvider(api_key=settings.gmi_api_key)
    pipeline = Pipeline(model).step(
        provider,
        model=model,
        modality=Modality.IMAGE,
        prompt=prompt,
        size=size,
    )
    result = pipeline.run(raise_on_failure=True)
    asset = result.run.steps[0].assets[0]
    with urlopen(asset.url) as response:
        return response.read()
