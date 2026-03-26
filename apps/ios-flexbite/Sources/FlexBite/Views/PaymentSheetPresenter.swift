import SwiftUI

#if canImport(Stripe)
import Stripe
#endif

struct PaymentSheetPresenter: UIViewControllerRepresentable {
  typealias UIViewControllerType = UIViewController

  let paymentIntentClientSecret: String
  let displayName: String
  let onResult: (PaymentSheetResult) -> Void

  func makeUIViewController(context: Context) -> UIViewControllerType {
    let vc = UIViewController()
    vc.view.backgroundColor = .clear
    return vc
  }

  func updateUIViewController(_ uiViewController: UIViewControllerType, context: Context) {
#if canImport(Stripe)
    let configuration = PaymentSheet.Configuration()
    configuration.merchantDisplayName = displayName

    let paymentSheet = PaymentSheet(paymentIntentClientSecret: paymentIntentClientSecret, configuration: configuration)
    paymentSheet.present(from: uiViewController) { result in
      onResult(result)
    }
#else
    // If Stripe SDK isn't available, surface a clear error.
    onResult(.failed(error: FlexBiteError.message("Stripe SDK not linked.")))
#endif
  }
}

