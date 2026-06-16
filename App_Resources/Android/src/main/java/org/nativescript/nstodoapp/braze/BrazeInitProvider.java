package org.nativescript.nstodoapp.braze;

import android.app.Activity;
import android.app.Application;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.braze.Braze;

/**
 * Auto-runs at process start. Initializes Braze + wires session open/close to
 * activity lifecycle. Base-SDK only, no UI module needed.
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
        Braze.getInstance(app);
        app.registerActivityLifecycleCallbacks(new SessionCallbacks());
        Log.i(TAG, "Braze initialized");
        return true;
    }

    private static final class SessionCallbacks implements Application.ActivityLifecycleCallbacks {
        @Override public void onActivityCreated(@NonNull Activity a, @Nullable Bundle b) {}
        @Override public void onActivityStarted(@NonNull Activity a) {
            Braze.getInstance(a).openSession(a);
        }
        @Override public void onActivityResumed(@NonNull Activity a) {}
        @Override public void onActivityPaused(@NonNull Activity a) {}
        @Override public void onActivityStopped(@NonNull Activity a) {
            Braze.getInstance(a).closeSession(a);
        }
        @Override public void onActivitySaveInstanceState(@NonNull Activity a, @NonNull Bundle b) {}
        @Override public void onActivityDestroyed(@NonNull Activity a) {}
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
