package f.red.app;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RedDisguise")
public class RedDisguisePlugin extends Plugin {

    @PluginMethod
    public void setDisguiseMode(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        if (enabled == null) enabled = false;

        PackageManager pm = getContext().getPackageManager();
        
        ComponentName mainActivity = new ComponentName(getContext(), "f.red.app.MainActivity");
        ComponentName aliasActivity = new ComponentName(getContext(), "f.red.app.CalculatorAlias");

        try {
            if (enabled) {
                // Enable Calculator, Disable RED
                pm.setComponentEnabledSetting(
                    aliasActivity,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
                pm.setComponentEnabledSetting(
                    mainActivity,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
            } else {
                // Enable RED, Disable Calculator
                pm.setComponentEnabledSetting(
                    mainActivity,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
                pm.setComponentEnabledSetting(
                    aliasActivity,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
            }
            
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject("Failed to change app icon: " + e.getMessage());
        }
    }
}
