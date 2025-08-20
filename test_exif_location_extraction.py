import os
import tempfile
from poi_media_manager import POIMediaManager
from PIL import Image
import piexif


def _create_image_with_exif(path: str, lat: float, lng: float):
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
    img.save(path, "jpeg", exif=exif_bytes)


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
