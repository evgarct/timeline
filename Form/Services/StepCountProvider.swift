import Foundation
import HealthKit

struct DailyStepTotal: Identifiable, Equatable, Sendable {
    let date: Date
    let steps: Int?

    var id: Date { date }
}

struct WeeklyActivitySnapshot: Equatable, Sendable {
    let days: [DailyStepTotal]
    let today: Date
    let distanceMeters: Double?
    let fetchedAt: Date

    var todaySteps: Int {
        days.first(where: { $0.date == today })?.steps ?? 0
    }

    var averageSteps: Int {
        let elapsed = days.filter { $0.date <= today }.compactMap(\.steps)
        guard !elapsed.isEmpty else { return 0 }
        return Int((Double(elapsed.reduce(0, +)) / Double(elapsed.count)).rounded())
    }

    static func preview(
        todaySteps: Int = 9_420,
        distanceMeters: Double? = 7_040,
        calendar: Calendar = .current
    ) -> WeeklyActivitySnapshot {
        let today = calendar.date(from: DateComponents(year: 2025, month: 7, day: 27))!
        let values = [8_210, 11_480, 7_920, 12_340, 10_160, 6_870, todaySteps]
        let start = Self.monday(containing: today, calendar: calendar)
        let days = values.enumerated().map { index, value in
            DailyStepTotal(date: calendar.date(byAdding: .day, value: index, to: start)!, steps: value)
        }
        return WeeklyActivitySnapshot(days: days, today: today, distanceMeters: distanceMeters, fetchedAt: today)
    }

    static func monday(containing date: Date, calendar: Calendar) -> Date {
        let startOfDay = calendar.startOfDay(for: date)
        let weekday = calendar.component(.weekday, from: startOfDay)
        let daysSinceMonday = (weekday + 5) % 7
        return calendar.date(byAdding: .day, value: -daysSinceMonday, to: startOfDay)!
    }
}

enum WeeklyActivityState: Equatable, Sendable {
    case idle
    case value(WeeklyActivitySnapshot)
    case denied
    case unavailable
}

protocol StepCountProviding: Sendable {
    func activitySnapshot(now: Date) async -> WeeklyActivityState
}

actor HealthKitStepCountProvider: StepCountProviding {
    private let store = HKHealthStore()

    func activitySnapshot(now: Date = .now) async -> WeeklyActivityState {
        guard HKHealthStore.isHealthDataAvailable(),
              let stepType = HKObjectType.quantityType(forIdentifier: .stepCount),
              let distanceType = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) else {
            return .unavailable
        }

        do {
            try await store.requestAuthorization(toShare: [], read: [stepType, distanceType])
            let calendar = Calendar.autoupdatingCurrent
            let today = calendar.startOfDay(for: now)
            async let days = dailySteps(type: stepType, today: today, now: now, calendar: calendar)
            async let distance = todayDistance(type: distanceType, today: today, now: now)
            return .value(WeeklyActivitySnapshot(
                days: try await days,
                today: today,
                distanceMeters: try await distance,
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
        today: Date,
        now: Date,
        calendar: Calendar
    ) async throws -> [DailyStepTotal] {
        let monday = WeeklyActivitySnapshot.monday(containing: today, calendar: calendar)
        let nextMonday = calendar.date(byAdding: .day, value: 7, to: monday)!
        let predicate = HKQuery.predicateForSamples(withStart: monday, end: min(now, nextMonday))

        let totals: [Date: Int] = try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: monday,
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                var result: [Date: Int] = [:]
                collection?.enumerateStatistics(from: monday, to: min(now, nextMonday)) { statistics, _ in
                    let date = calendar.startOfDay(for: statistics.startDate)
                    let value = statistics.sumQuantity()?.doubleValue(for: .count()) ?? 0
                    result[date] = Int(value.rounded())
                }
                continuation.resume(returning: result)
            }
            store.execute(query)
        }

        return (0..<7).map { offset in
            let date = calendar.date(byAdding: .day, value: offset, to: monday)!
            return DailyStepTotal(date: date, steps: date <= today ? totals[date, default: 0] : nil)
        }
    }

    private func todayDistance(type: HKQuantityType, today: Date, now: Date) async throws -> Double? {
        let predicate = HKQuery.predicateForSamples(withStart: today, end: now)
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
    var state: WeeklyActivityState = .value(.preview())

    func activitySnapshot(now: Date) async -> WeeklyActivityState { state }
}
