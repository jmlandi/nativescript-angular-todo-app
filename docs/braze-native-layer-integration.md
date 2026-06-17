# Implementing the Braze SDK at the native layer in a NativeScript app

This describes how Braze is brought up **at the native layer** — Android and iOS — with the SDK initialized at process start and **no JavaScript bridge**. It reflects the actual integration in this repo.

## Why the native layer (instead of a JS plugin)

A NativeScript plugin would call the Braze SDK from JavaScript through metadata marshalling. That works, but it has drawbacks for an analytics/messaging SDK:

- **Timing.** Braze wants to initialize as early as possible. JS-driven init only runs after the NativeScript runtime, webpack bundle, and app bootstrap are up — late, and after the first frames.
- **Coupling.** Every native call from JS depends on metadata being generated correctly. Keeping Braze off the JS path means it works even if metadata is partial (see the iOS `CLANG_ENABLE_MODULES` gotcha in `docs/faq/braze-base-sdk-compile-errors.md`).
- **Parity.** Both platforms expose a "run code at process start" hook (Android `ContentProvider`, iOS `NSPrincipalClass`). Using them gives near-identical init timing on both.

The principle: **initialize Braze in native code that the OS runs before the NativeScript runtime, and hold the instance in a native singleton.** JS never touches Braze. If JS later needs to (e.g. `changeUser`), add a thin bridge — see `docs/nativescript-native-js-bridge.md`.

All native source lives under `App_Resources/`, which the NativeScript CLI copies verbatim into the generated native project on build. No `platforms/` editing.

---

## Android

### 1. Add the dependency

`App_Resources/Android/app.gradle`:

```gradle
dependencies {
  // Braze Android SDK (base only, no UI).
  implementation 'com.braze:android-sdk-base:31.1.0'
}
```

`android-sdk-base` only — no `android-sdk-ui` (no in-app message / Content Card rendering). See the FAQ for the `BrazeActivityLifecycleCallbackListener` import error that comes from expecting the UI artifact.

### 2. Configure via resources

`App_Resources/Android/src/main/res/values/braze.xml`. Braze reads these `com_braze_*` keys automatically at init — no code:

```xml
<resources>
    <string translatable="false" name="com_braze_api_key">YOUR_ANDROID_API_KEY</string>
    <string translatable="false" name="com_braze_custom_endpoint">sdk.iad-06.braze.com</string>
    <bool name="com_braze_enable_location_collection">false</bool>
    <integer name="com_braze_session_timeout">60</integer>
</resources>
```

### 3. Initialize at process start with a ContentProvider

A `ContentProvider`'s `onCreate()` runs **before** `Application.onCreate()` and before any activity — the earliest reliable app-process hook, and how AndroidX libraries auto-init.

`App_Resources/Android/src/main/java/org/nativescript/nstodoapp/braze/BrazeInitProvider.java` — calls `Braze.getInstance(app)` and registers session lifecycle callbacks by hand (no UI dep). Full source is in `docs/faq/braze-base-sdk-compile-errors.md`. Core:

```java
public boolean onCreate() {
    Application app = (Application) getContext().getApplicationContext();
    Braze.getInstance(app);
    app.registerActivityLifecycleCallbacks(new SessionCallbacks()); // openSession/closeSession
    return true;
}
```

### 4. Register the provider

`App_Resources/Android/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<provider
    android:name="org.nativescript.nstodoapp.braze.BrazeInitProvider"
    android:authorities="${applicationId}.brazeinit"
    android:exported="false"
    android:initOrder="100"
    tools:ignore="MissingClass" />
```

`exported="false"` — internal only. `authorities` must be unique (`${applicationId}.brazeinit`). `tools:ignore="MissingClass"` because lint resolves the class from the NativeScript-merged source, not the manifest's own module.

### 5. Run

```
ns clean && ns run android
```

Expect logcat `BrazeInit: Braze initialized`, then an HTTPS POST to the configured endpoint on first activity start.

---

## iOS

### 1. Add the pod

`App_Resources/iOS/Podfile` (the CLI merges it into the generated `Podfile`):

```ruby
platform :ios, '16.0'
use_frameworks! :linkage => :static
pod 'BrazeKit', '~> 11.0'
```

`BrazeKit` only — base SDK, no `BrazeUI`. Static linkage; dynamic frameworks aren't needed and avoid extra header-path surface.

### 2. Initialize at process start with an NSPrincipalClass

iOS instantiates the app's principal `UIApplication` subclass inside `UIApplicationMain`, **before** the NativeScript app delegate — the iOS analog of Android's ContentProvider.

`App_Resources/iOS/src/BrazeBootstrap.swift`:

```swift
import UIKit
import BrazeKit

/// Holds the live Braze instance for the process. Pure native — not used from JS.
@objc(BrazeRuntime)
public final class BrazeRuntime: NSObject {
    @objc public static let shared = BrazeRuntime()
    public var braze: Braze?
}

/// Declared as NSPrincipalClass in Info.plist. UIApplicationMain instantiates it
/// before the NativeScript app delegate, so Braze comes up at process start.
@objc(BrazeApplication)
public final class BrazeApplication: UIApplication {
    public override init() {
        super.init()
        Self.startBraze()
    }

    private static func startBraze() {
        let config = Braze.Configuration(
            apiKey: "YOUR_IOS_API_KEY",
            endpoint: "sdk.iad-06.braze.com"
        )
        config.logger.level = .info
        BrazeRuntime.shared.braze = Braze(configuration: config)   // strong ref required
        NSLog("[BrazeInit] Braze initialized, sdk=\(Braze.version)")
    }
}
```

Two things that bite (both in the FAQ): the version property is `Braze.version`, **not** `Braze.sdkVersion`; and `BrazeRuntime.shared.braze` must hold a **strong reference** or the instance deallocs and Braze stops.

### 3. Register the principal class

`App_Resources/iOS/Info.plist`:

```xml
<key>NSPrincipalClass</key>
<string>BrazeApplication</string>
```

### 4. Build settings

`App_Resources/iOS/build.xcconfig`:

```
SWIFT_VERSION = 5.0
```

- **No trailing semicolons** — CocoaPods fails parsing `SWIFT_VERSION = 5.0;`.
- **Do NOT add `CLANG_ENABLE_MODULES = YES`.** It breaks NativeScript metadata generation on the iOS 26 SDK and crashes the app at boot with `CFRunLoopGetCurrent is not defined`. Full root cause in `docs/faq/braze-base-sdk-compile-errors.md`.

### 5. Run

```
ns clean && ns run ios
```

Expect console `[BrazeInit] Braze initialized, sdk=...`. Sanity-check metadata health:

```
ls -la platforms/ios/build/Debug-iphonesimulator/metadata-arm64.bin   # multi-MB, not ~92KB
```

---

## Push, custom events, user identity

The current setup only initializes the SDK and tracks sessions. Anything driven by app logic — `changeUser`, custom events, push token registration, in-app messages — needs either more native code in these same files, or a **native↔JS bridge** so JS can call in. Options for that bridge: `docs/nativescript-native-js-bridge.md`.

## Related

- `docs/faq/braze-base-sdk-compile-errors.md` — concrete build/runtime errors and fixes (both platforms).
- `docs/nativescript-native-js-bridge.md` — exposing native Braze calls to JavaScript.
