import XCTest
@testable import Form

@MainActor
final class TodayStoreTests: XCTestCase {
    func testRefreshSelectsLatestPhotoAndMeasurements() async {
        let older = EventBase(id: "old", occurredAt: .distantPast, timezone: "UTC", note: nil)
        let latest = EventBase(id: "latest", occurredAt: .now, timezone: "UTC", note: nil)
        let photo = ProgressPhoto(id: "photo", assetId: nil, url: URL(string: "https://example.com/a.jpg"), thumbnailUrl: nil, width: nil, height: nil, alt: "Photo")
        let values = BodyMeasurements(
            weightKg: 80, waistCm: nil, chestCm: nil, neckCm: nil,
            leftBicepCm: nil, rightBicepCm: nil, leftThighCm: nil,
            rightThighCm: nil, leftCalfCm: nil, rightCalfCm: nil
        )
        let repository = PreviewTimelineRepository(result: .success([
            .progressPhoto(older, []), .progressPhoto(latest, [photo]), .measurements(latest, values)
        ]))
        let store = TodayStore(repository: repository, steps: PreviewStepCountProvider(state: .value(1234)))

        await store.refresh()

        XCTAssertEqual(store.latestPhotos, [photo])
        XCTAssertEqual(store.latestMeasurements?.weightKg, 80)
        XCTAssertEqual(store.steps, .value(1234))
        XCTAssertEqual(store.state, .loaded)
    }

    func testUnauthorizedResponseShowsSessionError() async {
        let repository = PreviewTimelineRepository(result: .failure(TimelineRepositoryError.unauthorized))
        let store = TodayStore(repository: repository, steps: PreviewStepCountProvider())

        await store.refresh()

        guard case .failed = store.state else { return XCTFail("Expected failed state") }
    }
}
