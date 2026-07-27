import SwiftUI

struct PhotoGalleryView: View {
    let photos: [ProgressPhoto]
    @Binding var selection: Int
    var coverPhotoId: String?
    var onSetCover: ((ProgressPhoto) -> Void)?
    @Environment(\.dismiss) private var dismiss

    private var currentPhoto: ProgressPhoto? {
        photos.indices.contains(selection) ? photos[selection] : nil
    }

    private var isCurrentPinned: Bool {
        currentPhoto?.id == coverPhotoId
    }

    var body: some View {
        NavigationStack {
            TabView(selection: $selection) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                    AsyncImage(url: photo.url ?? photo.thumbnailUrl) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFit()
                        } else if phase.error != nil {
                            ContentUnavailableView("today.photo.failed", systemImage: "photo.badge.exclamationmark")
                        } else {
                            ProgressView()
                        }
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page)
            .background(Color.black)
            .navigationTitle("action.allPhotos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if onSetCover != nil, photos.count > 1 {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            if let photo = currentPhoto { onSetCover?(photo) }
                        } label: {
                            Label("action.setCoverPhoto", systemImage: isCurrentPinned ? "pin.fill" : "pin")
                        }
                        .disabled(isCurrentPinned)
                        .accessibilityIdentifier("gallery.setCover")
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("common.done") { dismiss() }
                }
            }
        }
    }
}
