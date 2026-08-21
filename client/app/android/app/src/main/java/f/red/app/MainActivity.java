package f.red.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.app.AlarmManager;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {
    // One-shot flags — prevents showing the dialog on every resume
    private boolean batteryExemptionRequested = false;
    private boolean exactAlarmRequested = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RedNodePlugin.class);
        registerPlugin(RedDisguisePlugin.class);
        super.onCreate(savedInstanceState);
        
        // Critical: Force WebView to use proper device-width scaling for CSS media queries
        android.webkit.WebView webView = this.bridge.getWebView();
        if (webView != null) {
            android.webkit.WebSettings settings = webView.getSettings();
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.setInitialScale(0);

            // Grant WebRTC and Media Capture permissions inside Capacitor WebView preserving Bridge features
            webView.setWebChromeClient(new com.getcapacitor.BridgeWebChromeClient(this.bridge) {
                @Override
                public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                    runOnUiThread(() -> {
                        request.grant(request.getResources());
                    });
                }
            });
        }

        copyDebugLogsToPublicStorage();
        requestP2pPermissions();
        handleConversationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleConversationIntent(intent);
    }

    private void handleConversationIntent(Intent intent) {
        if (intent == null) return;
        String openConv = intent.getStringExtra("open_conversation");
        if (openConv != null && !openConv.isEmpty()) {
            android.webkit.WebView wv = this.bridge != null ? this.bridge.getWebView() : null;
            if (wv != null) {
                wv.postDelayed(() -> {
                    wv.evaluateJavascript("if (window.dispatchEvent) { window.dispatchEvent(new CustomEvent('red:open_conversation', { detail: '" + openConv + "' })); }", null);
                }, 1000);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Request battery exemption once per app lifetime (not every resume)
        if (!batteryExemptionRequested) {
            batteryExemptionRequested = true;
            requestBatteryExemption();
        }
        // Request exact alarm permission once per app lifetime
        if (!exactAlarmRequested) {
            exactAlarmRequested = true;
            requestExactAlarmPermission();
        }
    }

    private void requestP2pPermissions() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            String[] permissions = {
                android.Manifest.permission.CAMERA,
                android.Manifest.permission.RECORD_AUDIO,
                android.Manifest.permission.MODIFY_AUDIO_SETTINGS,
                android.Manifest.permission.BLUETOOTH_SCAN,
                android.Manifest.permission.BLUETOOTH_ADVERTISE,
                android.Manifest.permission.BLUETOOTH_CONNECT,
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.POST_NOTIFICATIONS,
                android.Manifest.permission.NEARBY_WIFI_DEVICES
            };
            for (String perm : permissions) {
                if (checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(permissions, 1001);
                    break;
                }
            }
        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            String[] permissions = {
                android.Manifest.permission.CAMERA,
                android.Manifest.permission.RECORD_AUDIO,
                android.Manifest.permission.MODIFY_AUDIO_SETTINGS,
                android.Manifest.permission.BLUETOOTH_SCAN,
                android.Manifest.permission.BLUETOOTH_ADVERTISE,
                android.Manifest.permission.BLUETOOTH_CONNECT,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            };
            for (String perm : permissions) {
                if (checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(permissions, 1001);
                    break;
                }
            }
        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            String[] permissions = {
                android.Manifest.permission.CAMERA,
                android.Manifest.permission.RECORD_AUDIO,
                android.Manifest.permission.MODIFY_AUDIO_SETTINGS,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            };
            for (String perm : permissions) {
                if (checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(permissions, 1001);
                    break;
                }
            }
        }
    }

    private void copyDebugLogsToPublicStorage() {
        try {
            String internalDir = getFilesDir().getAbsolutePath() + "/red_node";
            File publicDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            
            String[] filesToCopy = {"CRASH_DUMP.txt", "PANIC_DUMP.txt"};
            
            for (String fileName : filesToCopy) {
                File sourceFile = new File(internalDir, fileName);
                if (sourceFile.exists()) {
                    File destFile = new File(publicDir, "RED_" + fileName);
                    try (FileInputStream fis = new FileInputStream(sourceFile);
                         FileOutputStream fos = new FileOutputStream(destFile)) {
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = fis.read(buffer)) > 0) {
                            fos.write(buffer, 0, length);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Request battery optimization exemption from the user.
     * On Xiaomi HyperOS / MIUI, this is REQUIRED to keep the foreground service alive.
     * Without this, Android will kill the mesh node service regardless of WakeLock and
     * foreground service type declarations. The system shows a one-time dialog to the user.
     */
    private void requestBatteryExemption() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        } catch (Exception e) {
            // Fallback: open generic battery optimization settings if direct request fails
            try {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                startActivity(intent);
            } catch (Exception ignored) {}
        }
    }

    /**
     * Request exact alarm scheduling permission.
     * On API 31-32 (Android 12-12L): requires user dialog via ACTION_REQUEST_SCHEDULE_EXACT_ALARM.
     * On API 33+ (Android 13+): USE_EXACT_ALARM in manifest is sufficient (no dialog needed).
     * Fixes: "AlarmManager: Package f.red.app lost permission to set exact alarms!" on Lenovo Tab.
     */
    private void requestExactAlarmPermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            try {
                AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
                if (am != null && !am.canScheduleExactAlarms()) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                }
            } catch (Exception ignored) {}
        }
    }
}


