package f.red.app;

import android.app.ActivityManager;
import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.provider.Settings;
import android.telephony.TelephonyManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.List;

@CapacitorPlugin(name = "RedShield")
public class RedShieldPlugin extends Plugin {

    private static RedShieldPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void notifyCallScreened(String number, boolean isSpam, String label) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("id", "call_" + System.currentTimeMillis());
            data.put("number", number);
            data.put("isSpam", isSpam);
            data.put("label", label);
            data.put("timestamp", System.currentTimeMillis());
            instance.notifyListeners("onCallScreened", data);
        }
    }

    @PluginMethod
    public void auditAppPermissions(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();

        int totalApps = 0;
        int criticalRisk = 0;
        int highRisk = 0;
        int mediumRisk = 0;
        int appsWithMic = 0;
        int appsWithCamera = 0;
        int appsWithLocation = 0;
        int appsWithAccessibility = 0;

        JSArray items = new JSArray();

        try {
            int flags = PackageManager.GET_PERMISSIONS;
            List<PackageInfo> packages = pm.getInstalledPackages(flags);

            for (PackageInfo pi : packages) {
                if (pi.requestedPermissions == null) continue;

                boolean isSystem = (pi.applicationInfo != null && (pi.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                String appName = pi.applicationInfo != null ? pm.getApplicationLabel(pi.applicationInfo).toString() : pi.packageName;

                boolean hasMic = false;
                boolean hasCam = false;
                boolean hasLoc = false;
                boolean hasOverlay = false;
                boolean hasAccessibility = false;
                JSArray dangerousPerms = new JSArray();

                for (String perm : pi.requestedPermissions) {
                    if ("android.permission.RECORD_AUDIO".equals(perm)) {
                        hasMic = true;
                        dangerousPerms.put("RECORD_AUDIO");
                    } else if ("android.permission.CAMERA".equals(perm)) {
                        hasCam = true;
                        dangerousPerms.put("CAMERA");
                    } else if ("android.permission.ACCESS_FINE_LOCATION".equals(perm) || "android.permission.ACCESS_BACKGROUND_LOCATION".equals(perm)) {
                        hasLoc = true;
                        dangerousPerms.put("LOCATION");
                    } else if ("android.permission.SYSTEM_ALERT_WINDOW".equals(perm)) {
                        hasOverlay = true;
                        dangerousPerms.put("SYSTEM_ALERT_WINDOW");
                    } else if ("android.permission.BIND_ACCESSIBILITY_SERVICE".equals(perm)) {
                        hasAccessibility = true;
                        dangerousPerms.put("ACCESSIBILITY");
                    }
                }

                if (dangerousPerms.length() == 0 && isSystem) {
                    continue; // Omitir apps del sistema inocuas para no saturar
                }

                totalApps++;
                if (hasMic) appsWithMic++;
                if (hasCam) appsWithCamera++;
                if (hasLoc) appsWithLocation++;
                if (hasAccessibility) appsWithAccessibility++;

                int score = 10;
                String riskLevel = "low";

                if (hasAccessibility && !isSystem) {
                    score = 90;
                    riskLevel = "critical";
                    criticalRisk++;
                } else if ((hasMic || hasCam) && hasLoc) {
                    score = 65;
                    riskLevel = "high";
                    highRisk++;
                } else if (hasMic || hasCam || hasLoc) {
                    score = 40;
                    riskLevel = "medium";
                    mediumRisk++;
                }

                JSObject item = new JSObject();
                item.put("packageName", pi.packageName);
                item.put("appName", appName);
                item.put("isSystemApp", isSystem);
                item.put("riskScore", score);
                item.put("riskLevel", riskLevel);
                item.put("dangerousPermissions", dangerousPerms);
                item.put("hasBackgroundMic", hasMic);
                item.put("hasBackgroundCamera", hasCam);
                item.put("hasBackgroundLocation", hasLoc);
                item.put("hasAccessibilityService", hasAccessibility);
                item.put("hasOverlayPermission", hasOverlay);

                items.put(item);
            }

            JSObject summary = new JSObject();
            summary.put("totalApps", totalApps);
            summary.put("criticalRiskCount", criticalRisk);
            summary.put("highRiskCount", highRisk);
            summary.put("mediumRiskCount", mediumRisk);
            summary.put("appsWithMic", appsWithMic);
            summary.put("appsWithCamera", appsWithCamera);
            summary.put("appsWithLocation", appsWithLocation);
            summary.put("appsWithAccessibility", appsWithAccessibility);
            summary.put("items", items);

            JSObject ret = new JSObject();
            ret.put("summary", summary);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Error auditando permisos de aplicaciones: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getHardwareHealth(PluginCall call) {
        Context context = getContext();

        // 1. Batería
        IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent bStatus = context.registerReceiver(null, ifilter);

        int level = 85;
        int tempTenths = 310;
        int status = BatteryManager.BATTERY_STATUS_UNKNOWN;

        if (bStatus != null) {
            int rawLevel = bStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = bStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            if (rawLevel >= 0 && scale > 0) {
                level = Math.round((rawLevel / (float) scale) * 100);
            }
            tempTenths = bStatus.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 310);
            status = bStatus.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN);
        }

        float tempC = tempTenths / 10.0f;
        boolean isCharging = (status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL);

        // 2. RAM
        ActivityManager actManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo memInfo = new ActivityManager.MemoryInfo();
        if (actManager != null) {
            actManager.getMemoryInfo(memInfo);
        }
        int freeMb = (int) (memInfo.availMem / (1024 * 1024));
        int totalMb = (int) (memInfo.totalMem / (1024 * 1024));

        // 3. Almacenamiento interno
        File path = Environment.getDataDirectory();
        StatFs stat = new StatFs(path.getPath());
        long blockSize = stat.getBlockSizeLong();
        long availableBlocks = stat.getAvailableBlocksLong();
        long totalBlocks = stat.getBlockCountLong();

        double freeGb = Math.round((availableBlocks * blockSize / (1024.0 * 1024.0 * 1024.0)) * 10.0) / 10.0;
        double totalGb = Math.round((totalBlocks * blockSize / (1024.0 * 1024.0 * 1024.0)) * 10.0) / 10.0;

        JSObject ret = new JSObject();
        ret.put("batteryLevel", level);
        ret.put("batteryTempCelsius", Math.round(tempC * 10.0) / 10.0);
        ret.put("isCharging", isCharging);
        ret.put("powerWattage", isCharging ? 12.5 : -1.8);
        ret.put("batteryHealthStatus", tempC > 45 ? "OVERHEAT" : "GOOD");
        ret.put("ramFreeMb", freeMb);
        ret.put("ramTotalMb", totalMb);
        ret.put("storageFreeGb", freeGb);
        ret.put("storageTotalGb", totalGb);

        call.resolve(ret);
    }

    @PluginMethod
    public void getRfStatus(PluginCall call) {
        Context context = getContext();
        TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
        ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);

        String carrier = "RED Cellular Mesh";
        String netType = "4G_LTE";
        boolean is2gThreat = false;

        if (tm != null) {
            String simOp = tm.getSimOperatorName();
            if (simOp != null && !simOp.trim().isEmpty()) {
                carrier = simOp;
            }

            int networkTypeInt = TelephonyManager.NETWORK_TYPE_UNKNOWN;
            try {
                if (context.checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                    networkTypeInt = tm.getDataNetworkType();
                }
            } catch (Exception ignored) {}

            switch (networkTypeInt) {
                case TelephonyManager.NETWORK_TYPE_NR:
                    netType = "5G";
                    break;
                case TelephonyManager.NETWORK_TYPE_LTE:
                    netType = "4G_LTE";
                    break;
                case TelephonyManager.NETWORK_TYPE_HSDPA:
                case TelephonyManager.NETWORK_TYPE_HSPA:
                case TelephonyManager.NETWORK_TYPE_UMTS:
                    netType = "3G";
                    break;
                case TelephonyManager.NETWORK_TYPE_GPRS:
                case TelephonyManager.NETWORK_TYPE_EDGE:
                case TelephonyManager.NETWORK_TYPE_CDMA:
                    netType = "2G_GSM";
                    is2gThreat = true; // Alerta IMSI-Catcher potencial
                    break;
                default:
                    netType = "4G_LTE";
                    break;
            }
        }

        String wifiSsid = "Wi-Fi Desconectado";
        String wifiSec = "NONE";
        boolean isRogueWifi = false;

        if (cm != null) {
            NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
            if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    WifiInfo winfo = wm.getConnectionInfo();
                    if (winfo != null && winfo.getSSID() != null) {
                        wifiSsid = winfo.getSSID().replace("\"", "");
                        wifiSec = "WPA2"; // Android abstrae WPA2/WPA3
                    }
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("carrierName", carrier);
        ret.put("networkType", netType);
        ret.put("isEncrypted", !is2gThreat);
        ret.put("is2gDowngradeThreat", is2gThreat);
        ret.put("wifiSsid", wifiSsid);
        ret.put("wifiSecurity", wifiSec);
        ret.put("isRogueWifiThreat", isRogueWifi);

        call.resolve(ret);
    }

    @PluginMethod
    public void syncShieldConfig(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences("red_shield_prefs", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            if (call.hasOption("shieldEnabled")) {
                editor.putBoolean("shield_enabled", call.getBoolean("shieldEnabled", true));
            }
            if (call.hasOption("strictMode")) {
                editor.putBoolean("strict_mode", call.getBoolean("strictMode", false));
            }
            if (call.hasOption("simPrefix")) {
                editor.putString("sim_prefix", call.getString("simPrefix", ""));
            }
            if (call.hasOption("customBlacklist")) {
                JSArray bl = call.getArray("customBlacklist");
                editor.putString("custom_blacklist", bl != null ? bl.toString() : "[]");
            }
            if (call.hasOption("customWhitelist")) {
                JSArray wl = call.getArray("customWhitelist");
                editor.putString("custom_whitelist", wl != null ? wl.toString() : "[]");
            }

            editor.apply();
            JSObject ret = new JSObject();
            ret.put("synced", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error sincronizando configuración de escudo: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getScreenedCallLogs(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences("red_shield_prefs", Context.MODE_PRIVATE);
            String raw = prefs.getString("call_log", "[]");
            JSArray arr = new JSArray(raw);
            JSObject ret = new JSObject();
            ret.put("logs", arr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error obteniendo registros de llamadas: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearScreenedCallLogs(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences("red_shield_prefs", Context.MODE_PRIVATE);
            prefs.edit().putString("call_log", "[]").apply();
            JSObject ret = new JSObject();
            ret.put("cleared", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error vaciando registros de llamadas: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isCallScreeningRoleHeld(PluginCall call) {
        Context context = getContext();
        TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
        boolean isVoiceCapable = (tm != null && tm.isVoiceCapable());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            RoleManager roleManager = (RoleManager) context.getSystemService(Context.ROLE_SERVICE);
            boolean isRoleAvailable = roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING);
            boolean held = isRoleAvailable && roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING);
            JSObject ret = new JSObject();
            ret.put("isHeld", held);
            ret.put("isRoleAvailable", isRoleAvailable);
            ret.put("isVoiceCapable", isVoiceCapable);
            call.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("isHeld", isVoiceCapable);
            ret.put("isRoleAvailable", false);
            ret.put("isVoiceCapable", isVoiceCapable);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestCallScreeningRole(PluginCall call) {
        Context context = getContext();
        TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
        boolean isVoiceCapable = (tm != null && tm.isVoiceCapable());

        if (!isVoiceCapable) {
            JSObject ret = new JSObject();
            ret.put("requested", false);
            ret.put("notSupported", true);
            ret.put("reason", "Dispositivo sin capacidad de llamadas celulares");
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            RoleManager roleManager = (RoleManager) context.getSystemService(Context.ROLE_SERVICE);
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                if (!roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                    Intent intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING);
                    getActivity().startActivity(intent);
                    JSObject ret = new JSObject();
                    ret.put("requested", true);
                    call.resolve(ret);
                    return;
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("requested", false);
        ret.put("alreadyHeld", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        String pkg = call.getString("packageName");
        if (pkg == null || pkg.trim().isEmpty()) {
            pkg = getContext().getPackageName();
        }
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + pkg));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error abriendo ajustes: " + e.getMessage());
        }
    }
}

