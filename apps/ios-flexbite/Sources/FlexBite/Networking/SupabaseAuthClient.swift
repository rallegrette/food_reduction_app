import Foundation

final class SupabaseAuthClient {
  private let supabaseUrl: String = FlexBiteConfig.supabaseUrl
  private let anonKey: String = FlexBiteConfig.supabaseAnonKey

  struct SupabaseUser: Decodable {
    let id: String
    let email: String?
  }

  struct TokenResponse: Decodable {
    let access_token: String
    let token_type: String?
    let expires_in: Int?
    let refresh_token: String?
    let user: SupabaseUser
  }

  private func makeURL() -> URL {
    let trimmed = supabaseUrl.hasSuffix("/") ? String(supabaseUrl.dropLast()) : supabaseUrl
    // Supabase Auth token endpoint
    return URL(string: trimmed + "/auth/v1/token?grant_type=password")!
  }

  func signIn(email: String, password: String) async throws -> (accessToken: String, userId: String) {
    var request = URLRequest(url: makeURL())
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = [
      "apikey": anonKey,
      "Authorization": "Bearer \(anonKey)",
      "Content-Type": "application/json",
    ]
    request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password], options: [])

    let (data, response) = try await URLSession.shared.data(for: request)
    let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
    guard (200..<300).contains(statusCode) else {
      let bodyText = String(data: data, encoding: .utf8) ?? ""
      throw FlexBiteError.message("Sign in failed (\(statusCode)): \(bodyText)")
    }

    let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
    return (decoded.access_token, decoded.user.id)
  }
}

