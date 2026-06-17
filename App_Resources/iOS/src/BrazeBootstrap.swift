import UIKit
import BrazeKit

/// Holds the live Braze instance for the process. Not used from JS — pure native.
@objc(BrazeRuntime)
public final class BrazeRuntime: NSObject {
    @objc public static let shared = BrazeRuntime()
    public var braze: Braze?
}

/// UIApplication subclass declared as `NSPrincipalClass` in Info.plist.
/// UIKit instantiates it during UIApplicationMain — before the NativeScript
/// app delegate runs — so Braze comes up at process start with zero JS bridge
/// and zero Objective-C glue.
@objc(BrazeApplication)
public final class BrazeApplication: UIApplication {
    public override init() {
        super.init()
        Self.startBraze()
    }

    private static func startBraze() {
        let config = Braze.Configuration(
            apiKey: "9954b08c-eb04-42e4-a765-2a32e913d6bf",
            endpoint: "sdk.iad-06.braze.com"
        )
        config.logger.level = .info
        BrazeRuntime.shared.braze = Braze(configuration: config)
        NSLog("[BrazeInit] Braze initialized, sdk=\(Braze.version)")
    }
}
