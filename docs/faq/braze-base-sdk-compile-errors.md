# Braze base SDK — compile errors after standalone integration

## Symptom

`./gradlew` fails on `:app:compileDebugJavaWithJavac`:

```
error: cannot find symbol
  import com.braze.BrazeActivityLifecycleCallbackListener;
                  ^
  symbol:   class BrazeActivityLifecycleCallbackListener
  location: package com.braze

error: cannot find symbol
  Log.i(TAG, "Braze initialized. sdkVersion=" + Braze.getSdkVersion());
                                                     ^
  symbol:   method getSdkVersion()
  location: class Braze
```

Build target: `com.braze:android-sdk-base:31.1.0` on a NativeScript Android app.

## Root cause

Two unrelated API mismatches against `android-sdk-base` 31.x:

1. `BrazeActivityLifecycleCallbackListener` is **not** shipped in `android-sdk-base`. It lives in `android-sdk-ui` because it also wires in-app message display. Importing it from the base artifact fails.
2. `Braze.getSdkVersion()` was removed from the Java-visible API in Braze SDK 30+. No drop-in static replacement exists in `android-sdk-base`.

## Fix

Drop both APIs. Replace the listener with a hand-written `Application.ActivityLifecycleCallbacks` that calls `Braze.openSession(activity)` / `closeSession(activity)` directly — equivalent session tracking, no UI dep. Remove the SDK-version log line.

File: `App_Resources/Android/src/main/java/org/nativescript/nstodoapp/braze/BrazeInitProvider.java`

```java
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

public class BrazeInitProvider extends ContentProvider {
    private static final String TAG = "BrazeInit";

    @Override
    public boolean onCreate() {
        Context ctx = getContext();
        if (ctx == null) return false;
        Application app = (Application) ctx.getApplicationContext();
        Braze.getInstance(app);
        app.registerActivityLifecycleCallbacks(new SessionCallbacks());
        Log.i(TAG, "Braze initialized");
        return true;
    }

    private static final class SessionCallbacks implements Application.ActivityLifecycleCallbacks {
        @Override public void onActivityCreated(@NonNull Activity a, @Nullable Bundle b) {}
        @Override public void onActivityStarted(@NonNull Activity a) { Braze.getInstance(a).openSession(a); }
        @Override public void onActivityResumed(@NonNull Activity a) {}
        @Override public void onActivityPaused(@NonNull Activity a) {}
        @Override public void onActivityStopped(@NonNull Activity a) { Braze.getInstance(a).closeSession(a); }
        @Override public void onActivitySaveInstanceState(@NonNull Activity a, @NonNull Bundle b) {}
        @Override public void onActivityDestroyed(@NonNull Activity a) {}
    }

    @Nullable @Override public Cursor query(@NonNull Uri u, @Nullable String[] p, @Nullable String s, @Nullable String[] a, @Nullable String o) { return null; }
    @Nullable @Override public String getType(@NonNull Uri u) { return null; }
    @Nullable @Override public Uri insert(@NonNull Uri u, @Nullable ContentValues v) { return null; }
    @Override public int delete(@NonNull Uri u, @Nullable String s, @Nullable String[] a) { return 0; }
    @Override public int update(@NonNull Uri u, @Nullable ContentValues v, @Nullable String s, @Nullable String[] a) { return 0; }
}
```

## Rebuild

```
ns clean
ns run android
```

Expect logcat line `BrazeInit: Braze initialized`, followed by an HTTPS POST to `sdk.iad-06.braze.com` on first activity start.

## Alternative — keep the listener

Swap the gradle dep to the UI artifact:

```gradle
implementation 'com.braze:android-sdk-ui:31.1.0'
```

Then restore the original imports / constructor:

```java
import com.braze.BrazeActivityLifecycleCallbackListener;
// ...
app.registerActivityLifecycleCallbacks(new BrazeActivityLifecycleCallbackListener(true, true));
```

UI dep also enables in-app message + Content Card rendering — extra surface to validate, larger APK.
