import SwiftUI

#if canImport(Stripe)
import Stripe
#endif

struct PaymentSheetPresenter: UIViewControllerRepresentable {
  typealias UIViewControllerType = UIViewController

  let paymentIntentClientSecret: String
  let displayName: String
  let onResult: (PaymentSheetResult) -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  func makeUIViewController(context: Context) -> UIViewControllerType {
    let vc = UIViewController()
    vc.view.backgroundColor = .clear
    return vc
  }

  func updateUIViewController(_ uiViewController: UIViewControllerType, context: Context) {
    guard !context.coordinator.hasPresented else { return }
    context.coordinator.hasPresented = true

#if canImport(Stripe)
    var configuration = PaymentSheet.Configuration()
    configuration.merchantDisplayName = displayName

    let paymentSheet = PaymentSheet(paymentIntentClientSecret: paymentIntentClientSecret, configuration: configuration)
    paymentSheet.present(from: uiViewController) { result in
      onResult(result)
    }
#else
    onResult(.failed(error: FlexBiteError.message("Stripe SDK not linked.")))
#endif
  }

  class Coordinator {
    var hasPresented = false
  }
}
