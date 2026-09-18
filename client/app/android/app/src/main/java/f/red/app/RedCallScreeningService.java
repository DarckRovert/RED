package f.red.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.ContactsContract;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import android.util.Log;

import androidx.annotation.RequiresApi;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.regex.Pattern;

@RequiresApi(api = Build.VERSION_CODES.Q)
public class RedCallScreeningService extends CallScreeningService {

    private static final String TAG = "RedCallScreening";
    private static final String PREF_NAME = "red_shield_prefs";

    // Prefijos de estafas internacionales Wangiri
    private static final String[] WANGIRI_PREFIXES = {
        "+232", "+247", "+269", "+223", "+675", "+236", "+252", "+224", "+387", "+881", "+882"
    };

    // Patrones semilla regulatorios de telemercadeo
    private static final Pattern[] SEED_PATTERNS = {
        Pattern.compile("^\\+?51(98400|98401|98402)"),
        Pattern.compile("^\\+?51(91200|91201|91202)"),
        Pattern.compile("^\\+?51(92000|92001|92002)"),
        Pattern.compile("^\\+?51(93000|93001)"),
        Pattern.compile("^\\+?51(96000|96001)"),
        Pattern.compile("^\\+?51(97000)"),
        Pattern.compile("^\\+?511(700|701|702|705|708)[0-9]{4}$"),
        Pattern.compile("^\\+?511(610|611|612|619)[0-9]{4}$")
    };

    @Override
    public void onScreenCall(Call.Details details) {
        if (details == null) return;

        // 1. Inviolabilidad Absoluta de Llamadas de Emergencia (Hardware Bypass 0ms)
        if (details.hasProperty(Call.Details.PROPERTY_EMERGENCY_CALLBACK_MODE)) {
            Log.i(TAG, "🚨 Bypass incondicional: Llamada en modo de emergencia");
            respondToCall(details, new CallResponse.Builder().build());
            return;
        }

        // Solo filtrar llamadas entrantes
        if (details.getCallDirection() != Call.Details.DIRECTION_INCOMING) {
            respondToCall(details, new CallResponse.Builder().build());
            return;
        }

        Uri handle = details.getHandle();
        String rawNumber = handle != null ? handle.getSchemeSpecificPart() : "";
        if (rawNumber == null || rawNumber.trim().isEmpty()) {
            respondToCall(details, new CallResponse.Builder().build());
            return;
        }

        String normNumber = normalizeNumber(rawNumber);

        // 2. Bypass de Emergencias Nacionales
        if (normNumber.equals("911") || normNumber.equals("112") || normNumber.equals("105") || normNumber.equals("116")) {
            respondToCall(details, new CallResponse.Builder().build());
            return;
        }

        // 3. Pase VIP Inteligente: Si el número está en los contactos del teléfono
        if (isSavedContact(this, normNumber)) {
            Log.d(TAG, "🟢 Pase VIP: Contacto guardado en libreta -> " + normNumber);
            respondToCall(details, new CallResponse.Builder().build());
            logCallEvent(normNumber, false, "Contacto Verificado");
            return;
        }

        // 4. Leer preferencias de RED
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        boolean isEnabled = prefs.getBoolean("shield_enabled", true);
        boolean isStrict = prefs.getBoolean("strict_mode", false);

        if (!isEnabled) {
            respondToCall(details, new CallResponse.Builder().build());
            return;
        }

        // 5. Evaluación de Spam
        boolean isSpam = false;
        String reason = "Número Desconocido";

        // A. Detección Wangiri
        for (String wp : WANGIRI_PREFIXES) {
            if (normNumber.startsWith(wp)) {
                isSpam = true;
                reason = "Fraude Internacional Wangiri (" + wp + ")";
                break;
            }
        }

        // B. Detección Base Semilla
        if (!isSpam) {
            for (Pattern p : SEED_PATTERNS) {
                if (p.matcher(normNumber).find()) {
                    isSpam = true;
                    reason = "Telemercadeo / Call Center Regulatorio";
                    break;
                }
            }
        }

        // 6. Formulación de Respuesta a Telecom
        CallResponse.Builder responseBuilder = new CallResponse.Builder();

        if (isSpam) {
            Log.w(TAG, "🔴 SPAM DETECTADO: " + normNumber + " (" + reason + ")");
            if (isStrict) {
                // Modo Fortaleza: Colgar en silencio
                responseBuilder.setDisallowCall(true);
                responseBuilder.setRejectCall(true);
                responseBuilder.setSkipNotification(true);
                responseBuilder.setSkipCallLog(false);
            } else {
                // Modo Advertencia: Silenciar y permitir que el usuario decida en pantalla
                responseBuilder.setSilenceCall(true);
            }
        }

        respondToCall(details, responseBuilder.build());
        logCallEvent(normNumber, isSpam, reason);
    }

    private String normalizeNumber(String raw) {
        String clean = raw.trim().replaceAll("[\\s\\-\\(\\)\\.]", "");
        if (!clean.startsWith("+") && clean.length() == 9 && clean.startsWith("9")) {
            clean = "+51" + clean;
        }
        return clean;
    }

    private boolean isSavedContact(Context context, String phoneNumber) {
        try {
            if (context.checkSelfPermission(android.Manifest.permission.READ_CONTACTS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return false;
            }
            Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber));
            String[] projection = new String[]{ ContactsContract.PhoneLookup._ID };
            try (Cursor cursor = context.getContentResolver().query(uri, projection, null, null, null)) {
                return cursor != null && cursor.moveToFirst();
            }
        } catch (Exception ignored) {
            return false;
        }
    }

    private void logCallEvent(String number, boolean isSpam, String label) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString("call_log", "[]");
            JSONArray arr = new JSONArray(raw);

            JSONObject obj = new JSONObject();
            obj.put("id", "call_" + System.currentTimeMillis());
            obj.put("number", number);
            obj.put("isSpam", isSpam);
            obj.put("label", label);
            obj.put("timestamp", System.currentTimeMillis());

            // Prepend
            JSONArray newArr = new JSONArray();
            newArr.put(obj);
            for (int i = 0; i < Math.min(arr.length(), 49); i++) {
                newArr.put(arr.get(i));
            }

            prefs.edit().putString("call_log", newArr.toString()).apply();
        } catch (Exception ignored) {}
    }
}
