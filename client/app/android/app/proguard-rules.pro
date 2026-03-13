# RED Protocol - ProGuard / R8 rules
# These rules prevent R8 from removing or renaming classes that
# are referenced by the native Rust library via JNI.

# ─── Rust FFI Bridge ─────────────────────────────────────────────────────────
# The JNI class name must match exactly what's declared in red_mobile/src/lib.rs:
#   Java_f_red_app_RedNodePlugin_startNode(...)
-keep class f.red.app.RedNodePlugin { *; }
-keepclassmembers class f.red.app.RedNodePlugin {
    public static native *;
    public native *;
}

# ─── Capacitor Bridge ────────────────────────────────────────────────────────
# Capacitor's plugin system uses reflection; prevent renaming of plugin classes
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# ─── WebView JS Interface ────────────────────────────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── General Android Safety ──────────────────────────────────────────────────
# Keep Parcelable implementations (used throughout Android APIs)
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable (used for Intent extras)
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Preserve stack traces in release builds for debugging
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
