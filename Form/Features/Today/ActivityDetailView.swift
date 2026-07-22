import Charts
import SwiftUI
import UIKit

struct ActivityDetailView: View {
    let snapshot: WeeklyActivitySnapshot
    let stepGoal: Int

    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @State private var sharePayload: ActivitySharePayload?

    var body: some View {
        ZStack {
            Brand.ink.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    toolbar
                    ActivityVisualContent(snapshot: snapshot, stepGoal: stepGoal, style: .detail)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
            }
        }
        .preferredColorScheme(.dark)
        .sheet(item: $sharePayload) { payload in
            ActivityShareSheet(image: payload.image)
        }
        .accessibilityIdentifier("activity.detail")
    }

    private var toolbar: some View {
        HStack {
            TraceSymbol(appearance: .dark)
                .frame(width: 44, height: 44)
            Spacer()
            GlassEffectContainer(spacing: 12) {
                HStack(spacing: 12) {
                    Button(action: share) {
                        Image(systemName: "square.and.arrow.up")
                            .frame(width: 42, height: 42)
                    }
                    .buttonStyle(.glass)
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

    private func share() {
        guard let image = ActivityShareRenderer.image(snapshot: snapshot, stepGoal: stepGoal, locale: locale) else { return }
        sharePayload = ActivitySharePayload(image: image)
    }
}

struct ActivityVisualContent: View {
    enum Style: Equatable { case detail, share }

    let snapshot: WeeklyActivitySnapshot
    let stepGoal: Int
    let style: Style

    private var isShare: Bool { style == .share }
    private var progress: Double {
        guard stepGoal > 0 else { return 0 }
        return min(Double(snapshot.todaySteps) / Double(stepGoal), 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: isShare ? 42 : 28) {
            indexHeader
            todayValue
            goalProgress
            weeklySection
            if let meters = snapshot.distanceMeters {
                distanceRow(meters)
            }
        }
        .foregroundStyle(isShare ? Brand.ink : Brand.lightInk)
    }

    private var indexHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("activity.detail.title")
                .font(.system(size: isShare ? 22 : 13, weight: .semibold))
                .tracking(isShare ? 2.4 : 1.2)
                .textCase(.uppercase)
            Spacer()
            Text(snapshot.today.formatted(.dateTime.day().month(.wide).year()))
                .font(.system(size: isShare ? 26 : 15, weight: .regular, design: .serif))
        }
        .foregroundStyle((isShare ? Brand.ink : Brand.lightInk).opacity(0.68))
    }

    private var todayValue: some View {
        VStack(alignment: .leading, spacing: isShare ? 8 : 2) {
            Text(snapshot.todaySteps.formatted())
                .font(.system(size: isShare ? 168 : 88, weight: .regular, design: .serif))
                .tracking(isShare ? -6 : -3)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
                .monospacedDigit()
            Text("summary.steps.unit")
                .font(.system(size: isShare ? 30 : 17, weight: .medium))
                .foregroundStyle((isShare ? Brand.ink : Brand.lightInk).opacity(0.62))
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("activity.todayValue")
    }

    private var goalProgress: some View {
        VStack(spacing: isShare ? 16 : 10) {
            HStack {
                Text("activity.goal.title")
                Spacer()
                Text(goalText)
                    .monospacedDigit()
            }
            .font(.system(size: isShare ? 24 : 14, weight: .medium))
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill((isShare ? Brand.ink : Brand.lightInk).opacity(0.14))
                    Capsule()
                        .fill(isShare ? Brand.trace : Brand.lightInk)
                        .frame(width: proxy.size.width * progress)
                }
            }
            .frame(height: isShare ? 8 : 5)
        }
    }

    private var weeklySection: some View {
        VStack(alignment: .leading, spacing: isShare ? 22 : 16) {
            HStack(alignment: .lastTextBaseline) {
                Text("activity.week.average")
                    .font(.system(size: isShare ? 24 : 14, weight: .semibold))
                    .tracking(isShare ? 1.6 : 0.8)
                    .textCase(.uppercase)
                Spacer()
                Text(snapshot.averageSteps.formatted())
                    .font(.system(size: isShare ? 58 : 34, weight: .regular, design: .serif))
                    .monospacedDigit()
                    .accessibilityIdentifier("activity.weekAverage")
            }
            ActivityWeekChart(snapshot: snapshot, style: style)
                .frame(height: isShare ? 330 : 250)
        }
    }

    private func distanceRow(_ meters: Double) -> some View {
        HStack(alignment: .lastTextBaseline) {
            Text("activity.distance")
                .font(.system(size: isShare ? 24 : 14, weight: .semibold))
                .tracking(isShare ? 1.6 : 0.8)
                .textCase(.uppercase)
            Spacer()
            Text(Measurement(value: meters, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated)))
                .font(.system(size: isShare ? 42 : 28, weight: .regular, design: .serif))
                .monospacedDigit()
        }
    }

    private var goalText: String {
        let percentage = stepGoal > 0 ? Int((Double(snapshot.todaySteps) / Double(stepGoal) * 100).rounded()) : 0
        return String(format: String(localized: "activity.goal.detail.format"), snapshot.todaySteps.formatted(), stepGoal.formatted(), percentage)
    }
}

private struct ActivityWeekChart: View {
    let snapshot: WeeklyActivitySnapshot
    let style: ActivityVisualContent.Style

    private var isShare: Bool { style == .share }
    private var chartColor: Color { isShare ? Brand.trace : Brand.lightInk }

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
                        colors: [chartColor.opacity(0.2), chartColor.opacity(0.01)],
                        startPoint: .top,
                        endPoint: .bottom
                    ))
                    .interpolationMethod(.catmullRom)
                    LineMark(
                        x: .value("activity.chart.day", day.date),
                        y: .value("activity.chart.steps", steps)
                    )
                    .foregroundStyle(chartColor)
                    .lineStyle(StrokeStyle(lineWidth: isShare ? 7 : 4, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.catmullRom)
                    PointMark(
                        x: .value("activity.chart.day", day.date),
                        y: .value("activity.chart.steps", steps)
                    )
                    .foregroundStyle(isShare ? Brand.paper : Brand.ink)
                    .symbolSize(isShare ? 150 : 70)
                }
            }
            RuleMark(y: .value("activity.week.average", snapshot.averageSteps))
                .foregroundStyle(chartColor.opacity(0.45))
                .lineStyle(StrokeStyle(lineWidth: isShare ? 3 : 1.5, dash: [6, 7]))
        }
        .chartXScale(domain: chartDomain)
        .chartXAxis {
            AxisMarks(values: snapshot.days.map(\.date)) { value in
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        Text(date.formatted(.dateTime.weekday(.narrow)))
                            .font(.system(size: isShare ? 20 : 12, weight: .semibold))
                            .foregroundStyle((isShare ? Brand.ink : Brand.lightInk).opacity(0.58))
                    }
                }
            }
        }
        .chartYAxis(.hidden)
        .accessibilityIdentifier("activity.weekChart")
    }

    private var chartDomain: ClosedRange<Date> {
        let first = snapshot.days.first?.date ?? snapshot.today
        let last = snapshot.days.last?.date ?? snapshot.today
        return first.addingTimeInterval(-43_200)...last.addingTimeInterval(43_200)
    }
}

private struct ActivityShareCard: View {
    let snapshot: WeeklyActivitySnapshot
    let stepGoal: Int

    var body: some View {
        ZStack {
            Brand.paper
            VStack(alignment: .leading, spacing: 34) {
                HStack {
                    TraceSymbol(appearance: .primary)
                        .frame(width: 92, height: 92)
                    Spacer()
                    Text("activity.share.signature")
                        .font(.system(size: 20, weight: .medium))
                        .tracking(1.8)
                        .foregroundStyle(Brand.ink.opacity(0.5))
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
    static func image(snapshot: WeeklyActivitySnapshot, stepGoal: Int, locale: Locale) -> UIImage? {
        let content = ActivityShareCard(snapshot: snapshot, stepGoal: stepGoal)
            .environment(\.locale, locale)
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

#Preview("Activity detail") {
    ActivityDetailView(snapshot: .preview(), stepGoal: 12_000)
}

#Preview("Activity detail without distance") {
    ActivityDetailView(snapshot: .preview(todaySteps: 0, distanceMeters: nil), stepGoal: 10_000)
}

#Preview("Activity share") {
    ActivityShareCard(snapshot: .preview(), stepGoal: 12_000)
        .scaleEffect(0.32, anchor: .topLeading)
        .frame(width: 346, height: 432, alignment: .topLeading)
}
