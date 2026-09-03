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
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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

    @Override
    public void load() {
        super.load();
        instance = this;
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("granted", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    /** Abre la pantalla del sistema Android para otorgar permiso de instalación de paquetes a RED */
    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } else {
                call.resolve();
            }
        } catch (Exception e) {
            call.reject("Could not open install permission settings: " + e.getMessage());
        }
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
                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "RED-Mobile-Updater");

                int responseCode = conn.getResponseCode();
                // Manejo de redirecciones 301, 302, 307, 308 (GitHub Releases -> AWS S3 CDN)
                if (responseCode == HttpURLConnection.HTTP_MOVED_PERM || responseCode == HttpURLConnection.HTTP_MOVED_TEMP || responseCode == 307 || responseCode == 308) {
                    String newUrl = conn.getHeaderField("Location");
                    conn.disconnect();
                    url = new URL(newUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "RED-Mobile-Updater");
                    responseCode = conn.getResponseCode();
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new Exception("HTTP server responded with status: " + responseCode);
                }

                long totalBytes = conn.getContentLengthLong();
                File cacheDir = getContext().getCacheDir();
                File targetFile = new File(cacheDir, fileName);
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
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        File file;
        if (filePath == null || filePath.isEmpty()) {
            file = new File(getContext().getCacheDir(), "red_update.apk");
        } else {
            file = new File(filePath);
        }

        if (!file.exists() || file.length() == 0) {
            call.reject("APK file does not exist or is empty at " + file.getAbsolutePath());
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!getContext().getPackageManager().canRequestPackageInstalls()) {
                    Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                    permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(permIntent);

                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("promptedPermission", true);
                    call.resolve(ret);
                    return;
                }
            }

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
            getContext().startActivity(intent);

            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Failed to trigger APK install: " + e.getMessage(), e);
            call.reject("Failed to trigger installer: " + e.getMessage());
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
}
