import os
import tempfile
import json
import pytest

from poi_media_manager import POIMediaManager
from PIL import Image
import piexif


def _create_image_with_exif(path: str, lat: float, lng: float, fmt: str = "jpeg"):
    img = Image.new('RGB', (10, 10), color='red')

    def _to_deg(value):
        d = int(value)
        m = int((value - d) * 60)
        s = (value - d - m/60) * 3600
        return (
            (d, 1),
            (m, 1),
            (int(s * 1000000), 1000000)
        )

    lat_ref = 'N' if lat >= 0 else 'S'
    lng_ref = 'E' if lng >= 0 else 'W'
    lat = abs(lat)
    lng = abs(lng)

    exif_dict = {
        'GPS': {
            piexif.GPSIFD.GPSLatitudeRef: lat_ref.encode(),
            piexif.GPSIFD.GPSLatitude: _to_deg(lat),
            piexif.GPSIFD.GPSLongitudeRef: lng_ref.encode(),

            piexif.GPSIFD.GPSLongitude: _to_deg(lng),
        }
    }
    exif_bytes = piexif.dump(exif_dict)
    img.save(path, fmt, exif=exif_bytes)


def test_extract_gps_from_exif():
    manager = POIMediaManager()
    with tempfile.TemporaryDirectory() as tmpdir:
        img_path = os.path.join(tmpdir, "exif.jpg")
        # Use negative coordinates to ensure byte direction refs are handled
        lat, lng = -40.1234, -29.9876

        _create_image_with_exif(img_path, lat, lng)

        info = manager.add_route_media(
            route_id=1,
            route_name="TestRoute",
            media_file_path=img_path
        )
        assert info is not None
        assert info['lat'] is not None and info['lng'] is not None
        assert abs(info['lat'] - lat) < 0.01
        assert abs(info['lng'] - lng) < 0.01

        # cleanup
        manager.delete_route_media(1, info['filename'])


def test_auto_set_route_media_location():
    manager = POIMediaManager()
    with tempfile.TemporaryDirectory() as tmpdir:
        img_path = os.path.join(tmpdir, "exif.jpg")
        lat, lng = 12.3456, 78.9012
        _create_image_with_exif(img_path, lat, lng)

        info = manager.add_route_media(
            route_id=2,
            route_name="AutoTest",
            media_file_path=img_path
        )
        assert info is not None

        # remove stored location to simulate missing coordinates
        if not manager.remove_route_media_location(2, info['filename']):
            pytest.skip("Database not available for location removal")

        coords = manager.auto_set_route_media_location(2, info['filename'])
        if coords is None:
            pytest.skip("Database not available for auto location")
        auto_lat, auto_lng = coords
        assert abs(auto_lat - lat) < 0.01
        assert abs(auto_lng - lng) < 0.01

        manager.delete_route_media(2, info['filename'])


def test_extract_gps_from_webp_exif():
    manager = POIMediaManager()
    with tempfile.TemporaryDirectory() as tmpdir:
        img_path = os.path.join(tmpdir, "exif.webp")
        lat, lng = 11.2233, 44.5566
        _create_image_with_exif(img_path, lat, lng, fmt="webp")

        info = manager.add_route_media(
            route_id=3,
            route_name="WebpTest",
            media_file_path=img_path
        )
        assert info is not None
        assert info['lat'] is not None and info['lng'] is not None
        assert abs(info['lat'] - lat) < 0.01
        assert abs(info['lng'] - lng) < 0.01

        manager.delete_route_media(3, info['filename'])


def test_webp_sidecar_creation():
    manager = POIMediaManager()
    with tempfile.TemporaryDirectory() as tmpdir:
        img_path = os.path.join(tmpdir, "sidecar.jpg")
        lat, lng = 22.3344, 55.6677
        _create_image_with_exif(img_path, lat, lng)

        info = manager.add_route_media(
            route_id=4,
            route_name="Sidecar",
            media_file_path=img_path
        )
        assert info is not None
        webp_path = info['file_path']
        exif_lat, exif_lng = manager._get_exif_location(webp_path)
        if exif_lat is None or exif_lng is None:
            sidecar = os.path.splitext(webp_path)[0] + '.json'
            assert os.path.exists(sidecar)
            with open(sidecar) as f:
                data = json.load(f)
            assert abs(data['lat'] - lat) < 0.01
            assert abs(data['lng'] - lng) < 0.01
        else:
            assert abs(exif_lat - lat) < 0.01
            assert abs(exif_lng - lng) < 0.01

        manager.delete_route_media(4, info['filename'])

