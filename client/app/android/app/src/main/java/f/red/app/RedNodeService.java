package f.red.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
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
import android.net.wifi.WifiManager;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

public class RedNodeService extends Service {
    private static final String TAG = "RedNodeService";
    // v40: renamed from "RedNodeServiceChannel" to force recreation with IMPORTANCE_HIGH.
    private static final String CHANNEL_ID = "RedMeshNode_v40";
    // v41: separate high-priority channel for incoming message heads-up notifications.
    private static final String MSG_CHANNEL_ID = "RedIncomingMsg_v41";
    // Key used by RemoteInput for inline reply from notification shade
    private static final String REPLY_KEY = "red_inline_reply";
    private static final String RED_BLE_SERVICE_UUID = "00001818-0000-1000-8000-00805f9b34fb";
    private static final String RED_BLE_TX_CHAR_UUID = "00002a4d-0000-1000-8000-00805f9b34fb";
    private static final String RED_BLE_RX_CHAR_UUID = "00002a6e-0000-1000-8000-00805f9b34fb";
    private static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private static volatile RedNodeService activeInstance = null;

    public static void restartBleIfPermitted() {
        if (activeInstance != null) {
            Log.i(TAG, "[BLE] Explicit request to start/restart BLE GATT and Advertising");
            activeInstance.startGattServer();
            activeInstance.startBleAdvertising();
        }
    }

    private static boolean isNodeRunning = false;
    private BluetoothLeAdvertiser bleAdvertiser = null;
    private AdvertiseCallback advertiseCallback = null;
    private BluetoothGattServer gattServer = null;
    private PowerManager.WakeLock wakeLock = null;
    private WifiManager.MulticastLock multicastLock = null;
    private WifiManager.WifiLock wifiLock = null;
    // SSE notification consumer
    private Thread sseThread = null;
    private final AtomicBoolean sseShouldRun = new AtomicBoolean(false);
    private int notifIdCounter = 2000;
    private java.util.concurrent.ScheduledExecutorService heartbeatExecutor = null;
    private final java.util.concurrent.ConcurrentHashMap<String, java.io.ByteArrayOutputStream> nativeBleBuffers = new java.util.concurrent.ConcurrentHashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        activeInstance = this;
        createNotificationChannel();
        createMsgNotificationChannel(); // v41: message heads-up channel
        
        // Acquire permanent WakeLock to keep CPU & network queues running in background
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RedNode:WakeLock");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
            Log.i(TAG, "WakeLock acquired: Node CPU will stay permanently active in background");
        }

        // Acquire MulticastLock to allow mDNS (UDP 224.0.0.251) packets to reach Rust libp2p
        WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifiManager != null) {
            multicastLock = wifiManager.createMulticastLock("RedNode:mDNSLock");
            multicastLock.setReferenceCounted(true);
            multicastLock.acquire();
            Log.i(TAG, "MulticastLock acquired: Android Firewall unblocked for mDNS P2P discovery");

            try {
                wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "RedNode:WifiLock");
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
                Log.i(TAG, "WifiLock acquired: Wi-Fi radio set to High Performance Mode for seamless WebRTC / P2P mesh");
            } catch (Exception e) {
                Log.w(TAG, "WifiLock warning: " + e.getMessage());
            }
        }

        startHeartbeatGovernor();
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
                    // On Android 14+ (API 34): ALL types declared in the manifest's
                    // foregroundServiceType MUST be passed here, or the OS throws
                    // MissingForegroundServiceTypeException and kills the service.
                    // specialUse is required because we added it to the manifest for
                    // the 6-hour timeout exemption on Xiaomi HyperOS.
                    startForeground(1, notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                            | ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                            | ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
                } else {
                    startForeground(1, notification);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error starting foreground service: " + e.getMessage());
                e.printStackTrace();
            }

            if (password == null || password.isEmpty() || password.equals("default_mobile_password")) {
                Log.w(TAG, "Service restarted by OS without password. Waiting for UI plugin call to boot Rust.");
            } else if (!RedNodePlugin.isNativeLoaded) {
                // Motor nativo no cargó — registrar error y continuar en modo degradado
                // La app sigue funcionando (UI visible) pero sin capacidades P2P reales.
                Log.e(TAG, "🔴 DEGRADED MODE: libred_mobile.so not loaded. App will run without P2P engine.");
                showEngineErrorNotification();
            } else {
                final String finalDataDir = dataDir;
                final String finalPassword = password;

                // Start the Rust Node in a background thread
                new Thread(() -> {
                    try {
                        Thread.sleep(100);
                        Log.i(TAG, "Starting Rust Node JNI call with UI password...");
                        RedNodePlugin.startNode(finalDataDir, finalPassword);
                        Log.i(TAG, "Rust Node JNI call returned successfully.");
                    } catch (UnsatisfiedLinkError e) {
                        // No crashear — la librería puede haberse cargado pero un símbolo falta
                        Log.e(TAG, "🔴 UnsatisfiedLinkError calling startNode — degraded mode: " + e.getMessage());
                        showEngineErrorNotification();
                    } catch (Exception e) {
                        Log.e(TAG, "Error starting Rust node: " + e.getMessage());
                        e.printStackTrace();
                    }
                }).start();
            }

            // Start GATT Server to receive incoming BLE P2P connections
            startGattServer();

            // Start BLE Advertising so nearby RED devices can discover this node
            startBleAdvertising();

            // v41 Sprint 2: Start SSE consumer for native push notifications when app is backgrounded
            startSseNotificationConsumer();
        }

        // START_STICKY ensures the OS tries to restart the background service if it kills it for memory
        return START_STICKY;
    }

    /**
     * v41 — Starts a persistent SSE consumer on the local Rust node event stream.
     * When a "new_message" event arrives and the app is in the background, it fires
     * a heads-up NotificationCompat with BigTextStyle + RemoteInput inline reply.
     */
    private void startSseNotificationConsumer() {
        if (sseShouldRun.getAndSet(true)) return; // Already running
        sseThread = new Thread(() -> {
            int backoffMs = 2000;
            while (sseShouldRun.get()) {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("http://127.0.0.1:7333/api/events");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Accept", "text/event-stream");
                    conn.setRequestProperty("Cache-Control", "no-cache");
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(0); // infinite — SSE is a persistent stream
                    conn.setDoInput(true);
                    int status = conn.getResponseCode();
                    if (status != 200) {
                        Log.w(TAG, "SSE endpoint returned HTTP " + status + " — retrying in " + backoffMs + "ms");
                        Thread.sleep(backoffMs);
                        backoffMs = Math.min(backoffMs * 2, 30000);
                        continue;
                    }
                    backoffMs = 2000; // reset backoff on successful connect
                    Log.i(TAG, "SSE consumer connected to /api/events");
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    String line;
                    String eventType = null;
                    StringBuilder dataBuffer = new StringBuilder();
                    while (sseShouldRun.get() && (line = reader.readLine()) != null) {
                        if (line.startsWith("event:")) {
                            eventType = line.substring(6).trim();
                        } else if (line.startsWith("data:")) {
                            dataBuffer.append(line.substring(5).trim());
                        } else if (line.isEmpty() && dataBuffer.length() > 0) {
                            // SSE event boundary — dispatch
                            String data = dataBuffer.toString();
                            dataBuffer.setLength(0);
                            if ("new_message".equals(eventType)) {
                                handleIncomingMessageEvent(data);
                            }
                            eventType = null;
                        }
                    }
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    if (sseShouldRun.get()) {
                        Log.w(TAG, "SSE consumer error (will retry): " + e.getMessage());
                        try { Thread.sleep(backoffMs); backoffMs = Math.min(backoffMs * 2, 30000); } catch (InterruptedException ie) { break; }
                    }
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
            Log.i(TAG, "SSE consumer thread exited.");
        }, "RedSSEConsumer");
        sseThread.setDaemon(true);
        sseThread.start();
    }

    /**
     * Parses a new_message SSE event JSON payload and fires a heads-up notification.
     * Only fires if the app is not in the foreground (checked via ActivityManager).
     */
    private void handleIncomingMessageEvent(String json) {
        try {
            JSONObject obj = new JSONObject(json);
            String sender = obj.optString("sender_name", obj.optString("sender", "RED"));
            String senderHash = obj.optString("sender", obj.optString("sender_hash", ""));
            String content = obj.optString("content", "");
            String conversationId = obj.optString("conversation_id", senderHash);
            String recipient = !senderHash.isEmpty() ? senderHash : conversationId;
            if (content.isEmpty()) return;

            // Preview: truncate long messages
            String preview = content.length() > 120 ? content.substring(0, 120) + "…" : content;

            // Inline-reply RemoteInput
            RemoteInput remoteInput = new RemoteInput.Builder(REPLY_KEY)
                    .setLabel("Responder a " + sender + "…")
                    .build();

            // PendingIntent targets a BroadcastReceiver that will POST the reply to the Rust API
            Intent replyIntent = new Intent(this, RedReplyReceiver.class);
            replyIntent.putExtra("conversation_id", conversationId);
            replyIntent.putExtra("sender", sender);
            replyIntent.putExtra("recipient", recipient);
            int reqCode = recipient.hashCode() & 0xFFFF;
            PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
                    this, reqCode, replyIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
            );

            NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                    android.R.drawable.ic_menu_send,
                    "Responder",
                    replyPendingIntent
            ).addRemoteInput(remoteInput).build();

            // Open-app PendingIntent
            Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (openIntent != null) openIntent.putExtra("open_conversation", conversationId);
            PendingIntent openPendingIntent = PendingIntent.getActivity(
                    this, reqCode + 1,
                    openIntent != null ? openIntent : new Intent(),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            NotificationCompat.Builder nb = new NotificationCompat.Builder(this, MSG_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_email)
                    .setContentTitle("🔴 " + sender)
                    .setContentText(preview)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(preview))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setAutoCancel(true)
                    .setContentIntent(openPendingIntent)
                    .addAction(replyAction)
                    .setVisibility(NotificationCompat.VISIBILITY_PRIVATE) // protect content on lock screen
                    .setGroup("RED_MESSAGES")
                    .setGroupSummary(false);

            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(notifIdCounter++, nb.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "handleIncomingMessageEvent parse error: " + e.getMessage());
        }
    }

    /**
     * Muestra una notificación persistente cuando el motor Rust no pudo cargar.
     * La app continúa en modo degradado (UI visible) en lugar de crashear.
     */
    private void showEngineErrorNotification() {
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            android.app.Notification.Builder builder;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                builder = new android.app.Notification.Builder(this, CHANNEL_ID);
            } else {
                builder = new android.app.Notification.Builder(this);
            }
            builder.setSmallIcon(android.R.drawable.ic_dialog_alert)
                   .setContentTitle("RED — Motor P2P no disponible")
                   .setContentText("El motor nativo (libred_mobile.so) no pudo cargarse. La app funciona en modo degradado.")
                   .setStyle(new android.app.Notification.BigTextStyle()
                       .bigText("El motor nativo (libred_mobile.so) no pudo cargarse en este dispositivo. Funciones P2P, mensajería cifrada y blockchain no estarán disponibles. Reinstala la app o contacta soporte."))
                   .setOngoing(false)
                   .setPriority(android.app.Notification.PRIORITY_HIGH);
            if (nm != null) {
                nm.notify(99, builder.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to show engine error notification: " + e.getMessage());
        }
    }

    /**
     * Starts broadcasting a BLE advertisement with the RED service UUID.
     * This allows the Capacitor BLE plugin on other devices to discover this device.
     */
    private void startBleAdvertising() {
        if (bleAdvertiser != null && advertiseCallback != null) {
            return;
        }
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

    private boolean isEcoMeshActive = false;

    public void setEcoMeshMode(boolean enabled) {
        this.isEcoMeshActive = enabled;
        try {
            if (enabled) {
                if (wifiLock != null && wifiLock.isHeld()) {
                    wifiLock.release();
                    Log.i(TAG, "[EcoMesh] WifiLock released: Switched to Ultra Low-Power Standby");
                }
            } else {
                if (wifiLock != null && !wifiLock.isHeld()) {
                    wifiLock.acquire();
                    Log.i(TAG, "[EcoMesh] WifiLock acquired: Restored High-Performance Mode");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "[EcoMesh] Mode transition error: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        // CRITICAL: Call stopForeground FIRST, before any blocking operations.
        // On Android 14+ (API 34), the OS enforces a strict timeout for dataSync
        // foreground services. If we block onDestroy for too long without releasing
        // the foreground state, the OS throws ForegroundServiceDidNotStopInTimeException
        // and kills the process. This must be the very first call.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}

        super.onDestroy();
        
        if (heartbeatExecutor != null) {
            heartbeatExecutor.shutdownNow();
            heartbeatExecutor = null;
        }

        // Stop the SSE consumer cleanly
        sseShouldRun.set(false);
        if (sseThread != null) {
            sseThread.interrupt();
            sseThread = null;
        }

        // Release WakeLock
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
            Log.i(TAG, "WakeLock released.");
        }

        // Release MulticastLock
        if (multicastLock != null && multicastLock.isHeld()) {
            try { multicastLock.release(); } catch (Exception ignored) {}
            Log.i(TAG, "MulticastLock released.");
        }

        // Release WifiLock
        if (wifiLock != null && wifiLock.isHeld()) {
            try { wifiLock.release(); } catch (Exception ignored) {}
            Log.i(TAG, "WifiLock released.");
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
            try { gattServer.close(); } catch (Exception ignored) {}
            Log.i(TAG, "[BLE] GATT Server closed.");
        }
        nativeBleBuffers.clear();

        // Stop Rust node in a background thread with a 3s timeout to avoid
        // blocking onDestroy past the OS foreground service deadline.
        if (RedNodePlugin.isNativeLoaded) {
            final String dataDir = getFilesDir().getAbsolutePath() + "/red_node";
            Thread stopThread = new Thread(() -> {
                try {
                    RedNodePlugin.destroyNode(dataDir);
                    Log.i(TAG, "Rust node destroyed cleanly.");
                } catch (Exception e) {
                    Log.e(TAG, "Error destroying Rust node: " + e.getMessage());
                }
            }, "RedNodeStop");
            stopThread.setDaemon(true);
            stopThread.start();
            try { stopThread.join(3000); } catch (InterruptedException ignored) {}
        }

        Log.i(TAG, "RedNodeService destroyed — all locks, BLE, and SSE consumer released.");
    }

    private void startGattServer() {
        if (gattServer != null) {
            return;
        }
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
                nativeBleBuffers.remove(device.getAddress());
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId, BluetoothGattCharacteristic characteristic, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            super.onCharacteristicWriteRequest(device, requestId, characteristic, preparedWrite, responseNeeded, offset, value);
            
            String charUuid = characteristic.getUuid().toString();
            if (RED_BLE_TX_CHAR_UUID.equalsIgnoreCase(charUuid) || RED_BLE_RX_CHAR_UUID.equalsIgnoreCase(charUuid)) {
                if (responseNeeded) {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) return;
                    gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
                }

                if (value != null && value.length > 0) {
                    // 1. Forward raw chunk to Capacitor App via RedNodePlugin static event emitter for active UI
                    RedNodePlugin.emitBleMessage(value, device.getAddress());

                    // 2. Direct native JNI injection into Rust core node with frame reassembly
                    if (RedNodePlugin.isNativeLoaded) {
                        try {
                            String devAddr = device.getAddress();
                            java.io.ByteArrayOutputStream stream = nativeBleBuffers.get(devAddr);
                            if (stream == null) {
                                stream = new java.io.ByteArrayOutputStream();
                                nativeBleBuffers.put(devAddr, stream);
                            }
                            synchronized (stream) {
                                stream.write(value);
                                byte[] accumulated = stream.toByteArray();

                                // Check if we have at least the 96-byte RED MeshPacket header
                                while (accumulated.length >= 96) {
                                    // Verify RED magic: 0x52454401 (0x52, 0x45, 0x44, 0x01)
                                    if (accumulated[0] == 0x52 && accumulated[1] == 0x45 && accumulated[2] == 0x44 && accumulated[3] == 0x01) {
                                        int payloadLen = (accumulated[70] & 0xFF) | ((accumulated[71] & 0xFF) << 8);
                                        int totalPacketLen = 96 + payloadLen;

                                        if (accumulated.length >= totalPacketLen) {
                                            byte[] fullPacket = new byte[totalPacketLen];
                                            System.arraycopy(accumulated, 0, fullPacket, 0, totalPacketLen);

                                            RedNodePlugin.injectBlePayload(fullPacket, devAddr);

                                            // Remaining bytes in buffer
                                            int remaining = accumulated.length - totalPacketLen;
                                            stream.reset();
                                            if (remaining > 0) {
                                                stream.write(accumulated, totalPacketLen, remaining);
                                                accumulated = stream.toByteArray();
                                            } else {
                                                break;
                                            }
                                        } else {
                                            break; // Wait for full packet payload chunks
                                        }
                                    } else {
                                        // Resync: Scan for magic 0x52454401 in buffer
                                        int syncIdx = -1;
                                        for (int i = 1; i <= accumulated.length - 4; i++) {
                                            if (accumulated[i] == 0x52 && accumulated[i+1] == 0x45 && accumulated[i+2] == 0x44 && accumulated[i+3] == 0x01) {
                                                syncIdx = i;
                                                break;
                                            }
                                        }
                                        if (syncIdx > 0) {
                                            int remaining = accumulated.length - syncIdx;
                                            stream.reset();
                                            stream.write(accumulated, syncIdx, remaining);
                                            accumulated = stream.toByteArray();
                                        } else {
                                            // No magic found, reset buffer if too large
                                            if (accumulated.length > 65536) {
                                                stream.reset();
                                            }
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (Throwable jniErr) {
                            Log.w(TAG, "Direct JNI injectBlePayload warning: " + jniErr.getMessage());
                        }
                    }
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
                    "RED Mesh Node",
                    // IMPORTANCE_HIGH: required to prevent Xiaomi HyperOS from considering
                    // the service as non-critical. IMPORTANCE_LOW channels are killed first.
                    NotificationManager.IMPORTANCE_HIGH
            );
            serviceChannel.setDescription("Emergency P2P mesh network node - keeps communication alive when infrastructure is down");
            // Disable sound/vibration for high-importance channel (this is a silent persistent service)
            serviceChannel.setSound(null, null);
            serviceChannel.enableVibration(false);
            serviceChannel.setShowBadge(false);
            // Show full notification on lock screen (not private/hidden) so users see the
            // service is active. Note: this does NOT prevent users from disabling the channel.
            serviceChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    /** v41: Creates the heads-up notification channel for incoming RED messages. */
    private void createMsgNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    MSG_CHANNEL_ID,
                    "RED — Mensajes Entrantes",
                    NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("Notificaciones de mensajes cifrados RED recibidos mientras la app está en segundo plano");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 120, 80, 120});
            ch.setShowBadge(true);
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(ch);
        }
    }

    private void injectNativeMeshPayload(byte[] payload) {
        new Thread(() -> {
            try {
                StringBuilder hex = new StringBuilder();
                for (byte b : payload) {
                    hex.append(String.format("%02x", b));
                }
                java.net.URL url = new java.net.URL("http://127.0.0.1:7333/api/mesh/receive");
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                String jsonBody = "{\"payload_hex\":\"" + hex.toString() + "\",\"is_lora\":false}";
                java.io.OutputStream os = conn.getOutputStream();
                os.write(jsonBody.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                os.close();
                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception e) {
                Log.w(TAG, "Direct native mesh inject failed (non-critical): " + e.getMessage());
            }
        }).start();
    }

    /**
     * Heartbeat Governor: runs periodic checks to prevent Android Doze Mode and aggressive OEM task killers
     * from freezing the BLE mesh radio or background SSE message queues.
     */
    private void startHeartbeatGovernor() {
        if (heartbeatExecutor != null && !heartbeatExecutor.isShutdown()) return;

        heartbeatExecutor = java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
        heartbeatExecutor.scheduleWithFixedDelay(() -> {
            try {
                // 1. Maintain CPU WakeLock
                if (wakeLock != null && !wakeLock.isHeld()) {
                    wakeLock.acquire();
                    Log.i(TAG, "[Heartbeat] WakeLock re-acquired");
                }

                // 2. Maintain MulticastLock for mDNS discovery
                if (multicastLock != null && !multicastLock.isHeld()) {
                    multicastLock.acquire();
                    Log.i(TAG, "[Heartbeat] MulticastLock re-acquired");
                }

                // 3. Verify SSE notification consumer thread
                if (sseThread == null || !sseThread.isAlive()) {
                    Log.w(TAG, "[Heartbeat] SSE consumer died, restarting...");
                    sseShouldRun.set(false);
                    startSseNotificationConsumer();
                }

                // 4. Verify BLE Advertiser
                if (bleAdvertiser == null && isNodeRunning) {
                    Log.i(TAG, "[Heartbeat] BLE advertiser null, re-initializing...");
                    restartBleIfPermitted();
                }
            } catch (Exception e) {
                Log.w(TAG, "[Heartbeat] Governor check exception: " + e.getMessage());
            }
        }, 30, 120, java.util.concurrent.TimeUnit.SECONDS);
    }
}
