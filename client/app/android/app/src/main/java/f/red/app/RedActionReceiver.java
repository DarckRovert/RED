package f.red.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * RedActionReceiver — RED Sovereign Tactical Notification Action Dispatcher
 *
 * Handles user interactions directly from the Android ongoing notification shade:
 * - ACTION_PANIC_SOS: Immediately broadcasts an emergency SOS beacon across the local P2P mesh
 *                     without requiring the user to unlock or open the application.
 * - ACTION_SILENCE: Silences audio alerts.
 */
public class RedActionReceiver extends BroadcastReceiver {
    private static final String TAG = "RedActionReceiver";
    public static final String ACTION_PANIC_SOS = "f.red.app.ACTION_PANIC_SOS";
    public static final String ACTION_SILENCE = "f.red.app.ACTION_SILENCE";
    private static final String EMERGENCY_BEACON_URL = "http://127.0.0.1:7333/api/emergency/beacons";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        Log.w(TAG, "⚡ Notification Action triggered: " + action);

        if (ACTION_PANIC_SOS.equals(action)) {
            handlePanicSos(context);
        } else if (ACTION_SILENCE.equals(action)) {
            Log.i(TAG, "Mute / Silence action acknowledged.");
        }
    }

    private void handlePanicSos(Context context) {
        // Run in background thread to avoid blocking main thread
        new Thread(() -> {
            try {
                long now = System.currentTimeMillis();
                String beaconId = "sos_hud_" + now;

                // 1. Telemetría de Batería (Sin permisos requeridos en Android)
                Integer batteryLevel = null;
                try {
                    Intent batteryIntent = context.registerReceiver(null, new android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                    if (batteryIntent != null) {
                        int level = batteryIntent.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1);
                        int scale = batteryIntent.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1);
                        if (level >= 0 && scale > 0) {
                            batteryLevel = (int) ((level / (float) scale) * 100);
                        }
                    }
                } catch (Exception ignored) {}

                // 2. Coordenadas GPS Tácticas (Mejor esfuerzo si los permisos están concedidos)
                Double latitude = null;
                Double longitude = null;
                Double altitude = null;
                try {
                    android.location.LocationManager lm = (android.location.LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
                    if (lm != null) {
                        boolean hasFine = context.checkCallingOrSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
                        boolean hasCoarse = context.checkCallingOrSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
                        if (hasFine || hasCoarse) {
                            android.location.Location loc = lm.getLastKnownLocation(android.location.LocationManager.GPS_PROVIDER);
                            if (loc == null) {
                                loc = lm.getLastKnownLocation(android.location.LocationManager.NETWORK_PROVIDER);
                            }
                            if (loc == null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                                loc = lm.getLastKnownLocation(android.location.LocationManager.FUSED_PROVIDER);
                            }
                            if (loc != null) {
                                latitude = loc.getLatitude();
                                longitude = loc.getLongitude();
                                if (loc.hasAltitude()) altitude = loc.getAltitude();
                            }
                        }
                    }
                } catch (Exception ignored) {}

                // 3. Serialización JSON exacta compatible con Rust CreateEmergencyBeaconRequest y TypeScript EmergencyBeaconRecord
                StringBuilder sb = new StringBuilder();
                sb.append("{");
                sb.append("\"beacon_id\":\"").append(beaconId).append("\",");
                sb.append("\"id\":\"").append(beaconId).append("\",");
                sb.append("\"distress_type\":\"SOS_PANIC\",");
                sb.append("\"beacon_type\":\"general_sos\",");
                sb.append("\"message\":\"EMERGENCIA SOS DISPARADA DESDE NOTIFICACIÓN PERSISTENTE RED\",");
                sb.append("\"type\":\"SOS\",");
                sb.append("\"severity\":\"CRITICAL\",");
                sb.append("\"status\":\"ACTIVE\",");
                sb.append("\"is_active\":true,");
                sb.append("\"description\":\"EMERGENCIA SOS DISPARADA DESDE NOTIFICACIÓN PERSISTENTE RED\",");
                sb.append("\"timestamp\":").append(now);

                if (batteryLevel != null) {
                    sb.append(",\"battery_level\":").append(batteryLevel);
                    sb.append(",\"battery_pct\":").append(batteryLevel);
                }
                if (latitude != null && longitude != null) {
                    sb.append(",\"latitude\":").append(latitude);
                    sb.append(",\"longitude\":").append(longitude);
                    sb.append(",\"lat\":").append(latitude);
                    sb.append(",\"lon\":").append(longitude);
                }
                if (altitude != null) {
                    sb.append(",\"altitude\":").append(altitude);
                }
                sb.append("}");
                String jsonBody = sb.toString();

                URL url = new URL(EMERGENCY_BEACON_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(5000);
                conn.setDoOutput(true);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                conn.disconnect();

                Log.w(TAG, "🚨 SOS Emergency Beacon dispatched to local Rust node, HTTP response: " + code);

                // Update notification to indicate active emergency
                RedNodeService.updateNotificationStatus(context, "🚨 BALIZA SOS ACTIVA EN MALLA P2P", -1, true);

                new Handler(Looper.getMainLooper()).post(() -> {
                    Toast.makeText(context, "🚨 BALIZA SOS TRANSMITIDA A LA MALLA RED", Toast.LENGTH_LONG).show();
                });
            } catch (Exception e) {
                Log.e(TAG, "Error dispatching notification SOS beacon: " + e.getMessage());
                // Even if HTTP endpoint is unavailable, visually update notification to alert user
                RedNodeService.updateNotificationStatus(context, "🚨 BALIZA SOS DISPARADA (LOCAL)", -1, true);
            }
        }, "RedPanicSosThread").start();
    }
}
