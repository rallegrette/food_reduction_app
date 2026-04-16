import SwiftUI

struct ContentView: View {
  @StateObject private var auth = AuthStore()

  var body: some View {
    NavigationStack {
      if auth.isSignedIn {
        DealsListView(
          auth: auth,
          dealsVM: DealsViewModel(accessTokenProvider: { [weak auth] in auth?.accessToken }),
          onSelectRegularRestaurant: { _ in },
          onSelectMysteryRestaurant: { _ in }
        )
      } else {
        LoginView(auth: auth)
      }
    }
  }
}

