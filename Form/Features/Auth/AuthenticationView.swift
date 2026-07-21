import SwiftUI

struct AuthenticationView: View {
    enum Stage { case email, code }

    let client: any AuthenticationClient
    let onSignedIn: @MainActor () async -> Void

    @State private var stage: Stage = .email
    @State private var email = ""
    @State private var code = ""
    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, Color(red: 0.16, green: 0.13, blue: 0.1)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            VStack(alignment: .leading, spacing: 28) {
                Spacer()
                Text("auth.brand")
                    .font(.system(size: 64, weight: .regular, design: .serif))
                Text(stage == .email ? "auth.intro" : "auth.code.intro")
                    .font(.title3)
                    .foregroundStyle(.secondary)

                if stage == .email {
                    TextField("auth.email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding()
                        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 18))
                        .accessibilityIdentifier("auth.email")
                } else {
                    TextField("auth.code", text: $code)
                        .textContentType(.oneTimeCode)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .font(.title.monospacedDigit())
                        .padding()
                        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 18))
                        .accessibilityIdentifier("auth.code")
                }

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red).font(.footnote)
                }

                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        if isWorking { ProgressView() }
                        Text(stage == .email ? "auth.send" : "auth.verify")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(isWorking || (stage == .email ? email.isEmpty : code.isEmpty))
                .accessibilityIdentifier("auth.submit")

                if stage == .code {
                    Button("auth.changeEmail") { stage = .email; code = "" }
                        .frame(maxWidth: .infinity)
                }
                Spacer()
            }
            .padding(28)
        }
    }

    @MainActor
    private func submit() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            if stage == .email {
                try await client.requestCode(email: email.trimmingCharacters(in: .whitespacesAndNewlines))
                stage = .code
            } else {
                try await client.verifyCode(email: email, code: code)
                await onSignedIn()
            }
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? String(localized: "auth.error.unavailable")
        }
    }
}
