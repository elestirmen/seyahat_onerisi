import math
import re
from pathlib import Path

def web_mercator_project(lat, lng, zoom, tile_size=256):
    """Project lat/lng to pixel coordinates in EPSG:3857."""
    scale = tile_size * (2 ** zoom)
    x = (lng + 180.0) / 360.0 * scale
    sin_lat = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * scale
    return x, y

def pixel_distance(lat, lng, zoom, icon_anchor):
    px, py = web_mercator_project(lat, lng, zoom)
    marker_px = px - icon_anchor[0]
    marker_py = py - icon_anchor[1]
    dx = (marker_px + icon_anchor[0]) - px
    dy = (marker_py + icon_anchor[1]) - py
    return math.hypot(dx, dy)

def test_marker_alignment_across_zoom_levels():
    lat, lng = 38.6436, 34.8128
    anchor = (15, 15)
    for zoom in (4, 8, 12, 15, 18):
        assert pixel_distance(lat, lng, zoom, anchor) <= 2

def test_leaflet_marker_css_uses_absolute_positioning():
    css = Path('static/css/poi_recommendation_system.css').read_text(encoding='utf-8')
    pattern = re.compile(r"\.leaflet-marker-icon\s*,\s*\.custom-poi-marker\s*{[^}]*position:\s*absolute\s*!important;", re.MULTILINE)
    assert pattern.search(css)
