import SwiftUI

struct OrderStatusView: View {
  @ObservedObject var auth: AuthStore
  let orderId: String

  private let restClient: SupabaseRESTClient
  @State private var status: String = "—"
  @State private var loading = true
  @State private var error: String?

  init(auth: AuthStore, orderId: String) {
    self.auth = auth
    self.orderId = orderId
    self.restClient = SupabaseRESTClient(accessToken: { auth.accessToken })
  }

  var body: some View {
    VStack(spacing: 16) {
      Text("Order Status").font(.largeTitle).bold()
      Text(orderId).font(.footnote).foregroundStyle(.secondary)

      if loading {
        ProgressView()
      } else if let error {
        Text(error).foregroundStyle(.red)
      } else {
        VStack(spacing: 8) {
          Text(status).font(.title2).bold()
          Text("We’ll keep polling until the restaurant accepts or rejects your pickup.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }
      Spacer()
    }
    .padding()
    .task {
      await pollUntilFinal()
    }
  }

  private func pollUntilFinal() async {
    loading = true
    error = nil
    defer { loading = false }

    guard let userId = auth.userId else {
      error = "Missing user_id. Please sign in again."
      return
    }

    let finalStatuses: Set<String> = ["accepted", "rejected", "completed", "cancelled"]
    var attempts = 0

    while attempts < 120 { // ~6 minutes if you poll every 3s
      attempts += 1
      do {
        let supabaseUrl = FlexBiteConfig.supabaseUrl
        let trimmed = supabaseUrl.hasSuffix("/") ? String(supabaseUrl.dropLast()) : supabaseUrl
        let url = URL(string: trimmed + "/rest/v1/orders?select=id,status&user_id=eq.\(userId)&id=eq.\(orderId)")!
        struct OrderRow: Decodable { let id: String; let status: String }
        let rows: [OrderRow] = try await restClient.get(url)
        if let row = rows.first {
          status = row.status
          if finalStatuses.contains(row.status) {
            return
          }
        }
      } catch {
        // Keep polling; network errors are common on mobile.
      }

      try? await Task.sleep(nanoseconds: 3_000_000_000)
    }

    // If it times out:
    error = "Timed out waiting for order status update."
  }
}

