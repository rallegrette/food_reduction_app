import SwiftUI

struct LoginView: View {
  @ObservedObject var auth: AuthStore

  @State private var email: String = ""
  @State private var password: String = ""
  @State private var loading: Bool = false

  var body: some View {
    VStack(spacing: 16) {
      Text("FlexBite")
        .font(.largeTitle)
        .bold()

      TextField("Email", text: $email)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .keyboardType(.emailAddress)
        .textFieldStyle(.roundedBorder)

      SecureField("Password", text: $password)
        .textFieldStyle(.roundedBorder)

      if let err = auth.authError {
        Text(err).foregroundColor(.red).font(.footnote)
      }

      Button(action: {
        Task {
          loading = true
          await auth.signIn(email: email, password: password)
          loading = false
        }
      }) {
        if loading { ProgressView() } else { Text("Sign In") }
      }
      .disabled(email.isEmpty || password.isEmpty || loading)
    }
    .padding()
  }
}

