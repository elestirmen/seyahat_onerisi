from pathlib import Path


ANDROID_ROOT = Path(__file__).resolve().parents[1] / "android_app" / "app" / "src"


def test_release_webview_uses_exact_https_origin_and_hardened_settings():
    source = (ANDROID_ROOT / "main/java/com/seyahat_rehberi/MainActivity.kt").read_text()

    assert 'RELEASE_WEB_ORIGIN = "https://harita.urgup.keenetic.link:443"' in source
    assert "isDebuggableBuild() && DEBUG_WEB_ORIGINS.contains(origin)" in source
    assert "override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest)" in source
    assert "override fun shouldOverrideUrlLoading(view: WebView, url: String)" in source
    assert "allowFileAccess = false" in source
    assert "allowContentAccess = false" in source
    assert "mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW" in source
    assert "WebView.setWebContentsDebuggingEnabled(isDebuggableBuild())" in source
    assert "ApplicationInfo.FLAG_DEBUGGABLE" in source


def test_release_disables_cleartext_while_debug_overlay_is_explicit():
    release_manifest = (ANDROID_ROOT / "main/AndroidManifest.xml").read_text()
    debug_manifest = (ANDROID_ROOT / "debug/AndroidManifest.xml").read_text()

    assert 'android:usesCleartextTraffic="false"' in release_manifest
    assert 'android:usesCleartextTraffic="true"' in debug_manifest


def test_background_location_coordinates_are_sent_in_post_bodies():
    source = (
        ANDROID_ROOT / "main/java/com/seyahat_rehberi/NearbyPoiTrackingService.kt"
    ).read_text()

    assert source.count('requestMethod = "POST"') >= 2
    assert 'put("lat", location.latitude)' in source
    assert 'put("lng", location.longitude)' in source
    assert '.appendQueryParameter("lat"' not in source
    assert '.appendQueryParameter("lng"' not in source
