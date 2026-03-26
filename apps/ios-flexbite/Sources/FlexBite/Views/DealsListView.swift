import SwiftUI

struct DealsListView: View {
  @ObservedObject var auth: AuthStore
  @ObservedObject var dealsVM: DealsViewModel

  var onSelectRegularRestaurant: (String) -> Void
  var onSelectMysteryRestaurant: (String) -> Void

  @State private var selectedRestaurantForRegular: String?
  @State private var selectedRestaurantForMystery: String?

  var body: some View {
    NavigationStack {
      List {
        if dealsVM.loading {
          Section {
            ProgressView()
          }
        } else if let err = dealsVM.error {
          Section {
            Text(err).foregroundStyle(.red)
          }
        } else {
          ForEach(dealsVM.restaurants, id: \.id) { r in
            Section(header: Text(r.name)) {
              if r.regularEnabled {
                Button("Regular deals") {
                  onSelectRegularRestaurant(r.id)
                  selectedRestaurantForRegular = r.id
                }
              }
              if r.mysteryEnabled {
                Button("Mystery baskets") {
                  onSelectMysteryRestaurant(r.id)
                  selectedRestaurantForMystery = r.id
                }
              }
            }
          }
        }
      }
      .navigationTitle("Nearby deals")
      .onAppear {
        Task {
          await dealsVM.fetchRestaurants()
        }
      }
      .background(
        NavigationLink(
          destination: regularDestination(),
          isActive: Binding(
            get: { selectedRestaurantForRegular != nil },
            set: { newValue in
              if !newValue { selectedRestaurantForRegular = nil }
            }
          )
        ) {
          EmptyView()
        }
        .hidden()
      )
      .background(
        NavigationLink(
          destination: mysteryDestination(),
          isActive: Binding(
            get: { selectedRestaurantForMystery != nil },
            set: { newValue in
              if !newValue { selectedRestaurantForMystery = nil }
            }
          )
        ) {
          EmptyView()
        }
        .hidden()
      )
    }
  }

  @ViewBuilder
  private func regularDestination() -> some View {
    if let id = selectedRestaurantForRegular {
      RegularDealsView(auth: auth, restaurantId: id)
    } else {
      Text("")
    }
  }

  @ViewBuilder
  private func mysteryDestination() -> some View {
    if let id = selectedRestaurantForMystery {
      MysteryBasketsView(auth: auth, restaurantId: id)
    } else {
      Text("")
    }
  }
}

