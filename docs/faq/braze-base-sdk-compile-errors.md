# Braze base SDK — build & runtime errors after standalone integration

Native-layer Braze integration (no JS bridge). Android and iOS issues below.

---

# Android

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

---

# iOS

Two separate problems hit when adding `BrazeKit` to the iOS native layer. Fix the Swift compile error first, then the runtime crash.

## Problem 1 — Swift compile error

### Symptom

`** BUILD FAILED **`, Swift frontend on `BrazeBootstrap.swift`:

```
error: type 'Braze' has no member 'sdkVersion'
    NSLog("[BrazeInit] Braze initialized, sdk=\(Braze.sdkVersion)")
                                                ~~~~~ ^~~~~~~~~~
```

### Root cause

`Braze.sdkVersion` does not exist in BrazeKit. The static version property is `Braze.version`.

### Fix

File: `App_Resources/iOS/src/BrazeBootstrap.swift`

```swift
NSLog("[BrazeInit] Braze initialized, sdk=\(Braze.version)")
```

## Problem 2 — runtime crash: `CFRunLoopGetCurrent is not defined`

### Symptom

App builds, then crashes at boot:

```
***** Fatal JavaScript exception - application has been terminated. *****
NativeScript encountered a fatal error:
Error calling module function
ReferenceError: CFRunLoopGetCurrent is not defined
```

`CFRunLoopGetCurrent` is just the first native symbol NativeScript touches at startup. Its absence means the whole native-symbol table (metadata) is empty.

### Root cause

`CLANG_ENABLE_MODULES = YES` was added to `App_Resources/iOS/build.xcconfig`. NativeScript's metadata generator reads that flag and, when set, runs clang with `-fmodules` (see `node_modules/@nativescript/ios/framework/internal/metadata-generator-arm64/bin/build-step-metadata-generator.py`). The bundled clang 17.0.6 cannot build the iOS 26.x SDK system clang-modules:

```
DarwinFoundation1.modulemap: error: module '_c_standard_library_obsolete'
  requires feature 'found_incompatible_headers__check_search_paths'
fatal error: could not build module '_DarwinFoundation2' / '_DarwinFoundation3'
fatal error: could not build module 'UIKit' / 'Foundation'
```

So Foundation/UIKit/CoreFoundation are dropped, the generated `metadata-arm64.bin` shrinks from healthy multi-MB to ~92KB (only the Braze module survives), and every system native symbol is undefined at runtime → crash.

Not caused by BrazeKit itself, the pod linkage, or the `@nativescript/ios` version (8.9.5 and 9.0.3 ship the same clang). Diagnostic: `find platforms/ios -name metadata-generation-stderr-arm64.txt` and grep for `found_incompatible_headers`.

### Fix

Remove `CLANG_ENABLE_MODULES = YES` from `build.xcconfig`. Swift modules are still on by default at the app-target level, so `BrazeBootstrap.swift` compiles fine. BrazeKit then drops out of NativeScript metadata — harmless here, because the integration is pure-native with no JS bridge.

`App_Resources/iOS/build.xcconfig`:

```
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon
IPHONEOS_DEPLOYMENT_TARGET = 16.0
SWIFT_VERSION = 5.0
// Do NOT set CLANG_ENABLE_MODULES = YES — breaks metadata generation (see above).
```

> No trailing semicolons in `build.xcconfig`. CocoaPods parses `SWIFT_VERSION` and fails on `SWIFT_VERSION = 5.0;` with `Malformed version number string 5.0;`.

If a future Swift pod genuinely needs the clang setting, scope it to the app target only (CocoaPods `post_install`) so the metadata generator never sees it. Alternatively, building under Xcode 16.x / iOS 18 SDK also avoids the generator failure.

## iOS native wiring (reference)

- `App_Resources/iOS/src/BrazeBootstrap.swift`: `BrazeApplication: UIApplication` inits Braze in `init()`; `BrazeRuntime.shared.braze` holds a strong ref.
- `App_Resources/iOS/Info.plist`: `NSPrincipalClass = BrazeApplication` (instantiated by UIApplicationMain before the NS app delegate).
- `App_Resources/iOS/Podfile`: `use_frameworks! :linkage => :static` + `pod 'BrazeKit', '~> 11.0'`.

## Rebuild

```
ns clean
ns run ios
```

Expect console line `[BrazeInit] Braze initialized, sdk=...`. Verify metadata is healthy:

```
ls -la platforms/ios/build/Debug-iphonesimulator/metadata-arm64.bin   # multi-MB, not ~92KB
```
