package com.jackpotroyals.portal;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Notification;
import android.graphics.Color;
import android.os.Build;

/**
 * Creates the high-importance notification channel as soon as the app process
 * starts (including when Firebase wakes the process in the background), so
 * pushed promotions reliably show a heads-up banner and appear on the lock
 * screen on every device — not just the ones where the JS layer happened to
 * create the channel first.
 */
public class MainApplication extends Application {
    public static final String CHANNEL_ID = "jackpot_portal_alerts";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        // Don't overwrite an existing channel — Android locks importance after
        // creation and this also preserves any preference the user changed.
        if (manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Portal Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Jackpot Portal request alerts");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setLightColor(Color.parseColor("#ffd700"));
        manager.createNotificationChannel(channel);
    }
}
