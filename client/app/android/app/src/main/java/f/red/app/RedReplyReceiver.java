package f.red.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.RemoteInput;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * v41 Sprint 2 — Inline-Reply BroadcastReceiver
 *
 * Fires when the user taps the "Responder" action in a RED incoming message notification.
 * Reads the typed text from the RemoteInput bundle and POSTs it to the local Rust node's
 * HTTP API so the message is sent through the P2P mesh without needing to open the app.
 */
public class RedReplyReceiver extends BroadcastReceiver {

    private static final String TAG = "RedReplyReceiver";
    private static final String REPLY_KEY = "red_inline_reply";
    private static final String SEND_URL = "http://127.0.0.1:7333/api/messages/send";

    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
        if (remoteInput == null) {
            Log.w(TAG, "RemoteInput bundle is null — aborting inline reply.");
            return;
        }

        CharSequence replyText = remoteInput.getCharSequence(REPLY_KEY);
        if (replyText == null || replyText.length() == 0) {
            Log.w(TAG, "Inline reply text is empty — aborting.");
            return;
        }

        String recipient = intent.getStringExtra("recipient");
        if (recipient == null || recipient.isEmpty()) {
            recipient = intent.getStringExtra("conversation_id");
        }
        if (recipient == null || recipient.isEmpty()) {
            recipient = intent.getStringExtra("sender");
        }
        String text = replyText.toString().trim();

        Log.i(TAG, "Inline reply received for recipient: " + recipient + " | length=" + text.length());

        final String finalRecipient = recipient != null ? recipient : "";

        // POST the reply to the local Rust node in a background thread
        new Thread(() -> {
            try {
                // Escape text for JSON (basic escaping — sufficient for mesh messages)
                String escaped = text
                        .replace("\\", "\\\\")
                        .replace("\"", "\\\"")
                        .replace("\n", "\\n")
                        .replace("\r", "\\r");

                String jsonBody = "{\"recipient\":\"" + finalRecipient + "\","
                        + "\"content\":\"" + escaped + "\","
                        + "\"msg_type\":\"text\"}";

                URL url = new URL(SEND_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(8000);
                conn.setDoOutput(true);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                conn.disconnect();

                if (code >= 200 && code < 300) {
                    Log.i(TAG, "Inline reply sent successfully via Rust API (HTTP " + code + ")");
                } else {
                    Log.w(TAG, "Rust API returned non-2xx for inline reply: HTTP " + code);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to send inline reply: " + e.getMessage());
            }
        }, "RedInlineReplyThread").start();

        // Dismiss the notification that triggered this reply
        if (recipient != null && !recipient.isEmpty()) {
            NotificationManager nm = (NotificationManager)
                    context.getSystemService(Context.NOTIFICATION_SERVICE);
            // We use the same hash-based ID as the sender — cancel to prevent duplicate replies
            if (nm != null) {
                int notifId = recipient.hashCode() & 0xFFFF;
                nm.cancel(notifId);
            }
        }
    }
}
