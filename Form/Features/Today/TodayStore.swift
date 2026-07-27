import Foundation
import Observation

@MainActor
@Observable
final class TodayStore {
    enum State: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    private(set) var state: State = .idle
    private(set) var events: [TimelineEvent] = []
    private(set) var activity: WeeklyActivityState = .idle
    private(set) var isRefreshingActivity = false

    private let repository: any TimelineRepository
    private let stepProvider: any StepCountProviding

    init(repository: any TimelineRepository, steps: any StepCountProviding) {
        self.repository = repository
        self.stepProvider = steps
    }

    private var latestPhotoEvent: (id: String, occurredAt: Date, photos: [ProgressPhoto])? {
        events.compactMap { event -> (String, Date, [ProgressPhoto])? in
            guard case let .progressPhoto(base, photos) = event else { return nil }
            return (base.id, base.occurredAt, photos)
        }.max(by: { $0.1 < $1.1 }).map { (id: $0.0, occurredAt: $0.1, photos: $0.2) }
    }

    var latestPhotos: [ProgressPhoto] {
        latestPhotoEvent?.photos ?? []
    }

    /// Index of the photo pinned as cover for the latest photo event, or 0 if none is pinned yet.
    var coverPhotoIndex: Int {
        guard let event = latestPhotoEvent, !event.photos.isEmpty else { return 0 }
        guard let pinnedId = CoverPhotoPreferences.shared.coverPhotoId(forEvent: event.id),
              let index = event.photos.firstIndex(where: { $0.id == pinnedId }) else { return 0 }
        return index
    }

    /// Pins `photo` as the cover for the latest photo event, so it keeps showing on Today instead of
    /// resetting to the first photo on the next load.
    func setCoverPhoto(_ photo: ProgressPhoto) {
        guard let event = latestPhotoEvent else { return }
        CoverPhotoPreferences.shared.setCoverPhotoId(photo.id, forEvent: event.id)
    }

    var latestPhotoDate: Date? {
        events.compactMap { event -> Date? in
            guard case let .progressPhoto(base, _) = event else { return nil }
            return base.occurredAt
        }.max()
    }

    var latestMeasurements: BodyMeasurements? {
        events.compactMap { event -> (Date, BodyMeasurements)? in
            guard case let .measurements(base, values) = event else { return nil }
            return (base.occurredAt, values)
        }.max(by: { $0.0 < $1.0 })?.1
    }

    func refresh() async {
        if events.isEmpty { state = .loading }
        do {
            events = try await repository.events().sorted { $0.base.occurredAt > $1.base.occurredAt }
            state = .loaded
        } catch TimelineRepositoryError.unauthorized {
            state = .failed(String(localized: "today.error.session"))
        } catch {
            state = .failed(String(localized: "today.error.network"))
        }
    }

    func refreshActivity(now: Date = .now) async {
        guard !isRefreshingActivity else { return }
        isRefreshingActivity = true
        defer { isRefreshingActivity = false }
        activity = await activitySnapshot(for: now, now: now)
    }

    func activitySnapshot(for selectedDate: Date, now: Date = .now) async -> WeeklyActivityState {
        await stepProvider.activitySnapshot(for: selectedDate, now: now)
    }

    func reset() {
        events = []
        activity = .idle
        state = .idle
    }
}
