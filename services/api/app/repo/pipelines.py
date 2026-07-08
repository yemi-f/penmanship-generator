"""All genblaze_core / genblaze_gmicloud imports live here. No other module may import them."""

import base64
import logging
from urllib.request import urlopen

from genblaze_core import Modality, Pipeline
from genblaze_gmicloud import GMICloudImageProvider

from app.config.settings import settings

logger = logging.getLogger(__name__)


def _run_and_fetch(pipeline: Pipeline) -> bytes:
    result = pipeline.run(raise_on_failure=True)
    asset = result.run.steps[0].assets[0]
    with urlopen(asset.url) as response:
        return response.read()


def generate_image(prompt: str, *, model: str, size: str) -> bytes:
    logger.debug("generate_image model=%s size=%s prompt=%s", model, size, prompt)
    provider = GMICloudImageProvider(api_key=settings.gmi_api_key)
    pipeline = Pipeline(model).step(
        provider,
        model=model,
        modality=Modality.IMAGE,
        prompt=prompt,
        size=size,
    )
    try:
        return _run_and_fetch(pipeline)
    except Exception:
        logger.error("generate_image failed model=%s size=%s", model, size, exc_info=True)
        raise


def generate_image_edit(
    prompt: str, *, model: str, size: str, reference_image: bytes, reference_content_type: str
) -> bytes:
    logger.debug("generate_image_edit model=%s size=%s prompt=%s", model, size, prompt)
    data_uri = f"data:{reference_content_type};base64,{base64.b64encode(reference_image).decode()}"
    provider = GMICloudImageProvider(api_key=settings.gmi_api_key)
    pipeline = Pipeline(model).step(
        provider,
        model=model,
        modality=Modality.IMAGE,
        prompt=prompt,
        size=size,
        image=data_uri,
    )
    try:
        return _run_and_fetch(pipeline)
    except Exception:
        logger.error("generate_image_edit failed model=%s size=%s", model, size, exc_info=True)
        raise
