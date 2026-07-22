import Foundation
import HealthKit

struct DailyStepTotal: Identifiable, Equatable, Sendable {
    let date: Date
    let steps: Int?

    var id: Date { date }
}

struct WeeklyActivitySnapshot: Identifiable, Equatable, Sendable {
    let days: [DailyStepTotal]
    let selectedDate: Date
    let averageEndDate: Date
    let selectedDistanceMeters: Double?
    let fetchedAt: Date

    var id: Date { selectedDate }

    var selectedSteps: Int {
        days.first(where: { $0.date == selectedDate })?.steps ?? 0
    }

    var averageSteps: Int {
        let elapsed = days.filter { $0.date <= averageEndDate }.compactMap(\.steps)
        guard !elapsed.isEmpty else { return 0 }
        return Int((Double(elapsed.reduce(0, +)) / Double(elapsed.count)).rounded())
    }

    static func preview(
        selectedDate: Date? = nil,
        now: Date? = nil,
        selectedSteps: Int? = nil,
        selectedDistanceMeters: Double? = 7_040,
        calendar: Calendar = .current
    ) -> WeeklyActivitySnapshot {
        let referenceNow = now ?? calendar.date(from: DateComponents(year: 2025, month: 7, day: 27, hour: 12))!
        let currentDay = calendar.startOfDay(for: referenceNow)
        let requestedDay = calendar.startOfDay(for: selectedDate ?? currentDay)
        let day = min(requestedDay, currentDay)
        let window = ActivityQueryWindow(selectedDate: day, now: referenceNow, calendar: calendar)
        let values = [8_210, 11_480, 7_920, 12_340, 10_160, 6_870, 9_420]
        let days = values.enumerated().map { index, value in
            let date = calendar.date(byAdding: .day, value: index, to: window.weekStart)!
            let override = date == day ? selectedSteps : nil
            return DailyStepTotal(
                date: date,
                steps: date <= window.averageEndDate ? (override ?? value) : nil
            )
        }
        return WeeklyActivitySnapshot(
            days: days,
            selectedDate: day,
            averageEndDate: window.averageEndDate,
            selectedDistanceMeters: selectedDistanceMeters,
            fetchedAt: referenceNow
        )
    }

    static func monday(containing date: Date, calendar: Calendar) -> Date {
        let startOfDay = calendar.startOfDay(for: date)
        let weekday = calendar.component(.weekday, from: startOfDay)
        let daysSinceMonday = (weekday + 5) % 7
        return calendar.date(byAdding: .day, value: -daysSinceMonday, to: startOfDay)!
    }
}

struct ActivityQueryWindow: Equatable, Sendable {
    let selectedDate: Date
    let weekStart: Date
    let weekEnd: Date
    let averageEndDate: Date
    let queryEnd: Date
    let selectedDayEnd: Date

    init(selectedDate: Date, now: Date, calendar: Calendar) {
        let currentDay = calendar.startOfDay(for: now)
        self.selectedDate = min(calendar.startOfDay(for: selectedDate), currentDay)
        weekStart = WeeklyActivitySnapshot.monday(containing: self.selectedDate, calendar: calendar)
        weekEnd = calendar.date(byAdding: .day, value: 7, to: weekStart)!
        let completedWeek = weekEnd <= currentDay
        averageEndDate = completedWeek
            ? calendar.date(byAdding: .day, value: 6, to: weekStart)!
            : self.selectedDate
        selectedDayEnd = self.selectedDate == currentDay
            ? now
            : calendar.date(byAdding: .day, value: 1, to: self.selectedDate)!
        queryEnd = completedWeek ? weekEnd : selectedDayEnd
    }
}

enum WeeklyActivityState: Equatable, Sendable {
    case idle
    case value(WeeklyActivitySnapshot)
    case denied
    case unavailable
}

protocol StepCountProviding: Sendable {
    func activitySnapshot(for selectedDate: Date, now: Date) async -> WeeklyActivityState
}

actor HealthKitStepCountProvider: StepCountProviding {
    private let store = HKHealthStore()

    func activitySnapshot(for selectedDate: Date, now: Date = .now) async -> WeeklyActivityState {
        guard HKHealthStore.isHealthDataAvailable(),
              let stepType = HKObjectType.quantityType(forIdentifier: .stepCount),
              let distanceType = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) else {
            return .unavailable
        }

        do {
            try await store.requestAuthorization(toShare: [], read: [stepType, distanceType])
            let calendar = Calendar.autoupdatingCurrent
            let window = ActivityQueryWindow(selectedDate: selectedDate, now: now, calendar: calendar)
            async let days = dailySteps(type: stepType, window: window, calendar: calendar)
            async let distance = selectedDistance(type: distanceType, window: window)
            return .value(WeeklyActivitySnapshot(
                days: try await days,
                selectedDate: window.selectedDate,
                averageEndDate: window.averageEndDate,
                selectedDistanceMeters: try await distance,
                fetchedAt: now
            ))
        } catch let error as HKError where error.code == .errorAuthorizationDenied {
            return .denied
        } catch {
            return .unavailable
        }
    }

    private func dailySteps(
        type: HKQuantityType,
        window: ActivityQueryWindow,
        calendar: Calendar
    ) async throws -> [DailyStepTotal] {
        let predicate = HKQuery.predicateForSamples(withStart: window.weekStart, end: window.queryEnd)

        let totals: [Date: Int] = try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: window.weekStart,
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                var result: [Date: Int] = [:]
                collection?.enumerateStatistics(from: window.weekStart, to: window.queryEnd) { statistics, _ in
                    let date = calendar.startOfDay(for: statistics.startDate)
                    let value = statistics.sumQuantity()?.doubleValue(for: .count()) ?? 0
                    result[date] = Int(value.rounded())
                }
                continuation.resume(returning: result)
            }
            store.execute(query)
        }

        return (0..<7).map { offset in
            let date = calendar.date(byAdding: .day, value: offset, to: window.weekStart)!
            return DailyStepTotal(
                date: date,
                steps: date <= window.averageEndDate ? totals[date, default: 0] : nil
            )
        }
    }

    private func selectedDistance(type: HKQuantityType, window: ActivityQueryWindow) async throws -> Double? {
        let predicate = HKQuery.predicateForSamples(withStart: window.selectedDate, end: window.selectedDayEnd)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, statistics, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: statistics?.sumQuantity()?.doubleValue(for: .meter()))
            }
            store.execute(query)
        }
    }
}

struct PreviewStepCountProvider: StepCountProviding {
    var state: WeeklyActivityState?
    var referenceNow: Date

    init(state: WeeklyActivityState? = nil, calendar: Calendar = .current) {
        self.state = state
        referenceNow = calendar.date(from: DateComponents(year: 2025, month: 7, day: 27, hour: 12))!
    }

    func activitySnapshot(for selectedDate: Date, now: Date) async -> WeeklyActivityState {
        if let state { return state }
        return .value(.preview(selectedDate: selectedDate, now: referenceNow))
    }
}
