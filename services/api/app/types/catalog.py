"""Slugs and display labels for the built-in handwriting styles.

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
