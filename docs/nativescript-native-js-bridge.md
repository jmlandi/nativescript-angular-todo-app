# Bridging the native and JavaScript layers in NativeScript

Ways to connect native code (Java/Kotlin, Objective-C/Swift) and the JavaScript/TypeScript layer in a NativeScript app, from "no bridge at all" to a packaged plugin. Uses the Braze native integration (`docs/braze-native-layer-integration.md`) as the running example.

## How the bridge works under the hood

NativeScript does not generate per-API glue code. At build time it produces a **metadata** file describing every native class, method, and symbol reachable from the app. At runtime the V8/JSC engine exposes those symbols on `global`, and calls are **marshalled** directly: a JS call to a native method becomes a real Objective-C message / JNI call, arguments converted on the fly.

Consequences that shape every option below:

- Any native API in the metadata is callable from JS **with no extra code** — no `.h`/`.java` wrapper needed to *reach* it.
- The bridge's reliability depends on metadata being generated correctly. If metadata is partial, native symbols are `undefined` at runtime (this is exactly the iOS `CFRunLoopGetCurrent` failure in the FAQ).
- "Building a bridge" is therefore mostly about **shaping** the surface (a clean API, threading, types) — not about plumbing the call itself.

---

## Option 0 — No bridge (native-only)

What Braze uses today. Native code runs at process start (Android `ContentProvider`, iOS `NSPrincipalClass`) and JS never calls in.

- **Use when:** the feature is fire-and-forget at startup (analytics init, crash reporters, session tracking).
- **Pros:** earliest possible init; immune to metadata problems; nothing to maintain on the JS side.
- **Cons:** JS can't trigger anything (no `changeUser`, no custom events from app logic).

Everything below adds a way for JS to call **into** the native layer when Option 0 isn't enough.

---

## Option 1 — Call native APIs directly from JS via metadata

Because the SDK's symbols are in metadata, you can call them straight from TS/JS. No wrapper class.

```ts
// iOS — BrazeKit symbols are global
declare const Braze: any;
const braze = new Braze(/* config */);

// Android — com.braze.Braze is global
declare const com: any;
const braze = com.braze.Braze.getInstance(androidApp.context);
braze.changeUser("user-123");
```

- **Pros:** zero native code; fastest to prototype.
- **Cons:** platform-forked JS (`if (global.isIOS) …`); loose typing; you re-implement init/threading in JS; couples app code to the SDK's native shape. For Braze specifically, calling the SDK from JS pulls it back onto the metadata-dependent path you avoided in Option 0.

Add `@nativescript/types` (already a dev dep here) or `tns-platform-declarations` for IntelliSense.

---

## Option 2 — Thin native facade exposed through metadata (recommended)

Write a small native class with a **flat, app-shaped API**, let it land in metadata, and call that one class from JS. The SDK stays native; JS sees only your facade.

**iOS** — extend the existing `BrazeRuntime` (it already holds the instance):

```swift
@objc(BrazeBridge)
public final class BrazeBridge: NSObject {
    @objc public static func changeUser(_ id: String) {
        BrazeRuntime.shared.braze?.changeUser(userId: id)
    }
    @objc public static func logCustomEvent(_ name: String) {
        BrazeRuntime.shared.braze?.logCustomEvent(name: name)
    }
}
```

```ts
// JS — BrazeBridge is in metadata because it's @objc + in App_Resources/iOS/src
declare const BrazeBridge: any;
BrazeBridge.changeUserWith("user-123"); // selector: changeUser(_:) -> changeUserWith
```

**Android** — a static facade beside `BrazeInitProvider`:

```java
package org.nativescript.nstodoapp.braze;
import com.braze.Braze;
public final class BrazeBridge {
    public static void changeUser(String id) { Braze.getInstance(appCtx).changeUser(id); }
    public static void logCustomEvent(String name) { Braze.getInstance(appCtx).logCustomEvent(name); }
}
```

```ts
declare const org: any;
org.nativescript.nstodoapp.braze.BrazeBridge.changeUser("user-123");
```

Then wrap both behind one TS module so app code is platform-agnostic:

```ts
// braze.ts
export function changeUser(id: string) {
  if (global.isIOS) (BrazeBridge as any).changeUserWith(id);
  else (org.nativescript.nstodoapp.braze.BrazeBridge as any).changeUser(id);
}
```

- **Pros:** keeps platform-specific logic in native code; stable, intentional JS surface; testable native side; SDK upgrades rarely touch JS.
- **Cons:** two native files + a TS wrapper to keep in sync; relies on metadata (keep the facade in `@objc` / public so it's emitted).
- **`@objc` naming:** Swift selectors map to JS by selector name (`changeUser(_:)` → `changeUserWith`). Mark with `@objc(Name)` to fix the JS-visible name.

---

## Option 3 — Subclass / implement native types from JS (`@NativeClass`)

When the SDK needs you to **provide** a native object — a delegate, listener, or callback — implement it in JS. NativeScript creates a real native class backed by your JS.

```ts
// iOS delegate implemented in TS
@NativeClass()
class InAppDelegate extends NSObject implements BrazeInAppMessageUIDelegate {
  static ObjCProtocols = [BrazeInAppMessageUIDelegate];
  // delegate methods…
}
```

```ts
// Android interface implemented in TS
const callbacks = new android.app.Application.ActivityLifecycleCallbacks({
  onActivityStarted(a) { /* … */ },
  // …
});
```

- **Use when:** the native API hands control back to you (callbacks, delegates, listeners).
- **Pros:** implement native contracts without writing native source.
- **Cons:** runs on native threads — marshalling cost and threading care; pure-native (Option 0/2) is better for hot or very-early paths like session callbacks.

---

## Option 4 — App/runtime events as a loose bridge

Native code emits, JS observes (or vice versa), without a direct call. Use `@nativescript/core` `Application` events, or a tiny notification hop (Android `LocalBroadcast`/`NSNotification` → JS handler).

```ts
import { Application } from "@nativescript/core";
Application.on(Application.resumeEvent, () => {/* tell native to flush */});
```

- **Use when:** lifecycle-driven side effects, fire-and-forget signals, decoupling.
- **Pros:** no tight coupling; good for lifecycle.
- **Cons:** not request/response; harder to trace; no return values.

---

## Option 5 — Package it as a NativeScript plugin

Promote Option 2's facade into a reusable plugin: a TS API plus `platforms/android` and `platforms/ios` native source, shipped as an npm package.

- **Use when:** sharing across apps, or the native surface grows enough to deserve its own versioning/tests.
- **Pros:** clean public API, independent release cycle, reusable, declarations bundled.
- **Cons:** most overhead (repo/build/publish); overkill for a single app. For this app, in-repo `App_Resources` (Option 2) is enough until reuse is real.

---

## Choosing

| Need | Option |
| --- | --- |
| Run at startup, JS never involved | 0 — native-only |
| Quick experiment, throwaway | 1 — direct metadata calls |
| App logic must call the SDK, clean & stable | 2 — native facade (recommended) |
| Provide a delegate/listener the SDK calls back | 3 — `@NativeClass` |
| React to lifecycle / decouple | 4 — events |
| Reuse across apps | 5 — plugin |

For Braze here: stay on **Option 0** for init/sessions; add an **Option 2** facade the day JS must drive `changeUser` / custom events.

## Related

- `docs/braze-native-layer-integration.md` — the native-only Braze setup these bridges extend.
- `docs/faq/braze-base-sdk-compile-errors.md` — metadata failure modes that break Options 1–3.
