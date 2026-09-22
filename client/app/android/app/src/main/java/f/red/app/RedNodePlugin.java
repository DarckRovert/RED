package f.red.app;

import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import androidx.core.content.FileProvider;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import com.hoho.android.usbserial.util.SerialInputOutputManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.DatagramPacket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import android.util.Base64;

@CapacitorPlugin(name = "RedNode")
public class RedNodePlugin extends Plugin {

    private volatile boolean isMorseActive = false;
    private Thread morseThread = null;
    private SpeechRecognizer speechRecognizer = null;
    private volatile boolean isSpeechListening = false;

    /** true si libred_mobile.so cargó correctamente — verificar antes de toda llamada JNI */
    public static volatile boolean isNativeLoaded = false;

    static {
        try {
            System.loadLibrary("red_mobile");
            isNativeLoaded = true;
            android.util.Log.i("RedNodePlugin", "✅ Native library red_mobile loaded successfully.");
        } catch (UnsatisfiedLinkError e) {
            isNativeLoaded = false;
            android.util.Log.e("RedNodePlugin", "❌ FAILED to load native library (UnsatisfiedLinkError): " + e.getMessage());
        } catch (Exception e) {
            isNativeLoaded = false;
            android.util.Log.e("RedNodePlugin", "❌ Exception loading native library: " + e.getMessage());
        }
    }

    public static native void startNode(String dataDir, String password);
    // SEC-FIX C-3: destroyNode — wipes all data directories via Rust JNI.
    public static native void destroyNode(String dataDir);
    public static native void injectBlePayload(byte[] payload, String fromDevice);

    private static RedNodePlugin instance;
    private String pendingApkInstallPath = null;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (pendingApkInstallPath != null) {
            boolean canInstall = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    canInstall = getContext().getPackageManager().canRequestPackageInstalls();
                } catch (Throwable t) {
                    android.util.Log.w("RedNodePlugin", "canRequestPackageInstalls check in onResume failed: " + t.getMessage());
                }
            } else {
                canInstall = true;
            }

            if (canInstall) {
                String apkPathToLaunch = pendingApkInstallPath;
                pendingApkInstallPath = null;
                android.util.Log.i("RedNodePlugin", "Auto-resuming APK installation after permission granted: " + apkPathToLaunch);
                boolean launched = launchInstallerIntent(apkPathToLaunch);
                com.getcapacitor.JSObject evt = new com.getcapacitor.JSObject();
                evt.put("resumed", launched);
                evt.put("filePath", apkPathToLaunch);
                notifyListeners("apkInstallResumed", evt);
            }
        }
    }

    @Override
    protected void handleOnDestroy() {
        isMorseActive = false;
        if (morseThread != null) {
            morseThread.interrupt();
            morseThread = null;
        }
        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
            speechRecognizer = null;
        }
        closeCurrentUsbPort();
        if (usbPermissionReceiver != null) {
            try { getContext().unregisterReceiver(usbPermissionReceiver); } catch (Exception ignored) {}
            usbPermissionReceiver = null;
        }
        stopCotMulticastInternal();
        if (activeMbtilesReader != null) {
            try { activeMbtilesReader.close(); } catch (Exception ignored) {}
            activeMbtilesReader = null;
        }
        super.handleOnDestroy();
    }

    public static void emitBleMessage(byte[] payload, String fromDevice) {
        if (instance != null) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("device", fromDevice);
            com.getcapacitor.JSArray jsArray = new com.getcapacitor.JSArray();
            for (byte b : payload) {
                jsArray.put(b & 0xFF);
            }
            ret.put("data", jsArray);
            instance.notifyListeners("bleMessageReceived", ret);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        try {
            String dataDir = getContext().getFilesDir().getAbsolutePath() + "/red_node";
            String password = call.getString("password", "default_mobile_password");

            Boolean isDecoy = call.getBoolean("decoyMode", false);
            if (Boolean.TRUE.equals(isDecoy)) {
                dataDir += "_decoy";
                android.util.Log.w("RedNodePlugin", "WARNING: DURESS PIN. MOUNTING DECOY VAULT.");
            }

            Intent serviceIntent = new Intent(getContext(), RedNodeService.class);
            serviceIntent.putExtra("dataDir", dataDir);
            serviceIntent.putExtra("password", password);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start RED node: " + e.getMessage());
        }
    }

    /** Permite al frontend reiniciar / asegurar el servidor GATT y publicidad BLE una vez otorgados los permisos. */
    @PluginMethod
    public void startBleServer(PluginCall call) {
        try {
            RedNodeService.restartBleIfPermitted();
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start BLE server: " + e.getMessage());
        }
    }

    /**
     * Envía un payload a través del servidor GATT local hacia un cliente Central conectado,
     * o a todos los clientes si device es nulo o vacío.
     */
    @PluginMethod
    public void sendBleServerMessage(PluginCall call) {
        try {
            String device = call.getString("device", null);
            com.getcapacitor.JSArray dataArray = call.getArray("data");
            if (dataArray == null || dataArray.length() == 0) {
                call.reject("Data array is required");
                return;
            }

            byte[] bytes = new byte[dataArray.length()];
            for (int i = 0; i < dataArray.length(); i++) {
                bytes[i] = (byte) dataArray.getInt(i);
            }

            boolean ok = RedNodeService.sendGattNotification(device, bytes);
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", ok);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to send BLE server message: " + e.getMessage());
        }
    }

    /**
     * Obtiene la lista de direcciones MAC de clientes GATT Centrales conectados a nuestro servidor.
     */
    @PluginMethod
    public void getBleServerClients(PluginCall call) {
        try {
            java.util.List<String> clients = RedNodeService.getConnectedClients();
            com.getcapacitor.JSArray array = new com.getcapacitor.JSArray();
            for (String c : clients) {
                array.put(c);
            }
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("clients", array);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get BLE server clients: " + e.getMessage());
        }
    }

    /** Expone el estado de carga de la librería nativa al frontend (Capacitor JS). */
    @PluginMethod
    public void isNativeReady(PluginCall call) {
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("ready", isNativeLoaded);
        ret.put("error", isNativeLoaded ? null : "libred_mobile.so failed to load on this device");
        call.resolve(ret);
    }

    /** Consulta el sensor barométrico de hardware (Sensor.TYPE_PRESSURE) del dispositivo. */
    @PluginMethod
    public void getBarometerSensor(PluginCall call) {
        try {
            SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            if (sm == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                ret.put("reason", "SensorManager no disponible");
                call.resolve(ret);
                return;
            }

            Sensor pressureSensor = sm.getDefaultSensor(Sensor.TYPE_PRESSURE);
            if (pressureSensor == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                ret.put("reason", "Sensor barométrico no presente en este hardware");
                call.resolve(ret);
                return;
            }

            final boolean[] resolved = {false};
            SensorEventListener listener = new SensorEventListener() {
                @Override
                public void onSensorChanged(SensorEvent event) {
                    if (!resolved[0] && event.values != null && event.values.length > 0) {
                        resolved[0] = true;
                        sm.unregisterListener(this);
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("available", true);
                        ret.put("pressure_hpa", (double) event.values[0]);
                        ret.put("accuracy", event.accuracy);
                        ret.put("sensor_name", pressureSensor.getName());
                        ret.put("vendor", pressureSensor.getVendor());
                        ret.put("power_ma", (double) pressureSensor.getPower());
                        call.resolve(ret);
                    }
                }

                @Override
                public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            };

            boolean registered = sm.registerListener(listener, pressureSensor, SensorManager.SENSOR_DELAY_NORMAL);
            if (!registered) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                ret.put("reason", "No se pudo registrar el listener del sensor de presión");
                call.resolve(ret);
                return;
            }

            // Fallback timeout por si el sensor no emite inmediatamente
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (!resolved[0]) {
                    resolved[0] = true;
                    sm.unregisterListener(listener);
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("available", false);
                    ret.put("reason", "Timeout al obtener lectura del sensor de presión");
                    try {
                        call.resolve(ret);
                    } catch (Exception ignored) {}
                }
            }, 800);

        } catch (Exception e) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", false);
            ret.put("reason", "Error accediendo al barómetro: " + e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getThermometerSensor(PluginCall call) {
        try {
            SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            if (sm == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            Sensor tempSensor = sm.getDefaultSensor(Sensor.TYPE_AMBIENT_TEMPERATURE);
            if (tempSensor == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            final boolean[] resolved = {false};
            SensorEventListener listener = new SensorEventListener() {
                @Override
                public void onSensorChanged(SensorEvent event) {
                    if (!resolved[0] && event.values != null && event.values.length > 0) {
                        resolved[0] = true;
                        sm.unregisterListener(this);
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("available", true);
                        ret.put("value", (double) event.values[0]);
                        ret.put("sensor_name", tempSensor.getName());
                        call.resolve(ret);
                    }
                }
                @Override
                public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            };
            if (!sm.registerListener(listener, tempSensor, SensorManager.SENSOR_DELAY_NORMAL)) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (!resolved[0]) {
                    resolved[0] = true;
                    sm.unregisterListener(listener);
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("available", false);
                    try { call.resolve(ret); } catch (Exception ignored) {}
                }
            }, 800);
        } catch (Exception e) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getHygrometerSensor(PluginCall call) {
        try {
            SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            if (sm == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            Sensor humSensor = sm.getDefaultSensor(Sensor.TYPE_RELATIVE_HUMIDITY);
            if (humSensor == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            final boolean[] resolved = {false};
            SensorEventListener listener = new SensorEventListener() {
                @Override
                public void onSensorChanged(SensorEvent event) {
                    if (!resolved[0] && event.values != null && event.values.length > 0) {
                        resolved[0] = true;
                        sm.unregisterListener(this);
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("available", true);
                        ret.put("value", (double) event.values[0]);
                        ret.put("sensor_name", humSensor.getName());
                        call.resolve(ret);
                    }
                }
                @Override
                public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            };
            if (!sm.registerListener(listener, humSensor, SensorManager.SENSOR_DELAY_NORMAL)) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (!resolved[0]) {
                    resolved[0] = true;
                    sm.unregisterListener(listener);
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("available", false);
                    try { call.resolve(ret); } catch (Exception ignored) {}
                }
            }, 800);
        } catch (Exception e) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getCompassSensor(PluginCall call) {
        try {
            SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            if (sm == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            Sensor rotSensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
            if (rotSensor == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            final boolean[] resolved = {false};
            SensorEventListener listener = new SensorEventListener() {
                @Override
                public void onSensorChanged(SensorEvent event) {
                    if (!resolved[0] && event.values != null && event.values.length > 2) {
                        resolved[0] = true;
                        sm.unregisterListener(this);
                        float[] rotationMatrix = new float[9];
                        SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
                        float[] orientationAngles = new float[3];
                        SensorManager.getOrientation(rotationMatrix, orientationAngles);
                        double azimuth = Math.toDegrees(orientationAngles[0]);
                        if (azimuth < 0) {
                            azimuth += 360;
                        }
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("available", true);
                        ret.put("value", azimuth);
                        ret.put("sensor_name", rotSensor.getName());
                        call.resolve(ret);
                    }
                }
                @Override
                public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            };
            if (!sm.registerListener(listener, rotSensor, SensorManager.SENSOR_DELAY_NORMAL)) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (!resolved[0]) {
                    resolved[0] = true;
                    sm.unregisterListener(listener);
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("available", false);
                    try { call.resolve(ret); } catch (Exception ignored) {}
                }
            }, 800);
        } catch (Exception e) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", false);
            call.resolve(ret);
        }
    }

    /** Consulta el sensor magnetómetro triaxial de hardware (Sensor.TYPE_MAGNETIC_FIELD) en microteslas (uT). */
    @PluginMethod
    public void getMagnetometerSensor(PluginCall call) {
        try {
            SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            if (sm == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                ret.put("reason", "SensorManager no disponible");
                call.resolve(ret);
                return;
            }
            Sensor magSensor = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
            if (magSensor == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                ret.put("reason", "Sensor magnetómetro no presente en este hardware");
                call.resolve(ret);
                return;
            }
            final boolean[] resolved = {false};
            SensorEventListener listener = new SensorEventListener() {
                @Override
                public void onSensorChanged(SensorEvent event) {
                    if (!resolved[0] && event.values != null && event.values.length >= 3) {
                        resolved[0] = true;
                        sm.unregisterListener(this);
                        float x = event.values[0];
                        float y = event.values[1];
                        float z = event.values[2];
                        double magnitude = Math.sqrt(x * x + y * y + z * z);
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("available", true);
                        ret.put("x", (double) x);
                        ret.put("y", (double) y);
                        ret.put("z", (double) z);
                        ret.put("magnitude", magnitude);
                        ret.put("accuracy", event.accuracy);
                        ret.put("sensor_name", magSensor.getName());
                        ret.put("vendor", magSensor.getVendor());
                        call.resolve(ret);
                    }
                }
                @Override
                public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            };
            if (!sm.registerListener(listener, magSensor, SensorManager.SENSOR_DELAY_GAME)) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                ret.put("reason", "No se pudo registrar el listener del sensor magnético");
                call.resolve(ret);
                return;
            }
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (!resolved[0]) {
                    resolved[0] = true;
                    sm.unregisterListener(listener);
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("available", false);
                    ret.put("reason", "Timeout al obtener lectura del sensor magnético");
                    try { call.resolve(ret); } catch (Exception ignored) {}
                }
            }, 800);
        } catch (Exception e) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", false);
            ret.put("reason", "Error accediendo al magnetómetro: " + e.getMessage());
            call.resolve(ret);
        }
    }

    private String getCameraWithFlash(CameraManager cameraManager) {
        try {
            for (String id : cameraManager.getCameraIdList()) {
                CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(id);
                Boolean flashAvailable = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                if (flashAvailable != null && flashAvailable) {
                    if (facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) {
                        return id;
                    }
                }
            }
            for (String id : cameraManager.getCameraIdList()) {
                CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(id);
                Boolean flashAvailable = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (flashAvailable != null && flashAvailable) {
                    return id;
                }
            }
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Error checking camera flash: " + e.getMessage());
        }
        return null;
    }

    /** Enciende o apaga la linterna/antorcha de hardware del dispositivo. */
    @PluginMethod
    public void setTorch(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        try {
            CameraManager cm = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            if (cm == null) {
                call.reject("CameraManager no disponible");
                return;
            }
            String cameraId = getCameraWithFlash(cm);
            if (cameraId == null) {
                call.reject("No se detectó cámara con flash en este hardware");
                return;
            }
            cm.setTorchMode(cameraId, enabled);
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", true);
            ret.put("enabled", enabled);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al controlar antorcha: " + e.getMessage());
        }
    }

    /** Verifica si el hardware cuenta con flash LED disponible para antorcha. */
    @PluginMethod
    public void isTorchAvailable(PluginCall call) {
        try {
            CameraManager cm = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            if (cm == null) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                call.resolve(ret);
                return;
            }
            String cameraId = getCameraWithFlash(cm);
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", cameraId != null);
            call.resolve(ret);
        } catch (Exception e) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", false);
            call.resolve(ret);
        }
    }

    /** Emite pulsos Morse ópticos SOS (... --- ...) sobre el flash LED de hardware en un hilo nativo de alta precisión. */
    @PluginMethod
    public void toggleMorseSosTorch(PluginCall call) {
        boolean active = call.getBoolean("active", true);
        CameraManager cm = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
        if (cm == null) {
            call.reject("CameraManager no disponible");
            return;
        }
        String cameraId = getCameraWithFlash(cm);
        if (cameraId == null) {
            call.reject("No se detectó cámara con flash en este hardware");
            return;
        }

        if (!active) {
            isMorseActive = false;
            if (morseThread != null) {
                morseThread.interrupt();
                morseThread = null;
            }
            try {
                cm.setTorchMode(cameraId, false);
            } catch (Exception ignored) {}
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("active", false);
            ret.put("success", true);
            call.resolve(ret);
            return;
        }

        isMorseActive = false;
        if (morseThread != null) {
            morseThread.interrupt();
        }

        isMorseActive = true;
        morseThread = new Thread(() -> {
            try {
                while (isMorseActive && !Thread.currentThread().isInterrupted()) {
                    // S: . . . (150ms on, 150ms off)
                    for (int i = 0; i < 3; i++) {
                        if (!isMorseActive) break;
                        cm.setTorchMode(cameraId, true);
                        Thread.sleep(150);
                        cm.setTorchMode(cameraId, false);
                        Thread.sleep(150);
                    }
                    Thread.sleep(300); // Espacio entre letras

                    // O: - - - (450ms on, 150ms off)
                    for (int i = 0; i < 3; i++) {
                        if (!isMorseActive) break;
                        cm.setTorchMode(cameraId, true);
                        Thread.sleep(450);
                        cm.setTorchMode(cameraId, false);
                        Thread.sleep(150);
                    }
                    Thread.sleep(300); // Espacio entre letras

                    // S: . . . (150ms on, 150ms off)
                    for (int i = 0; i < 3; i++) {
                        if (!isMorseActive) break;
                        cm.setTorchMode(cameraId, true);
                        Thread.sleep(150);
                        cm.setTorchMode(cameraId, false);
                        Thread.sleep(150);
                    }
                    Thread.sleep(1200); // Espacio entre ciclos SOS
                }
            } catch (InterruptedException ignored) {
            } catch (Exception e) {
                android.util.Log.e("RedNodePlugin", "Morse SOS error: " + e.getMessage());
            } finally {
                try {
                    cm.setTorchMode(cameraId, false);
                } catch (Exception ignored) {}
            }
        });
        morseThread.start();

        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("active", true);
        ret.put("success", true);
        call.resolve(ret);
    }

    private static final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();

    /** Verifica si la aplicación tiene permiso para instalar paquetes desconocidos (Android 8.0+) */
    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        boolean granted = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                granted = getContext().getPackageManager().canRequestPackageInstalls();
            } else {
                granted = true;
            }
        } catch (Throwable t) {
            android.util.Log.w("RedNodePlugin", "canRequestPackageInstalls exception: " + t.getMessage());
            granted = false;
        }
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /** Abre la pantalla del sistema Android para otorgar permiso de instalación de paquetes a RED */
    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                } catch (android.content.ActivityNotFoundException anfe) {
                    Intent fallback = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallback);
                }
                call.resolve();
            } else {
                call.resolve();
            }
        } catch (Exception e) {
            call.reject("Could not open install permission settings: " + e.getMessage());
        }
    }

    /**
     * Retorna la ubicación óptima para descargar el APK: almacenamiento de caché externo
     * (accesible por PackageInstaller sin restricciones SELinux en Android 14/15) con fallback a caché interno.
     */
    private File getOptimalApkFile(String fileName) {
        File ext = getContext().getExternalCacheDir();
        if (ext != null && (ext.exists() || ext.mkdirs()) && ext.canWrite()) {
            return new File(ext, fileName);
        }
        return new File(getContext().getCacheDir(), fileName);
    }

    /**
     * Localiza un APK en caché comprobando tanto almacenamiento externo como interno.
     */
    private File locateCachedApk(String fileName) {
        File ext = getContext().getExternalCacheDir();
        if (ext != null) {
            File extFile = new File(ext, fileName);
            if (extFile.exists() && extFile.length() > 1024 * 1024) {
                return extFile;
            }
        }
        File intFile = new File(getContext().getCacheDir(), fileName);
        if (intFile.exists() && intFile.length() > 1024 * 1024) {
            return intFile;
        }
        return null;
    }

    /**
     * Lanza el Intent nativo de instalación con FileProvider y concesión explícita de permisos URI.
     */
    private boolean launchInstallerIntent(String filePath) {
        File file;
        if (filePath == null || filePath.isEmpty()) {
            file = locateCachedApk("red_update.apk");
            if (file == null) {
                file = new File(getContext().getCacheDir(), "red_update.apk");
            }
        } else {
            file = new File(filePath);
        }

        if (!file.exists() || file.length() == 0) {
            android.util.Log.e("RedNodePlugin", "Cannot launch installer: APK file missing or empty: " + file.getAbsolutePath());
            return false;
        }

        try {
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
            } else {
                apkUri = Uri.fromFile(file);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(android.content.ClipData.newRawUri("RED Update", apkUri));

            // Concesión explícita de URI para todas las actividades del instalador del sistema (Android 11/14/15)
            try {
                android.content.pm.PackageManager pm = getContext().getPackageManager();
                java.util.List<android.content.pm.ResolveInfo> resInfoList = pm.queryIntentActivities(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
                for (android.content.pm.ResolveInfo resolveInfo : resInfoList) {
                    String packageName = resolveInfo.activityInfo.packageName;
                    getContext().grantUriPermission(packageName, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
            } catch (Throwable t) {
                android.util.Log.w("RedNodePlugin", "grantUriPermission resolution warning: " + t.getMessage());
            }

            // Concesión explícita adicional para instaladores de sistema conocidos (blindaje contra filtros de queries)
            String[] commonInstallers = {"com.google.android.packageinstaller", "com.android.packageinstaller"};
            for (String pkg : commonInstallers) {
                try {
                    getContext().grantUriPermission(pkg, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Throwable ignored) {}
            }

            android.content.Context launchCtx = getActivity() != null ? getActivity() : getContext();
            launchCtx.startActivity(intent);
            return true;
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "launchInstallerIntent exception: " + e.getMessage(), e);
            return false;
        }
    }

    /**
     * Calcula el SHA-256 de un archivo en disco usando streaming de 64 KB.
     * Evita cargar el APK completo (~65 MB) en heap — opera en O(1) de memoria.
     *
     * Parámetros de entrada: { filePath: string }
     * Respuesta de éxito:    { sha256: "<64-char-lowercase-hex>" }
     * Respuesta de error:    reject con mensaje descriptivo
     *
     * Requerido por updateManager.ts para verificar integridad del APK descargado
     * antes de invocar installApk. Sin este método la verificación SHA-256 es inoperante.
     */
    @PluginMethod
    public void computeFileSha256(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.isEmpty()) {
            call.reject("SHA-256 verification failed: filePath is required");
            return;
        }

        java.io.File file = new java.io.File(filePath);
        if (!file.exists() || !file.isFile()) {
            call.reject("SHA-256 verification failed: file not found at " + filePath);
            return;
        }

        downloadExecutor.execute(() -> {
            try {
                java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
                try (java.io.FileInputStream fis = new java.io.FileInputStream(file)) {
                    byte[] buffer = new byte[65536]; // 64 KB streaming — O(1) memoria
                    int bytesRead;
                    while ((bytesRead = fis.read(buffer)) != -1) {
                        digest.update(buffer, 0, bytesRead);
                    }
                }
                byte[] hashBytes = digest.digest();
                StringBuilder hexBuilder = new StringBuilder(64);
                for (byte b : hashBytes) {
                    hexBuilder.append(String.format("%02x", b));
                }
                com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
                result.put("sha256", hexBuilder.toString());
                call.resolve(result);
            } catch (java.security.NoSuchAlgorithmException e) {
                call.reject("SHA-256 verification failed: SHA-256 algorithm not available on this device");
            } catch (java.io.IOException e) {
                call.reject("SHA-256 verification failed: I/O error reading file: " + e.getMessage());
            }
        });
    }

    /**
     * Descarga de APK en streaming nativo de alta eficiencia directamente al almacenamiento caché.
     * Cero uso de Base64 ni saturación del heap de V8 JS.
     * Emite eventos 'apkDownloadProgress' con bytes recibidos, total, porcentaje y velocidad en KB/s.
     */
    @PluginMethod
    public void downloadApk(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("URL is required");
            return;
        }
        String fileName = call.getString("fileName", "red_update.apk");

        downloadExecutor.execute(() -> {
            InputStream in = null;
            FileOutputStream out = null;
            HttpURLConnection conn = null;
            try {
                URL url = new URL(urlString);
                int redirects = 0;
                int responseCode;

                // Bucle de redirecciones multinivel (GitHub Releases -> S3/Azure CDN)
                while (true) {
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "RED-Mobile-Updater");
                    responseCode = conn.getResponseCode();

                    if (responseCode == HttpURLConnection.HTTP_MOVED_PERM || 
                        responseCode == HttpURLConnection.HTTP_MOVED_TEMP || 
                        responseCode == 307 || 
                        responseCode == 308) {

                        redirects++;
                        if (redirects > 5) {
                            throw new Exception("Demasiadas redirecciones HTTP (" + redirects + ")");
                        }
                        String newUrl = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (newUrl == null || newUrl.isEmpty()) {
                            throw new Exception("Cabecera de redirección Location vacía");
                        }
                        url = new URL(newUrl);
                        continue;
                    }
                    break;
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new Exception("Servidor HTTP respondió con código: " + responseCode);
                }

                long totalBytes = conn.getContentLengthLong();
                File targetFile = getOptimalApkFile(fileName);
                if (targetFile.exists()) {
                    targetFile.delete();
                }

                in = conn.getInputStream();
                out = new FileOutputStream(targetFile);

                byte[] buffer = new byte[16384];
                long receivedBytes = 0;
                int bytesRead;
                long startTime = System.currentTimeMillis();
                long lastProgressTime = 0;

                while ((bytesRead = in.read(buffer)) != -1) {
                    out.write(buffer, 0, bytesRead);
                    receivedBytes += bytesRead;

                    long now = System.currentTimeMillis();
                    if (now - lastProgressTime > 150 || (totalBytes > 0 && receivedBytes == totalBytes)) {
                        lastProgressTime = now;
                        double elapsedSec = Math.max(0.1, (now - startTime) / 1000.0);
                        double speedKbps = (receivedBytes / 1024.0) / elapsedSec;
                        float progress = totalBytes > 0 ? (float) receivedBytes / (float) totalBytes : 0f;

                        com.getcapacitor.JSObject prog = new com.getcapacitor.JSObject();
                        prog.put("progress", progress);
                        prog.put("receivedBytes", receivedBytes);
                        prog.put("totalBytes", totalBytes);
                        prog.put("speedKbps", speedKbps);
                        prog.put("done", false);
                        notifyListeners("apkDownloadProgress", prog);
                    }
                }

                out.flush();

                com.getcapacitor.JSObject doneProg = new com.getcapacitor.JSObject();
                doneProg.put("progress", 1.0);
                doneProg.put("receivedBytes", receivedBytes);
                doneProg.put("totalBytes", totalBytes > 0 ? totalBytes : receivedBytes);
                doneProg.put("speedKbps", 0);
                doneProg.put("done", true);
                doneProg.put("filePath", targetFile.getAbsolutePath());
                notifyListeners("apkDownloadProgress", doneProg);

                com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
                result.put("success", true);
                result.put("filePath", targetFile.getAbsolutePath());
                result.put("totalBytes", receivedBytes);
                call.resolve(result);

            } catch (Exception e) {
                android.util.Log.e("RedNodePlugin", "APK Download error: " + e.getMessage(), e);
                com.getcapacitor.JSObject errProg = new com.getcapacitor.JSObject();
                errProg.put("error", e.getMessage());
                notifyListeners("apkDownloadProgress", errProg);
                call.reject("Download failed: " + e.getMessage());
            } finally {
                try { if (in != null) in.close(); } catch (Exception ignored) {}
                try { if (out != null) out.close(); } catch (Exception ignored) {}
                if (conn != null) conn.disconnect();
            }
        });
    }

    /**
     * Inicia la instalación del APK nativo mediante FileProvider e Intent(ACTION_VIEW).
     * Si no tiene permiso de fuentes desconocidas, guarda la ruta para auto-reanudar tras volver de Ajustes.
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        File file;
        if (filePath == null || filePath.isEmpty()) {
            file = locateCachedApk("red_update.apk");
            if (file == null) {
                file = new File(getContext().getCacheDir(), "red_update.apk");
            }
        } else {
            file = new File(filePath);
        }

        if (!file.exists() || file.length() == 0) {
            call.reject("APK file does not exist or is empty at " + file.getAbsolutePath());
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                boolean canInstall = false;
                try {
                    canInstall = getContext().getPackageManager().canRequestPackageInstalls();
                } catch (Throwable t) {
                    android.util.Log.w("RedNodePlugin", "canRequestPackageInstalls check in installApk failed: " + t.getMessage());
                }
                if (!canInstall) {
                    pendingApkInstallPath = file.getAbsolutePath();
                    try {
                        Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                        permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(permIntent);
                    } catch (android.content.ActivityNotFoundException anfe) {
                        Intent fallback = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(fallback);
                    }

                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("promptedPermission", true);
                    call.resolve(ret);
                    return;
                }
            }

            boolean ok = launchInstallerIntent(file.getAbsolutePath());
            if (ok) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } else {
                call.reject("Failed to trigger package installer intent");
            }
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Failed to trigger APK install: " + e.getMessage(), e);
            call.reject("Failed to trigger installer: " + e.getMessage());
        }
    }

    /**
     * Reanuda la instalación pendiente si el permiso ya fue concedido.
     */
    @PluginMethod
    public void resumePendingInstall(PluginCall call) {
        try {
            boolean canInstall = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                canInstall = getContext().getPackageManager().canRequestPackageInstalls();
            }
            if (!canInstall) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("resumed", false);
                ret.put("reason", "permission_denied");
                call.resolve(ret);
                return;
            }
            File file = locateCachedApk("red_update.apk");
            if (file != null && file.exists()) {
                boolean launched = launchInstallerIntent(file.getAbsolutePath());
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("resumed", launched);
                ret.put("filePath", file.getAbsolutePath());
                call.resolve(ret);
            } else {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("resumed", false);
                ret.put("reason", "no_cached_apk");
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Error al reanudar instalación: " + e.getMessage());
        }
    }

    /**
     * Verifica si existe un APK descargado previamente en caché y retorna sus metadatos.
     */
    @PluginMethod
    public void getCachedApkInfo(PluginCall call) {
        try {
            File file = locateCachedApk("red_update.apk");
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            if (file != null && file.exists() && file.length() > 1024 * 1024) { // mayor a 1MB
                ret.put("exists", true);
                ret.put("filePath", file.getAbsolutePath());
                ret.put("size", file.length());
                ret.put("lastModified", file.lastModified());
            } else {
                ret.put("exists", false);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al consultar caché de APK: " + e.getMessage());
        }
    }

    /**
     * Elimina el APK en caché tras la instalación o descarte en ambas rutas de almacenamiento.
     */
    @PluginMethod
    public void deleteCachedApk(PluginCall call) {
        try {
            boolean deleted = false;
            File ext = getContext().getExternalCacheDir();
            if (ext != null) {
                File f = new File(ext, "red_update.apk");
                if (f.exists()) deleted = f.delete() || deleted;
            }
            File internal = new File(getContext().getCacheDir(), "red_update.apk");
            if (internal.exists()) deleted = internal.delete() || deleted;

            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("deleted", deleted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al eliminar APK en caché: " + e.getMessage());
        }
    }

    // SEC-FIX C-3: Panic wipe plugin method — triggered by AuthWall panic PIN.
    @PluginMethod
    public void destroy(PluginCall call) {
        try {
            String dataDir = getContext().getFilesDir().getAbsolutePath() + "/red_node";
            android.util.Log.e("RedNodePlugin", "🔴 PANIC WIPE: destroying " + dataDir);
            getContext().stopService(new Intent(getContext(), RedNodeService.class));
            destroyNode(dataDir);
            call.resolve();
        } catch (Exception e) {
            call.reject("Destroy failed: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // NATIVE SPEECH RECOGNITION (STT) BRIDGE
    // ─────────────────────────────────────────────────────────────────────────────

    @PluginMethod
    public void isSpeechRecognitionAvailable(PluginCall call) {
        try {
            boolean available = SpeechRecognizer.isRecognitionAvailable(getContext());
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", available);
            call.resolve(ret);
        } catch (Exception e) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("available", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void startSpeechRecognition(PluginCall call) {
        final String lang = call.getString("lang", "es-ES");
        final boolean preferOffline = call.getBoolean("preferOffline", true);

        if (getActivity() == null) {
            call.reject("Activity no disponible para inicializar reconocimiento de voz");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                    call.reject("El servicio de reconocimiento de voz de Android no está disponible.");
                    return;
                }

                if (speechRecognizer != null) {
                    try {
                        speechRecognizer.destroy();
                    } catch (Exception ignored) {}
                    speechRecognizer = null;
                }

                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle params) {
                        isSpeechListening = true;
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("status", "ready");
                        notifyListeners("speechReady", ret);
                    }

                    @Override
                    public void onBeginningOfSpeech() {
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("status", "listening");
                        notifyListeners("speechStart", ret);
                    }

                    @Override
                    public void onRmsChanged(float rmsdB) {
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("rmsdB", rmsdB);
                        notifyListeners("speechRms", ret);
                    }

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("status", "processing");
                        notifyListeners("speechEnd", ret);
                    }

                    @Override
                    public void onError(int error) {
                        isSpeechListening = false;
                        String errorMsg = getSpeechErrorMsg(error);
                        android.util.Log.w("RedNodePlugin", "SpeechRecognizer error: " + error + " (" + errorMsg + ")");
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("error", error);
                        ret.put("message", errorMsg);
                        notifyListeners("speechError", ret);
                    }

                    @Override
                    public void onResults(Bundle results) {
                        isSpeechListening = false;
                        ArrayList<String> matches = results != null ? results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
                        String transcript = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("transcript", transcript != null ? transcript.trim() : "");
                        ret.put("isFinal", true);
                        notifyListeners("speechResult", ret);
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> matches = partialResults != null ? partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
                        String transcript = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        if (transcript != null && !transcript.trim().isEmpty()) {
                            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                            ret.put("transcript", transcript.trim());
                            ret.put("isFinal", false);
                            notifyListeners("speechResult", ret);
                        }
                    }

                    @Override
                    public void onEvent(int eventType, Bundle params) {}
                });

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
                intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, lang);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                if (preferOffline && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                }

                speechRecognizer.startListening(intent);
                call.resolve();
            } catch (Exception e) {
                android.util.Log.e("RedNodePlugin", "Error iniciando SpeechRecognizer: " + e.getMessage(), e);
                call.reject("Error al iniciar reconocimiento: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stopSpeechRecognition(PluginCall call) {
        if (getActivity() == null) {
            isSpeechListening = false;
            call.resolve();
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.stopListening();
                }
                isSpeechListening = false;
                call.resolve();
            } catch (Exception e) {
                isSpeechListening = false;
                call.reject("Error deteniendo reconocimiento: " + e.getMessage());
            }
        });
    }

    private String getSpeechErrorMsg(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO: return "Error de captura de audio";
            case SpeechRecognizer.ERROR_CLIENT: return "Error del cliente de voz";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Permisos de micrófono insuficientes";
            case SpeechRecognizer.ERROR_NETWORK: return "Sin conexión para reconocimiento en línea";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "Tiempo de espera de red agotado";
            case SpeechRecognizer.ERROR_NO_MATCH: return "No se detectaron palabras reconocibles";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Servicio de reconocimiento ocupado";
            case SpeechRecognizer.ERROR_SERVER: return "Error del servidor de reconocimiento";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "Silencio prolongado";
            default: return "Error de reconocimiento (" + error + ")";
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // NATIVE USB-OTG SERIAL DRIVER (LoRa Semtech / Meshtastic / FTDI / CP210x / CH340)
    // ─────────────────────────────────────────────────────────────────────────────

    private static final String ACTION_USB_PERMISSION = "f.red.app.USB_PERMISSION";
    private UsbSerialPort currentUsbPort = null;
    private UsbDeviceConnection currentUsbConnection = null;
    private SerialInputOutputManager currentUsbIoManager = null;
    private BroadcastReceiver usbPermissionReceiver = null;

    private synchronized void closeCurrentUsbPort() {
        if (currentUsbIoManager != null) {
            try {
                currentUsbIoManager.setListener(null);
                currentUsbIoManager.stop();
            } catch (Exception ignored) {}
            currentUsbIoManager = null;
        }
        if (currentUsbPort != null) {
            try {
                currentUsbPort.close();
            } catch (Exception ignored) {}
            currentUsbPort = null;
        }
        if (currentUsbConnection != null) {
            try {
                currentUsbConnection.close();
            } catch (Exception ignored) {}
            currentUsbConnection = null;
        }
    }

    /**
     * Lista todos los puertos serie USB-OTG disponibles actualmente conectados al dispositivo Android.
     */
    @PluginMethod
    public void listUsbSerialDevices(PluginCall call) {
        try {
            UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
            if (usbManager == null) {
                call.reject("UsbManager no disponible en este dispositivo");
                return;
            }

            java.util.List<UsbSerialDriver> availableDrivers = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager);
            com.getcapacitor.JSArray devicesArray = new com.getcapacitor.JSArray();

            for (UsbSerialDriver driver : availableDrivers) {
                UsbDevice device = driver.getDevice();
                com.getcapacitor.JSObject devObj = new com.getcapacitor.JSObject();
                devObj.put("deviceId", device.getDeviceId());
                devObj.put("deviceName", device.getDeviceName());
                devObj.put("vendorId", device.getVendorId());
                devObj.put("productId", device.getProductId());
                devObj.put("driverClass", driver.getClass().getSimpleName());
                devObj.put("portsCount", driver.getPorts().size());
                devObj.put("hasPermission", usbManager.hasPermission(device));
                
                String manufacturer = "";
                String product = "";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    try { manufacturer = device.getManufacturerName(); } catch (Exception ignored) {}
                    try { product = device.getProductName(); } catch (Exception ignored) {}
                }
                devObj.put("manufacturer", manufacturer != null ? manufacturer : "");
                devObj.put("productName", product != null ? product : "");

                devicesArray.put(devObj);
            }

            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("devices", devicesArray);
            ret.put("connected", currentUsbPort != null && currentUsbPort.isOpen());
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Error listando dispositivos USB: " + e.getMessage(), e);
            call.reject("Error al listar dispositivos USB: " + e.getMessage());
        }
    }

    /**
     * Abre la conexión con el transceptor LoRa / conversor UART conectado por cable USB-C OTG.
     * Si no tiene permiso concedido, solicita al usuario el diálogo del sistema Android.
     */
    @PluginMethod
    public void openUsbSerial(PluginCall call) {
        try {
            UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
            if (usbManager == null) {
                call.reject("UsbManager no disponible");
                return;
            }

            java.util.List<UsbSerialDriver> availableDrivers = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager);
            if (availableDrivers.isEmpty()) {
                call.reject("No se detectó ningún dispositivo USB Serial (CP210x, CH340, FTDI, CDC-ACM) conectado vía OTG");
                return;
            }

            Integer targetDeviceId = call.getInt("deviceId", null);
            int baudRate = call.getInt("baudRate", 115200);
            int dataBits = call.getInt("dataBits", 8);
            int stopBits = call.getInt("stopBits", UsbSerialPort.STOPBITS_1);
            int parity = call.getInt("parity", UsbSerialPort.PARITY_NONE);

            UsbSerialDriver targetDriver = null;
            if (targetDeviceId != null) {
                for (UsbSerialDriver driver : availableDrivers) {
                    if (driver.getDevice().getDeviceId() == targetDeviceId) {
                        targetDriver = driver;
                        break;
                    }
                }
            }
            if (targetDriver == null) {
                targetDriver = availableDrivers.get(0); // Tomar el primer transceptor disponible
            }

            final UsbSerialDriver selectedDriver = targetDriver;
            final UsbDevice usbDevice = selectedDriver.getDevice();

            if (!usbManager.hasPermission(usbDevice)) {
                android.util.Log.i("RedNodePlugin", "Solicitando permiso USB al usuario para: " + usbDevice.getDeviceName());

                if (usbPermissionReceiver != null) {
                    try { getContext().unregisterReceiver(usbPermissionReceiver); } catch (Exception ignored) {}
                    usbPermissionReceiver = null;
                }

                // Handler para watchdog de timeout (30 segundos) si el usuario descarta o ignora el diálogo
                final android.os.Handler timeoutHandler = new android.os.Handler(android.os.Looper.getMainLooper());
                final Runnable timeoutRunnable = new Runnable() {
                    @Override
                    public void run() {
                        if (usbPermissionReceiver != null) {
                            try { getContext().unregisterReceiver(usbPermissionReceiver); } catch (Exception ignored) {}
                            usbPermissionReceiver = null;
                            android.util.Log.w("RedNodePlugin", "Timeout esperando respuesta al diálogo de permiso USB");
                            call.reject("Tiempo de espera agotado para autorización de puerto USB");
                        }
                    }
                };

                usbPermissionReceiver = new BroadcastReceiver() {
                    @Override
                    public void onReceive(Context context, Intent intent) {
                        if (ACTION_USB_PERMISSION.equals(intent.getAction())) {
                            timeoutHandler.removeCallbacks(timeoutRunnable);
                            try { context.unregisterReceiver(this); } catch (Exception ignored) {}
                            usbPermissionReceiver = null;

                            synchronized (this) {
                                UsbDevice dev = null;
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                    try {
                                        dev = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice.class);
                                    } catch (Exception ignored) {}
                                }
                                if (dev == null) {
                                    try {
                                        dev = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                                    } catch (Exception ignored) {}
                                }

                                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                                boolean isPermitted = (granted && (dev != null || usbManager.hasPermission(usbDevice)))
                                        || usbManager.hasPermission(usbDevice);

                                if (isPermitted) {
                                    android.util.Log.i("RedNodePlugin", "Permiso USB concedido por el usuario");
                                    initUsbPort(usbManager, selectedDriver, baudRate, dataBits, stopBits, parity, call);
                                } else {
                                    android.util.Log.w("RedNodePlugin", "Permiso USB denegado por el usuario");
                                    call.reject("Permiso USB denegado por el usuario");
                                }
                            }
                        }
                    }
                };

                // 1. Intent explícito con paquete de la aplicación — mandatorio en Android 14+ para FLAG_MUTABLE
                Intent permIntent = new Intent(ACTION_USB_PERMISSION);
                permIntent.setPackage(getContext().getPackageName());

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    flags |= PendingIntent.FLAG_MUTABLE;
                }
                PendingIntent permissionIntent = PendingIntent.getBroadcast(getContext(), 0, permIntent, flags);
                IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);

                // 2. RECEIVER_EXPORTED es requerido en Android 14+ porque el broadcast lo origina system_server (UID 1000)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    getContext().registerReceiver(usbPermissionReceiver, filter, Context.RECEIVER_EXPORTED);
                } else {
                    getContext().registerReceiver(usbPermissionReceiver, filter);
                }

                // Iniciar timeout preventivo de 30 segundos
                timeoutHandler.postDelayed(timeoutRunnable, 30000);

                usbManager.requestPermission(usbDevice, permissionIntent);
            } else {
                initUsbPort(usbManager, selectedDriver, baudRate, dataBits, stopBits, parity, call);
            }
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Error abriendo puerto serie USB: " + e.getMessage(), e);
            call.reject("Error al abrir puerto serie USB: " + e.getMessage());
        }
    }

    private void initUsbPort(UsbManager usbManager, UsbSerialDriver driver, int baudRate, int dataBits, int stopBits, int parity, PluginCall call) {
        try {
            closeCurrentUsbPort();

            UsbDeviceConnection connection = usbManager.openDevice(driver.getDevice());
            if (connection == null) {
                call.reject("No se pudo abrir UsbDeviceConnection. Verifique cable OTG o permiso");
                return;
            }
            currentUsbConnection = connection;

            if (driver.getPorts().isEmpty()) {
                call.reject("El controlador USB no expone ningún puerto serie");
                return;
            }

            UsbSerialPort port = driver.getPorts().get(0);
            port.open(currentUsbConnection);
            port.setParameters(baudRate, dataBits, stopBits, parity);

            // Importante para chips CP2102 y ESP32-S3: activar DTR/RTS
            try {
                port.setDTR(true);
                port.setRTS(true);
            } catch (Exception ignored) {}

            currentUsbPort = port;

            currentUsbIoManager = new SerialInputOutputManager(currentUsbPort, new SerialInputOutputManager.Listener() {
                @Override
                public void onNewData(byte[] data) {
                    if (data == null || data.length == 0) return;
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
                    for (byte b : data) {
                        arr.put(b & 0xFF);
                    }
                    ret.put("data", arr);
                    notifyListeners("usbSerialData", ret);
                }

                @Override
                public void onRunError(Exception e) {
                    android.util.Log.e("RedNodePlugin", "Error en bucle I/O USB Serial: " + e.getMessage());
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("error", e.getMessage());
                    notifyListeners("usbSerialError", ret);
                    closeCurrentUsbPort();
                }
            });

            currentUsbIoManager.start();

            android.util.Log.i("RedNodePlugin", "✅ Puerto USB Serial iniciado correctamente a " + baudRate + " bps");

            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", true);
            ret.put("baudRate", baudRate);
            ret.put("driver", driver.getClass().getSimpleName());
            ret.put("deviceName", driver.getDevice().getDeviceName());
            call.resolve(ret);
        } catch (Exception e) {
            closeCurrentUsbPort();
            android.util.Log.e("RedNodePlugin", "Error inicializando puerto USB: " + e.getMessage(), e);
            call.reject("Error inicializando puerto USB: " + e.getMessage());
        }
    }

    /**
     * Escribe un búfer de bytes directamente en el bus USB conectado al transceptor LoRa.
     */
    @PluginMethod
    public void writeUsbSerial(PluginCall call) {
        try {
            if (currentUsbPort == null || !currentUsbPort.isOpen()) {
                call.reject("Puerto USB Serial no está conectado o no está abierto");
                return;
            }

            com.getcapacitor.JSArray dataArray = call.getArray("data");
            if (dataArray == null || dataArray.length() == 0) {
                call.reject("Se requiere un arreglo 'data' con bytes");
                return;
            }

            byte[] bytes = new byte[dataArray.length()];
            for (int i = 0; i < dataArray.length(); i++) {
                bytes[i] = (byte) dataArray.getInt(i);
            }

            currentUsbPort.write(bytes, 2000);

            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", true);
            ret.put("bytesWritten", bytes.length);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Error escribiendo en USB Serial: " + e.getMessage(), e);
            call.reject("Error escribiendo en USB Serial: " + e.getMessage());
        }
    }

    /**
     * Cierra la conexión física USB Serial liberando todos los recursos de hardware.
     */
    @PluginMethod
    public void closeUsbSerial(PluginCall call) {
        closeCurrentUsbPort();
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    /**
     * Consulta el estado de conexión del puerto USB Serial físico.
     */
    @PluginMethod
    public void isUsbSerialConnected(PluginCall call) {
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("connected", currentUsbPort != null && currentUsbPort.isOpen());
        call.resolve(ret);
    }

    /**
     * Permite a la interfaz actualizar el texto y conteo de pares en la notificación persistente.
     */
    @PluginMethod
    public void updateNotificationStatus(PluginCall call) {
        String statusText = call.getString("statusText", null);
        int peerCount = call.getInt("peerCount", -1);
        boolean isPanic = call.getBoolean("isPanic", false);

        RedNodeService.updateNotificationStatus(getContext(), statusText, peerCount, isPanic);

        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CURSOR-ON-TARGET (CoT) MULTICAST UDP GATEWAY (ATAK / CivTAK / WinTAK 239.2.3.1:6969)
    // ─────────────────────────────────────────────────────────────────────────────

    private static final String COT_MULTICAST_GROUP = "239.2.3.1";
    private static final int COT_MULTICAST_PORT = 6969;
    private MulticastSocket cotMulticastSocket = null;
    private Thread cotReceiverThread = null;
    private final AtomicBoolean isCotListening = new AtomicBoolean(false);

    private synchronized void stopCotMulticastInternal() {
        isCotListening.set(false);
        if (cotMulticastSocket != null) {
            try {
                InetAddress group = InetAddress.getByName(COT_MULTICAST_GROUP);
                cotMulticastSocket.leaveGroup(group);
            } catch (Exception ignored) {}
            try {
                cotMulticastSocket.close();
            } catch (Exception ignored) {}
            cotMulticastSocket = null;
        }
        if (cotReceiverThread != null) {
            cotReceiverThread.interrupt();
            cotReceiverThread = null;
        }
    }

    @PluginMethod
    public synchronized void startCotMulticast(PluginCall call) {
        if (isCotListening.get() && cotMulticastSocket != null && !cotMulticastSocket.isClosed()) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("active", true);
            ret.put("port", COT_MULTICAST_PORT);
            ret.put("group", COT_MULTICAST_GROUP);
            call.resolve(ret);
            return;
        }

        stopCotMulticastInternal();

        new Thread(() -> {
            try {
                MulticastSocket socket = new MulticastSocket(COT_MULTICAST_PORT);
                socket.setReuseAddress(true);
                socket.setTimeToLive(32);

                InetAddress group = InetAddress.getByName(COT_MULTICAST_GROUP);

                // Join multicast on all up & multicast-supporting interfaces
                try {
                    Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
                    while (interfaces != null && interfaces.hasMoreElements()) {
                        NetworkInterface ni = interfaces.nextElement();
                        if (ni.isUp() && ni.supportsMulticast() && !ni.isLoopback()) {
                            try {
                                socket.joinGroup(new InetSocketAddress(group, COT_MULTICAST_PORT), ni);
                            } catch (Exception ignored) {}
                        }
                    }
                } catch (Exception ignored) {
                    socket.joinGroup(group);
                }

                cotMulticastSocket = socket;
                isCotListening.set(true);

                cotReceiverThread = new Thread(() -> {
                    byte[] buffer = new byte[65535];
                    while (isCotListening.get() && !Thread.currentThread().isInterrupted()) {
                        try {
                            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                            socket.receive(packet);
                            if (packet.getLength() > 0) {
                                String xml = new String(packet.getData(), packet.getOffset(), packet.getLength(), java.nio.charset.StandardCharsets.UTF_8);
                                String sourceIp = packet.getAddress() != null ? packet.getAddress().getHostAddress() : "";

                                com.getcapacitor.JSObject eventData = new com.getcapacitor.JSObject();
                                eventData.put("xml", xml);
                                eventData.put("sourceIp", sourceIp);
                                eventData.put("port", packet.getPort());
                                notifyListeners("cotMulticastData", eventData);
                            }
                        } catch (Exception e) {
                            if (isCotListening.get()) {
                                android.util.Log.w("RedNodePlugin", "Error in CoT multicast loop: " + e.getMessage());
                            }
                            break;
                        }
                    }
                }, "RedCotReceiverThread");
                cotReceiverThread.start();

                android.util.Log.i("RedNodePlugin", "✅ CoT Multicast Gateway iniciado en " + COT_MULTICAST_GROUP + ":" + COT_MULTICAST_PORT);

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("active", true);
                ret.put("port", COT_MULTICAST_PORT);
                ret.put("group", COT_MULTICAST_GROUP);
                call.resolve(ret);
            } catch (Exception e) {
                android.util.Log.e("RedNodePlugin", "Error starting CoT Multicast Gateway: " + e.getMessage(), e);
                stopCotMulticastInternal();
                call.reject("Error al iniciar CoT Multicast: " + e.getMessage());
            }
        }, "RedCotStarterThread").start();
    }

    @PluginMethod
    public void stopCotMulticast(PluginCall call) {
        stopCotMulticastInternal();
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("active", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void isCotMulticastActive(PluginCall call) {
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("active", isCotListening.get() && cotMulticastSocket != null && !cotMulticastSocket.isClosed());
        call.resolve(ret);
    }

    @PluginMethod
    public void sendCotMulticast(PluginCall call) {
        String xml = call.getString("xml", null);
        if (xml == null || xml.trim().isEmpty()) {
            call.reject("Se requiere parámetro 'xml'");
            return;
        }

        new Thread(() -> {
            try {
                byte[] bytes = xml.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                InetAddress group = InetAddress.getByName(COT_MULTICAST_GROUP);

                MulticastSocket socket = cotMulticastSocket;
                boolean shouldClose = false;
                if (socket == null || socket.isClosed()) {
                    socket = new MulticastSocket();
                    socket.setTimeToLive(32);
                    shouldClose = true;
                }

                DatagramPacket packet = new DatagramPacket(bytes, bytes.length, group, COT_MULTICAST_PORT);
                socket.send(packet);

                if (shouldClose) {
                    try { socket.close(); } catch (Exception ignored) {}
                }

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                ret.put("bytesSent", bytes.length);
                call.resolve(ret);
            } catch (Exception e) {
                android.util.Log.e("RedNodePlugin", "Error sending CoT multicast: " + e.getMessage(), e);
                call.reject("Error enviando CoT Multicast: " + e.getMessage());
            }
        }, "RedCotSenderThread").start();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // NATIVE MBTILES VECTOR/RASTER OFFLINE MAP ENGINE
    // ─────────────────────────────────────────────────────────────────────────────

    private MbtilesPackageReader activeMbtilesReader = null;

    @PluginMethod
    public void listAvailableMbtiles(PluginCall call) {
        try {
            List<File> searchDirs = new ArrayList<>();

            // 1. App external files dir
            File[] extDirs = getContext().getExternalFilesDirs(null);
            if (extDirs != null) {
                for (File f : extDirs) {
                    if (f != null) {
                        searchDirs.add(f);
                        searchDirs.add(new File(f, "maps"));
                    }
                }
            }

            // 2. Common map directories
            File sharedDownloads = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
            if (sharedDownloads != null && sharedDownloads.exists()) {
                searchDirs.add(sharedDownloads);
                searchDirs.add(new File(sharedDownloads, "maps"));
                searchDirs.add(new File(sharedDownloads, "RED/maps"));
            }

            File sdcardRoot = new File("/storage/emulated/0/RED/maps");
            if (sdcardRoot.exists()) searchDirs.add(sdcardRoot);

            List<Map<String, Object>> packages = MbtilesPackageReader.scanMapDirectories(searchDirs);
            com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();

            for (Map<String, Object> pkg : packages) {
                com.getcapacitor.JSObject obj = new com.getcapacitor.JSObject();
                for (Map.Entry<String, Object> entry : pkg.entrySet()) {
                    obj.put(entry.getKey(), entry.getValue());
                }
                arr.put(obj);
            }

            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("packages", arr);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Error listing MBTiles: " + e.getMessage(), e);
            call.reject("Error listando mapas MBTiles: " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void openMbtilesPackage(PluginCall call) {
        String filePath = call.getString("filePath", null);
        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("Se requiere parámetro 'filePath'");
            return;
        }

        try {
            if (activeMbtilesReader == null) {
                activeMbtilesReader = new MbtilesPackageReader();
            }

            boolean ok = activeMbtilesReader.open(filePath);
            if (!ok) {
                call.reject("No se pudo abrir el archivo .mbtiles en la ruta especificada");
                return;
            }

            Map<String, String> meta = activeMbtilesReader.getMetadata();
            com.getcapacitor.JSObject metaObj = new com.getcapacitor.JSObject();
            for (Map.Entry<String, String> entry : meta.entrySet()) {
                metaObj.put(entry.getKey(), entry.getValue());
            }

            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", true);
            ret.put("filePath", filePath);
            ret.put("metadata", metaObj);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Error opening MBTiles package: " + e.getMessage(), e);
            call.reject("Error abriendo paquete MBTiles: " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void getMbtilesTile(PluginCall call) {
        if (activeMbtilesReader == null || !activeMbtilesReader.isOpen()) {
            call.reject("Ningún paquete MBTiles abierto actualmente");
            return;
        }

        Integer z = call.getInt("z");
        Integer x = call.getInt("x");
        Integer y = call.getInt("y");

        if (z == null || x == null || y == null) {
            call.reject("Se requieren los parámetros 'z', 'x' e 'y'");
            return;
        }

        try {
            byte[] tileData = activeMbtilesReader.getTile(z, x, y);
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            if (tileData != null && tileData.length > 0) {
                ret.put("found", true);
                ret.put("dataBase64", Base64.encodeToString(tileData, Base64.NO_WRAP));
                ret.put("sizeBytes", tileData.length);
            } else {
                ret.put("found", false);
            }
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Error fetching tile: " + e.getMessage(), e);
            call.reject("Error obteniendo baldosa MBTiles: " + e.getMessage());
        }
    }

    @PluginMethod
    public synchronized void closeMbtilesPackage(PluginCall call) {
        if (activeMbtilesReader != null) {
            activeMbtilesReader.close();
        }
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void startProxyServer(PluginCall call) {
        int port = call.getInt("port", 8088);
        String sniHost = call.getString("sniHost", "www.claro.com.pe");
        String ipTarget = call.getString("ipTarget", "179.6.232.18");
        String provider = call.getString("provider", "Claro PE");
        String mode = call.getString("mode", "ZERO_RATING_SNI");
        boolean zeroRating = call.getBoolean("zeroRating", true);

        RedNodeService.setProxyZeroRatingConfig(sniHost, ipTarget, provider, mode, zeroRating);
        boolean started = RedNodeService.startProxyServer(port);

        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("success", started);
        ret.put("running", started);
        ret.put("isRunning", started);
        ret.put("port", port);
        ret.put("host", "127.0.0.1");
        ret.put("activeSniHost", sniHost);
        ret.put("activeIpTarget", ipTarget);
        ret.put("activeProvider", provider);
        ret.put("tunnelMode", mode);
        ret.put("zeroRatingEnabled", zeroRating);
        call.resolve(ret);
    }

    @PluginMethod
    public void setProxyZeroRatingConfig(PluginCall call) {
        String sniHost = call.getString("sniHost", "www.claro.com.pe");
        String ipTarget = call.getString("ipTarget", "179.6.232.18");
        String provider = call.getString("provider", "Claro PE");
        String mode = call.getString("mode", "ZERO_RATING_SNI");
        boolean zeroRating = call.getBoolean("zeroRating", true);

        RedNodeService.setProxyZeroRatingConfig(sniHost, ipTarget, provider, mode, zeroRating);

        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("success", true);
        ret.put("activeSniHost", sniHost);
        ret.put("activeIpTarget", ipTarget);
        ret.put("activeProvider", provider);
        ret.put("tunnelMode", mode);
        ret.put("zeroRatingEnabled", zeroRating);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopProxyServer(PluginCall call) {
        RedNodeService.stopProxyServer();
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("success", true);
        ret.put("running", false);
        ret.put("isRunning", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void getProxyStats(PluginCall call) {
        RedProxyServer proxy = RedNodeService.getProxyServer();
        boolean running = proxy != null && proxy.isRunning();
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("success", true);
        ret.put("running", running);
        ret.put("isRunning", running);
        ret.put("port", proxy != null ? proxy.getBoundPort() : 8088);
        ret.put("host", "127.0.0.1");
        ret.put("bytesUploaded", proxy != null ? proxy.getBytesUploaded() : 0);
        ret.put("bytesDownloaded", proxy != null ? proxy.getBytesDownloaded() : 0);
        ret.put("activeConnections", proxy != null ? proxy.getActiveConnections() : 0);
        ret.put("totalRequests", proxy != null ? proxy.getTotalRequests() : 0);
        ret.put("activeSniHost", proxy != null ? proxy.getActiveSniHost() : "www.claro.com.pe");
        ret.put("activeIpTarget", proxy != null ? proxy.getActiveIpTarget() : "179.6.232.18");
        ret.put("activeProvider", proxy != null ? proxy.getActiveProvider() : "Claro PE");
        ret.put("zeroRatingEnabled", proxy != null && proxy.isZeroRatingEnabled());
        ret.put("tunnelMode", proxy != null ? proxy.getTunnelMode() : "ZERO_RATING_SNI");
        call.resolve(ret);
    }

    /**
     * Sondeo de Permeabilidad de Portales Cautivos / Zero-Rating Nativo
     * Ejecuta una consulta directa por socket TCP crudo al puerto 80 del destino,
     * midiendo latencia real RTT y detectando redirecciones 301/302 de operadores celulares.
     */
    @PluginMethod
    public void probeCaptivePermeability(PluginCall call) {
        String host = call.getString("host", "www.claro.com.pe");
        int port = call.getInt("port", 80);
        long startTime = System.currentTimeMillis();

        new Thread(() -> {
            java.net.Socket socket = null;
            try {
                socket = new java.net.Socket();
                socket.connect(new java.net.InetSocketAddress(host, port), 4000);
                socket.setSoTimeout(4000);

                java.io.OutputStream out = socket.getOutputStream();
                String req = "GET / HTTP/1.1\r\n" +
                             "Host: " + host + "\r\n" +
                             "User-Agent: Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.88 Mobile Safari/537.36\r\n" +
                             "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\n" +
                             "Accept-Language: es-419,es;q=0.9,en;q=0.8\r\n" +
                             "Sec-Ch-Ua: \"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Google Chrome\";v=\"128\"\r\n" +
                             "Sec-Ch-Ua-Mobile: ?1\r\n" +
                             "Sec-Ch-Ua-Platform: \"Android\"\r\n" +
                             "Sec-Fetch-Site: none\r\n" +
                             "Sec-Fetch-Mode: navigate\r\n" +
                             "Sec-Fetch-Dest: document\r\n" +
                             "Connection: close\r\n\r\n";
                out.write(req.getBytes());
                out.flush();

                java.io.InputStream in = socket.getInputStream();
                java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(in));
                String statusLine = reader.readLine();

                long latencyMs = System.currentTimeMillis() - startTime;
                int statusCode = 0;
                String location = "";

                if (statusLine != null) {
                    String[] parts = statusLine.split("\\s+");
                    if (parts.length > 1) {
                        try {
                            statusCode = Integer.parseInt(parts[1]);
                        } catch (Exception ignored) {}
                    }

                    String line;
                    while ((line = reader.readLine()) != null && !line.trim().isEmpty()) {
                        if (line.toLowerCase().startsWith("location:")) {
                            location = line.substring(9).trim();
                        }
                    }
                }

                boolean permeable = (statusCode == 200 || statusCode == 204 || statusCode == 301 || statusCode == 302 || statusCode == 307);

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                ret.put("isCaptivePermeable", permeable);
                ret.put("statusCode", statusCode);
                ret.put("location", location);
                ret.put("latencyMs", latencyMs);
                ret.put("host", host);
                ret.put("statusLine", statusLine != null ? statusLine : "");
                call.resolve(ret);

            } catch (Exception e) {
                long latencyMs = System.currentTimeMillis() - startTime;
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", false);
                ret.put("isCaptivePermeable", false);
                ret.put("statusCode", 0);
                ret.put("latencyMs", latencyMs);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            } finally {
                if (socket != null && !socket.isClosed()) {
                    try { socket.close(); } catch (Exception ignored) {}
                }
            }
        }, "CaptiveProbeThread").start();
    }

    /**
     * Ejecuta una petición HTTP/HTTPS a través del túnel o proxy local nativo 127.0.0.1:8088
     * Permite al navegador interno de RED navegar libremente eludiendo las restricciones de CORS
     * y las cabeceras prohibidas (Host) del WebView de Android.
     */
    @PluginMethod
    public void executeTunneledRequest(PluginCall call) {
        String targetUrl = call.getString("url");
        if (targetUrl == null || targetUrl.trim().isEmpty()) {
            call.reject("URL de destino requerida");
            return;
        }

        String method = call.getString("method", "GET").toUpperCase();
        int timeoutMs = call.getInt("timeoutMs", 15000);
        com.getcapacitor.JSObject headersObj = call.getObject("headers");
        String body = call.getString("body", null);
        String mode = call.getString("mode", "ZERO_RATING_SNI");

        new Thread(() -> {
            try {
                if (RedNodeService.getProxyServer() == null || !RedNodeService.getProxyServer().isRunning()) {
                    RedNodeService.startProxyServer(8088);
                }
                int proxyPort = RedNodeService.getProxyServer() != null ? RedNodeService.getProxyServer().getBoundPort() : 8088;
                java.net.Proxy proxy = new java.net.Proxy(java.net.Proxy.Type.HTTP, new java.net.InetSocketAddress("127.0.0.1", proxyPort));

                java.net.URL url = new java.net.URL(targetUrl);
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection(proxy);
                conn.setRequestMethod(method);
                conn.setConnectTimeout(timeoutMs);
                conn.setReadTimeout(timeoutMs);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Mobile; Android 14; RED Sovereign Browser)");
                conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.8");
                conn.setRequestProperty("Accept-Language", "es-ES,es;q=0.9,en;q=0.8");

                if (conn instanceof javax.net.ssl.HttpsURLConnection) {
                    ((javax.net.ssl.HttpsURLConnection) conn).setHostnameVerifier((hostname, session) -> true);
                }

                if (headersObj != null) {
                    java.util.Iterator<String> keys = headersObj.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        conn.setRequestProperty(key, headersObj.getString(key));
                    }
                }

                if (body != null && !body.isEmpty() && ("POST".equals(method) || "PUT".equals(method))) {
                    conn.setDoOutput(true);
                    try (java.io.OutputStream os = conn.getOutputStream()) {
                        os.write(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                        os.flush();
                    }
                }

                int statusCode = conn.getResponseCode();
                String statusMessage = conn.getResponseMessage();

                // Manejo de redirecciones entre protocolos (HTTP -> HTTPS) hasta 3 saltos
                int redirects = 0;
                while (redirects < 3 && (statusCode == 301 || statusCode == 302 || statusCode == 303 || statusCode == 307 || statusCode == 308)) {
                    String redirectUrl = conn.getHeaderField("Location");
                    if (redirectUrl == null || redirectUrl.trim().isEmpty()) break;
                    if (!redirectUrl.startsWith("http://") && !redirectUrl.startsWith("https://")) {
                        redirectUrl = new java.net.URL(url, redirectUrl).toString();
                    }
                    url = new java.net.URL(redirectUrl);
                    conn = (java.net.HttpURLConnection) url.openConnection(proxy);
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(timeoutMs);
                    conn.setReadTimeout(timeoutMs);
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Mobile; Android 14; RED Sovereign Browser)");
                    conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.8");
                    conn.setRequestProperty("Accept-Language", "es-ES,es;q=0.9,en;q=0.8");
                    if (conn instanceof javax.net.ssl.HttpsURLConnection) {
                        ((javax.net.ssl.HttpsURLConnection) conn).setHostnameVerifier((hostname, session) -> true);
                    }
                    statusCode = conn.getResponseCode();
                    statusMessage = conn.getResponseMessage();
                    redirects++;
                }

                java.io.InputStream inStream = (statusCode >= 200 && statusCode < 400)
                        ? conn.getInputStream()
                        : conn.getErrorStream();

                String responseBody = "";
                if (inStream != null) {
                    try (java.io.BufferedReader reader = new java.io.BufferedReader(
                            new java.io.InputStreamReader(inStream, java.nio.charset.StandardCharsets.UTF_8))) {
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line).append("\n");
                            if (sb.length() > 2000000) break; // Cota de seguridad de 2MB
                        }
                        responseBody = sb.toString();
                    }
                }

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                ret.put("ok", statusCode >= 200 && statusCode < 400);
                ret.put("status", statusCode);
                ret.put("statusText", statusMessage != null ? statusMessage : "");
                ret.put("body", responseBody);
                ret.put("fromProxy", true);
                ret.put("carrierHost", RedNodeService.getProxyServer() != null ? RedNodeService.getProxyServer().getActiveSniHost() : "127.0.0.1");
                call.resolve(ret);

            } catch (Exception e) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", false);
                ret.put("ok", false);
                ret.put("status", 502);
                ret.put("statusText", "Error en túnel soberano: " + e.getMessage());
                ret.put("body", "<html><body><h3>Fallo en Túnel Zero-Rating</h3><p>" + e.getMessage() + "</p></body></html>");
                ret.put("fromProxy", true);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        }, "TunneledRequestThread").start();
    }

    /**
     * Consulta DNS Sigilosa sobre UDP 53 (Modo DNS_STEALTH / SlowDNS)
     * Permite penetrar firewalls celulares que bloquean puertos TCP 80/443 sin saldo.
     */
    @PluginMethod
    public void queryDnsStealth(PluginCall call) {
        String host = call.getString("host", "connectivitycheck.gstatic.com");
        String server = call.getString("server", "1.1.1.1");
        int port = call.getInt("port", 53);
        long startTime = System.currentTimeMillis();

        new Thread(() -> {
            java.net.DatagramSocket udpSocket = null;
            try {
                udpSocket = new java.net.DatagramSocket();
                udpSocket.setSoTimeout(4000);

                // Paquete DNS estándar tipo A
                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                baos.write(new byte[]{0x1a, 0x2b, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00});
                for (String part : host.split("\\.")) {
                    if (part.isEmpty()) continue;
                    byte[] b = part.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    baos.write((byte) b.length);
                    baos.write(b);
                }
                baos.write(0x00);
                baos.write(new byte[]{0x00, 0x01, 0x00, 0x01}); // QTYPE A (1), QCLASS IN (1)

                byte[] queryData = baos.toByteArray();
                java.net.InetAddress serverAddr = java.net.InetAddress.getByName(server);
                java.net.DatagramPacket queryPacket = new java.net.DatagramPacket(queryData, queryData.length, serverAddr, port);
                udpSocket.send(queryPacket);

                byte[] buffer = new byte[512];
                java.net.DatagramPacket respPacket = new java.net.DatagramPacket(buffer, buffer.length);
                udpSocket.receive(respPacket);

                long latencyMs = System.currentTimeMillis() - startTime;
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                ret.put("latencyMs", latencyMs);
                ret.put("bytesReceived", respPacket.getLength());
                ret.put("server", server);
                ret.put("host", host);
                call.resolve(ret);

            } catch (Exception e) {
                long latencyMs = System.currentTimeMillis() - startTime;
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", false);
                ret.put("latencyMs", latencyMs);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            } finally {
                if (udpSocket != null && !udpSocket.isClosed()) {
                    udpSocket.close();
                }
            }
        }, "DnsStealthThread").start();
    }
}
