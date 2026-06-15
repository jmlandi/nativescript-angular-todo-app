package org.nativescript.nstodoapp.braze;

import android.app.Application;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.braze.Braze;
import com.braze.BrazeActivityLifecycleCallbackListener;

/**
 * Auto-runs at process start (before first Activity). Initializes Braze without
 * subclassing Application so NativeScript's com.tns.NativeScriptApplication stays untouched.
 */
public class BrazeInitProvider extends ContentProvider {
    private static final String TAG = "BrazeInit";

    @Override
    public boolean onCreate() {
        Context ctx = getContext();
        if (ctx == null) {
            Log.w(TAG, "null context, skip");
            return false;
        }
        Application app = (Application) ctx.getApplicationContext();
        app.registerActivityLifecycleCallbacks(
                new BrazeActivityLifecycleCallbackListener(true, true));
        Braze.getInstance(app);
        Log.i(TAG, "Braze initialized. sdkVersion=" + Braze.getSdkVersion());
        return true;
    }

    @Nullable @Override
    public Cursor query(@NonNull Uri uri, @Nullable String[] projection, @Nullable String selection,
                        @Nullable String[] selectionArgs, @Nullable String sortOrder) { return null; }

    @Nullable @Override public String getType(@NonNull Uri uri) { return null; }

    @Nullable @Override
    public Uri insert(@NonNull Uri uri, @Nullable ContentValues values) { return null; }

    @Override
    public int delete(@NonNull Uri uri, @Nullable String selection, @Nullable String[] selectionArgs) { return 0; }

    @Override
    public int update(@NonNull Uri uri, @Nullable ContentValues values,
                      @Nullable String selection, @Nullable String[] selectionArgs) { return 0; }
}
