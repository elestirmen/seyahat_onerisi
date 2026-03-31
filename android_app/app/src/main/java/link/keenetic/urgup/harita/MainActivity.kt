package link.keenetic.urgup.harita

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
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
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
  companion object {
    private const val START_URL = "https://harita.urgup.keenetic.link/"
    private const val PERSONAL_ROUTES_URL = "https://harita.urgup.keenetic.link/personal_routes.html"
    private const val EXTRA_TARGET_URL = "target_url"
    private const val POI_ALERT_CHANNEL_ID = "nearby_poi_alerts"
    private const val DEFAULT_NATIVE_LOCATION_MAX_AGE_MS = 5 * 60 * 1000L
    private val TRUSTED_WEB_HOSTS =
      linkedSetOf<String>().apply {
        Uri.parse(START_URL).host?.lowercase()?.let(::add)
        add("localhost")
        add("127.0.0.1")
        add("10.0.2.2")
      }
  }

  private data class PendingPoiTrackingStartRequest(
    val categories: List<String>,
    val alertRadiusMeters: Int,
    val includePanoramas: Boolean,
    val trackAllCategories: Boolean,
  )

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
  private var pendingPoiTrackingStartRequest: PendingPoiTrackingStartRequest? = null
  @Volatile private var poiTrackingServiceRequestStatus: String = "idle"
  @Volatile private var poiTrackingServiceLastError: String? = null
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

        if (granted) {
          continuePendingPoiTrackingStart()
        } else {
          pendingPoiTrackingStartRequest = null
          setPoiTrackingServiceRequestState(
            "error",
            getString(R.string.poi_tracking_permission_denied),
          )
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
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)

    webView.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      setGeolocationEnabled(true)
      mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
      userAgentString = "$userAgentString HaritaUrdupWebView/1.0"
    }
    webView.addJavascriptInterface(AndroidBridge(), "APDAndroid")

    webView.webViewClient =
      object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
          val uri = request.url
          val scheme = uri.scheme?.lowercase() ?: return false
          return when (scheme) {
            "http", "https" -> {
              if (isTrustedWebUri(uri)) {
                false
              } else {
                openExternalUrl(uri)
                true
              }
            }
            "about", "javascript" -> false
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
          if (!isTrustedWebOrigin(origin)) {
            callback.invoke(origin, false, false)
            return
          }

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

  private fun setPoiTrackingServiceRequestState(status: String, errorMessage: String? = null) {
    poiTrackingServiceRequestStatus = status
    poiTrackingServiceLastError = errorMessage?.trim()?.takeIf { it.isNotEmpty() }
  }

  private fun getPoiTrackingServiceLastError(): String? {
    return NearbyPoiTrackingService.getLastStartupError() ?: poiTrackingServiceLastError
  }

  private fun getPoiTrackingServiceStartStatus(): String {
    if (NearbyPoiTrackingService.isRunning) {
      return "running"
    }

    if (!NearbyPoiTrackingService.getLastStartupError().isNullOrBlank()) {
      return "error"
    }

    return poiTrackingServiceRequestStatus
  }

  private fun isTrustedWebOrigin(origin: String?): Boolean {
    val parsedOrigin =
      origin
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?.let { runCatching { Uri.parse(it) }.getOrNull() }
    return isTrustedWebUri(parsedOrigin)
  }

  private fun isTrustedWebUri(uri: Uri?): Boolean {
    if (uri == null) return false
    val scheme = uri.scheme?.lowercase() ?: return false
    if (scheme != "http" && scheme != "https") return false
    val host = uri.host?.lowercase() ?: return false
    return TRUSTED_WEB_HOSTS.contains(host)
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
    if (targetUrl.isNullOrBlank()) return START_URL

    val targetUri = runCatching { Uri.parse(targetUrl) }.getOrNull() ?: return START_URL
    return if (isTrustedWebUri(targetUri)) targetUrl else START_URL
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

  private fun getBestLastKnownLocation(maxAgeMs: Long = DEFAULT_NATIVE_LOCATION_MAX_AGE_MS): Location? {
    if (!hasLocationPermission()) return null

    val locationManager = getSystemService(LOCATION_SERVICE) as? LocationManager ?: return null
    val now = System.currentTimeMillis()
    val providers =
      linkedSetOf(
        LocationManager.GPS_PROVIDER,
        LocationManager.NETWORK_PROVIDER,
        LocationManager.PASSIVE_PROVIDER,
      ).apply {
        addAll(locationManager.getProviders(true))
      }

    var bestLocation: Location? = null
    providers.forEach { provider ->
      val candidate =
        try {
          locationManager.getLastKnownLocation(provider)
        } catch (_: SecurityException) {
          null
        } ?: return@forEach

      val candidateTime = candidate.time.takeIf { it > 0L } ?: return@forEach
      val candidateAgeMs = now - candidateTime
      if (candidateAgeMs < 0L) return@forEach
      if (maxAgeMs > 0L && candidateAgeMs > maxAgeMs) return@forEach

      val currentBest = bestLocation
      bestLocation =
        when {
          currentBest == null -> candidate
          candidateTime > currentBest.time -> candidate
          candidateTime == currentBest.time && candidate.accuracy < currentBest.accuracy -> candidate
          else -> currentBest
        }
    }

    return bestLocation
  }

  private fun buildLocationPayload(location: Location): String {
    return JSONObject().apply {
      put("latitude", location.latitude)
      put("longitude", location.longitude)
      put("accuracy", location.accuracy.toDouble())
      put("timestamp", location.time)
      if (location.provider.isNullOrBlank()) {
        put("provider", JSONObject.NULL)
      } else {
        put("provider", location.provider)
      }
      put("source", "android-last-known")
    }.toString()
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

  private fun postNotificationIfPermitted(notificationId: Int, notification: Notification): Boolean {
    if (!hasNotificationPermission()) return false

    return try {
      NotificationManagerCompat.from(this).notify(notificationId, notification)
      true
    } catch (_: SecurityException) {
      false
    }
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
    pendingPoiTrackingStartRequest = PendingPoiTrackingStartRequest(
      categories = categories,
      alertRadiusMeters = alertRadiusM,
      includePanoramas = includePanoramas,
      trackAllCategories = trackAllCategories,
    )
    setPoiTrackingServiceRequestState("pending_location_permission")
    nativeTrackingLocationPermissionLauncher.launch(
      arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
      ),
    )
  }

  private fun continuePendingPoiTrackingStart() {
    val request = pendingPoiTrackingStartRequest ?: return

    pendingPoiTrackingStartRequest = null
    startNearbyPoiTrackingService(
      request.categories,
      request.alertRadiusMeters,
      request.includePanoramas,
      request.trackAllCategories,
    )
  }

  private fun mapPoiTrackingServiceStartError(error: Exception): String {
    if (error is IllegalStateException &&
      error.javaClass.name == "android.app.ForegroundServiceStartNotAllowedException"
    ) {
      return getString(R.string.poi_tracking_service_start_not_allowed)
    }

    return error.message?.takeIf { it.isNotBlank() } ?: getString(R.string.poi_tracking_service_start_failed)
  }

  private fun startNearbyPoiTrackingService(
    categories: List<String>,
    alertRadiusM: Int,
    includePanoramas: Boolean,
    trackAllCategories: Boolean,
  ) {
    requestNotificationPermissionIfNeeded()
    NearbyPoiTrackingService.clearStartupError()
    setPoiTrackingServiceRequestState("starting")

    try {
      ContextCompat.startForegroundService(
        this,
        NearbyPoiTrackingService.buildStartIntent(this, categories, alertRadiusM, includePanoramas, trackAllCategories),
      )
    } catch (error: Exception) {
      setPoiTrackingServiceRequestState("error", mapPoiTrackingServiceStartError(error))
      val errorMessage =
        getPoiTrackingServiceLastError() ?: getString(R.string.poi_tracking_service_start_failed)
      Toast.makeText(this, errorMessage, Toast.LENGTH_LONG).show()
    }
  }

  private fun stopNearbyPoiTrackingService() {
    pendingPoiTrackingStartRequest = null
    setPoiTrackingServiceRequestState("stopped")
    NearbyPoiTrackingService.clearStartupError()
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
    if (!postNotificationIfPermitted(notificationId, notification)) {
      requestNotificationPermissionIfNeeded()
    }
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

        NearbyPoiTrackingService.clearStartupError()
        setPoiTrackingServiceRequestState("idle")

        if (hasLocationPermission()) {
          pendingPoiTrackingStartRequest = PendingPoiTrackingStartRequest(
            categories = categories,
            alertRadiusMeters = radiusMeters,
            includePanoramas = includePanoramas,
            trackAllCategories = trackAllCategories,
          )
          continuePendingPoiTrackingStart()
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
    fun getPoiTrackingServiceStartStatus(): String {
      return this@MainActivity.getPoiTrackingServiceStartStatus()
    }

    @JavascriptInterface
    fun getPoiTrackingServiceLastError(): String? {
      return this@MainActivity.getPoiTrackingServiceLastError()
    }

    @JavascriptInterface
    fun getLastKnownLocation(maxAgeMsPayload: String?): String? {
      val maxAgeMs =
        maxAgeMsPayload
          ?.toLongOrNull()
          ?.coerceAtLeast(0L)
          ?: DEFAULT_NATIVE_LOCATION_MAX_AGE_MS
      val location = this@MainActivity.getBestLastKnownLocation(maxAgeMs) ?: return null
      return this@MainActivity.buildLocationPayload(location)
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
