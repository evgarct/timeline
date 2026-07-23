import Foundation

protocol AuthenticationClient: Sendable {
    func requestCode(email: String) async throws
    func verifyCode(email: String, code: String) async throws
    func hasSession() async throws -> Bool
    func signOut() async throws
}

enum AuthenticationError: LocalizedError, Equatable {
    case invalidEmail
    case invalidCode
    case unavailable
    case rejected

    var errorDescription: String? {
        switch self {
        case .invalidEmail: String(localized: "auth.error.email")
        case .invalidCode: String(localized: "auth.error.code")
        case .unavailable: String(localized: "auth.error.unavailable")
        case .rejected: String(localized: "auth.error.rejected")
        }
    }
}

actor NeonAuthenticationClient: AuthenticationClient {
    private let baseURL: URL
    private let origin: String
    private let session: FormSession

    init(baseURL: URL, session: FormSession) {
        self.baseURL = baseURL
        var components = URLComponents()
        components.scheme = baseURL.scheme
        components.host = baseURL.host
        components.port = baseURL.port
        origin = components.url?.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            ?? baseURL.absoluteString
        self.session = session
    }

    func requestCode(email: String) async throws {
        guard email.contains("@") else { throw AuthenticationError.invalidEmail }
        let body = ["email": email, "type": "sign-in"]
        _ = try await post(path: "api/auth/email-otp/send-verification-otp", body: body)
    }

    func verifyCode(email: String, code: String) async throws {
        guard code.count >= 4 else { throw AuthenticationError.invalidCode }
        let body = ["email": email, "otp": code]
        _ = try await post(path: "api/auth/sign-in/email-otp", body: body)
        guard try await hasSession() else { throw AuthenticationError.rejected }
    }

    func hasSession() async throws -> Bool {
        var request = URLRequest(url: baseURL.appending(path: "api/auth/get-session"))
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AuthenticationError.unavailable }
        if http.statusCode == 401 || String(data: data, encoding: .utf8) == "null" { return false }
        guard (200..<300).contains(http.statusCode) else { throw AuthenticationError.unavailable }
        return !data.isEmpty
    }

    func signOut() async throws {
        _ = try await post(path: "api/auth/sign-out", body: [String: String]())
    }

    private func post(path: String, body: [String: String]) async throws -> Data {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AuthenticationError.unavailable }
        guard (200..<300).contains(http.statusCode) else {
            throw http.statusCode == 400 || http.statusCode == 401
                ? AuthenticationError.rejected
                : AuthenticationError.unavailable
        }
        return data
    }
}

struct PreviewAuthenticationClient: AuthenticationClient {
    var signedIn = false
    func requestCode(email: String) async throws {}
    func verifyCode(email: String, code: String) async throws {}
    func hasSession() async throws -> Bool { signedIn }
    func signOut() async throws {}
}
