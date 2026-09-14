package f.red.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * BootReceiver — RED Sovereign Mesh OS
 *
 * Ensures 24/7 node survivability across device reboots and package upgrades.
 * Listens for ACTION_BOOT_COMPLETED, ACTION_MY_PACKAGE_REPLACED, and QUICKBOOT_POWERON.
 * Automatically starts RedNodeService as a Foreground Service.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        Log.i(TAG, "🚨 System Broadcast received: " + action + ". Initiating RED Sovereign Node resurrection.");

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            try {
                Intent serviceIntent = new Intent(context, RedNodeService.class);
                String dataDir = context.getFilesDir().getAbsolutePath() + "/red_node";
                serviceIntent.putExtra("dataDir", dataDir);
                // Flag to inform service it was restored by OS boot
                serviceIntent.putExtra("bootRestored", true);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                Log.i(TAG, "✅ RedNodeService successfully launched post-boot.");
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to start RedNodeService post-boot: " + e.getMessage(), e);
            }
        }
    }
}
