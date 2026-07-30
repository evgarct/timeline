import SwiftUI

struct SettingsView: View {
    let onSignOut: @MainActor () async -> Void
    @Environment(\.dismiss) private var dismiss
    @AppStorage(AppLanguageStorageKey.appLanguage) private var appLanguageRaw = AppLanguage.systemDefault.rawValue
    @AppStorage(AppLanguageStorageKey.reportLanguage) private var reportLanguageRaw = AppLanguage.systemDefault.rawValue

    var body: some View {
        NavigationStack {
            Form {
                Section("settings.language") {
                    Picker("settings.language.app", selection: $appLanguageRaw) {
                        ForEach(AppLanguage.allCases) { language in
                            Text(language.displayName).tag(language.rawValue)
                        }
                    }
                    Picker("settings.language.report", selection: $reportLanguageRaw) {
                        ForEach(AppLanguage.allCases) { language in
                            Text(language.displayName).tag(language.rawValue)
                        }
                    }
                }
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
