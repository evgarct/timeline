import Foundation
import Observation

@MainActor
@Observable
final class AppRuntime {
    enum SessionState: Equatable {
        case restoring
        case signedOut
        case signedIn
        case unavailable(String)
    }

    private(set) var sessionState: SessionState = .restoring
    let todayStore: TodayStore
    let nutritionStore: NutritionStore
    let authentication: any AuthenticationClient

    init(
        authentication: any AuthenticationClient,
        todayStore: TodayStore,
        nutritionStore: NutritionStore = NutritionStore(repository: PreviewNutritionRepository()),
        sessionState: SessionState = .restoring
    ) {
        self.authentication = authentication
        self.todayStore = todayStore
        self.nutritionStore = nutritionStore
        self.sessionState = sessionState
    }

    static func live(bundle: Bundle = .main) -> AppRuntime {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-testing-today") {
            return AppRuntime(
                authentication: PreviewAuthenticationClient(signedIn: true),
                todayStore: TodayStore(repository: PreviewTimelineRepository(), steps: PreviewStepCountProvider()),
                sessionState: .signedIn
            )
        }
        #endif
        guard let configuration = FormConfiguration(bundle: bundle) else {
            return AppRuntime(
                authentication: PreviewAuthenticationClient(),
                todayStore: TodayStore(repository: PreviewTimelineRepository(), steps: PreviewStepCountProvider()),
                sessionState: .unavailable(String(localized: "auth.error.unavailable"))
            )
        }
        let session = FormSession()
        let auth = NeonAuthenticationClient(baseURL: configuration.authBaseURL, session: session)
        let repository = RemoteTimelineRepository(baseURL: configuration.apiBaseURL, session: session)
        let nutritionRepository = RemoteNutritionRepository(baseURL: configuration.apiBaseURL, session: session)
        #if DEBUG
        let steps: any StepCountProviding = ProcessInfo.processInfo.arguments.contains("-ui-testing-no-healthkit")
            ? PreviewStepCountProvider(state: .value(.preview()))
            : HealthKitStepCountProvider()
        #else
        let steps: any StepCountProviding = HealthKitStepCountProvider()
        #endif
        return AppRuntime(
            authentication: auth,
            todayStore: TodayStore(repository: repository, steps: steps),
            nutritionStore: NutritionStore(repository: nutritionRepository, stepProvider: steps)
        )
    }

    func restore() async {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-testing-today") {
            await todayStore.refresh()
            return
        }
        #endif
        do {
            sessionState = try await authentication.hasSession() ? .signedIn : .signedOut
            if sessionState == .signedIn {
                async let today: Void = todayStore.refresh()
                async let nutrition: Void = nutritionStore.load()
                _ = await (today, nutrition)
            }
        } catch {
            sessionState = .signedOut
        }
    }

    func signedIn() async {
        sessionState = .signedIn
        async let today: Void = todayStore.refresh()
        async let nutrition: Void = nutritionStore.load()
        _ = await (today, nutrition)
    }

    func signOut() async {
        try? await authentication.signOut()
        sessionState = .signedOut
        todayStore.reset()
        nutritionStore.reset()
    }

    func refresh() async {
        guard sessionState == .signedIn else { return }
        async let today: Void = todayStore.refresh()
        async let nutrition: Void = nutritionStore.load()
        _ = await (today, nutrition)
    }
}

struct FormConfiguration: Sendable {
    let authBaseURL: URL
    let apiBaseURL: URL

    init?(bundle: Bundle) {
        guard
            let auth = bundle.object(forInfoDictionaryKey: "FormAuthBaseURL") as? String,
            let api = bundle.object(forInfoDictionaryKey: "FormAPIBaseURL") as? String
        else { return nil }
        self.init(auth: auth, api: api)
    }

    init?(auth: String, api: String) {
        guard
            !auth.isEmpty,
            !api.isEmpty,
            let authBaseURL = URL(string: auth),
            let apiBaseURL = URL(string: api),
            authBaseURL.scheme == "https",
            apiBaseURL.scheme == "https",
            authBaseURL.host != nil,
            apiBaseURL.host != nil
        else { return nil }
        self.authBaseURL = authBaseURL
        self.apiBaseURL = apiBaseURL
    }
}
