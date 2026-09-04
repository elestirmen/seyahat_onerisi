import hashlib
import io
import json
import os
import stat
import uuid
import zipfile

import pytest
from werkzeug.datastructures import FileStorage

from app.services.route_import_service import RouteImportService
from route_file_parser import KMZParser, RouteParserError, RouteFileParser


class _NoUnboundedRead(io.BytesIO):
    def read(self, size=-1):
        if size is None or size < 0:
            raise AssertionError("upload hashing must use bounded reads")
        return super().read(size)


def _file_storage(content, filename):
    return FileStorage(
        stream=io.BytesIO(content),
        filename=filename,
        content_type="application/octet-stream",
    )


def _kmz_bytes(kml_content, entry_name="doc.kml"):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(entry_name, kml_content)
    return output.getvalue()


def test_upload_hash_is_streamed_and_restores_position():
    content = b"0123456789" * 10_000
    upload = FileStorage(
        stream=_NoUnboundedRead(content),
        filename="route.gpx",
    )
    upload.seek(17)

    result = RouteImportService._calculate_stream_hash(upload)

    assert result == hashlib.sha256(content).hexdigest()
    assert upload.tell() == 17


def test_kmz_validation_rejects_suspicious_compression_ratio():
    # Repeated XML comments are harmless XML but compress extremely well and
    # exercise the archive-bomb guard without allocating a large fixture.
    compressed_payload = (
        b'<kml xmlns="http://www.opengis.net/kml/2.2">'
        + b"<!--padding-->" * 100_000
        + b"</kml>"
    )
    upload = _file_storage(_kmz_bytes(compressed_payload), "route.kmz")

    result = RouteImportService().validate_file(upload)

    assert result["is_valid"] is False
    assert any("compression ratio" in error for error in result["errors"])


def test_kmz_parser_enforces_compression_limit(tmp_path):
    compressed_payload = (
        b'<kml xmlns="http://www.opengis.net/kml/2.2">'
        + b"<!--padding-->" * 100_000
        + b"</kml>"
    )
    archive_path = tmp_path / "route.kmz"
    archive_path.write_bytes(_kmz_bytes(compressed_payload))

    with pytest.raises(RouteParserError) as excinfo:
        KMZParser().parse(str(archive_path))

    assert excinfo.value.error_code == "KMZ_SUSPICIOUS_COMPRESSION"


def test_xml_parser_rejects_doctype_and_entity_declarations(tmp_path):
    route_path = tmp_path / "unsafe.gpx"
    route_path.write_text(
        """<?xml version="1.0"?>
        <!DOCTYPE gpx [<!ENTITY example "unsafe">]>
        <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
          <trk><trkseg><trkpt lat="38.6" lon="34.8" /></trkseg></trk>
        </gpx>
        """,
        encoding="utf-8",
    )

    with pytest.raises(RouteParserError) as excinfo:
        RouteFileParser().parse_file(str(route_path), "gpx")

    assert excinfo.value.error_code == "UNSAFE_XML"


def test_gpx_parser_drops_non_finite_and_out_of_range_coordinates(tmp_path):
    route_path = tmp_path / "coordinates.gpx"
    route_path.write_text(
        """<?xml version="1.0"?>
        <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
          <trk><trkseg>
            <trkpt lat="nan" lon="34.8" />
            <trkpt lat="91" lon="34.8" />
            <trkpt lat="38.6" lon="34.8"><ele>inf</ele></trkpt>
          </trkseg></trk>
        </gpx>
        """,
        encoding="utf-8",
    )

    parsed = RouteFileParser().parse_file(str(route_path), "gpx")

    assert len(parsed.points) == 1
    assert parsed.points[0].latitude == 38.6
    assert parsed.points[0].elevation is None


def test_kmz_validation_rejects_traversal_entry():
    kml = b'<kml xmlns="http://www.opengis.net/kml/2.2"></kml>'
    upload = _file_storage(_kmz_bytes(kml, "../doc.kml"), "route.kmz")

    result = RouteImportService().validate_file(upload)

    assert result["is_valid"] is False
    assert "KMZ contains an unsafe archive entry" in result["errors"]


def test_import_state_and_upload_are_owner_only(tmp_path):
    service = RouteImportService()
    service.upload_dir = str(tmp_path)
    service.state_dir = tmp_path / "state"
    service.state_dir.mkdir(mode=0o700)
    upload_id = str(uuid.uuid4())

    service._write_progress_state(upload_id, {"status": "validating"})
    upload = _file_storage(b"<gpx>" + b" " * 100 + b"</gpx>", "route.gpx")
    upload_path = service.save_uploaded_file(upload, upload_id)

    state_mode = stat.S_IMODE(service._state_path(upload_id).stat().st_mode)
    upload_mode = stat.S_IMODE(os.stat(upload_path).st_mode)
    assert state_mode == 0o600
    assert upload_mode == 0o600


def test_stale_state_cleanup_only_removes_managed_uploads(tmp_path):
    service = RouteImportService()
    service.upload_dir = str(tmp_path)
    service.state_dir = tmp_path / "state"
    service.state_dir.mkdir(mode=0o700)
    service.state_ttl_seconds = 300

    managed_upload_id = uuid.uuid4()
    managed_upload = tmp_path / f"route_import_{managed_upload_id}.gpx"
    managed_upload.write_bytes(b"expired")
    unrelated_file = tmp_path / "keep-me.gpx"
    unrelated_file.write_bytes(b"important")

    expired_state = service.state_dir / f"{managed_upload_id}.json"
    expired_state.write_text(
        json.dumps({"temp_file_path": str(managed_upload)}), encoding="utf-8"
    )
    os.utime(expired_state, (0, 0))

    unrelated_state = service.state_dir / f"{uuid.uuid4()}.json"
    unrelated_state.write_text(
        json.dumps({"temp_file_path": str(unrelated_file)}), encoding="utf-8"
    )
    os.utime(unrelated_state, (0, 0))

    service._cleanup_stale_states()

    assert not managed_upload.exists()
    assert not expired_state.exists()
    assert unrelated_file.exists()
    assert not unrelated_state.exists()


def test_cleanup_cannot_delete_another_imports_managed_file(tmp_path):
    service = RouteImportService()
    service.upload_dir = str(tmp_path)
    service.state_dir = tmp_path / "state"
    service.state_dir.mkdir(mode=0o700)
    requested_upload_id = str(uuid.uuid4())
    other_upload = tmp_path / f"route_import_{uuid.uuid4()}.gpx"
    other_upload.write_bytes(b"keep")

    service.cleanup_upload(requested_upload_id, str(other_upload))

    assert other_upload.exists()
