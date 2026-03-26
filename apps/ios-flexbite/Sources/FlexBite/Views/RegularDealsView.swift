import SwiftUI

struct RegularSelectionItem: Identifiable, Hashable {
  let id: String // menu item id
  var quantity: Int
  var menuItem: MenuItem
  var inventory: InventorySnapshot
}

struct RegularDealsView: View {
  @ObservedObject var auth: AuthStore
  let restaurantId: String

  private let restClient: SupabaseRESTClient

  @State private var menuItems: [MenuItem] = []
  @State private var invByItemId: [String: InventorySnapshot] = [:]
  @State private var selections: [String: Int] = [:]

  @State private var error: String?
  @State private var loading = true

  @State private var navigateToCheckout = false
  @State private var checkoutPayload: RegularCheckoutPayload?

  struct RegularInventoryRow: Decodable {
    let menu_item_id: String
    let quantity_total: Int
    let quantity_remaining: Int
  }

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
        List(menuItems) { item in
          let inv = invByItemId[item.id]
          let remaining = inv?.quantityRemaining ?? 0
          Section {
            HStack {
              VStack(alignment: .leading, spacing: 4) {
                Text(item.name).font(.headline)
                Text(item.category).font(.caption).foregroundStyle(.secondary)
                Text(String(format: "$%.2f", item.basePrice))
                  .font(.subheadline)
                Text("Remaining: \(remaining)")
                  .font(.caption)
                  .foregroundStyle(remaining > 0 ? .secondary : .red)
              }
              Spacer()
              Stepper(
                value: Binding(
                  get: { selections[item.id] ?? 0 },
                  set: { selections[item.id] = max(0, $0) }
                ),
                in: 0...(remaining > 0 ? remaining : 0),
                step: 1
              ) {
                Text("Qty")
              }
            }
          }
        }

        NavigationLink(
          destination: CheckoutView(auth: auth, regularPayload: checkoutPayload),
          isActive: $navigateToCheckout
        ) {
          EmptyView()
        }
        .hidden()

        Button("Checkout") {
          error = nil
          let picked = selections.compactMap { (menuItemId, qty) -> RegularSelectionItem? in
            guard qty > 0,
                  let menuItem = menuItems.first(where: { $0.id == menuItemId }),
                  let inv = invByItemId[menuItemId]
            else { return nil }
            return RegularSelectionItem(id: menuItemId, quantity: qty, menuItem: menuItem, inventory: inv)
          }

          if picked.isEmpty {
            error = "Select at least one item."
            return
          }

          checkoutPayload = RegularCheckoutPayload(
            restaurantId: restaurantId,
            items: picked.map { .init(menu_item_id: $0.id, quantity: $0.quantity) }
          )
          navigateToCheckout = true
        }
        .buttonStyle(.borderedProminent)
        .disabled(auth.isSignedIn == false)
      }
    }
    .navigationTitle("Regular deals")
    .padding(.horizontal)
    .task {
      await fetchData()
    }
  }

  private func fetchData() async {
    loading = true
    error = nil
    defer { loading = false }

    do {
      let supabaseUrl = FlexBiteConfig.supabaseUrl
      let trimmed = supabaseUrl.hasSuffix("/") ? String(supabaseUrl.dropLast()) : supabaseUrl
      let today = ISO8601DateFormatter().string(from: Date()).prefix(10)

      // Menu items
      let menuURL = URL(string: trimmed + "/rest/v1/menu_items?select=id,name,category,base_price&restaurant_id=eq.\(restaurantId)")!
      menuItems = try await restClient.get(menuURL)

      // Inventory
      let invURL = URL(string: trimmed + "/rest/v1/inventory_units?select=menu_item_id,quantity_total,quantity_remaining&restaurant_id=eq.\(restaurantId)&inventory_date=eq.\(today)")!
      let invRows: [RegularInventoryRow] = try await restClient.get(invURL)
      var map: [String: InventorySnapshot] = [:]
      for row in invRows {
        map[row.menu_item_id] = InventorySnapshot(quantityTotal: row.quantity_total, quantityRemaining: row.quantity_remaining)
      }
      invByItemId = map

      // Initialize selections
      var initial: [String: Int] = [:]
      for item in menuItems {
        let remaining = map[item.id]?.quantityRemaining ?? 0
        initial[item.id] = remaining > 0 ? 1 : 0
      }
      selections = initial
    } catch {
      self.error = error.localizedDescription
    }
  }
}

struct RegularCheckoutPayload {
  var restaurantId: String
  var items: [RegularOrderItem]
}

struct RegularOrderItem: Encodable, Hashable {
  let menu_item_id: String
  let quantity: Int
}

