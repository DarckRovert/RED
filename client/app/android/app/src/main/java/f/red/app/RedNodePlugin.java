package f.red.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RedNode")
public class RedNodePlugin extends Plugin {

    // Load the native Rust library
    static {
        System.loadLibrary("red_mobile");
    }

    // Made public static so RedNodeService can call it without instantiating the Plugin.
    // The JNI signature (Java_f_red_app_RedNodePlugin_startNode) remains fully identical.
    public static native void startNode(String dataDir, String password);

    @PluginMethod
    public void start(PluginCall call) {
        try {
            // Setup data directory to be internal app storage
            String dataDir = getContext().getFilesDir().getAbsolutePath() + "/red_node";
            
            // Allow an optional password from frontend, or use a default
            String password = call.getString("password", "default_mobile_password");
            
            // Delegate the heavy lifting to the Foreground Service
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
}
