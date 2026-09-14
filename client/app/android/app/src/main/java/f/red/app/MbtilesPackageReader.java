package f.red.app;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Log;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MbtilesPackageReader — RED Sovereign Tactical Map Engine (MBTiles 1.3)
 *
 * Provides ultra-fast, zero-memory-leak, direct SQLite reading of massive offline
 * map packages (.mbtiles from 500 MB to 15+ GB) residing on internal memory or MicroSD.
 * Handles Slippy Map (XYZ) to Tile Map Service (TMS) vertical axis translation.
 */
public class MbtilesPackageReader {
    private static final String TAG = "MbtilesPackageReader";

    private SQLiteDatabase db = null;
    private String currentFilePath = null;

    public synchronized boolean open(String filePath) {
        close();
        if (filePath == null || filePath.trim().isEmpty()) {
            Log.e(TAG, "File path is null or empty");
            return false;
        }

        File file = new File(filePath);
        if (!file.exists() || !file.canRead()) {
            Log.e(TAG, "MBTiles file does not exist or is not readable: " + filePath);
            return false;
        }

        try {
            db = SQLiteDatabase.openDatabase(filePath, null, SQLiteDatabase.OPEN_READONLY | SQLiteDatabase.NO_LOCALIZED_COLLATORS);
            currentFilePath = filePath;
            Log.i(TAG, "✅ MBTiles package opened successfully: " + file.getName() + " (" + (file.length() / (1024 * 1024)) + " MB)");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to open MBTiles database: " + e.getMessage(), e);
            db = null;
            currentFilePath = null;
            return false;
        }
    }

    public synchronized void close() {
        if (db != null) {
            try {
                if (db.isOpen()) {
                    db.close();
                }
            } catch (Exception ignored) {}
            db = null;
        }
        currentFilePath = null;
    }

    public synchronized boolean isOpen() {
        return db != null && db.isOpen();
    }

    public synchronized String getFilePath() {
        return currentFilePath;
    }

    /**
     * Extracts all key-value metadata from the MBTiles 'metadata' table.
     */
    public synchronized Map<String, String> getMetadata() {
        Map<String, String> metadata = new HashMap<>();
        if (!isOpen()) return metadata;

        Cursor cursor = null;
        try {
            cursor = db.rawQuery("SELECT name, value FROM metadata", null);
            if (cursor != null && cursor.moveToFirst()) {
                do {
                    String name = cursor.getString(0);
                    String val = cursor.getString(1);
                    if (name != null && val != null) {
                        metadata.put(name, val);
                    }
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            Log.w(TAG, "Error querying metadata table: " + e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
        }
        return metadata;
    }

    /**
     * Queries a single tile BLOB given standard XYZ coordinates.
     * Automatically converts XYZ to TMS coordinate system:
     * tms_y = (2^z - 1) - y
     */
    public synchronized byte[] getTile(int z, int x, int y) {
        if (!isOpen()) return null;

        // TMS coordinate translation
        int tmsY = (1 << z) - 1 - y;

        Cursor cursor = null;
        try {
            cursor = db.rawQuery(
                "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1",
                new String[]{String.valueOf(z), String.valueOf(x), String.valueOf(tmsY)}
            );

            if (cursor != null && cursor.moveToFirst()) {
                return cursor.getBlob(0);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error fetching tile z=" + z + ", x=" + x + ", y=" + y + ": " + e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
        }
        return null;
    }

    /**
     * Helper to inspect map directory and list all available .mbtiles packages.
     */
    public static List<Map<String, Object>> scanMapDirectories(List<File> directories) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (directories == null) return list;

        for (File dir : directories) {
            if (dir == null || !dir.exists() || !dir.isDirectory()) continue;

            File[] files = dir.listFiles((d, name) -> name.toLowerCase().endsWith(".mbtiles"));
            if (files == null) continue;

            for (File file : files) {
                if (!file.isFile() || !file.canRead()) continue;

                Map<String, Object> item = new HashMap<>();
                item.put("path", file.getAbsolutePath());
                item.put("fileName", file.getName());
                item.put("sizeBytes", file.length());

                // Read metadata header quickly
                MbtilesPackageReader reader = new MbtilesPackageReader();
                if (reader.open(file.getAbsolutePath())) {
                    Map<String, String> meta = reader.getMetadata();
                    item.put("name", meta.getOrDefault("name", file.getName().replace(".mbtiles", "")));
                    item.put("format", meta.getOrDefault("format", "png"));
                    item.put("minzoom", meta.getOrDefault("minzoom", "0"));
                    item.put("maxzoom", meta.getOrDefault("maxzoom", "18"));
                    item.put("bounds", meta.getOrDefault("bounds", ""));
                    item.put("attribution", meta.getOrDefault("attribution", "RED Sovereign Maps"));
                    item.put("description", meta.getOrDefault("description", ""));
                    reader.close();
                } else {
                    item.put("name", file.getName());
                    item.put("format", "unknown");
                }
                list.add(item);
            }
        }
        return list;
    }
}
