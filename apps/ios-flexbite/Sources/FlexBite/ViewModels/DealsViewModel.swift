import Foundation
import SwiftUI

struct RestaurantWithSettings: Identifiable, Hashable {
  var id: String
  var name: String
  var latitude: Double?
  var longitude: Double?
  var regularEnabled: Bool
  var mysteryEnabled: Bool
}

@MainActor
final class DealsViewModel: ObservableObject {
  @Published var restaurants: [RestaurantWithSettings] = []
  @Published var loading = false
  @Published var error: String?

  private let restClient: SupabaseRESTClient
  private let anonAccessToken: () -> String?

  init(accessTokenProvider: @escaping () -> String?) {
    self.anonAccessToken = accessTokenProvider
    self.restClient = SupabaseRESTClient(accessToken: accessTokenProvider)
  }

  func fetchRestaurants() async {
    loading = true
    error = nil
    defer { loading = false }

    do {
      let supabaseUrl = FlexBiteConfig.supabaseUrl
      let trimmed = supabaseUrl.hasSuffix("/") ? String(supabaseUrl.dropLast()) : supabaseUrl

      let restaurantsURL = URL(string: trimmed + "/rest/v1/restaurants?select=id,name,latitude,longitude")!
      let restaurantRows: [Restaurant] = try await restClient.get(restaurantsURL)

      let settingsURL = URL(string: trimmed + "/rest/v1/restaurant_settings?select=restaurant_id,regular_enabled,mystery_enabled")!
      struct SettingsRow: Decodable {
        let restaurant_id: String
        let regular_enabled: Bool
        let mystery_enabled: Bool
      }
      let settingsRows: [SettingsRow] = try await restClient.get(settingsURL)

      let settingsMap = Dictionary(settingsRows.map { ($0.restaurant_id, $0) }, uniquingKeysWith: { _, latest in latest })

      restaurants = restaurantRows.map { r in
        let s = settingsMap[r.id]
        return RestaurantWithSettings(
          id: r.id,
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          regularEnabled: s?.regular_enabled ?? true,
          mysteryEnabled: s?.mystery_enabled ?? true
        )
      }
      .sorted { $0.name < $1.name }
    } catch let caught {
      self.error = caught.localizedDescription
    }
  }
}

