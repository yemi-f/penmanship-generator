"""Slugs and display labels for the built-in handwriting styles and card designs.

Shared between the FastAPI routes and scripts/generate_static_assets.py so
both stay in sync with what's actually stored in B2.
"""

DEFAULT_STYLES = [
    {"slug": "casual", "label": "Casual"},
    {"slug": "cursive", "label": "Cursive"},
    {"slug": "neat-print", "label": "Neat Print"},
    {"slug": "bold-marker", "label": "Bold Marker"},
    {"slug": "tiny-script", "label": "Tiny Script"},
]

CARD_DESIGNS = [
    {"slug": "minimal-white", "label": "Minimal White"},
    {"slug": "kraft-paper", "label": "Kraft Paper"},
    {"slug": "floral-watercolour", "label": "Floral Watercolour"},
    {"slug": "vintage-stamp", "label": "Vintage Stamp"},
    {"slug": "bold-color", "label": "Bold Color"},
    {"slug": "linen-texture", "label": "Linen Texture"},
]
