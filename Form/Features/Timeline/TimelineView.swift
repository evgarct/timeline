import SwiftUI

struct TimelineView: View {
    @Bindable var store: TodayStore
    @State private var sheet: TimelineSheet?

    var body: some View {
        NavigationStack {
            Group {
                if store.state == .loading && store.events.isEmpty {
                    ProgressView("common.loading").frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if case let .failed(message) = store.state, bodyEvents.isEmpty {
                    ContentUnavailableView("today.error.network", systemImage: "wifi.exclamationmark", description: Text(message))
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 26) {
                            editorialHeader
            if bodyEvents.isEmpty {
                                ContentUnavailableView("timeline.empty", systemImage: "clock", description: Text("timeline.empty.description"))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 60)
                            } else { TimelineArchive(events: bodyEvents) }
                        }
                        .padding(.horizontal, 18)
                        .padding(.top, 12)
                        .padding(.bottom, 110)
                    }
                    .refreshable { await store.refresh() }
                }
            }
            .background { timelineBackground }
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(item: $sheet) { _ in
            MeasurementEditor(previous: latestMeasurements) { values, date in
                try await store.addMeasurements(values, on: date)
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .task { if store.state == .idle { await store.refresh() } }
        .preferredColorScheme(.dark)
        .accessibilityIdentifier("timeline.screen")
    }

    private var editorialHeader: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("timeline.eyebrow")
                        .font(.caption.weight(.semibold))
                        .tracking(1.6)
                        .foregroundStyle(.secondary)
                    Text("timeline.title")
                        .font(.system(size: 45, weight: .regular, design: .serif))
                        .tracking(-1.4)
                }
                Spacer()
                Button { sheet = .measurements } label: {
                    Image(systemName: "plus")
                        .font(.headline)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.glass)
                .accessibilityLabel("timeline.add.measurements")
                .accessibilityIdentifier("timeline.add.measurements")
            }

            if let latestMeasurements, let weight = latestMeasurements.weightKg {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(weight.formatted(.number.precision(.fractionLength(0...2))))
                        .font(.system(size: 58, weight: .light, design: .serif))
                    Text("measurement.kg").font(.title3).foregroundStyle(.secondary)
                    Spacer()
                    if let delta = weightDelta {
                        Text(delta, format: .number.sign(strategy: .always()).precision(.fractionLength(0...2)))
                            .font(.callout.weight(.medium))
                            .foregroundStyle(.secondary)
                        Text("measurement.kg").font(.caption).foregroundStyle(.tertiary)
                    }
                }
                Text("timeline.latest.caption").font(.callout).foregroundStyle(.secondary)
            }
        }
    }

    private var timelineBackground: some View {
        ZStack {
            Color(red: 0.075, green: 0.065, blue: 0.058)
            RadialGradient(colors: [Color(red: 0.34, green: 0.27, blue: 0.22).opacity(0.45), .clear], center: .topTrailing, startRadius: 0, endRadius: 520)
        }
        .ignoresSafeArea()
    }

    private var bodyEvents: [TimelineEvent] {
        store.events.filter {
            switch $0 {
            case .progressPhoto, .measurements, .inbody: true
            case .workout, .nutritionEntry, .unsupported: false
            }
        }
    }

    private var measurementEvents: [(EventBase, BodyMeasurements)] {
        store.events.compactMap { if case let .measurements(base, values) = $0 { return (base, values) }; return nil }
            .sorted { $0.0.occurredAt > $1.0.occurredAt }
    }

    private var latestMeasurements: BodyMeasurements? { measurementEvents.first?.1 }
    private var weightDelta: Double? {
        guard measurementEvents.count > 1, let current = measurementEvents[0].1.weightKg, let prior = measurementEvents[1].1.weightKg else { return nil }
        return current - prior
    }

}

private struct PhotoSession: Identifiable, Hashable { let id: String; let photos: [ProgressPhoto] }
private enum TimelineSheet: String, Identifiable { case measurements; var id: String { rawValue } }

struct TimelineArchive: View {
    let events: [TimelineEvent]
    var excludingPhotoEventID: String?
    @State private var photoSession: PhotoSession?

    init(events: [TimelineEvent], excludingPhotoEventID: String? = nil) {
        self.events = events
        self.excludingPhotoEventID = excludingPhotoEventID
    }

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 26) {
            ForEach(groupedDays, id: \.0) { day, dayEvents in
                VStack(alignment: .leading, spacing: 10) {
                    Text(dayLabel(day)).font(.system(size: 21, design: .serif)).foregroundStyle(.secondary)
                    ForEach(dayEvents) { event in
                        switch event {
                        case let .progressPhoto(base, photos):
                            TimelinePhotoCard(base: base, photos: photos) {
                                photoSession = PhotoSession(id: base.id, photos: photos)
                            }
                        case let .measurements(base, values):
                            MeasurementArchiveCard(values: values, previous: previousMeasurements(before: base.occurredAt))
                        default:
                            TimelineMediaRow(event: event)
                        }
                    }
                }
            }
        }
        .sheet(item: $photoSession) { session in
            PhotoGalleryView(photos: session.photos, selection: .constant(0))
        }
        .accessibilityIdentifier("timeline.archive")
    }

    private var bodyEvents: [TimelineEvent] {
        events.filter { event in
            switch event {
            case let .progressPhoto(base, _): base.id != excludingPhotoEventID
            case .measurements, .inbody: true
            case .workout, .nutritionEntry, .unsupported: false
            }
        }
    }

    private var measurementEvents: [(EventBase, BodyMeasurements)] {
        events.compactMap { if case let .measurements(base, values) = $0 { return (base, values) }; return nil }
            .sorted { $0.0.occurredAt > $1.0.occurredAt }
    }

    private var groupedDays: [(Date, [TimelineEvent])] {
        let groups = Dictionary(grouping: bodyEvents) { Calendar.current.startOfDay(for: $0.base.occurredAt) }
        return groups.keys.sorted(by: >).map { ($0, groups[$0, default: []].sorted { $0.base.occurredAt > $1.base.occurredAt }) }
    }

    private func previousMeasurements(before date: Date) -> BodyMeasurements? {
        measurementEvents.first { $0.0.occurredAt < date }?.1
    }

    private func dayLabel(_ day: Date) -> String {
        if Calendar.current.isDateInToday(day) { return String(localized: "nutrition.today") }
        if Calendar.current.isDateInYesterday(day) { return String(localized: "timeline.yesterday") }
        return day.formatted(.dateTime.day().month(.wide).year())
    }
}

private struct MeasurementArchiveCard: View {
    let values: BodyMeasurements
    let previous: BodyMeasurements?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Label("timeline.event.measurements", systemImage: "ruler")
                    .font(.headline)
                Spacer()
                if let weight = values.weightKg {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(weight.formatted(.number.precision(.fractionLength(0...2)))) \(String(localized: "measurement.kg"))")
                            .font(.title3.weight(.medium))
                        MeasurementChangeLabel(delta: MeasurementDelta(current: weight, previous: previous?.weightKg), unit: "measurement.kg")
                    }
                }
            }
            FlowMeasurements(values: values, previous: previous)
        }
        .padding(19)
        .glassEffect(.regular, in: .rect(cornerRadius: 26))
    }
}

private struct FlowMeasurements: View {
    let values: BodyMeasurements
    let previous: BodyMeasurements?
    private var items: [(String, Double?, Double?)] { [
        ("measurement.chest", values.chestCm, previous?.chestCm), ("measurement.waist", values.waistCm, previous?.waistCm),
        ("measurement.abdomen", values.abdomenCm, previous?.abdomenCm), ("measurement.arm.relaxed", values.leftBicepCm, previous?.leftBicepCm),
        ("measurement.arm.flexed", values.leftBicepFlexedCm, previous?.leftBicepFlexedCm), ("measurement.forearm", values.forearmCm, previous?.forearmCm),
        ("measurement.hips", values.hipsCm, previous?.hipsCm), ("measurement.thigh", values.leftThighCm, previous?.leftThighCm),
        ("measurement.calf", values.leftCalfCm, previous?.leftCalfCm)
    ] }

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 10) {
            ForEach(Array(items.filter { $0.1 != nil }.enumerated()), id: \.offset) { _, item in
                GridRow {
                    Text(LocalizedStringKey(item.0)).foregroundStyle(.secondary)
                    Spacer()
                    HStack(spacing: 9) {
                        MeasurementChangeLabel(delta: MeasurementDelta(current: item.1!, previous: item.2), unit: "measurement.cm")
                        Text("\(item.1!.formatted(.number.precision(.fractionLength(0...1)))) \(String(localized: "measurement.cm"))")
                            .monospacedDigit()
                    }
                }
                .font(.subheadline)
            }
        }
    }
}

private struct MeasurementChangeLabel: View {
    let delta: MeasurementDelta
    let unit: String

    var body: some View {
        if let change = delta.change, let direction = delta.direction {
            HStack(spacing: 3) {
                Image(systemName: icon(direction)).font(.caption2.weight(.semibold))
                if direction != .unchanged {
                    Text(abs(change).formatted(.number.precision(.fractionLength(0...2))))
                        .monospacedDigit()
                    Text(LocalizedStringKey(unit))
                }
            }
            .font(.caption)
            .foregroundStyle(.tertiary)
            .accessibilityLabel(accessibilityValue(change: change, direction: direction))
        }
    }

    private func icon(_ direction: MeasurementDelta.Direction) -> String {
        switch direction { case .increased: "arrow.up.right"; case .decreased: "arrow.down.right"; case .unchanged: "minus" }
    }

    private func accessibilityValue(change: Double, direction: MeasurementDelta.Direction) -> String {
        let key = switch direction {
        case .increased: "timeline.change.increased"
        case .decreased: "timeline.change.decreased"
        case .unchanged: "timeline.change.unchanged"
        }
        if direction == .unchanged { return String(localized: String.LocalizationValue(key)) }
        return "\(String(localized: String.LocalizationValue(key))) \(abs(change).formatted(.number.precision(.fractionLength(0...2)))) \(String(localized: String.LocalizationValue(unit)))"
    }
}

private struct TimelinePhotoCard: View {
    let base: EventBase
    let photos: [ProgressPhoto]
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            ZStack(alignment: .bottomLeading) {
                photo
                    .frame(maxWidth: .infinity)
                    .frame(height: 440)
                    .clipped()
                LinearGradient(colors: [.clear, .black.opacity(0.72)], startPoint: .center, endPoint: .bottom)
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("timeline.photo.session").font(.headline)
                        Text(base.occurredAt.formatted(.dateTime.day().month(.wide).year()))
                            .font(.subheadline).foregroundStyle(.white.opacity(0.72))
                    }
                    Spacer()
                    if photos.count > 1 {
                        Label("\(photos.count)", systemImage: "photo.on.rectangle.angled")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 11).padding(.vertical, 7)
                            .glassEffect(.regular, in: .capsule)
                    }
                }
                .padding(18)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .clipShape(.rect(cornerRadius: 28))
        .overlay { RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.12), lineWidth: 0.8) }
        .accessibilityLabel("timeline.photo.open")
        .accessibilityIdentifier("timeline.photo.session")
    }

    @ViewBuilder private var photo: some View {
        if let first = photos.first, let url = first.thumbnailUrl ?? first.url {
            AsyncImage(url: url) { phase in
                if let image = phase.image { image.resizable().scaledToFill() }
                else if phase.error != nil { placeholder }
                else { ZStack { placeholder; ProgressView().tint(.white) } }
            }
        } else { placeholder }
    }

    private var placeholder: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.30, green: 0.25, blue: 0.21), Color(red: 0.10, green: 0.09, blue: 0.08)], startPoint: .top, endPoint: .bottom)
            Image(systemName: "figure.stand").font(.system(size: 78, weight: .ultraLight)).foregroundStyle(.white.opacity(0.3))
        }
    }
}

private struct TimelineMediaRow: View {
    let event: TimelineEvent
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: eventIcon).foregroundStyle(.secondary).frame(width: 24)
            Text(eventTitle).font(.body)
            Spacer()
            Text(event.base.occurredAt.formatted(date: .omitted, time: .shortened)).font(.caption).foregroundStyle(.tertiary)
        }
        .padding(18)
        .glassEffect(.regular, in: .rect(cornerRadius: 22))
    }
    private var eventIcon: String { if case .progressPhoto = event { return "camera" }; return "waveform.path.ecg" }
    private var eventTitle: LocalizedStringKey { if case .progressPhoto = event { return "timeline.event.photo" }; return "timeline.event.inbody" }
}

private struct MeasurementEditor: View {
    @Environment(\.dismiss) private var dismiss
    let previous: BodyMeasurements?
    let onSave: (BodyMeasurements, Date) async throws -> Void
    @State private var date = Date()
    @State private var fields = Array(repeating: "", count: 10)
    @State private var isSaving = false
    @State private var error: String?

    private let definitions: [(String, Bool)] = [
        ("measurement.weight", true), ("measurement.chest", false), ("measurement.waist", false),
        ("measurement.abdomen", false), ("measurement.arm.relaxed", false), ("measurement.arm.flexed", false),
        ("measurement.forearm", false), ("measurement.hips", false), ("measurement.thigh", false), ("measurement.calf", false)
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("common.cancel") { dismiss() }.buttonStyle(.plain)
                Spacer()
                Text("timeline.add.measurements").font(.headline)
                Spacer()
                Button("common.save") { Task { await save() } }
                    .buttonStyle(.plain).fontWeight(.semibold).disabled(!values.hasValues || isSaving)
            }
            .padding(.horizontal, 20).frame(height: 54)

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    DatePicker("nutrition.date", selection: $date, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .padding(18)
                        .glassEffect(.regular, in: .rect(cornerRadius: 22))

                    Text("timeline.editor.caption").font(.callout).foregroundStyle(.secondary)

                    VStack(spacing: 0) {
                        ForEach(definitions.indices, id: \.self) { index in
                            if index > 0 { Divider().overlay(.white.opacity(0.1)) }
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(LocalizedStringKey(definitions[index].0)).font(.body)
                                    if let previousValue = previousValue(index) {
                                        Text("\(String(localized: "timeline.previous")) \(previousValue.formatted(.number.precision(.fractionLength(0...2))))")
                                            .font(.caption).foregroundStyle(.tertiary)
                                    }
                                }
                                Spacer()
                                TextField("—", text: $fields[index])
                                    .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                                    .font(.title3.monospacedDigit()).frame(width: 82)
                                    .accessibilityIdentifier("measurement.field.\(index)")
                                Text(definitions[index].1 ? "measurement.kg" : "measurement.cm")
                                    .font(.caption).foregroundStyle(.secondary).frame(width: 24, alignment: .leading)
                            }
                            .padding(.horizontal, 18).padding(.vertical, 14)
                        }
                    }
                    .glassEffect(.regular, in: .rect(cornerRadius: 26))
                    if let error { Text(error).font(.footnote).foregroundStyle(.secondary) }
                }
                .padding(.horizontal, 18).padding(.bottom, 36)
            }
        }
        .background(Color(red: 0.075, green: 0.065, blue: 0.058).ignoresSafeArea())
        .accessibilityIdentifier("measurement.editor")
    }

    private func number(_ index: Int) -> Double? { Double(fields[index].replacingOccurrences(of: ",", with: ".")) }
    private var values: BodyMeasurements {
        BodyMeasurements(weightKg: number(0), waistCm: number(2), abdomenCm: number(3), chestCm: number(1), neckCm: nil,
                         hipsCm: number(7), forearmCm: number(6), leftBicepCm: number(4), rightBicepCm: number(4),
                         leftBicepFlexedCm: number(5), rightBicepFlexedCm: number(5), leftThighCm: number(8),
                         rightThighCm: number(8), leftCalfCm: number(9), rightCalfCm: number(9))
    }
    private func previousValue(_ index: Int) -> Double? {
        guard let previous else { return nil }
        return [previous.weightKg, previous.chestCm, previous.waistCm, previous.abdomenCm, previous.leftBicepCm,
                previous.leftBicepFlexedCm, previous.forearmCm, previous.hipsCm, previous.leftThighCm, previous.leftCalfCm][index]
    }
    private func save() async {
        isSaving = true; defer { isSaving = false }
        do { try await onSave(values, date); dismiss() }
        catch { self.error = String(localized: "timeline.save.error") }
    }
}

#Preview("Timeline archive") {
    TimelineView(store: TodayStore(repository: PreviewTimelineRepository(), steps: PreviewStepCountProvider()))
}
