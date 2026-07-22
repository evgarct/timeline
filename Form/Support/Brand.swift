import SwiftUI

enum Brand {
    static let paper = Color(red: 0.949, green: 0.933, blue: 0.902)
    static let ink = Color(red: 0.082, green: 0.075, blue: 0.063)
    static let lightInk = Color(red: 0.984, green: 0.976, blue: 0.957)
    static let trace = Color(red: 0.502, green: 0.392, blue: 0.318)
}

struct TraceSymbol: View {
    enum Appearance { case primary, dark, mono }

    let appearance: Appearance

    var body: some View {
        Image(assetName)
            .resizable()
            .scaledToFit()
            .accessibilityHidden(true)
    }

    private var assetName: String {
        switch appearance {
        case .primary: "TraceSymbolPrimary"
        case .dark: "TraceSymbolDark"
        case .mono: "TraceSymbolMono"
        }
    }
}
