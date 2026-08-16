package f.red.app;

import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RedNode")
public class RedNodePlugin extends Plugin {

    private volatile boolean isMorseActive = false;
    private Thread morseThread = null;

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

    private static RedNodePlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
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
}
