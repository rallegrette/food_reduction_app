import Foundation
import SwiftUI

@MainActor
final class AuthStore: ObservableObject {
  @Published private(set) var accessToken: String?
  @Published private(set) var userId: String?
  @Published var authError: String?

  private let authClient = SupabaseAuthClient()

  init() {
    let defaults = UserDefaults.standard
    self.accessToken = defaults.string(forKey: FlexBiteConfig.supabaseAccessTokenKey)
    self.userId = defaults.string(forKey: "supabase_user_id")
  }

  var isSignedIn: Bool { accessToken != nil && userId != nil }

  func signIn(email: String, password: String) async {
    authError = nil
    do {
      let result = try await authClient.signIn(email: email, password: password)
      accessToken = result.accessToken
      userId = result.userId
      UserDefaults.standard.set(result.accessToken, forKey: FlexBiteConfig.supabaseAccessTokenKey)
      UserDefaults.standard.set(result.userId, forKey: "supabase_user_id")
    } catch {
      authError = error.localizedDescription
    }
  }
}

