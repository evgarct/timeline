import SwiftUI

struct SettingsView: View {
    let onSignOut: @MainActor () async -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("settings.about") {
                    LabeledContent("settings.app", value: "Form")
                    LabeledContent("settings.version", value: "0.1.0")
                }
                Section {
                    Button("settings.signOut", role: .destructive) {
                        Task { await onSignOut(); dismiss() }
                    }
                }
            }
            .navigationTitle("settings.title")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("common.done") { dismiss() }
                }
            }
        }
    }
}
