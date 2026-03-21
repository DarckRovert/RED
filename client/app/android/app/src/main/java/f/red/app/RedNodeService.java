package f.red.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.ParcelUuid;
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.Nullable;
import java.util.UUID;

public class RedNodeService extends Service {
    private static final String TAG = "RedNodeService";
    private static final String CHANNEL_ID = "RedNodeServiceChannel";
    // RED P2P service UUID — must match bluethootTransport.ts constant
    private static final String RED_BLE_SERVICE_UUID = "00001818-0000-1000-8000-00805f9b34fb";
    private static final String RED_BLE_TX_CHAR_UUID = "00002a4d-0000-1000-8000-00805f9b34fb";
    private static final String RED_BLE_RX_CHAR_UUID = "00002a6e-0000-1000-8000-00805f9b34fb";
    private static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private static boolean isNodeRunning = false;
    private BluetoothLeAdvertiser bleAdvertiser = null;
    private AdvertiseCallback advertiseCallback = null;
    private BluetoothGattServer gattServer = null;
    private PowerManager.WakeLock wakeLock = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        
        // Acquire WakeLock to keep CPU running even when screen is off
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RedNode:WakeLock");
            wakeLock.acquire(10 * 60 * 1000L); // 10 minutes timeout, renewable
            Log.i(TAG, "WakeLock acquired: Node will stay active in background");
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String dataDir = intent.getStringExtra("dataDir");
            String password = intent.getStringExtra("password");

            // Avoid nulls if started by system
            if (dataDir == null) dataDir = getFilesDir().getAbsolutePath() + "/red_node";

            // Build notification
            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            builder.setContentTitle("RED Protocol")
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
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
                } else {
                    startForeground(1, notification);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error starting foreground service: " + e.getMessage());
                e.printStackTrace();
            }

            if (password == null || password.isEmpty() || password.equals("default_mobile_password")) {
                Log.w(TAG, "Service restarted by OS without password. Waiting for UI plugin call to boot Rust.");
            } else {
                final String finalDataDir = dataDir;
                final String finalPassword = password;
                
                // Start the Rust Node in a background thread
                new Thread(() -> {
                    try {
                        Thread.sleep(100); // Reduced artificial delay
                        Log.i(TAG, "Starting Rust Node JNI call with UI password...");
                        RedNodePlugin.startNode(finalDataDir, finalPassword);
                        Log.i(TAG, "Rust Node JNI call returned successfully.");
                    } catch (Exception e) {
                        Log.e(TAG, "Error starting Rust node: " + e.getMessage());
                        e.printStackTrace();
                    }
                }).start();
                
                // Removed isNodeRunning = true; let Rust handle its own state concurrency
            }

            // Start GATT Server to receive incoming BLE P2P connections
            startGattServer();

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
        // Check permissions before advertising (Android 12+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (checkSelfPermission(android.Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "BLUETOOTH_ADVERTISE permission not granted. Cannot advertise.");
                return;
            }
        }

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
        
        // Release WakeLock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.i(TAG, "WakeLock released.");
        }

        // Clean up BLE advertising when service is stopped
        if (bleAdvertiser != null && advertiseCallback != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (checkSelfPermission(android.Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED) {
                        bleAdvertiser.stopAdvertising(advertiseCallback);
                    }
                } else {
                    bleAdvertiser.stopAdvertising(advertiseCallback);
                }
                Log.i(TAG, "[BLE] Advertising stopped.");
            } catch (Exception e) {
                Log.e(TAG, "[BLE] Error stopping advertise: " + e.getMessage());
            }
        }

        if (gattServer != null) {
            gattServer.close();
            Log.i(TAG, "[BLE] GATT Server closed.");
        }
    }

    private void startGattServer() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            if (checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
        }

        BluetoothManager btManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (btManager == null) return;
        
        gattServer = btManager.openGattServer(this, gattServerCallback);
        if (gattServer == null) {
            Log.w(TAG, "Unable to open GATT Server");
            return;
        }

        BluetoothGattService service = new BluetoothGattService(
                UUID.fromString(RED_BLE_SERVICE_UUID),
                BluetoothGattService.SERVICE_TYPE_PRIMARY);

        BluetoothGattCharacteristic txChar = new BluetoothGattCharacteristic(
                UUID.fromString(RED_BLE_TX_CHAR_UUID),
                BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
                BluetoothGattCharacteristic.PERMISSION_WRITE);

        BluetoothGattCharacteristic rxChar = new BluetoothGattCharacteristic(
                UUID.fromString(RED_BLE_RX_CHAR_UUID),
                BluetoothGattCharacteristic.PROPERTY_READ | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ);

        BluetoothGattDescriptor cccd = new BluetoothGattDescriptor(
                CCCD_UUID,
                BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE);
        rxChar.addDescriptor(cccd);

        service.addCharacteristic(txChar);
        service.addCharacteristic(rxChar);
        gattServer.addService(service);
        Log.i(TAG, "[BLE] GATT Server started and service added.");
    }

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {
        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            super.onConnectionStateChange(device, status, newState);
            if (newState == android.bluetooth.BluetoothProfile.STATE_CONNECTED) {
                Log.i(TAG, "[BLE Server] Device connected: " + device.getAddress());
            } else if (newState == android.bluetooth.BluetoothProfile.STATE_DISCONNECTED) {
                Log.i(TAG, "[BLE Server] Device disconnected: " + device.getAddress());
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId, BluetoothGattCharacteristic characteristic, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            super.onCharacteristicWriteRequest(device, requestId, characteristic, preparedWrite, responseNeeded, offset, value);
            
            if (RED_BLE_TX_CHAR_UUID.equals(characteristic.getUuid().toString())) {
                if (responseNeeded) {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) return;
                    gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
                }

                if (value != null && value.length > 0) {
                    // Forward bytes to Capacitor App via RedNodePlugin static event emitter
                    RedNodePlugin.emitBleMessage(value, device.getAddress());
                }
            } else {
                if (responseNeeded) {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) return;
                    gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, offset, null);
                }
            }
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId, BluetoothGattDescriptor descriptor, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            super.onDescriptorWriteRequest(device, requestId, descriptor, preparedWrite, responseNeeded, offset, value);
            if (responseNeeded) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) return;
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            }
        }
    };

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
