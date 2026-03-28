package link.keenetic.urgup.harita

import android.content.Context

object PoiNotificationPreferenceStore {
  const val PREFS_NAME = "poi_notification_prefs"
  const val PREF_KEY_MUTED_POI_IDS = "muted_poi_ids"
  const val PREF_KEY_LAST_ALERT_AT_PREFIX = "last_alert_at_"

  fun normalizePoiId(rawPoiId: String?): String {
    return rawPoiId?.trim().orEmpty()
  }

  fun isPoiMuted(context: Context, poiId: String?): Boolean {
    val normalizedPoiId = normalizePoiId(poiId)
    if (normalizedPoiId.isEmpty()) return false

    return context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getStringSet(PREF_KEY_MUTED_POI_IDS, emptySet())
      .orEmpty()
      .any { storedPoiId -> normalizePoiId(storedPoiId) == normalizedPoiId }
  }

  fun setPoiMuted(context: Context, poiId: String?, muted: Boolean) {
    val normalizedPoiId = normalizePoiId(poiId)
    if (normalizedPoiId.isEmpty()) return

    val preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val mutedPoiIds = preferences
      .getStringSet(PREF_KEY_MUTED_POI_IDS, emptySet())
      .orEmpty()
      .map { storedPoiId -> normalizePoiId(storedPoiId) }
      .filter { storedPoiId -> storedPoiId.isNotEmpty() }
      .toMutableSet()

    if (muted) {
      mutedPoiIds.add(normalizedPoiId)
    } else {
      mutedPoiIds.remove(normalizedPoiId)
    }

    preferences.edit()
      .putStringSet(PREF_KEY_MUTED_POI_IDS, mutedPoiIds)
      .apply()
  }

  fun getLastAlertAt(context: Context, poiId: String?): Long {
    val normalizedPoiId = normalizePoiId(poiId)
    if (normalizedPoiId.isEmpty()) return 0L

    return context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getLong("$PREF_KEY_LAST_ALERT_AT_PREFIX$normalizedPoiId", 0L)
  }

  fun persistLastAlertAt(context: Context, poiId: String?, timestamp: Long) {
    val normalizedPoiId = normalizePoiId(poiId)
    if (normalizedPoiId.isEmpty()) return

    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putLong("$PREF_KEY_LAST_ALERT_AT_PREFIX$normalizedPoiId", timestamp)
      .apply()
  }
}
