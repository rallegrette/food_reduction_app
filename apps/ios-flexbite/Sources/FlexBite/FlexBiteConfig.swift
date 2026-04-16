import Foundation

enum FlexBiteConfig {
  // These are expected to be set in Info.plist keys for an Xcode app.
  private static func infoString(_ key: String) -> String {
    let v = Bundle.main.object(forInfoDictionaryKey: key) as? String
    return v ?? ""
  }

  static var supabaseUrl: String { infoString("FLEXBITE_SUPABASE_URL") }
  static var supabaseAnonKey: String { infoString("FLEXBITE_SUPABASE_ANON_KEY") }
  static var stripePublishableKey: String { infoString("FLEXBITE_STRIPE_PUBLISHABLE_KEY") }

  static var supabaseAccessTokenKey: String { "supabase_access_token" }
}

