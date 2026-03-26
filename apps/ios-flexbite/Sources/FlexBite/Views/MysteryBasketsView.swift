import SwiftUI

struct MysteryCheckoutPayload: Hashable {
  var restaurantId: String
  var mysteryBasketId: String
}

struct MysteryBasketsView: View {
  @ObservedObject var auth: AuthStore
  let restaurantId: String

  private let restClient: SupabaseRESTClient
  @State private var baskets: [MysteryBasket] = []
  @State private var loading = true
  @State private var error: String?

  @State private var selectedBasket: MysteryBasket?
  @State private var navigateToCheckout = false

  init(auth: AuthStore, restaurantId: String) {
    self.auth = auth
    self.restaurantId = restaurantId
    self.restClient = SupabaseRESTClient(accessToken: { auth.accessToken })
  }

  var body: some View {
    VStack(spacing: 16) {
      if loading {
        ProgressView()
      } else if let error {
        Text(error).foregroundStyle(.red)
      } else {
        List(baskets) { b in
          VStack(alignment: .leading, spacing: 6) {
            Text(b.name ?? "Mystery Basket").font(.headline)
            Text("Bundle: \(b.bundleSize) units")
            Text("Mystery discount: \(String(format: "%.2f", b.mysteryDiscountPercent))%")
            Button("Checkout") {
              selectedBasket = b
              navigateToCheckout = true
            }
            .buttonStyle(.borderedProminent)
          }
          .padding(.vertical, 6)
        }

        NavigationLink(
          destination: CheckoutView(auth: auth, mysteryPayload: selectedMysteryPayload()),
          isActive: $navigateToCheckout
        ) {
          EmptyView()
        }
        .hidden()
      }
    }
    .navigationTitle("Mystery baskets")
    .padding(.horizontal)
    .task { await fetchBaskets() }
  }

  private func selectedMysteryPayload() -> MysteryCheckoutPayload? {
    guard let basket = selectedBasket else { return nil }
    return MysteryCheckoutPayload(restaurantId: restaurantId, mysteryBasketId: basket.id)
  }

  private func fetchBaskets() async {
    loading = true
    error = nil
    defer { loading = false }

    do {
      let supabaseUrl = FlexBiteConfig.supabaseUrl
      let trimmed = supabaseUrl.hasSuffix("/") ? String(supabaseUrl.dropLast()) : supabaseUrl
      let url = URL(string: trimmed + "/rest/v1/mystery_baskets?select=id,name,bundle_size,mystery_discount_percent&restaurant_id=eq.\(restaurantId)")!

      struct BasketRow: Decodable {
        let id: String
        let name: String?
        let bundle_size: Int
        let mystery_discount_percent: Double
      }
      let rows: [BasketRow] = try await restClient.get(url)
      baskets = rows.map { Basket in
        MysteryBasket(id: Basket.id, name: Basket.name, bundleSize: Basket.bundle_size, mysteryDiscountPercent: Basket.mystery_discount_percent)
      }
      if baskets.isEmpty { error = "No mystery baskets configured." }
    } catch {
      self.error = error.localizedDescription
    }
  }
}

