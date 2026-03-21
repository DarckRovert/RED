package f.red.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RedNode")
public class RedNodePlugin extends Plugin {

    static {
        try {
            System.loadLibrary("red_mobile");
            android.util.Log.i("RedNodePlugin", "Native library red_mobile loaded successfully.");
        } catch (UnsatisfiedLinkError e) {
            android.util.Log.e("RedNodePlugin", "FAILED to load native library: " + e.getMessage());
        } catch (Exception e) {
            android.util.Log.e("RedNodePlugin", "Exception loading native library: " + e.getMessage());
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
