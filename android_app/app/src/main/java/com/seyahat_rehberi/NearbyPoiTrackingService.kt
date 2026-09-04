package com.seyahat_rehberi

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import kotlin.math.roundToInt

class NearbyPoiTrackingService : Service() {
  companion object {
    private const val TAG = "NearbyPoiTracking"
    private const val ACTION_START = "com.seyahat_rehberi.action.START_POI_TRACKING"
    private const val ACTION_STOP = "com.seyahat_rehberi.action.STOP_POI_TRACKING"
    private const val EXTRA_CATEGORY = "extra_category"
    private const val EXTRA_CATEGORIES = "extra_categories"
    private const val EXTRA_ALERT_RADIUS_METERS = "extra_alert_radius_meters"
    private const val EXTRA_INCLUDE_PANORAMAS = "extra_include_panoramas"
    private const val EXTRA_TRACK_ALL_CATEGORIES = "extra_track_all_categories"
    private const val EXTRA_TARGET_URL = "target_url"
    private const val API_URL = "https://harita.urgup.keenetic.link/api/pois/nearby"
    private const val PANORAMA_API_URL = "https://harita.urgup.keenetic.link/api/panoramas/nearby"
    private const val PERSONAL_ROUTES_URL = "https://harita.urgup.keenetic.link/personal_routes.html"
    const val TRACKING_CHANNEL_ID = "poi_tracking_service"
    const val ALERT_CHANNEL_ID = "nearby_poi_alerts"
    private const val TRACKING_NOTIFICATION_ID = 3001
    private const val DEFAULT_ALERT_RADIUS_METERS = 250
    private const val MIN_ALERT_RADIUS_METERS = 100
    private const val MAX_ALERT_RADIUS_METERS = 5000
    private const val LOCATION_UPDATE_INTERVAL_MS = 15_000L
    private const val LOCATION_UPDATE_DISTANCE_METERS = 50f
    private const val SCAN_MIN_INTERVAL_MS = 30_000L
    private const val ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000L

    @Volatile
    var isRunning: Boolean = false

    @Volatile
    private var lastStartupErrorMessage: String? = null

    fun getLastStartupError(): String? = lastStartupErrorMessage

    fun clearStartupError() {
      lastStartupErrorMessage = null
    }

    private fun setStartupError(message: String?) {
      lastStartupErrorMessage = message?.trim()?.takeIf { it.isNotEmpty() }
    }

    fun buildStartIntent(
      context: Context,
      categories: List<String>,
      alertRadiusMeters: Int,
      includePanoramas: Boolean,
      trackAllCategories: Boolean,
    ): Intent {
      return Intent(context, NearbyPoiTrackingService::class.java).apply {
        action = ACTION_START
        putStringArrayListExtra(EXTRA_CATEGORIES, ArrayList(categories.filter { it.isNotBlank() }))
        putExtra(EXTRA_ALERT_RADIUS_METERS, alertRadiusMeters)
        putExtra(EXTRA_INCLUDE_PANORAMAS, includePanoramas)
        putExtra(EXTRA_TRACK_ALL_CATEGORIES, trackAllCategories)
      }
    }

    fun buildStopIntent(context: Context): Intent {
      return Intent(context, NearbyPoiTrackingService::class.java).apply {
        action = ACTION_STOP
      }
    }
  }

  private data class NearbyAlertItem(
    val id: String,
    val name: String,
    val typeLabel: String,
    val distanceMeters: Int,
    val targetUrl: String,
    val panoramaPath: String? = null,
    val panoramaOriginalPath: String? = null,
  )

  private data class NearbyScanResult(
    val items: List<NearbyAlertItem>,
    val attemptedSources: Int,
    val successfulSources: Int,
  )

  private lateinit var locationManager: LocationManager
  private val networkExecutor = Executors.newSingleThreadExecutor()
  private val lastAlertAtByPoiId = ConcurrentHashMap<String, Long>()
  private val insideAlertIds = ConcurrentHashMap<String, Boolean>()
  private val providersChangedReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != LocationManager.PROVIDERS_CHANGED_ACTION) return
        if (!isRunning) return
        beginTracking()
      }
    }

  private var selectedCategories: List<String> = emptyList()
  private var includePanoramas: Boolean = true
  private var trackAllCategories: Boolean = true
  private var alertRadiusMeters: Int = DEFAULT_ALERT_RADIUS_METERS
  private var lastScannedLocation: Location? = null
  private var lastScanAt: Long = 0L

  private val locationListener =
    object : LocationListener {
      override fun onLocationChanged(location: Location) {
        handleLocationUpdate(location)
      }
    }

  override fun onCreate() {
    super.onCreate()
    locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    ContextCompat.registerReceiver(
      this,
      providersChangedReceiver,
      IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION),
      ContextCompat.RECEIVER_EXPORTED,
    )
    createNotificationChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      clearStartupError()
      stopTracking()
      return START_NOT_STICKY
    }

    val categoriesFromIntent = intent?.getStringArrayListExtra(EXTRA_CATEGORIES)
      ?.map { it.trim() }
      ?.filter { it.isNotEmpty() }
      ?.distinct()
      .orEmpty()
    val singleCategory = intent?.getStringExtra(EXTRA_CATEGORY)?.trim()?.takeIf { it.isNotEmpty() }
    selectedCategories = if (categoriesFromIntent.isNotEmpty()) {
      categoriesFromIntent
    } else {
      listOfNotNull(singleCategory)
    }
    includePanoramas = intent?.getBooleanExtra(EXTRA_INCLUDE_PANORAMAS, true) ?: true
    trackAllCategories = intent?.getBooleanExtra(EXTRA_TRACK_ALL_CATEGORIES, true) ?: true
    alertRadiusMeters = sanitizeAlertRadius(intent?.getIntExtra(EXTRA_ALERT_RADIUS_METERS, DEFAULT_ALERT_RADIUS_METERS))
    clearStartupError()
    lastAlertAtByPoiId.clear()
    insideAlertIds.clear()
    lastScannedLocation = null
    lastScanAt = 0L

    isRunning = true
    if (!startAsForeground()) {
      isRunning = false
      stopSelf()
      return START_NOT_STICKY
    }
    beginTracking()

    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    removeLocationUpdates()
    try {
      unregisterReceiver(providersChangedReceiver)
    } catch (_: Exception) {
      // Ignore cleanup failures if the receiver was never registered or was already removed.
    }
    networkExecutor.shutdownNow()
    isRunning = false
    super.onDestroy()
  }

  private fun sanitizeAlertRadius(value: Int?): Int {
    return (value ?: DEFAULT_ALERT_RADIUS_METERS).coerceIn(
      MIN_ALERT_RADIUS_METERS,
      MAX_ALERT_RADIUS_METERS,
    )
  }

  private fun startAsForeground(): Boolean {
    val notification = buildTrackingNotification()
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          TRACKING_NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
        )
      } else {
        startForeground(TRACKING_NOTIFICATION_ID, notification)
      }
      true
    } catch (error: Exception) {
      Log.w(TAG, "Unable to start tracking service in foreground", error)
      setStartupError(mapForegroundStartError(error))
      false
    }
  }

  private fun mapForegroundStartError(error: Exception): String {
    val className = error.javaClass.name
    return when {
      className.endsWith("ForegroundServiceStartNotAllowedException") ->
        getString(R.string.poi_tracking_service_start_not_allowed)
      error is SecurityException ->
        getString(R.string.poi_tracking_notification_permission_denied)
      else ->
        error.message?.trim()?.takeIf { it.isNotEmpty() }
          ?: getString(R.string.poi_tracking_service_start_failed)
    }
  }

  private fun beginTracking() {
    removeLocationUpdates()

    if (!hasLocationPermission()) {
      setStartupError(getString(R.string.poi_tracking_permission_denied))
      updateTrackingNotification(getString(R.string.poi_tracking_notification_no_location))
      stopTracking()
      return
    }

    val requestedProviders = mutableListOf<String>()
    if (isProviderEnabled(LocationManager.GPS_PROVIDER)) {
      requestedProviders.add(LocationManager.GPS_PROVIDER)
    }
    if (isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
      requestedProviders.add(LocationManager.NETWORK_PROVIDER)
    }

    if (requestedProviders.isEmpty()) {
      updateTrackingNotification(getString(R.string.poi_tracking_notification_location_disabled))
      return
    }

    requestedProviders.forEach { provider ->
      try {
        locationManager.requestLocationUpdates(
          provider,
          LOCATION_UPDATE_INTERVAL_MS,
          LOCATION_UPDATE_DISTANCE_METERS,
          locationListener,
          Looper.getMainLooper(),
        )
      } catch (_: SecurityException) {
        setStartupError(getString(R.string.poi_tracking_permission_denied))
        updateTrackingNotification(getString(R.string.poi_tracking_notification_no_location))
        stopTracking()
        return
      }
    }

    updateTrackingNotification()
    seedLastKnownLocation(requestedProviders)
  }

  private fun seedLastKnownLocation(providers: List<String>) {
    var bestLastKnownLocation: Location? = null

    providers.forEach { provider ->
      try {
        val lastKnownLocation = locationManager.getLastKnownLocation(provider) ?: return@forEach
        bestLastKnownLocation =
          when (val currentBest = bestLastKnownLocation) {
            null -> lastKnownLocation
            else -> when {
              lastKnownLocation.time > currentBest.time -> lastKnownLocation
              lastKnownLocation.time == currentBest.time && lastKnownLocation.accuracy < currentBest.accuracy -> lastKnownLocation
              else -> currentBest
            }
          }
      } catch (_: SecurityException) {
        return@forEach
      }
    }

    bestLastKnownLocation?.let(::handleLocationUpdate)
  }

  private fun handleLocationUpdate(location: Location) {
    val now = System.currentTimeMillis()
    val previousLocation = lastScannedLocation
    if (previousLocation != null) {
      val movedMeters = previousLocation.distanceTo(location)
      val elapsedMs = now - lastScanAt
      if (movedMeters < LOCATION_UPDATE_DISTANCE_METERS && elapsedMs < SCAN_MIN_INTERVAL_MS) {
        return
      }
    }

    lastScannedLocation = Location(location)
    lastScanAt = now

    networkExecutor.execute {
      runNearbyScan(location)
    }
  }

  private fun hasNotificationPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
    return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun postNotificationIfPermitted(notificationId: Int, notification: Notification) {
    if (!hasNotificationPermission()) return

    try {
      NotificationManagerCompat.from(this).notify(notificationId, notification)
    } catch (_: SecurityException) {
      // Ignore transient permission/state mismatches; foreground tracking keeps running.
    }
  }

  private fun runNearbyScan(location: Location) {
    try {
      val scanResult = fetchNearbyAlertItems(location)
      val alertItems = scanResult.items
      if (alertItems.isEmpty()) {
        if (scanResult.attemptedSources > 0 && scanResult.successfulSources == 0) {
          updateTrackingNotification(getString(R.string.poi_tracking_notification_error))
          return
        }

        insideAlertIds.clear()
        updateTrackingNotification(
          getString(
            R.string.poi_tracking_notification_empty,
            trackingSelectionLabel(),
            alertRadiusMeters,
          ),
        )
        return
      }

      val nearestPoi = alertItems.first()
      updateTrackingNotification(
        getString(
          R.string.poi_tracking_notification_nearest,
          nearestPoi.name,
          formatDistance(nearestPoi.distanceMeters),
        ),
      )

      val now = System.currentTimeMillis()
      val visibleAlertIds = alertItems
        .map { it.id.trim() }
        .filter { it.isNotEmpty() }
        .toSet()
      insideAlertIds.keys
        .filter { storedAlertId -> !visibleAlertIds.contains(storedAlertId) }
        .forEach { staleAlertId ->
          insideAlertIds.remove(staleAlertId)
        }

      alertItems.forEach { alertItem ->
        val alertId = alertItem.id.trim()
        if (alertId.isBlank()) {
          return@forEach
        }

        val wasInside = insideAlertIds.put(alertId, true) == true
        if (PoiNotificationPreferenceStore.isPoiMuted(this, alertItem.id)) {
          return@forEach
        }
        if (wasInside) {
          return@forEach
        }

        val lastAlertAt = maxOf(
          lastAlertAtByPoiId[alertId] ?: 0L,
          PoiNotificationPreferenceStore.getLastAlertAt(this, alertId),
        )
        if ((now - lastAlertAt) < ALERT_COOLDOWN_MS) {
          return@forEach
        }

        showNearbyAlertNotification(alertItem)
        lastAlertAtByPoiId[alertId] = now
        PoiNotificationPreferenceStore.persistLastAlertAt(this, alertId, now)
      }
    } catch (error: Exception) {
      Log.w(TAG, "Nearby content scan failed", error)
      updateTrackingNotification(getString(R.string.poi_tracking_notification_error))
    }
  }

  private fun fetchNearbyAlertItems(location: Location): NearbyScanResult {
    val items = mutableListOf<NearbyAlertItem>()
    var attemptedSources = 0
    var successfulSources = 0

    if (trackAllCategories || selectedCategories.isNotEmpty()) {
      attemptedSources += 1
      try {
        items += fetchNearbyPois(location)
        successfulSources += 1
      } catch (error: Exception) {
        Log.w(TAG, "Nearby POI scan failed", error)
      }
    }
    if (includePanoramas) {
      attemptedSources += 1
      try {
        items += fetchNearbyPanoramas(location)
        successfulSources += 1
      } catch (error: Exception) {
        Log.w(TAG, "Nearby panorama scan failed", error)
      }
    }

    return NearbyScanResult(
      items = items.sortedBy { it.distanceMeters },
      attemptedSources = attemptedSources,
      successfulSources = successfulSources,
    )
  }

  private fun fetchNearbyPois(location: Location): List<NearbyAlertItem> {
    val requestBody = JSONObject().apply {
      put("lat", location.latitude)
      put("lng", location.longitude)
      put("radius_m", alertRadiusMeters)
      put("limit", 20)
      if (!trackAllCategories) {
        put("categories", JSONArray(selectedCategories))
      }
    }

    val connection = (URL(API_URL).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 10_000
      readTimeout = 10_000
      doInput = true
      doOutput = true
      setRequestProperty("Content-Type", "application/json; charset=utf-8")
      outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
        writer.write(requestBody.toString())
      }
    }

    return try {
      val responseCode = connection.responseCode
      if (responseCode !in 200..299) {
        throw IllegalStateException("Nearby POI request failed: $responseCode")
      }

      val payload = connection.inputStream.bufferedReader().use { it.readText() }
      val root = JSONObject(payload)
      val poisArray = root.optJSONArray("pois") ?: return emptyList()
      val pois = mutableListOf<NearbyAlertItem>()

      for (index in 0 until poisArray.length()) {
        val item = poisArray.optJSONObject(index) ?: continue
        val poiId = item.optString("_id", item.optString("id"))
          .ifBlank { item.optString("name", "poi-$index") }
        val poiName = item.optString("name", getString(R.string.nearby_poi_notification_title))
        val poiCategory = item.optString("category", selectedCategories.firstOrNull().orEmpty())
        val poiDistanceMeters = item.optDouble("distance_m", 0.0).roundToInt()

        pois.add(
          NearbyAlertItem(
            id = poiId,
            name = poiName,
            typeLabel = poiCategory.takeIf { it.isNotBlank() }?.let { formatCategoryLabel(it) } ?: trackingPoiCategoryLabel(),
            distanceMeters = poiDistanceMeters,
            targetUrl = buildPoiTargetUrl(poiId),
          ),
        )
      }

      pois
    } finally {
      connection.disconnect()
    }
  }

  private fun fetchNearbyPanoramas(location: Location): List<NearbyAlertItem> {
    val requestBody = JSONObject().apply {
      put("lat", location.latitude)
      put("lng", location.longitude)
      put("radius_m", alertRadiusMeters)
      put("limit", 20)
    }

    val connection = (URL(PANORAMA_API_URL).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 10_000
      readTimeout = 10_000
      doInput = true
      doOutput = true
      setRequestProperty("Content-Type", "application/json; charset=utf-8")
      outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
        writer.write(requestBody.toString())
      }
    }

    return try {
      val responseCode = connection.responseCode
      if (responseCode == HttpURLConnection.HTTP_NOT_FOUND || responseCode == HttpURLConnection.HTTP_BAD_METHOD) {
        Log.w(TAG, "Nearby panorama endpoint is unavailable ($responseCode); skipping panorama alerts")
        return emptyList()
      }
      if (responseCode !in 200..299) {
        throw IllegalStateException("Nearby panorama request failed: $responseCode")
      }

      val payload = connection.inputStream.bufferedReader().use { it.readText() }
      val root = JSONObject(payload)
      val panoramasArray = root.optJSONArray("panoramas") ?: return emptyList()
      val panoramas = mutableListOf<NearbyAlertItem>()

      for (index in 0 until panoramasArray.length()) {
        val item = panoramasArray.optJSONObject(index) ?: continue
        val alertId = item.optString("_id", item.optString("id"))
          .ifBlank { item.optString("name", "panorama-$index") }
        val sourceType = item.optString("source_type", "standalone")
        val panoramaName = item.optString("name", item.optString("caption", "360° Panorama"))
          .ifBlank { "360° Panorama" }
        val panoramaDistanceMeters = item.optDouble("distance_m", 0.0).roundToInt()

        panoramas.add(
          NearbyAlertItem(
            id = alertId,
            name = panoramaName,
            typeLabel = getString(R.string.poi_tracking_panorama_label),
            distanceMeters = panoramaDistanceMeters,
            targetUrl = buildPanoramaTargetUrl(
              alertId,
              sourceType,
              item.optString("path").trim().ifBlank { null },
              item.optString("original_path").trim().ifBlank { null },
              panoramaName,
            ),
            panoramaPath = item.optString("path").trim().ifBlank { null },
            panoramaOriginalPath = item.optString("original_path").trim().ifBlank { null },
          ),
        )
      }

      panoramas
    } finally {
      connection.disconnect()
    }
  }

  private fun showNearbyAlertNotification(alertItem: NearbyAlertItem) {
    val notificationId = alertItem.id.hashCode()
    val title = getString(
      R.string.poi_tracking_alert_title,
      alertItem.typeLabel.ifBlank { trackingSelectionLabel() },
    )
    val message = getString(
      R.string.poi_tracking_alert_message,
      alertItem.name,
      formatDistance(alertItem.distanceMeters),
    )

    val notification =
      NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(title)
        .setContentText(message)
        .setStyle(NotificationCompat.BigTextStyle().bigText(message))
        .setContentIntent(buildContentPendingIntent(alertItem.targetUrl, notificationId))
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .addAction(
          0,
          getString(R.string.poi_tracking_mute_action),
          buildMutePoiPendingIntent(alertItem.id, notificationId),
        )
        .build()

    postNotificationIfPermitted(notificationId, notification)
  }

  private fun buildTrackingNotification(statusText: String? = null): Notification {
    val stopIntent = buildStopIntent(this)
    val stopPendingIntent =
      PendingIntent.getService(
        this,
        TRACKING_NOTIFICATION_ID,
        stopIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    return NotificationCompat.Builder(this, TRACKING_CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(getString(R.string.poi_tracking_notification_title))
      .setContentText(
        statusText ?: getString(
          R.string.poi_tracking_notification_active,
          trackingSelectionLabel(),
          alertRadiusMeters,
        ),
      )
      .setContentIntent(buildContentPendingIntent(PERSONAL_ROUTES_URL, TRACKING_NOTIFICATION_ID))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(
        0,
        getString(R.string.poi_tracking_stop_action),
        stopPendingIntent,
      )
      .build()
  }

  private fun updateTrackingNotification(statusText: String? = null) {
    postNotificationIfPermitted(
      TRACKING_NOTIFICATION_ID,
      buildTrackingNotification(statusText),
    )
  }

  private fun buildContentPendingIntent(targetUrl: String, requestCode: Int): PendingIntent {
    val openIntent =
      Intent(this, MainActivity::class.java).apply {
        putExtra(EXTRA_TARGET_URL, targetUrl)
        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }

    return PendingIntent.getActivity(
      this,
      requestCode,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
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

  private fun buildPoiTargetUrl(poiId: String): String {
    return Uri.parse(PERSONAL_ROUTES_URL)
      .buildUpon()
      .appendQueryParameter("poi", poiId)
      .build()
      .toString()
  }

  private fun buildPanoramaTargetUrl(
    alertId: String,
    sourceType: String,
    panoramaPath: String? = null,
    panoramaOriginalPath: String? = null,
    panoramaTitle: String? = null,
  ): String {
    return Uri.parse(PERSONAL_ROUTES_URL)
      .buildUpon()
      .appendQueryParameter("panorama", alertId)
      .appendQueryParameter("panoramaSource", sourceType.ifBlank { "standalone" })
      .apply {
        panoramaPath?.trim()?.takeIf { it.isNotEmpty() }?.let {
          appendQueryParameter("panoramaPath", it)
        }
        panoramaOriginalPath?.trim()?.takeIf { it.isNotEmpty() }?.let {
          appendQueryParameter("panoramaOriginalPath", it)
        }
        panoramaTitle?.trim()?.takeIf { it.isNotEmpty() }?.let {
          appendQueryParameter("panoramaTitle", it)
        }
      }
      .build()
      .toString()
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val notificationManager = getSystemService(NotificationManager::class.java) ?: return

    val trackingChannel = NotificationChannel(
      TRACKING_CHANNEL_ID,
      getString(R.string.poi_tracking_channel_name),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = getString(R.string.poi_tracking_channel_description)
    }

    val alertChannel = NotificationChannel(
      ALERT_CHANNEL_ID,
      getString(R.string.nearby_poi_channel_name),
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = getString(R.string.nearby_poi_channel_description)
    }

    notificationManager.createNotificationChannel(trackingChannel)
    notificationManager.createNotificationChannel(alertChannel)
  }

  private fun trackingPoiCategoryLabel(): String {
    if (trackAllCategories || selectedCategories.isEmpty()) {
      return getString(R.string.poi_tracking_all_categories)
    }

    val displayLabels = selectedCategories.map { formatCategoryLabel(it) }
    if (displayLabels.size <= 2) {
      return displayLabels.joinToString(", ")
    }

    return "${displayLabels.take(2).joinToString(", ")} +${displayLabels.size - 2}"
  }

  private fun trackingSelectionLabel(): String {
    val parts = mutableListOf<String>()

    if (trackAllCategories || selectedCategories.isNotEmpty()) {
      parts += trackingPoiCategoryLabel()
    }

    if (includePanoramas) {
      parts += getString(R.string.poi_tracking_panorama_label)
    }

    if (parts.isEmpty()) {
      return getString(R.string.poi_tracking_all_categories)
    }

    return parts.joinToString(" + ")
  }

  private fun formatCategoryLabel(categoryName: String): String {
    val normalized = categoryName.trim().replace('_', ' ').replace('-', ' ')
    if (normalized.isBlank()) return getString(R.string.poi_tracking_all_categories)

    return normalized
      .split(Regex("\\s+"))
      .filter { it.isNotBlank() }
      .joinToString(" ") { word ->
        word.replaceFirstChar { character -> character.titlecase() }
      }
  }

  private fun formatDistance(distanceMeters: Int): String {
    if (distanceMeters >= 1000) {
      return String.format("%.2f km", distanceMeters / 1000.0)
    }
    return "$distanceMeters m"
  }

  private fun hasLocationPermission(): Boolean {
    val fineGranted =
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarseGranted =
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    return fineGranted || coarseGranted
  }

  private fun isProviderEnabled(provider: String): Boolean {
    return try {
      locationManager.isProviderEnabled(provider)
    } catch (_: Exception) {
      false
    }
  }

  private fun removeLocationUpdates() {
    try {
      locationManager.removeUpdates(locationListener)
    } catch (_: SecurityException) {
      // Ignore cleanup failures when permissions are already gone.
    }
  }

  private fun stopTracking() {
    removeLocationUpdates()
    isRunning = false
    insideAlertIds.clear()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }

    stopSelf()
  }
}
