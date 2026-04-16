import SwiftUI
#if canImport(Stripe)
import Stripe
#endif

@main
struct FlexBiteApp: App {
  init() {
#if canImport(Stripe)
    StripeAPI.defaultPublishableKey = FlexBiteConfig.stripePublishableKey
#endif
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}

