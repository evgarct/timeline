import SwiftUI

@main
@MainActor
struct FormApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var runtime = AppRuntime.live()

    var body: some Scene {
        WindowGroup {
            RootView(runtime: runtime)
                .preferredColorScheme(.dark)
                .task { await runtime.restore() }
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    Task { await runtime.refresh() }
                }
        }
    }
}
