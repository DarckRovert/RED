package f.red.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Environment;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RedNodePlugin.class);
        registerPlugin(RedDisguisePlugin.class);
        super.onCreate(savedInstanceState);
        
        // Critical: Force WebView to use proper device-width scaling for CSS media queries
        android.webkit.WebView webView = this.bridge.getWebView();
        if (webView != null) {
            android.webkit.WebSettings settings = webView.getSettings();
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.setInitialScale(0);

            // Grant WebRTC and Media Capture permissions inside Capacitor WebView
            webView.setWebChromeClient(new android.webkit.WebChromeClient() {
                @Override
                public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                    runOnUiThread(() -> {
                        request.grant(request.getResources());
                    });
                }
            });
        }

        copyDebugLogsToPublicStorage();
        requestP2pPermissions();
    }

    private void requestP2pPermissions() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            String[] permissions = {
                android.Manifest.permission.CAMERA,
                android.Manifest.permission.RECORD_AUDIO,
                android.Manifest.permission.MODIFY_AUDIO_SETTINGS,
                android.Manifest.permission.BLUETOOTH_SCAN,
                android.Manifest.permission.BLUETOOTH_ADVERTISE,
                android.Manifest.permission.BLUETOOTH_CONNECT,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            };
            for (String perm : permissions) {
                if (checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(permissions, 1001);
                    break;
                }
            }
        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            String[] permissions = {
                android.Manifest.permission.CAMERA,
                android.Manifest.permission.RECORD_AUDIO,
                android.Manifest.permission.MODIFY_AUDIO_SETTINGS,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            };
            for (String perm : permissions) {
                if (checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(permissions, 1001);
                    break;
                }
            }
        }
    }

    private void copyDebugLogsToPublicStorage() {
        try {
            String internalDir = getFilesDir().getAbsolutePath() + "/red_node";
            File publicDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            
            String[] filesToCopy = {"CRASH_DUMP.txt", "PANIC_DUMP.txt"};
            
            for (String fileName : filesToCopy) {
                File sourceFile = new File(internalDir, fileName);
                if (sourceFile.exists()) {
                    File destFile = new File(publicDir, "RED_" + fileName);
                    try (FileInputStream fis = new FileInputStream(sourceFile);
                         FileOutputStream fos = new FileOutputStream(destFile)) {
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = fis.read(buffer)) > 0) {
                            fos.write(buffer, 0, length);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
