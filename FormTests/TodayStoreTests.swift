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
            weightKg: 80, waistCm: nil, abdomenCm: nil, chestCm: nil, neckCm: nil,
            hipsCm: nil, forearmCm: nil, leftBicepCm: nil, rightBicepCm: nil,
            leftBicepFlexedCm: nil, rightBicepFlexedCm: nil, leftThighCm: nil,
            rightThighCm: nil, leftCalfCm: nil, rightCalfCm: nil
        )
        let repository = PreviewTimelineRepository(result: .success([
            .progressPhoto(older, []), .progressPhoto(latest, [photo]), .measurements(latest, values)
        ]))
        let snapshot = WeeklyActivitySnapshot.preview(selectedSteps: 1_234)
        let store = TodayStore(repository: repository, steps: PreviewStepCountProvider(state: .value(snapshot)))

        await store.refresh()

        XCTAssertEqual(store.latestPhotos, [photo])
        XCTAssertEqual(store.latestMeasurements?.weightKg, 80)
        XCTAssertEqual(store.activity, .idle)

        await store.refreshActivity(now: snapshot.fetchedAt)

        XCTAssertEqual(store.activity, .value(snapshot))
        XCTAssertEqual(store.state, .loaded)
    }

    func testUnauthorizedResponseShowsSessionError() async {
        let repository = PreviewTimelineRepository(result: .failure(TimelineRepositoryError.unauthorized))
        let store = TodayStore(repository: repository, steps: PreviewStepCountProvider())

        await store.refresh()

        guard case .failed = store.state else { return XCTFail("Expected failed state") }
    }

    func testCurrentWeekAverageUsesMondayThroughSelectedDayIncludingZeroDays() {
        let calendar = utcCalendar
        let selectedDate = date(2025, 7, 27)
        let monday = WeeklyActivitySnapshot.monday(containing: selectedDate, calendar: calendar)
        let values = [10_000, 0, 8_000, 6_000, 12_000, 0, 6_000]
        let days = values.enumerated().map { offset, steps in
            DailyStepTotal(date: calendar.date(byAdding: .day, value: offset, to: monday)!, steps: steps)
        }
        let snapshot = WeeklyActivitySnapshot(
            days: days,
            selectedDate: selectedDate,
            averageEndDate: selectedDate,
            selectedDistanceMeters: 7_040,
            fetchedAt: date(2025, 7, 27, hour: 12)
        )

        XCTAssertEqual(snapshot.averageSteps, 6_000)
        XCTAssertEqual(snapshot.selectedSteps, 6_000)
        XCTAssertEqual(snapshot.selectedDistanceMeters, 7_040)
    }

    func testCurrentWeekAverageExcludesDaysAfterSelection() {
        let calendar = utcCalendar
        let monday = date(2025, 7, 21)
        let days = (0..<7).map { offset in
            DailyStepTotal(
                date: calendar.date(byAdding: .day, value: offset, to: monday)!,
                steps: offset < 3 ? [9_000, 0, 6_000][offset] : nil
            )
        }
        let wednesday = calendar.date(byAdding: .day, value: 2, to: monday)!
        let snapshot = WeeklyActivitySnapshot(
            days: days,
            selectedDate: wednesday,
            averageEndDate: wednesday,
            selectedDistanceMeters: nil,
            fetchedAt: date(2025, 7, 27, hour: 12)
        )

        XCTAssertEqual(snapshot.averageSteps, 5_000)
        XCTAssertEqual(snapshot.selectedSteps, 6_000)
    }

    func testCompletedWeekAverageIncludesAllSevenDays() {
        let calendar = utcCalendar
        let monday = date(2025, 7, 14)
        let values = [7_000, 0, 7_000, 0, 7_000, 0, 7_000]
        let days = values.enumerated().map { offset, steps in
            DailyStepTotal(date: calendar.date(byAdding: .day, value: offset, to: monday)!, steps: steps)
        }
        let selectedDate = date(2025, 7, 16)
        let snapshot = WeeklyActivitySnapshot(
            days: days,
            selectedDate: selectedDate,
            averageEndDate: date(2025, 7, 20),
            selectedDistanceMeters: nil,
            fetchedAt: date(2025, 7, 27, hour: 12)
        )

        XCTAssertEqual(snapshot.averageSteps, 4_000)
        XCTAssertEqual(snapshot.selectedSteps, 7_000)
    }

    func testPastDayWindowEndsAtNextMidnightAndQueriesCompletedWeek() {
        let calendar = utcCalendar
        let window = ActivityQueryWindow(
            selectedDate: date(2025, 7, 16, hour: 18),
            now: date(2025, 7, 27, hour: 12),
            calendar: calendar
        )

        XCTAssertEqual(window.selectedDate, date(2025, 7, 16))
        XCTAssertEqual(window.selectedDayEnd, date(2025, 7, 17))
        XCTAssertEqual(window.weekStart, date(2025, 7, 14))
        XCTAssertEqual(window.averageEndDate, date(2025, 7, 20))
        XCTAssertEqual(window.queryEnd, date(2025, 7, 21))
    }

    func testCurrentWeekPastDayWindowQueriesOnlyThroughSelectedDay() {
        let calendar = utcCalendar
        let window = ActivityQueryWindow(
            selectedDate: date(2025, 7, 23),
            now: date(2025, 7, 27, hour: 12),
            calendar: calendar
        )

        XCTAssertEqual(window.averageEndDate, date(2025, 7, 23))
        XCTAssertEqual(window.queryEnd, date(2025, 7, 24))
    }

    func testFutureSelectionClampsToTodayAndCurrentTime() {
        let calendar = utcCalendar
        let now = date(2025, 7, 27, hour: 12)
        let window = ActivityQueryWindow(
            selectedDate: date(2025, 8, 2),
            now: now,
            calendar: calendar
        )

        XCTAssertEqual(window.selectedDate, date(2025, 7, 27))
        XCTAssertEqual(window.selectedDayEnd, now)
        XCTAssertEqual(window.queryEnd, now)
    }

    func testShareRendererProducesThemeMatchedCardAtRequiredSize() throws {
        let snapshot = WeeklyActivitySnapshot.preview(calendar: utcCalendar)
        let dark = try XCTUnwrap(ActivityShareRenderer.image(
            snapshot: snapshot,
            stepGoal: 12_000,
            locale: Locale(identifier: "en_US"),
            colorScheme: .dark
        ))
        let light = try XCTUnwrap(ActivityShareRenderer.image(
            snapshot: snapshot,
            stepGoal: 12_000,
            locale: Locale(identifier: "en_US"),
            colorScheme: .light
        ))

        XCTAssertEqual(dark.size.width, 1_080)
        XCTAssertEqual(dark.size.height, 1_350)
        XCTAssertEqual(light.size, dark.size)
        XCTAssertNotEqual(dark.pngData(), light.pngData())

        let darkAttachment = XCTAttachment(image: dark)
        darkAttachment.name = "Activity share card dark"
        darkAttachment.lifetime = .keepAlways
        add(darkAttachment)
        let lightAttachment = XCTAttachment(image: light)
        lightAttachment.name = "Activity share card light"
        lightAttachment.lifetime = .keepAlways
        add(lightAttachment)
    }

    func testWeekAlwaysStartsOnMonday() {
        let calendar = utcCalendar
        let sunday = date(2025, 7, 27)
        let monday = WeeklyActivitySnapshot.monday(containing: sunday, calendar: calendar)

        XCTAssertEqual(calendar.component(.weekday, from: monday), 2)
        XCTAssertEqual(calendar.dateComponents([.day], from: monday, to: calendar.startOfDay(for: sunday)).day, 6)
    }

    private var utcCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func date(_ year: Int, _ month: Int, _ day: Int, hour: Int = 0) -> Date {
        utcCalendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour))!
    }
}
