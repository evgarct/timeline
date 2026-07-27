import SwiftUI

/// Early scaffold for the roadmap's "History and comparison" milestone (Documentation/ROADMAP.md item 4):
/// a chronological read of the body-record events Today already loads — progress photos, measurements,
/// and InBody analyses — grouped by day. Nutrition and workouts are logged/tracked elsewhere and are
/// deliberately excluded here; this is a body-history view, not an activity feed. Intentionally minimal
/// — no comparison or detail drill-down yet — so that work has a real screen to extend.
struct TimelineView: View {
    @Bindable var store: TodayStore

    var body: some View {
        NavigationStack {
            Group {
                if store.state == .loading && store.events.isEmpty {
                    ProgressView("common.loading").frame(maxWidth: .infinity).padding(48)
                } else if case let .failed(message) = store.state, filteredEvents.isEmpty {
                    ContentUnavailableView(
                        "today.error.network",
                        systemImage: "wifi.exclamationmark",
                        description: Text(message)
                    )
                } else if filteredEvents.isEmpty {
                    ContentUnavailableView(
                        "timeline.empty",
                        systemImage: "clock",
                        description: Text("timeline.empty.description")
                    )
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 28) {
                            ForEach(groupedDays, id: \.0) { day, events in
                                daySection(day: day, events: events)
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.top, 8)
                        .padding(.bottom, 100)
                    }
                    .refreshable { await store.refresh() }
                }
            }
            .background { nutritionBackgroundGradient() }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task { if store.state == .idle { await store.refresh() } }
        .preferredColorScheme(.dark)
        .accessibilityIdentifier("timeline.screen")
    }

    private var filteredEvents: [TimelineEvent] {
        store.events.filter { event in
            switch event {
            case .progressPhoto, .measurements, .inbody: true
            case .workout, .nutritionEntry, .unsupported: false
            }
        }
    }

    private var groupedDays: [(Date, [TimelineEvent])] {
        let calendar = Calendar.current
        let groups = Dictionary(grouping: filteredEvents) { calendar.startOfDay(for: $0.base.occurredAt) }
        return groups.keys.sorted(by: >).map { day in
            (day, groups[day, default: []].sorted { $0.base.occurredAt > $1.base.occurredAt })
        }
    }

    private func daySection(day: Date, events: [TimelineEvent]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(dayLabel(day))
                .font(.system(size: 22, design: .serif))
            VStack(spacing: 0) {
                ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                    if index > 0 {
                        Divider().overlay(.white.opacity(0.12))
                    }
                    TimelineRow(event: event)
                }
            }
            .padding(18)
            .glassEffect(.regular, in: .rect(cornerRadius: 26))
        }
    }

    private func dayLabel(_ day: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(day) { return String(localized: "nutrition.today") }
        if calendar.isDateInYesterday(day) { return String(localized: "timeline.yesterday") }
        return day.formatted(.dateTime.day().month(.wide))
    }
}

private struct TimelineRow: View {
    let event: TimelineEvent

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body)
            }
            Spacer(minLength: 8)
            Text(event.base.occurredAt.formatted(date: .omitted, time: .shortened))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 10)
    }

    private var icon: String {
        switch event {
        case .progressPhoto: "camera"
        case .measurements: "ruler"
        case .inbody: "waveform.path.ecg"
        case .workout, .nutritionEntry, .unsupported: "questionmark.circle"
        }
    }

    private var title: LocalizedStringKey {
        switch event {
        case .progressPhoto: "timeline.event.photo"
        case .measurements: "timeline.event.measurements"
        case .inbody: "timeline.event.inbody"
        case .workout, .nutritionEntry, .unsupported: "timeline.event.unsupported"
        }
    }
}

#Preview("Timeline") {
    TimelineView(store: TodayStore(repository: PreviewTimelineRepository(), steps: PreviewStepCountProvider()))
}
