import SwiftUI

struct CheckoutView: View {
  @ObservedObject var auth: AuthStore
  let regularPayload: RegularCheckoutPayload?
  let mysteryPayload: MysteryCheckoutPayload?

  private let edgeClient: EdgeFunctionsClient
  private let restClient: SupabaseRESTClient

  @State private var loading = true
  @State private var error: String?

  @State private var orderId: String?
  @State private var clientSecret: String?
  @State private var totalAmount: Double?
  @State private var currency: String = "usd"

  @State private var shouldPresentPaymentSheet = false
  @State private var goToStatus = false

  init(auth: AuthStore, regularPayload: RegularCheckoutPayload? = nil, mysteryPayload: MysteryCheckoutPayload? = nil) {
    self.auth = auth
    self.regularPayload = regularPayload
    self.mysteryPayload = mysteryPayload
    self.edgeClient = EdgeFunctionsClient(accessToken: { auth.accessToken })
    self.restClient = SupabaseRESTClient(accessToken: { auth.accessToken })
  }

  var body: some View {
    VStack(spacing: 16) {
      Text("Checkout").font(.largeTitle).bold()

      if loading {
        ProgressView()
      } else if let error {
        Text(error).foregroundStyle(.red)
      } else {
        VStack(alignment: .leading, spacing: 8) {
          Text("Total: \(totalAmount != nil ? String(format: "$%.2f", totalAmount!) : "—")")
          Text("Currency: \(currency.uppercased())").foregroundStyle(.secondary).font(.footnote)
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        Button("Pay now") {
          shouldPresentPaymentSheet = true
        }
        .buttonStyle(.borderedProminent)
        .disabled(clientSecret == nil)

        if let secret = clientSecret, shouldPresentPaymentSheet {
          PaymentSheetPresenter(
            paymentIntentClientSecret: secret,
            displayName: "FlexBite",
            onResult: { result in
              shouldPresentPaymentSheet = false
              switch result {
              case .completed:
                if let orderId {
                  goToStatus = true
                } else {
                  error = "Missing order_id."
                }
              case .canceled:
                error = "Payment was canceled."
              case .failed(let err):
                error = "Payment failed: \(err.localizedDescription)"
              }
            }
          )
          .frame(height: 1)
          .hidden()
        }
      }

      NavigationLink(
        destination: OrderStatusView(auth: auth, orderId: orderId ?? ""),
        isActive: $goToStatus
      ) { EmptyView() }
      .hidden()

      Spacer()
    }
    .padding()
    .task {
      await prepareOrderAndPayment()
    }
  }

  private func prepareOrderAndPayment() async {
    loading = true
    error = nil
    orderId = nil
    clientSecret = nil
    totalAmount = nil
    currency = "usd"
    goToStatus = false

    do {
      guard let userId = auth.userId else { throw FlexBiteError.message("Sign in required.") }
      guard regularPayload != nil || mysteryPayload != nil else { throw FlexBiteError.message("Missing checkout payload.") }

      if let regular = regularPayload {
        let body: [String: Any] = [
          "restaurant_id": regular.restaurantId,
          "user_id": userId,
          "mode": "regular",
          "currency": "usd",
          "items": regular.items.map { ["menu_item_id": $0.menu_item_id, "quantity": $0.quantity] },
        ]
        let createOrderResp = try await edgeClient.invoke("create_order", body: body) as CreateOrderResponse
        orderId = createOrderResp.order_id
        totalAmount = createOrderResp.total_amount
        currency = createOrderResp.currency

        let piResp = try await edgeClient.invoke("create_payment_intent", body: ["order_id": createOrderResp.order_id]) as CreatePaymentIntentResponse
        clientSecret = piResp.client_secret
      } else if let mystery = mysteryPayload {
        let body: [String: Any] = [
          "restaurant_id": mystery.restaurantId,
          "user_id": userId,
          "mode": "mystery",
          "currency": "usd",
          "mystery_basket_id": mystery.mysteryBasketId,
        ]
        let createOrderResp = try await edgeClient.invoke("create_order", body: body) as CreateOrderResponse
        orderId = createOrderResp.order_id
        totalAmount = createOrderResp.total_amount
        currency = createOrderResp.currency

        let piResp = try await edgeClient.invoke("create_payment_intent", body: ["order_id": createOrderResp.order_id]) as CreatePaymentIntentResponse
        clientSecret = piResp.client_secret
      }
    } catch {
      self.error = error.localizedDescription
    }

    loading = false
  }
}

private struct CreateOrderResponse: Decodable {
  let order_id: String
  let total_amount: Double
  let currency: String
  let status: String
}

private struct CreatePaymentIntentResponse: Decodable {
  let client_secret: String
  let payment_intent_id: String
}

