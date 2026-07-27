import SwiftUI

struct TodayView: View {
    @Bindable var store: TodayStore
    @Bindable var nutritionStore: NutritionStore
    let onSignOut: @MainActor () async -> Void

    @Environment(\.locale) private var locale
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedPhoto = 0
    @State private var galleryPresented = false
    @State private var settingsPresented = false
    @State private var unavailableAction: UnavailableAction?
    @State private var goalEditorPresented = false
    @State private var goalDraft = "12000"
    @State private var activityDetailSnapshot: WeeklyActivitySnapshot?
    @State private var sharePayload: ActivitySharePayload?
    @AppStorage("activity.stepGoal") private var stepGoal = 12_000

    enum UnavailableAction: String, Identifiable {
        case compare, share
        var id: String { rawValue }
    }

    var body: some View {
        GeometryReader { proxy in
            let heroHeight = proxy.size.height + proxy.safeAreaInsets.top
            ZStack(alignment: .top) {
                fixedPhotoBackground(height: heroHeight)

                ScrollView {
                    LazyVStack(spacing: 0) {
                        heroChrome(height: heroHeight)
                        timelineDetails
                    }
                    .scrollTargetLayout()
                }
                .ignoresSafeArea(edges: .top)
                .refreshable {
                    async let timeline: Void = store.refresh()
                    async let activity: Void = store.refreshActivity()
                    async let nutrition: Void = nutritionStore.refreshTodaySummary()
                    _ = await (timeline, activity, nutrition)
                }
            }
            .background(Color.black)
        }
        .sheet(isPresented: $galleryPresented) {
            PhotoGalleryView(
                photos: store.latestPhotos,
                selection: $selectedPhoto,
                coverPhotoId: pinnedPhotoId,
                onSetCover: { photo in store.setCoverPhoto(photo) }
            )
        }
        .sheet(isPresented: $settingsPresented) {
            SettingsView(onSignOut: onSignOut)
        }
        .sheet(item: $sharePayload) { payload in
            ActivityShareSheet(image: payload.image)
        }
        .fullScreenCover(item: $activityDetailSnapshot) { snapshot in
            ActivityDetailView(
                initialSnapshot: snapshot,
                stepGoal: stepGoal,
                loadSnapshot: { date in await store.activitySnapshot(for: date) }
            )
        }
        .alert(item: $unavailableAction) { action in
            Alert(
                title: Text(action == .compare ? "action.compare" : "action.share"),
                message: Text("action.soon.message"),
                dismissButton: .default(Text("common.ok"))
            )
        }
        .alert("activity.goal.title", isPresented: $goalEditorPresented) {
            TextField("activity.goal.placeholder", text: $goalDraft)
                .keyboardType(.numberPad)
            Button("common.cancel", role: .cancel) {}
            Button("common.save") { saveStepGoal() }
        } message: {
            Text("activity.goal.message")
        }
        .task {
            async let activity: Void = store.refreshActivity()
            async let nutrition: Void = nutritionStore.refreshTodaySummary()
            if store.state == .idle { await store.refresh() }
            _ = await (activity, nutrition)
        }
        .onAppear {
            Task { await nutritionStore.refreshTodaySummary() }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.refreshActivity() }
        }
        .onChange(of: store.latestPhotos) { _, _ in
            selectedPhoto = store.coverPhotoIndex
        }
    }

    /// The id of the photo pinned as cover for the currently displayed event, if any — used to show
    /// the pinned state in the full-screen gallery.
    private var pinnedPhotoId: String? {
        let photos = store.latestPhotos
        let index = store.coverPhotoIndex
        return photos.indices.contains(index) ? photos[index].id : nil
    }

    @ViewBuilder
    private func fixedPhotoBackground(height: CGFloat) -> some View {
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
        }
        .frame(height: height)
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    @ViewBuilder
    private func heroChrome(height: CGFloat) -> some View {
        VStack(spacing: 0) {
            ZStack {
                VStack(spacing: 0) {
                    header
                    Spacer()
                    photoActions
                    summaryGlass
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 16)
            }
            .frame(height: height)
            .contentShape(Rectangle())
            .simultaneousGesture(photoSelectionGesture)

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
        VStack(spacing: 14) {
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
        HStack(alignment: .top, spacing: 0) {
            MetricSummaryColumn(
                title: "summary.nutrition",
                value: nutritionStore.todaySummary.calories.formatted(.number.precision(.fractionLength(0))),
                unit: String(localized: "summary.calories.unit"),
                target: "",
                progress: nil,
                footer: nutritionMacros
            )
            Divider().overlay(.white.opacity(0.18)).padding(.vertical, 4)
            Button { Task { await store.refreshActivity() } } label: {
                MetricSummaryColumn(
                    title: "summary.activity",
                    value: stepsValue,
                    unit: String(localized: "summary.steps.unit.short"),
                    target: stepTargetText,
                progress: stepProgress,
                    footer: stepProgressText,
                    accessory: store.isRefreshingActivity ? "arrow.triangle.2.circlepath" : nil
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .contextMenu {
                Button {
                    goalDraft = String(stepGoal)
                    goalEditorPresented = true
                } label: {
                    Label("activity.action.goal", systemImage: "target")
                }
                .accessibilityIdentifier("activity.menu.goal")
                Button {
                    activityDetailSnapshot = activitySnapshot
                } label: {
                    Label("activity.action.detail", systemImage: "chart.xyaxis.line")
                }
                .disabled(activitySnapshot == nil)
                .accessibilityIdentifier("activity.menu.detail")
                Button(action: shareActivity) {
                    Label("activity.action.share", systemImage: "square.and.arrow.up")
                }
                .disabled(activitySnapshot == nil)
                .accessibilityIdentifier("activity.menu.share")
            }
            .accessibilityLabel("activity.refresh.accessibility")
            .accessibilityHint("activity.goal.accessibilityHint")
            .accessibilityValue(stepsValue)
            .accessibilityIdentifier("today.activity")
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 18)
        .padding(.vertical, 18)
        .glassEffect(.regular, in: .rect(cornerRadius: 30))
    }

    private var photoSelectionGesture: some Gesture {
        DragGesture(minimumDistance: 24)
            .onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height), store.latestPhotos.count > 1 else { return }
                withAnimation(.snappy) {
                    if value.translation.width < 0 {
                        selectedPhoto = min(selectedPhoto + 1, store.latestPhotos.count - 1)
                    } else {
                        selectedPhoto = max(selectedPhoto - 1, 0)
                    }
                }
            }
    }

    private func saveStepGoal() {
        guard let value = Int(goalDraft.filter(\.isNumber)), (1...100_000).contains(value) else { return }
        stepGoal = value
    }

    private var stepTargetText: String {
        String(format: String(localized: "summary.steps.target.format"), stepGoal.formatted())
    }

    private var nutritionMacros: String {
        let summary = nutritionStore.todaySummary
        return String(
            format: String(localized: "summary.nutrition.macros.format"),
            summary.protein.formatted(.number.precision(.fractionLength(0...1))),
            summary.fat.formatted(.number.precision(.fractionLength(0...1))),
            summary.carbohydrates.formatted(.number.precision(.fractionLength(0...1)))
        )
    }

    private var stepProgress: Double {
        guard let snapshot = activitySnapshot, stepGoal > 0 else { return 0 }
        return min(Double(snapshot.selectedSteps) / Double(stepGoal), 1)
    }

    private var stepProgressText: String {
        guard let snapshot = activitySnapshot, stepGoal > 0 else { return stepsCaption }
        let percentage = Int((Double(snapshot.selectedSteps) / Double(stepGoal) * 100).rounded())
        return String(format: String(localized: "summary.steps.progress.format"), percentage)
    }

    private var stepsValue: String {
        if let snapshot = activitySnapshot { return snapshot.selectedSteps.formatted() }
        return String(localized: "summary.empty")
    }

    private var stepsCaption: String {
        switch store.activity {
        case .denied: String(localized: "summary.steps.denied")
        case .unavailable: String(localized: "summary.steps.unavailable")
        default: String(localized: "summary.steps.unit")
        }
    }

    private var activitySnapshot: WeeklyActivitySnapshot? {
        guard case let .value(snapshot) = store.activity else { return nil }
        return snapshot
    }

    private func shareActivity() {
        guard let snapshot = activitySnapshot,
              let image = ActivityShareRenderer.image(
                snapshot: snapshot,
                stepGoal: stepGoal,
                locale: locale,
                colorScheme: colorScheme
              ) else { return }
        sharePayload = ActivitySharePayload(image: image)
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

private struct MetricSummaryColumn: View {
    let title: LocalizedStringKey
    let value: String
    let unit: String
    let target: String
    let progress: Double?
    let footer: String
    var accessory: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .tracking(0.5)
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                if let accessory {
                    Image(systemName: accessory)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 4)
            }
            HStack(alignment: .lastTextBaseline, spacing: 5) {
                Text(value)
                    .font(.system(size: 34, weight: .regular, design: .serif))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                Text(unit).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 6) {
                if !target.isEmpty {
                    Text(target)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                if let progress {
                    ProgressView(value: progress)
                        .tint(.white)
                        .scaleEffect(x: 1, y: 0.7, anchor: .center)
                }
            }
            Text(footer)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 6)
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
        nutritionStore: NutritionStore(repository: PreviewNutritionRepository()),
        onSignOut: {}
    )
}
