import Charts
import SwiftUI
import UIKit

typealias ActivitySnapshotLoader = @MainActor (Date) async -> WeeklyActivityState

enum ActivityDetailLoadPhase: Equatable {
    case loaded
    case loading
    case failed
}

struct ActivityDetailView: View {
    let initialSnapshot: WeeklyActivitySnapshot
    let stepGoal: Int
    let loadSnapshot: ActivitySnapshotLoader

    @Environment(\.calendar) private var calendar
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @State private var snapshot: WeeklyActivitySnapshot
    @State private var selectedDate: Date
    @State private var loadPhase: ActivityDetailLoadPhase
    @State private var reloadRevision = 0
    @State private var calendarPresented = false
    @State private var sharePayload: ActivitySharePayload?

    init(
        initialSnapshot: WeeklyActivitySnapshot,
        stepGoal: Int,
        initialPhase: ActivityDetailLoadPhase = .loaded,
        loadSnapshot: @escaping ActivitySnapshotLoader
    ) {
        self.initialSnapshot = initialSnapshot
        self.stepGoal = stepGoal
        self.loadSnapshot = loadSnapshot
        _snapshot = State(initialValue: initialSnapshot)
        _selectedDate = State(initialValue: initialSnapshot.selectedDate)
        _loadPhase = State(initialValue: initialPhase)
    }

    var body: some View {
        let palette = ActivityPalette(colorScheme: colorScheme)
        ZStack {
            palette.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 22) {
                    toolbar(palette: palette)
                    dateNavigation
                    if loadPhase == .failed { loadFailure }
                    ActivityVisualContent(snapshot: snapshot, stepGoal: stepGoal, style: .detail)
                        .redacted(reason: loadPhase == .loaded ? [] : .placeholder)
                        .opacity(loadPhase == .loading ? 0.56 : 1)
                        .animation(.easeInOut(duration: 0.18), value: loadPhase)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
            }
        }
        .sheet(isPresented: $calendarPresented) {
            ActivityCalendarSheet(selection: $selectedDate, maximumDate: maximumDate)
        }
        .sheet(item: $sharePayload) { payload in
            ActivityShareSheet(image: payload.image)
        }
        .task(id: LoadRequest(date: selectedDate, revision: reloadRevision)) {
            await loadSelectedDate()
        }
        .accessibilityIdentifier("activity.detail")
    }

    private func toolbar(palette: ActivityPalette) -> some View {
        HStack {
            TraceSymbol(appearance: palette.traceAppearance)
                .frame(width: 42, height: 42)
            Spacer()
            GlassEffectContainer(spacing: 12) {
                HStack(spacing: 12) {
                    Button(action: share) {
                        Image(systemName: "square.and.arrow.up")
                            .frame(width: 42, height: 42)
                    }
                    .buttonStyle(.glass)
                    .disabled(loadPhase != .loaded)
                    .accessibilityLabel("activity.action.share")
                    .accessibilityIdentifier("activity.detail.share")
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .frame(width: 42, height: 42)
                    }
                    .buttonStyle(.glass)
                    .accessibilityLabel("common.close")
                    .accessibilityIdentifier("activity.detail.close")
                }
            }
        }
        .padding(.top, 10)
    }

    private var dateNavigation: some View {
        GlassEffectContainer(spacing: 10) {
            HStack(spacing: 10) {
                Button { moveSelection(by: -1) } label: {
                    Image(systemName: "chevron.left")
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.glass)
                .accessibilityLabel("activity.date.previous")
                .accessibilityIdentifier("activity.date.previous")

                Button { calendarPresented = true } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "calendar")
                        Text(selectedDate.formatted(
                            .dateTime.weekday(.abbreviated).day().month(.wide).locale(locale)
                        ))
                            .lineLimit(1)
                    }
                    .font(.callout.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                }
                .buttonStyle(.glass)
                .accessibilityLabel("activity.date.select")
                .accessibilityValue(selectedDate.formatted(date: .long, time: .omitted))
                .accessibilityIdentifier("activity.date.select")

                Button { moveSelection(by: 1) } label: {
                    Image(systemName: "chevron.right")
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.glass)
                .disabled(isTodaySelected)
                .accessibilityLabel("activity.date.next")
                .accessibilityIdentifier("activity.date.next")
            }
        }
    }

    private var loadFailure: some View {
        Button { reloadRevision += 1 } label: {
            Label("activity.load.retry", systemImage: "arrow.clockwise")
                .font(.footnote.weight(.medium))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("activity.load.retry")
    }

    private var maximumDate: Date {
        calendar.startOfDay(for: initialSnapshot.fetchedAt)
    }

    private var isTodaySelected: Bool {
        calendar.isDate(selectedDate, inSameDayAs: maximumDate)
    }

    private func moveSelection(by dayOffset: Int) {
        guard let candidate = calendar.date(byAdding: .day, value: dayOffset, to: selectedDate) else { return }
        selectedDate = min(calendar.startOfDay(for: candidate), maximumDate)
    }

    private func loadSelectedDate() async {
        guard !calendar.isDate(selectedDate, inSameDayAs: snapshot.selectedDate) || reloadRevision > 0 else {
            return
        }
        let requestedDate = calendar.startOfDay(for: selectedDate)
        loadPhase = .loading
        let result = await loadSnapshot(requestedDate)
        guard !Task.isCancelled, calendar.isDate(selectedDate, inSameDayAs: requestedDate) else { return }
        switch result {
        case let .value(value):
            snapshot = value
            selectedDate = value.selectedDate
            loadPhase = .loaded
        case .idle, .denied, .unavailable:
            loadPhase = .failed
        }
    }

    private func share() {
        guard loadPhase == .loaded,
              let image = ActivityShareRenderer.image(
                snapshot: snapshot,
                stepGoal: stepGoal,
                locale: locale,
                colorScheme: colorScheme
              ) else { return }
        sharePayload = ActivitySharePayload(image: image)
    }

    private struct LoadRequest: Hashable {
        let date: Date
        let revision: Int
    }
}

private struct ActivityCalendarSheet: View {
    @Binding var selection: Date
    let maximumDate: Date

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            DatePicker(
                "activity.date.select",
                selection: $selection,
                in: ...maximumDate,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            .padding()
            .navigationTitle("activity.date.select")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("common.done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
        .accessibilityIdentifier("activity.date.calendar")
    }
}

struct ActivityVisualContent: View {
    enum Style: Equatable { case detail, share }

    let snapshot: WeeklyActivitySnapshot
    let stepGoal: Int
    let style: Style

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.locale) private var locale
    @ScaledMetric(relativeTo: .largeTitle) private var detailStepSize = 92
    @ScaledMetric(relativeTo: .title) private var detailAverageSize = 36
    @ScaledMetric(relativeTo: .title2) private var detailDistanceSize = 30
    @ScaledMetric(relativeTo: .body) private var detailMetricSize = 15
    @ScaledMetric(relativeTo: .body) private var detailIconSize = 26

    private var isShare: Bool { style == .share }
    private var palette: ActivityPalette { ActivityPalette(colorScheme: colorScheme) }
    private var progress: Double {
        guard stepGoal > 0 else { return 0 }
        return min(Double(snapshot.selectedSteps) / Double(stepGoal), 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: isShare ? 44 : 30) {
            stepHero
            goalProgress
            weeklySection
            if let meters = snapshot.selectedDistanceMeters {
                distanceRow(meters)
            }
        }
        .foregroundStyle(palette.foreground)
    }

    private var stepHero: some View {
        HStack(alignment: .center, spacing: isShare ? 28 : 14) {
            Image(systemName: "figure.walk")
                .font(.system(size: isShare ? 58 : detailIconSize, weight: .light))
                .foregroundStyle(palette.muted)
            Text(snapshot.selectedSteps.formatted(.number.locale(locale)))
                .font(.system(size: isShare ? 170 : detailStepSize, weight: .regular, design: .serif))
                .tracking(isShare ? -6 : -3)
                .minimumScaleFactor(0.65)
                .lineLimit(1)
                .monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("activity.detail.title")
        .accessibilityValue(snapshot.selectedSteps.formatted(.number.locale(locale)))
        .accessibilityIdentifier("activity.selectedValue")
    }

    private var goalProgress: some View {
        VStack(spacing: isShare ? 16 : 10) {
            HStack(spacing: isShare ? 18 : 10) {
                Image(systemName: "target")
                    .foregroundStyle(palette.muted)
                Text(stepGoal.formatted(.number.locale(locale)))
                    .monospacedDigit()
                Spacer()
                Text(percentage.formatted(.percent.precision(.fractionLength(0)).locale(locale)))
                    .monospacedDigit()
            }
            .font(.system(size: isShare ? 28 : detailMetricSize, weight: .medium))
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(palette.track)
                    Capsule()
                        .fill(palette.accent)
                        .frame(width: proxy.size.width * progress)
                }
            }
            .frame(height: isShare ? 8 : 5)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("activity.goal.title")
        .accessibilityValue(goalAccessibilityValue)
    }

    private var weeklySection: some View {
        VStack(alignment: .leading, spacing: isShare ? 22 : 16) {
            HStack(spacing: isShare ? 18 : 10) {
                Image(systemName: "chart.xyaxis.line")
                    .foregroundStyle(palette.muted)
                Text("Ø")
                    .foregroundStyle(palette.muted)
                Text(snapshot.averageSteps.formatted(.number.locale(locale)))
                    .font(.system(size: isShare ? 60 : detailAverageSize, weight: .regular, design: .serif))
                    .monospacedDigit()
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("activity.week.average")
            .accessibilityValue(snapshot.averageSteps.formatted(.number.locale(locale)))
            .accessibilityIdentifier("activity.weekAverage")
            ActivityWeekChart(snapshot: snapshot, style: style)
                .frame(height: isShare ? 330 : 250)
        }
    }

    private func distanceRow(_ meters: Double) -> some View {
        HStack(spacing: isShare ? 18 : 10) {
            Image(systemName: "ruler")
                .foregroundStyle(palette.muted)
            Text(Measurement(value: meters, unit: UnitLength.meters).formatted(
                .measurement(width: .abbreviated).locale(locale)
            ))
                .font(.system(size: isShare ? 44 : detailDistanceSize, weight: .regular, design: .serif))
                .monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("activity.distance")
        .accessibilityValue(Measurement(value: meters, unit: UnitLength.meters).formatted(
            .measurement(width: .wide).locale(locale)
        ))
    }

    private var percentage: Double {
        guard stepGoal > 0 else { return 0 }
        return Double(snapshot.selectedSteps) / Double(stepGoal)
    }

    private var goalAccessibilityValue: String {
        String(
            format: String(localized: "activity.goal.detail.format"),
            snapshot.selectedSteps.formatted(.number.locale(locale)),
            stepGoal.formatted(.number.locale(locale)),
            Int((percentage * 100).rounded())
        )
    }
}

struct ActivityWeekChart: View {
    let snapshot: WeeklyActivitySnapshot
    let style: ActivityVisualContent.Style

    @Environment(\.calendar) private var calendar
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.locale) private var locale

    private var isShare: Bool { style == .share }
    private var palette: ActivityPalette { ActivityPalette(colorScheme: colorScheme) }

    var body: some View {
        Chart {
            ForEach(snapshot.days) { day in
                if let steps = day.steps {
                    AreaMark(
                        x: .value("activity.chart.day", day.date),
                        yStart: .value("activity.chart.zero", 0),
                        yEnd: .value("activity.chart.steps", steps)
                    )
                    .foregroundStyle(LinearGradient(
                        colors: [palette.accent.opacity(0.18), palette.accent.opacity(0.01)],
                        startPoint: .top,
                        endPoint: .bottom
                    ))
                    .interpolationMethod(.catmullRom)
                    LineMark(
                        x: .value("activity.chart.day", day.date),
                        y: .value("activity.chart.steps", steps)
                    )
                    .foregroundStyle(palette.accent)
                    .lineStyle(StrokeStyle(lineWidth: isShare ? 7 : 4, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.catmullRom)
                    if calendar.isDate(day.date, inSameDayAs: snapshot.selectedDate) {
                        PointMark(
                            x: .value("activity.chart.day", day.date),
                            y: .value("activity.chart.steps", steps)
                        )
                        .foregroundStyle(palette.foreground)
                        .symbolSize(isShare ? 230 : 130)
                        PointMark(
                            x: .value("activity.chart.day", day.date),
                            y: .value("activity.chart.steps", steps)
                        )
                        .foregroundStyle(palette.background)
                        .symbolSize(isShare ? 95 : 48)
                    } else {
                        PointMark(
                            x: .value("activity.chart.day", day.date),
                            y: .value("activity.chart.steps", steps)
                        )
                        .foregroundStyle(palette.foreground.opacity(0.48))
                        .symbolSize(isShare ? 95 : 48)
                    }
                }
            }
            RuleMark(y: .value("activity.week.average", snapshot.averageSteps))
                .foregroundStyle(palette.foreground.opacity(0.3))
                .lineStyle(StrokeStyle(lineWidth: isShare ? 3 : 1.5, dash: [6, 7]))
        }
        .chartXScale(domain: chartDomain)
        .chartXAxis {
            AxisMarks(values: snapshot.days.map(\.date)) { value in
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        Text(date.formatted(.dateTime.weekday(.narrow).locale(locale)))
                            .font(.system(size: isShare ? 20 : 12, weight: .semibold))
                            .foregroundStyle(palette.muted)
                    }
                }
            }
        }
        .chartYAxis(.hidden)
        .accessibilityLabel("activity.week.average")
        .accessibilityValue(snapshot.averageSteps.formatted(.number.locale(locale)))
        .accessibilityIdentifier("activity.weekChart")
    }

    private var chartDomain: ClosedRange<Date> {
        let first = snapshot.days.first?.date ?? snapshot.selectedDate
        let last = snapshot.days.last?.date ?? snapshot.selectedDate
        return first.addingTimeInterval(-43_200)...last.addingTimeInterval(43_200)
    }
}

private struct ActivityShareCard: View {
    let snapshot: WeeklyActivitySnapshot
    let stepGoal: Int

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.locale) private var locale

    var body: some View {
        let palette = ActivityPalette(colorScheme: colorScheme)
        ZStack {
            palette.background
            VStack(alignment: .leading, spacing: 40) {
                HStack {
                    TraceSymbol(appearance: palette.traceAppearance)
                        .frame(width: 88, height: 88)
                    Spacer()
                    Text(snapshot.selectedDate.formatted(
                        .dateTime.day().month(.wide).year().locale(locale)
                    ))
                        .font(.system(size: 28, weight: .regular, design: .serif))
                        .foregroundStyle(palette.muted)
                }
                ActivityVisualContent(snapshot: snapshot, stepGoal: stepGoal, style: .share)
                Spacer(minLength: 0)
            }
            .padding(72)
        }
        .frame(width: 1080, height: 1350)
    }
}

enum ActivityShareRenderer {
    @MainActor
    static func image(
        snapshot: WeeklyActivitySnapshot,
        stepGoal: Int,
        locale: Locale,
        colorScheme: ColorScheme
    ) -> UIImage? {
        let content = ActivityShareCard(snapshot: snapshot, stepGoal: stepGoal)
            .environment(\.locale, locale)
            .environment(\.colorScheme, colorScheme)
        let renderer = ImageRenderer(content: content)
        renderer.proposedSize = ProposedViewSize(width: 1080, height: 1350)
        renderer.scale = 1
        renderer.isOpaque = true
        return renderer.uiImage
    }
}

struct ActivitySharePayload: Identifiable {
    let id = UUID()
    let image: UIImage
}

struct ActivityShareSheet: UIViewControllerRepresentable {
    let image: UIImage

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [image], applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private let previewActivityLoader: ActivitySnapshotLoader = { date in
    .value(.preview(selectedDate: date))
}

#Preview("Activity today dark") {
    ActivityDetailView(
        initialSnapshot: .preview(),
        stepGoal: 12_000,
        loadSnapshot: previewActivityLoader
    )
    .preferredColorScheme(.dark)
}

#Preview("Activity past week light") {
    ActivityDetailView(
        initialSnapshot: .preview(
            selectedDate: Calendar.current.date(from: DateComponents(year: 2025, month: 7, day: 18))!,
            now: Calendar.current.date(from: DateComponents(year: 2025, month: 7, day: 27, hour: 12))!,
            selectedDistanceMeters: 5_820
        ),
        stepGoal: 10_000,
        loadSnapshot: previewActivityLoader
    )
    .preferredColorScheme(.light)
}

#Preview("Activity loading") {
    ActivityDetailView(
        initialSnapshot: .preview(),
        stepGoal: 12_000,
        initialPhase: .loading,
        loadSnapshot: previewActivityLoader
    )
    .preferredColorScheme(.dark)
}

#Preview("Activity error") {
    ActivityDetailView(
        initialSnapshot: .preview(selectedDistanceMeters: nil),
        stepGoal: 12_000,
        initialPhase: .failed,
        loadSnapshot: { _ in .unavailable }
    )
    .preferredColorScheme(.dark)
}

#Preview("Activity share dark") {
    ActivityShareCard(snapshot: .preview(), stepGoal: 12_000)
        .environment(\.colorScheme, .dark)
        .scaleEffect(0.32, anchor: .topLeading)
        .frame(width: 346, height: 432, alignment: .topLeading)
}

#Preview("Activity share light") {
    ActivityShareCard(snapshot: .preview(), stepGoal: 12_000)
        .environment(\.colorScheme, .light)
        .scaleEffect(0.32, anchor: .topLeading)
        .frame(width: 346, height: 432, alignment: .topLeading)
}
