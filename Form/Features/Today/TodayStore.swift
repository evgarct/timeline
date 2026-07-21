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
    private(set) var steps: StepCountState = .idle

    private let repository: any TimelineRepository
    private let stepProvider: any StepCountProviding

    init(repository: any TimelineRepository, steps: any StepCountProviding) {
        self.repository = repository
        self.stepProvider = steps
    }

    var latestPhotos: [ProgressPhoto] {
        events.compactMap { event -> (Date, [ProgressPhoto])? in
            guard case let .progressPhoto(base, photos) = event else { return nil }
            return (base.occurredAt, photos)
        }.max(by: { $0.0 < $1.0 })?.1 ?? []
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
        async let remoteEvents = repository.events()
        async let stepState = stepProvider.todaySteps()
        do {
            events = try await remoteEvents.sorted { $0.base.occurredAt > $1.base.occurredAt }
            steps = await stepState
            state = .loaded
        } catch TimelineRepositoryError.unauthorized {
            state = .failed(String(localized: "today.error.session"))
            steps = await stepState
        } catch {
            state = .failed(String(localized: "today.error.network"))
            steps = await stepState
        }
    }

    func reset() {
        events = []
        steps = .idle
        state = .idle
    }
}
