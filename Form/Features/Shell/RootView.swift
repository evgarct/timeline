import SwiftUI

struct RootView: View {
    @Bindable var runtime: AppRuntime

    var body: some View {
        Group {
            switch runtime.sessionState {
            case .restoring:
                ProgressView("common.loading")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black)
            case .signedOut:
                AuthenticationView(client: runtime.authentication) {
                    await runtime.signedIn()
                }
            case .signedIn:
                AppTabs(runtime: runtime)
            case let .unavailable(message):
                ContentUnavailableView("common.unavailable", systemImage: "exclamationmark.triangle", description: Text(message))
            }
        }
        .tint(.white)
    }
}

private struct AppTabs: View {
    @Bindable var runtime: AppRuntime

    var body: some View {
        TabView {
            Tab("tab.today", systemImage: "house") {
                TodayView(store: runtime.todayStore, nutritionStore: runtime.nutritionStore) {
                    await runtime.signOut()
                }
            }
            Tab("tab.nutrition", systemImage: "fork.knife") {
                NutritionView(store: runtime.nutritionStore)
            }
            Tab("tab.timeline", systemImage: "chart.bar") {
                TimelineView(store: runtime.todayStore)
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
    }
}

#Preview("Signed out") {
    RootView(runtime: AppRuntime(
        authentication: PreviewAuthenticationClient(),
        todayStore: TodayStore(repository: PreviewTimelineRepository(), steps: PreviewStepCountProvider())
    ))
}
