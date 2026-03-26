import SwiftUI

struct ContentView: View {
  @StateObject private var auth = AuthStore()
  @StateObject private var dealsVM = DealsViewModel(accessTokenProvider: { nil })

  @State private var activeRestaurantId: String?
  @State private var activeOrderId: String?

  var body: some View {
    NavigationStack {
      if auth.isSignedIn {
        DealsListView(
          auth: auth,
          dealsVM: dealsVM,
          onSelectRegularRestaurant: { restId in
            activeRestaurantId = restId
          },
          onSelectMysteryRestaurant: { restId in
            activeRestaurantId = restId
          }
        )
        .navigationDestination(isPresented: Binding(
          get: { activeOrderId != nil },
          set: { _ in activeOrderId = nil }
        )) {
          if let orderId = activeOrderId {
            OrderStatusView(auth: auth, orderId: orderId)
          }
        }
      } else {
        LoginView(auth: auth)
      }
    }
  }
}

