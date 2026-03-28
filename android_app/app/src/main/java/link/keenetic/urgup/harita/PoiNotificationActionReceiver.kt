package link.keenetic.urgup.harita

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.app.NotificationManagerCompat

class PoiNotificationActionReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION_MUTE_POI = "link.keenetic.urgup.harita.action.MUTE_POI_NOTIFICATION"
    const val EXTRA_POI_ID = "extra_poi_id"
    const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
  }

  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != ACTION_MUTE_POI) return

    val poiId = intent.getStringExtra(EXTRA_POI_ID)
    val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, Int.MIN_VALUE)
    val normalizedPoiId = PoiNotificationPreferenceStore.normalizePoiId(poiId)
    if (normalizedPoiId.isEmpty()) return

    PoiNotificationPreferenceStore.setPoiMuted(context, normalizedPoiId, true)
    PoiNotificationPreferenceStore.persistLastAlertAt(context, normalizedPoiId, System.currentTimeMillis())

    if (notificationId != Int.MIN_VALUE) {
      NotificationManagerCompat.from(context).cancel(notificationId)
    }

    Toast.makeText(
      context,
      context.getString(R.string.poi_tracking_muted_confirmation),
      Toast.LENGTH_SHORT,
    ).show()
  }
}
