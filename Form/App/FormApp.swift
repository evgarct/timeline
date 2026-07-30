import SwiftUI

@main
@MainActor
struct FormApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var runtime = AppRuntime.live()
    @AppStorage(AppLanguageStorageKey.appLanguage) private var appLanguageRaw = AppLanguage.systemDefault.rawValue

    var body: some Scene {
        WindowGroup {
            RootView(runtime: runtime)
                .environment(\.locale, (AppLanguage(rawValue: appLanguageRaw) ?? .systemDefault).locale)
                .preferredColorScheme(.dark)
                .task { await runtime.restore() }
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    Task { await runtime.refresh() }
                }
        }
    }
}
