package link.keenetic.urgup.harita

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.addCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
  companion object {
    private const val START_URL = "https://harita.urgup.keenetic.link/"
  }

  private lateinit var webView: WebView

  private var filePathCallback: ValueCallback<Array<Uri>>? = null
  private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>

  private var geoPermissionOrigin: String? = null
  private var geoPermissionCallback: GeolocationPermissions.Callback? = null
  private lateinit var locationPermissionLauncher: ActivityResultLauncher<Array<String>>

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.webview)

    fileChooserLauncher =
      registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = filePathCallback ?: return@registerForActivityResult
        filePathCallback = null
        callback.onReceiveValue(
          WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data),
        )
      }

    locationPermissionLauncher =
      registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        val callback = geoPermissionCallback
        val origin = geoPermissionOrigin
        geoPermissionCallback = null
        geoPermissionOrigin = null

        if (callback == null || origin == null) return@registerForActivityResult

        val granted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
          results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        callback.invoke(origin, granted, false)
      }

    setupWebView()

    if (savedInstanceState != null) {
      webView.restoreState(savedInstanceState)
    } else {
      webView.loadUrl(START_URL)
    }

    onBackPressedDispatcher.addCallback(this) {
      if (webView.canGoBack()) webView.goBack() else finish()
    }
  }

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    webView.saveState(outState)
  }

  private fun setupWebView() {
    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

    webView.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      setGeolocationEnabled(true)
      mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
      userAgentString = "$userAgentString HaritaUrdupWebView/1.0"
    }

    webView.webViewClient =
      object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
          val uri = request.url
          val scheme = uri.scheme?.lowercase() ?: return false
          return when (scheme) {
            "http", "https" -> false
            else -> {
              openExternalUrl(uri)
              true
            }
          }
        }
      }

    webView.webChromeClient =
      object : WebChromeClient() {
        override fun onShowFileChooser(
          webView: WebView,
          filePathCallback: ValueCallback<Array<Uri>>,
          fileChooserParams: FileChooserParams,
        ): Boolean {
          this@MainActivity.filePathCallback?.onReceiveValue(null)
          this@MainActivity.filePathCallback = filePathCallback

          return try {
            fileChooserLauncher.launch(fileChooserParams.createIntent())
            true
          } catch (_: ActivityNotFoundException) {
            this@MainActivity.filePathCallback = null
            false
          }
        }

        override fun onGeolocationPermissionsShowPrompt(
          origin: String,
          callback: GeolocationPermissions.Callback,
        ) {
          if (hasLocationPermission()) {
            callback.invoke(origin, true, false)
            return
          }

          geoPermissionOrigin = origin
          geoPermissionCallback = callback
          locationPermissionLauncher.launch(
            arrayOf(
              Manifest.permission.ACCESS_FINE_LOCATION,
              Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
          )
        }
      }
  }

  private fun hasLocationPermission(): Boolean {
    val fine =
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarse =
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    return fine || coarse
  }

  private fun openExternalUrl(uri: Uri) {
    try {
      startActivity(Intent(Intent.ACTION_VIEW, uri))
    } catch (_: ActivityNotFoundException) {
      // no-op
    }
  }
}

