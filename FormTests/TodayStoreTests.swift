import XCTest
@testable import Form

@MainActor
final class TodayStoreTests: XCTestCase {
    func testConfigurationRejectsSchemeOnlyURLs() {
        XCTAssertNil(FormConfiguration(auth: "https:", api: "https:"))
        XCTAssertNotNil(FormConfiguration(
            auth: "https://timeline.example.com",
            api: "https://timeline.example.com"
        ))
    }

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
        let snapshot = WeeklyActivitySnapshot.preview(todaySteps: 1_234)
        let store = TodayStore(repository: repository, steps: PreviewStepCountProvider(state: .value(snapshot)))

        await store.refresh()

        XCTAssertEqual(store.latestPhotos, [photo])
        XCTAssertEqual(store.latestMeasurements?.weightKg, 80)
        XCTAssertEqual(store.activity, .idle)

        await store.refreshActivity(now: snapshot.today)

        XCTAssertEqual(store.activity, .value(snapshot))
        XCTAssertEqual(store.state, .loaded)
    }

    func testUnauthorizedResponseShowsSessionError() async {
        let repository = PreviewTimelineRepository(result: .failure(TimelineRepositoryError.unauthorized))
        let store = TodayStore(repository: repository, steps: PreviewStepCountProvider())

        await store.refresh()

        guard case .failed = store.state else { return XCTFail("Expected failed state") }
    }

    func testWeeklyAverageUsesMondayThroughTodayIncludingZeroDays() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let today = calendar.date(from: DateComponents(year: 2025, month: 7, day: 27))!
        let monday = WeeklyActivitySnapshot.monday(containing: today, calendar: calendar)
        let values = [10_000, 0, 8_000, 6_000, 12_000, 0, 6_000]
        let days = values.enumerated().map { offset, steps in
            DailyStepTotal(date: calendar.date(byAdding: .day, value: offset, to: monday)!, steps: steps)
        }
        let snapshot = WeeklyActivitySnapshot(days: days, today: calendar.startOfDay(for: today), distanceMeters: nil, fetchedAt: today)

        XCTAssertEqual(snapshot.averageSteps, 6_000)
        XCTAssertEqual(snapshot.todaySteps, 6_000)
    }

    func testWeeklyAverageExcludesFutureDays() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let monday = Date(timeIntervalSince1970: 1_752_451_200)
        let days = (0..<7).map { offset in
            DailyStepTotal(
                date: calendar.date(byAdding: .day, value: offset, to: monday)!,
                steps: offset < 3 ? [9_000, 0, 6_000][offset] : nil
            )
        }
        let wednesday = calendar.date(byAdding: .day, value: 2, to: monday)!
        let snapshot = WeeklyActivitySnapshot(days: days, today: wednesday, distanceMeters: nil, fetchedAt: wednesday)

        XCTAssertEqual(snapshot.averageSteps, 5_000)
        XCTAssertEqual(snapshot.todaySteps, 6_000)
    }

    func testWeekAlwaysStartsOnMonday() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let sunday = Date(timeIntervalSince1970: 1_752_422_400)
        let monday = WeeklyActivitySnapshot.monday(containing: sunday, calendar: calendar)

        XCTAssertEqual(calendar.component(.weekday, from: monday), 2)
        XCTAssertEqual(calendar.dateComponents([.day], from: monday, to: calendar.startOfDay(for: sunday)).day, 6)
    }
}
