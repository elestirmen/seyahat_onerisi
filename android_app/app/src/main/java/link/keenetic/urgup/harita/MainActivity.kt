package link.keenetic.urgup.harita

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.View
import android.widget.FrameLayout
import androidx.activity.addCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONArray

class MainActivity : AppCompatActivity() {
  companion object {
    private const val START_URL = "https://harita.urgup.keenetic.link/"
    private const val PERSONAL_ROUTES_URL = "https://harita.urgup.keenetic.link/personal_routes.html"
    private const val EXTRA_TARGET_URL = "target_url"
    private const val POI_ALERT_CHANNEL_ID = "nearby_poi_alerts"
  }

  private lateinit var rootContainer: FrameLayout
  private lateinit var webView: WebView

  private var filePathCallback: ValueCallback<Array<Uri>>? = null
  private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
  private var customView: View? = null
  private var customViewCallback: WebChromeClient.CustomViewCallback? = null

  private var geoPermissionOrigin: String? = null
  private var geoPermissionCallback: GeolocationPermissions.Callback? = null
  private lateinit var locationPermissionLauncher: ActivityResultLauncher<Array<String>>
  private lateinit var nativeTrackingLocationPermissionLauncher: ActivityResultLauncher<Array<String>>
  private lateinit var notificationPermissionLauncher: ActivityResultLauncher<String>
  private var pendingPoiTrackingCategories: List<String> = emptyList()
  private var pendingPoiTrackingRadiusMeters: Int = 250
  private var pendingPoiTrackingPanoramasEnabled: Boolean = true
  private var pendingPoiTrackingAllCategories: Boolean = true
  private var nativeVrModeActive = false
  private var previousRequestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    rootContainer = findViewById(android.R.id.content)
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

    nativeTrackingLocationPermissionLauncher =
      registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        val granted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
          results[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        val categories = pendingPoiTrackingCategories
        val radiusMeters = pendingPoiTrackingRadiusMeters
        val includePanoramas = pendingPoiTrackingPanoramasEnabled
        val trackAllCategories = pendingPoiTrackingAllCategories
        pendingPoiTrackingCategories = emptyList()
        pendingPoiTrackingRadiusMeters = 250
        pendingPoiTrackingPanoramasEnabled = true
        pendingPoiTrackingAllCategories = true

        if (granted) {
          startNearbyPoiTrackingService(categories, radiusMeters, includePanoramas, trackAllCategories)
        } else {
          Toast.makeText(
            this,
            getString(R.string.poi_tracking_permission_denied),
            Toast.LENGTH_SHORT,
          ).show()
        }
      }

    notificationPermissionLauncher =
      registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
        // Notification permission state is checked again right before posting.
      }

    setupWebView()
    createPoiAlertChannel()

    val initialUrl = resolveStartUrl(intent)
    if (savedInstanceState != null) {
      webView.restoreState(savedInstanceState)
      if (initialUrl != START_URL) {
        webView.loadUrl(initialUrl)
      }
    } else {
      webView.loadUrl(initialUrl)
    }

    onBackPressedDispatcher.addCallback(this) {
      when {
        customView != null && nativeVrModeActive -> {
          webView.evaluateJavascript(
            """
            (function() {
              if (typeof window.__APDClosePanoramaViewer === 'function') {
                window.__APDClosePanoramaViewer();
                return true;
              }
              return false;
            })();
            """.trimIndent(),
          ) { result ->
            if (result != "true") {
              hideCustomView()
            }
          }
        }
        customView != null -> hideCustomView()
        webView.canGoBack() -> webView.goBack()
        else -> finish()
      }
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus && (nativeVrModeActive || customView != null)) {
      setSystemBarsHidden(true)
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)

    val targetUrl = resolveStartUrl(intent)
    if (targetUrl != START_URL) {
      webView.loadUrl(targetUrl)
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
    webView.addJavascriptInterface(AndroidBridge(), "APDAndroid")

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

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
          showCustomView(view, callback)
        }

        override fun onHideCustomView() {
          hideCustomView()
        }
      }
  }

  private fun showCustomView(view: View?, callback: WebChromeClient.CustomViewCallback?) {
    if (view == null) {
      callback?.onCustomViewHidden()
      return
    }

    if (customView != null) {
      callback?.onCustomViewHidden()
      return
    }

    customView = view
    customViewCallback = callback
    rootContainer.addView(
      view,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    webView.visibility = View.GONE
    setSystemBarsHidden(true)
  }

  private fun hideCustomView() {
    val activeCustomView = customView ?: return

    rootContainer.removeView(activeCustomView)
    customView = null
    webView.visibility = View.VISIBLE
    customViewCallback?.onCustomViewHidden()
    customViewCallback = null

    if (!nativeVrModeActive) {
      setSystemBarsHidden(false)
    }
  }

  private fun setSystemBarsHidden(hidden: Boolean) {
    WindowCompat.setDecorFitsSystemWindows(window, !hidden)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    if (hidden) {
      controller.hide(WindowInsetsCompat.Type.systemBars())
    } else {
      controller.show(WindowInsetsCompat.Type.systemBars())
    }
  }

  private fun enterNativeVrMode() {
    if (!nativeVrModeActive) {
      previousRequestedOrientation = requestedOrientation
      nativeVrModeActive = true
    }

    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    setSystemBarsHidden(true)
  }

  private fun exitNativeVrMode() {
    if (!nativeVrModeActive) return

    nativeVrModeActive = false
    requestedOrientation = previousRequestedOrientation

    if (customView == null) {
      setSystemBarsHidden(false)
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

  private fun resolveStartUrl(intent: Intent?): String {
    val targetUrl = intent?.getStringExtra(EXTRA_TARGET_URL)?.trim()
    return if (targetUrl.isNullOrBlank()) START_URL else targetUrl
  }

  private fun buildPoiTargetUrl(poiId: String?): String {
    if (poiId.isNullOrBlank()) {
      return PERSONAL_ROUTES_URL
    }

    return Uri.parse(PERSONAL_ROUTES_URL)
      .buildUpon()
      .appendQueryParameter("poi", poiId)
      .build()
      .toString()
  }

  private fun buildPanoramaTargetUrl(alertId: String?, sourceType: String?): String {
    val normalizedAlertId = alertId?.trim().orEmpty()
    if (normalizedAlertId.isBlank()) {
      return PERSONAL_ROUTES_URL
    }

    return Uri.parse(PERSONAL_ROUTES_URL)
      .buildUpon()
      .appendQueryParameter("panorama", normalizedAlertId)
      .appendQueryParameter("panoramaSource", sourceType?.trim().takeUnless { it.isNullOrBlank() } ?: "standalone")
      .build()
      .toString()
  }

  private fun createPoiAlertChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      POI_ALERT_CHANNEL_ID,
      getString(R.string.nearby_poi_channel_name),
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = getString(R.string.nearby_poi_channel_description)
    }

    manager.createNotificationChannel(channel)
  }

  private fun hasNotificationPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
    return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    if (hasNotificationPermission()) return
    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
  }

  private fun parsePoiTrackingCategories(payload: String?): List<String> {
    val normalizedPayload = payload?.trim().orEmpty()
    if (normalizedPayload.isBlank()) return emptyList()

    return try {
      if (normalizedPayload.startsWith("[")) {
        buildList {
          val jsonArray = JSONArray(normalizedPayload)
          for (index in 0 until jsonArray.length()) {
            val categoryName = jsonArray.optString(index).trim()
            if (categoryName.isNotEmpty() && !contains(categoryName)) {
              add(categoryName)
            }
          }
        }
      } else {
        listOf(normalizedPayload)
      }
    } catch (_: Exception) {
      listOf(normalizedPayload)
    }
  }

  private fun parsePoiTrackingFlag(payload: String?, defaultValue: Boolean): Boolean {
    return when (payload?.trim()?.lowercase()) {
      null, "" -> defaultValue
      "1", "true", "yes", "on" -> true
      "0", "false", "no", "off" -> false
      else -> defaultValue
    }
  }

  private fun requestNearbyPoiTrackingLocationPermission(
    categories: List<String>,
    alertRadiusM: Int,
    includePanoramas: Boolean,
    trackAllCategories: Boolean,
  ) {
    pendingPoiTrackingCategories = categories
    pendingPoiTrackingRadiusMeters = alertRadiusM
    pendingPoiTrackingPanoramasEnabled = includePanoramas
    pendingPoiTrackingAllCategories = trackAllCategories
    nativeTrackingLocationPermissionLauncher.launch(
      arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
      ),
    )
  }

  private fun startNearbyPoiTrackingService(
    categories: List<String>,
    alertRadiusM: Int,
    includePanoramas: Boolean,
    trackAllCategories: Boolean,
  ) {
    requestNotificationPermissionIfNeeded()
    ContextCompat.startForegroundService(
      this,
      NearbyPoiTrackingService.buildStartIntent(this, categories, alertRadiusM, includePanoramas, trackAllCategories),
    )
  }

  private fun stopNearbyPoiTrackingService() {
    startService(NearbyPoiTrackingService.buildStopIntent(this))
  }

  private fun buildMutePoiPendingIntent(poiId: String, notificationId: Int): PendingIntent {
    val muteIntent =
      Intent(this, PoiNotificationActionReceiver::class.java).apply {
        action = PoiNotificationActionReceiver.ACTION_MUTE_POI
        putExtra(PoiNotificationActionReceiver.EXTRA_POI_ID, poiId)
        putExtra(PoiNotificationActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
      }

    return PendingIntent.getBroadcast(
      this,
      notificationId + 1,
      muteIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun showNearbyAlertNotification(
    title: String,
    message: String,
    alertId: String?,
    targetUrl: String?,
  ) {
    if (!hasNotificationPermission()) {
      requestNotificationPermissionIfNeeded()
      return
    }

    val normalizedAlertId = PoiNotificationPreferenceStore.normalizePoiId(alertId)
    if (normalizedAlertId.isEmpty()) return
    if (PoiNotificationPreferenceStore.isPoiMuted(this, normalizedAlertId)) return

    val safeTargetUrl =
      targetUrl?.trim().takeUnless { it.isNullOrBlank() } ?: when {
        normalizedAlertId.startsWith("route-panorama:") -> buildPanoramaTargetUrl(normalizedAlertId, "route")
        normalizedAlertId.startsWith("panorama:") -> buildPanoramaTargetUrl(normalizedAlertId, "standalone")
        else -> buildPoiTargetUrl(alertId)
      }
    val notificationId = safeTargetUrl.hashCode()
    val intent =
      Intent(this, MainActivity::class.java).apply {
        putExtra(EXTRA_TARGET_URL, safeTargetUrl)
        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }

    val pendingIntent =
      PendingIntent.getActivity(
        this,
        safeTargetUrl.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    val notification =
      NotificationCompat.Builder(this, POI_ALERT_CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(title)
        .setContentText(message)
        .setStyle(NotificationCompat.BigTextStyle().bigText(message))
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .addAction(
          0,
          getString(R.string.poi_tracking_mute_action),
          buildMutePoiPendingIntent(normalizedAlertId, notificationId),
        )
        .build()

    PoiNotificationPreferenceStore.persistLastAlertAt(this, normalizedAlertId, System.currentTimeMillis())
    NotificationManagerCompat.from(this).notify(notificationId, notification)
  }

  private fun showPoiAlertNotification(title: String, message: String, poiId: String?) {
    showNearbyAlertNotification(title, message, poiId, buildPoiTargetUrl(poiId))
  }

  private inner class AndroidBridge {
    @JavascriptInterface
    fun requestNotificationPermission() {
      runOnUiThread {
        requestNotificationPermissionIfNeeded()
      }
    }

    @JavascriptInterface
    fun showPoiNotification(title: String?, message: String?, poiId: String?) {
      runOnUiThread {
        val safeTitle = title?.takeIf { it.isNotBlank() } ?: getString(R.string.nearby_poi_notification_title)
        val safeMessage = message?.takeIf { it.isNotBlank() } ?: return@runOnUiThread
        showPoiAlertNotification(safeTitle, safeMessage, poiId)
      }
    }

    @JavascriptInterface
    fun showNearbyAlertNotification(title: String?, message: String?, alertId: String?, targetUrl: String?) {
      runOnUiThread {
        val safeTitle = title?.takeIf { it.isNotBlank() } ?: getString(R.string.nearby_poi_notification_title)
        val safeMessage = message?.takeIf { it.isNotBlank() } ?: return@runOnUiThread
        this@MainActivity.showNearbyAlertNotification(safeTitle, safeMessage, alertId, targetUrl)
      }
    }

    @JavascriptInterface
    fun isPoiNotificationMuted(poiId: String?): Boolean {
      return PoiNotificationPreferenceStore.isPoiMuted(this@MainActivity, poiId)
    }

    @JavascriptInterface
    fun setPoiNotificationMuted(poiId: String?, muted: Boolean) {
      PoiNotificationPreferenceStore.setPoiMuted(this@MainActivity, poiId, muted)
      if (muted) {
        PoiNotificationPreferenceStore.persistLastAlertAt(
          this@MainActivity,
          poiId,
          System.currentTimeMillis(),
        )
      }
    }

    @JavascriptInterface
    fun startPoiTrackingService(
      categoriesPayload: String?,
      alertRadiusMeters: String?,
      includePanoramasPayload: String?,
      trackAllCategoriesPayload: String?,
    ) {
      runOnUiThread {
        val radiusMeters = alertRadiusMeters?.toIntOrNull()?.coerceIn(100, 5000) ?: 250
        val categories = parsePoiTrackingCategories(categoriesPayload)
        val includePanoramas = parsePoiTrackingFlag(includePanoramasPayload, true)
        val trackAllCategories = parsePoiTrackingFlag(trackAllCategoriesPayload, true)

        if (hasLocationPermission()) {
          startNearbyPoiTrackingService(categories, radiusMeters, includePanoramas, trackAllCategories)
        } else {
          requestNearbyPoiTrackingLocationPermission(categories, radiusMeters, includePanoramas, trackAllCategories)
        }
      }
    }

    @JavascriptInterface
    fun stopPoiTrackingService() {
      runOnUiThread {
        stopNearbyPoiTrackingService()
      }
    }

    @JavascriptInterface
    fun isPoiTrackingServiceRunning(): Boolean {
      return NearbyPoiTrackingService.isRunning
    }

    @JavascriptInterface
    fun enterVrMode(): Boolean {
      runOnUiThread {
        enterNativeVrMode()
      }
      return true
    }

    @JavascriptInterface
    fun exitVrMode(): Boolean {
      runOnUiThread {
        exitNativeVrMode()
      }
      return true
    }
  }
}
