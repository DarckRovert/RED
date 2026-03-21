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
            webView.setInitialScale(0);
        }

        copyDebugLogsToPublicStorage();
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
