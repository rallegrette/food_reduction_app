import Foundation

final class SupabaseRESTClient {
  private let supabaseUrl: String
  private let anonKey: String
  private let accessToken: () -> String?

  init(accessToken: @escaping () -> String?) {
    self.supabaseUrl = FlexBiteConfig.supabaseUrl
    self.anonKey = FlexBiteConfig.supabaseAnonKey
    self.accessToken = accessToken
  }

  private func makeURL(_ path: String) -> URL {
    let trimmed = supabaseUrl.hasSuffix("/") ? String(supabaseUrl.dropLast()) : supabaseUrl
    let full = trimmed + path
    guard let url = URL(string: full) else {
      fatalError("Invalid URL: \(full)")
    }
    return url
  }

  private func headers(extra: [String: String] = [:]) -> [String: String] {
    var h: [String: String] = [
      "apikey": anonKey,
      "Content-Type": "application/json",
    ]
    if let token = accessToken() {
      h["Authorization"] = "Bearer \(token)"
    }
    for (k, v) in extra { h[k] = v }
    return h
  }

  func get<T: Decodable>(_ url: URL, queryItems: [URLQueryItem] = [], headers extraHeaders: [String: String] = [:]) async throws -> T {
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    if !queryItems.isEmpty {
      components?.queryItems = queryItems
    }
    guard let finalUrl = components?.url else { throw FlexBiteError.message("Bad URL") }

    var request = URLRequest(url: finalUrl)
    request.httpMethod = "GET"
    request.allHTTPHeaderFields = headers(extra: extraHeaders)

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw FlexBiteError.message("GET failed (\((response as? HTTPURLResponse)?.statusCode ?? -1))")
    }
    return try JSONDecoder().decode(T.self, from: data)
  }

  func post<T: Decodable>(_ url: URL, jsonBody: [String: Any], headers extraHeaders: [String: String] = [:]) async throws -> T {
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = headers(extra: extraHeaders)
    request.httpBody = try JSONSerialization.data(withJSONObject: jsonBody, options: [])

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      let body = String(data: data, encoding: .utf8) ?? ""
      throw FlexBiteError.message("POST failed (\(http.statusCode)): \(body)")
    }
    return try JSONDecoder().decode(T.self, from: data)
  }
}

