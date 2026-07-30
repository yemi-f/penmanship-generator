"""Slugs and display labels for the built-in handwriting styles.

Canonical list consumed by the `/api/samples` route and, in turn, the
frontend style picker. Preview swatches for these slugs are static assets
committed at apps/web/public/handwriting-samples/{slug}-preview.png.
"""

DEFAULT_STYLES = [
    {"slug": "casual", "label": "Casual"},
    {"slug": "cursive", "label": "Cursive"},
    {"slug": "bold-marker", "label": "Bold Marker"},
]
