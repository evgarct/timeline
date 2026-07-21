import SwiftUI

struct PlaceholderView: View {
    let title: LocalizedStringKey
    let icon: String

    var body: some View {
        NavigationStack {
            ContentUnavailableView("placeholder.soon", systemImage: icon, description: Text("placeholder.description"))
                .navigationTitle(title)
                .background(Color.black)
        }
    }
}
