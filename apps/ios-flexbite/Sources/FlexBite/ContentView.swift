import SwiftUI

struct ContentView: View {
  @StateObject private var auth = AuthStore()
  @StateObject private var dealsVM = DealsViewModel(accessTokenProvider: { nil })

  var body: some View {
    NavigationStack {
      if auth.isSignedIn {
        DealsListView(
          auth: auth,
          dealsVM: dealsVM,
          onSelectRegularRestaurant: { _ in },
          onSelectMysteryRestaurant: { _ in }
        )
      } else {
        LoginView(auth: auth)
      }
    }
  }
}

