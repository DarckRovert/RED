package f.red.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.IBinder;
import android.os.ParcelUuid;
import android.util.Log;
import androidx.annotation.Nullable;
import java.util.UUID;

public class RedNodeService extends Service {
    private static final String TAG = "RedNodeService";
    private static final String CHANNEL_ID = "RedNodeServiceChannel";
    // RED P2P service UUID — must match bluethootTransport.ts constant
    private static final String RED_BLE_SERVICE_UUID = "00001818-0000-1000-8000-00805f9b34fb";
    private static boolean isNodeRunning = false;
    private BluetoothLeAdvertiser bleAdvertiser = null;
    private AdvertiseCallback advertiseCallback = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isNodeRunning && intent != null) {
            String dataDir = intent.getStringExtra("dataDir");
            String password = intent.getStringExtra("password");

            // Avoid nulls if started by system
            if (dataDir == null) dataDir = getFilesDir().getAbsolutePath() + "/red_node";
            if (password == null) password = "default_mobile_password";

            // Build notification - use simple foreground without a typed service
            // to avoid SecurityException on Android 14 (API 34+)
            Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                    .setContentTitle("RED Protocol")
                    .setContentText("Decentralized node running")
                    .setOngoing(true);

            int iconResId = getResources().getIdentifier("ic_launcher", "mipmap", getPackageName());
            if (iconResId != 0) {
                builder.setSmallIcon(iconResId);
            } else {
                builder.setSmallIcon(android.R.drawable.ic_dialog_info);
            }

            Notification notification = builder.build();

            try {
                startForeground(1, notification);
            } catch (Exception e) {
                e.printStackTrace();
            }

            final String finalDataDir = dataDir;
            final String finalPassword = password;
            
            // Start the Rust Node in a background thread
            new Thread(() -> {
                try {
                    RedNodePlugin.startNode(finalDataDir, finalPassword);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }).start();
            
            isNodeRunning = true;

            // Start BLE Advertising so nearby RED devices can discover this node
            startBleAdvertising();
        }

        // START_STICKY ensures the OS tries to restart the background service if it kills it for memory
        return START_STICKY;
    }

    /**
     * Starts broadcasting a BLE advertisement with the RED service UUID.
     * This allows the Capacitor BLE plugin on other devices to discover this device.
     */
    private void startBleAdvertising() {
        // Check that hardware supports BLE Peripheral mode
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)) {
            Log.w(TAG, "BLE not supported on this hardware — skipping advertise");
            return;
        }

        BluetoothManager btManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (btManager == null) return;

        BluetoothAdapter btAdapter = btManager.getAdapter();
        if (btAdapter == null || !btAdapter.isEnabled()) {
            Log.w(TAG, "Bluetooth is disabled — cannot advertise");
            return;
        }

        bleAdvertiser = btAdapter.getBluetoothLeAdvertiser();
        if (bleAdvertiser == null) {
            Log.w(TAG, "BluetoothLeAdvertiser not available (device may not support peripheral mode)");
            return;
        }

        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
                .setConnectable(true)
                .setTimeout(0) // Advertise indefinitely
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
                .build();

        ParcelUuid serviceUuid = new ParcelUuid(UUID.fromString(RED_BLE_SERVICE_UUID));

        AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(true) // Other devices see "RED-<devicename>"
                .setIncludeTxPowerLevel(false)
                .addServiceUuid(serviceUuid)
                .build();

        advertiseCallback = new AdvertiseCallback() {
            @Override
            public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                Log.i(TAG, "[BLE] RED Peripheral advertising started. UUID=" + RED_BLE_SERVICE_UUID);
            }

            @Override
            public void onStartFailure(int errorCode) {
                Log.e(TAG, "[BLE] Advertising failed. Error code: " + errorCode);
            }
        };

        try {
            bleAdvertiser.startAdvertising(settings, data, advertiseCallback);
        } catch (Exception e) {
            Log.e(TAG, "[BLE] Exception starting advertise: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // Clean up BLE advertising when service is stopped
        if (bleAdvertiser != null && advertiseCallback != null) {
            try {
                bleAdvertiser.stopAdvertising(advertiseCallback);
                Log.i(TAG, "[BLE] Advertising stopped.");
            } catch (Exception e) {
                Log.e(TAG, "[BLE] Error stopping advertise: " + e.getMessage());
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null; // We only use started service, not bound service
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "RED Node Background Process",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Keeps the decentralized P2P network connected in the background");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}
