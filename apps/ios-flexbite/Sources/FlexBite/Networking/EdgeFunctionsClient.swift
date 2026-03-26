import Foundation

final class EdgeFunctionsClient {
  private let supabaseUrl: String
  private let accessToken: () -> String?
  private let anonKey: String

  init(accessToken: @escaping () -> String?) {
    self.supabaseUrl = FlexBiteConfig.supabaseUrl
    self.anonKey = FlexBiteConfig.supabaseAnonKey
    self.accessToken = accessToken
  }

  private func makeURL(_ functionName: String) -> URL {
    let trimmed = supabaseUrl.hasSuffix("/") ? String(supabaseUrl.dropLast()) : supabaseUrl
    let path = "/functions/v1/\(functionName)"
    return URL(string: trimmed + path)!
  }

  func invoke<T: Decodable>(_ functionName: String, body: [String: Any]) async throws -> T {
    let url = makeURL(functionName)
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    var headers: [String: String] = [
      "apikey": anonKey,
      "Content-Type": "application/json",
    ]
    if let token = accessToken() {
      headers["Authorization"] = "Bearer \(token)"
    }
    request.allHTTPHeaderFields = headers
    request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      let bodyText = String(data: data, encoding: .utf8) ?? ""
      throw FlexBiteError.message("Edge function failed (\(http.statusCode)): \(bodyText)")
    }
    return try JSONDecoder().decode(T.self, from: data)
  }
}

