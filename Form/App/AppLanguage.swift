import SwiftUI

/// One of the app's 3 supported languages, used for both the app UI language and the (independent)
/// PDF report language settings.
enum AppLanguage: String, CaseIterable, Identifiable {
    case en, ru, cs

    var id: String { rawValue }

    var displayName: LocalizedStringKey {
        switch self {
        case .en: "settings.language.en"
        case .ru: "settings.language.ru"
        case .cs: "settings.language.cs"
        }
    }

    var locale: Locale { Locale(identifier: rawValue) }

    /// The device's system language if it's one of the 3 supported ones, else English.
    static var systemDefault: AppLanguage {
        AppLanguage(rawValue: Locale.current.language.languageCode?.identifier ?? "") ?? .en
    }
}

enum AppLanguageStorageKey {
    static let appLanguage = "appLanguage"
    static let reportLanguage = "reportLanguage"
}
