import SwiftUI

struct TodayView: View {
    @Bindable var store: TodayStore
    let onSignOut: @MainActor () async -> Void

    @State private var selectedPhoto = 0
    @State private var galleryPresented = false
    @State private var settingsPresented = false
    @State private var unavailableAction: UnavailableAction?

    enum UnavailableAction: String, Identifiable {
        case compare, share
        var id: String { rawValue }
    }

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    hero(height: proxy.size.height)
                    timelineDetails
                }
                .scrollTargetLayout()
            }
            .ignoresSafeArea(edges: .top)
            .refreshable { await store.refresh() }
            .background(Color.black)
        }
        .sheet(isPresented: $galleryPresented) {
            PhotoGalleryView(photos: store.latestPhotos, selection: $selectedPhoto)
        }
        .sheet(isPresented: $settingsPresented) {
            SettingsView(onSignOut: onSignOut)
        }
        .alert(item: $unavailableAction) { action in
            Alert(
                title: Text(action == .compare ? "action.compare" : "action.share"),
                message: Text("action.soon.message"),
                dismissButton: .default(Text("common.ok"))
            )
        }
        .task { if store.state == .idle { await store.refresh() } }
    }

    @ViewBuilder
    private func hero(height: CGFloat) -> some View {
        ZStack {
            photoPager
            LinearGradient(colors: [.black.opacity(0.45), .clear, .black.opacity(0.78)], startPoint: .top, endPoint: .bottom)

            VStack(spacing: 0) {
                header
                Spacer()
                photoActions
                summaryGlass
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 12)
        }
        .frame(height: height)
        .clipped()
        .accessibilityIdentifier("today.hero")
    }

    @ViewBuilder
    private var photoPager: some View {
        if store.latestPhotos.isEmpty {
            LinearGradient(
                colors: [Color(red: 0.24, green: 0.2, blue: 0.16), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .overlay {
                if store.state == .loading { ProgressView() }
                else {
                    ContentUnavailableView("today.empty.photo", systemImage: "photo", description: Text("today.empty.photo.description"))
                        .padding(32)
                }
            }
        } else {
            TabView(selection: $selectedPhoto) {
                ForEach(Array(store.latestPhotos.enumerated()), id: \.element.id) { index, photo in
                    AsyncImage(url: photo.url ?? photo.thumbnailUrl) { phase in
                        switch phase {
                        case let .success(image):
                            image.resizable().scaledToFill()
                        case .failure:
                            Color.black.overlay { Image(systemName: "photo.badge.exclamationmark").font(.largeTitle) }
                        default:
                            Color.black.overlay { ProgressView() }
                        }
                    }
                    .tag(index)
                    .accessibilityLabel(photo.alt)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text("today.label").font(.subheadline).textCase(.uppercase)
                Text((store.latestPhotoDate ?? .now).formatted(.dateTime.day().month(.wide)))
                    .font(.system(size: 44, weight: .regular, design: .serif))
            }
            Spacer()
            Button { settingsPresented = true } label: {
                Image(systemName: "ellipsis").frame(width: 32, height: 32)
            }
            .buttonStyle(.glass)
            .controlSize(.small)
            .accessibilityLabel("action.menu")
        }
        .padding(.top, 52)
    }

    private var photoActions: some View {
        VStack(spacing: 10) {
            if store.latestPhotos.count > 1 {
                Text("\(selectedPhoto + 1) / \(store.latestPhotos.count)")
                    .font(.footnote.monospacedDigit())
            }
            GlassEffectContainer(spacing: 12) {
                HStack {
                    Button { unavailableAction = .compare } label: {
                        Label("action.compare", systemImage: "chart.bar.xaxis")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glass)
                    Button { galleryPresented = true } label: {
                        Label("action.allPhotos", systemImage: "rectangle.on.rectangle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glass)
                    .disabled(store.latestPhotos.isEmpty)
                }
            }
        }
        .padding(.bottom, 14)
    }

    private var summaryGlass: some View {
        HStack(spacing: 0) {
            SummaryColumn(
                title: "summary.nutrition",
                value: String(localized: "summary.empty"),
                caption: String(localized: "summary.nutrition.soon")
            )
            Divider().overlay(.white.opacity(0.22)).padding(.vertical, 8)
            SummaryColumn(
                title: "summary.activity",
                value: stepsValue,
                caption: stepsCaption
            )
            Button { unavailableAction = .share } label: {
                Image(systemName: "square.and.arrow.up").frame(width: 30, height: 30)
            }
            .buttonStyle(.glass)
            .controlSize(.small)
            .accessibilityLabel("action.share")
        }
        .padding(18)
        .frame(height: 156)
        .glassEffect(.regular, in: .rect(cornerRadius: 28))
    }

    private var stepsValue: String {
        if case let .value(value) = store.steps { return value.formatted() }
        return String(localized: "summary.empty")
    }

    private var stepsCaption: String {
        switch store.steps {
        case .denied: String(localized: "summary.steps.denied")
        case .unavailable: String(localized: "summary.steps.unavailable")
        default: String(localized: "summary.steps.unit")
        }
    }

    private var timelineDetails: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("today.details")
                .font(.system(size: 40, design: .serif))
            if let values = store.latestMeasurements {
                MeasurementRows(values: values)
            } else {
                Text("today.empty.measurements").foregroundStyle(.secondary)
            }
            if case let .failed(message) = store.state {
                Label(message, systemImage: "wifi.exclamationmark").foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .padding(.bottom, 100)
        .background(Color.black)
    }
}

private struct SummaryColumn: View {
    let title: LocalizedStringKey
    let value: String
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).textCase(.uppercase).foregroundStyle(.secondary)
            Text(value).font(.system(size: 28, design: .serif)).lineLimit(1).minimumScaleFactor(0.7)
            Text(caption).font(.caption).foregroundStyle(.secondary).lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct MeasurementRows: View {
    let values: BodyMeasurements

    var body: some View {
        VStack(spacing: 0) {
            if let value = values.weightKg { row("measurement.weight", value, "measurement.kg") }
            if let value = values.waistCm { row("measurement.waist", value, "measurement.cm") }
            if let value = values.chestCm { row("measurement.chest", value, "measurement.cm") }
        }
        .glassEffect(.regular, in: .rect(cornerRadius: 24))
    }

    private func row(_ title: LocalizedStringKey, _ value: Double, _ unit: LocalizedStringKey) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value.formatted(.number.precision(.fractionLength(0...1))))
            Text(unit).foregroundStyle(.secondary)
        }
        .padding()
    }
}

#Preview("Today empty") {
    TodayView(
        store: TodayStore(repository: PreviewTimelineRepository(), steps: PreviewStepCountProvider()),
        onSignOut: {}
    )
}
