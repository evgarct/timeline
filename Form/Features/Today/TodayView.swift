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
                    hero(height: proxy.size.height + proxy.safeAreaInsets.top)
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
        VStack(spacing: 0) {
            ZStack {
                Color.black

                VStack(spacing: 0) {
                    photoPager
                        .frame(height: max(520, height - 178))
                        .clipped()
                    Spacer(minLength: 0)
                }

                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0.48), location: 0),
                        .init(color: .clear, location: 0.22),
                        .init(color: .clear, location: 0.66),
                        .init(color: .black.opacity(0.9), location: 0.82),
                        .init(color: .black, location: 1)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )

                VStack(spacing: 0) {
                    header
                    Spacer()
                    photoActions
                    summaryGlass
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 8)
            }
            .frame(height: height)

            // Keep the next timeline heading entirely below the initial viewport,
            // including the system tab bar's overlay region on compact iPhones.
            Color.black.frame(height: 84)
        }
        .frame(height: height + 84)
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
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
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
            VStack(alignment: .leading, spacing: 0) {
                Text("today.label")
                    .font(.system(size: 15, weight: .medium))
                    .tracking(0.7)
                    .textCase(.uppercase)
                Text((store.latestPhotoDate ?? .now).formatted(.dateTime.day().month(.wide)))
                    .font(.system(size: 52, weight: .regular, design: .serif))
                    .tracking(-1.2)
            }
            Spacer()
            Button { settingsPresented = true } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 42, height: 42)
            }
            .buttonStyle(.glass)
            .accessibilityLabel("action.menu")
        }
        .padding(.top, 58)
        .padding(.horizontal, 4)
    }

    private var photoActions: some View {
        VStack(spacing: 7) {
            if store.latestPhotos.count > 1 {
                Text("\(selectedPhoto + 1) / \(store.latestPhotos.count)")
                    .font(.footnote.monospacedDigit())
            }
            GlassEffectContainer(spacing: 12) {
                HStack(spacing: 10) {
                    Button { unavailableAction = .compare } label: {
                        Label("action.compare", systemImage: "chart.bar.xaxis")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glass)
                    .controlSize(.regular)
                    Button { galleryPresented = true } label: {
                        Label("action.allPhotos", systemImage: "rectangle.on.rectangle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glass)
                    .controlSize(.regular)
                    .disabled(store.latestPhotos.isEmpty)
                }
            }
        }
        .padding(.horizontal, 2)
        .padding(.bottom, 8)
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
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(height: 112)
        .glassEffect(.regular, in: .rect(cornerRadius: 30))
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
                .accessibilityIdentifier("today.details")
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
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .tracking(0.5)
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 30, weight: .regular, design: .serif))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(caption)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineLimit(1)
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
