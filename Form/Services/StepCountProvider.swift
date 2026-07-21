import Foundation
import HealthKit

enum StepCountState: Equatable, Sendable {
    case idle
    case value(Int)
    case denied
    case unavailable
}

protocol StepCountProviding: Sendable {
    func todaySteps() async -> StepCountState
}

actor HealthKitStepCountProvider: StepCountProviding {
    private let store = HKHealthStore()

    func todaySteps() async -> StepCountState {
        guard HKHealthStore.isHealthDataAvailable(),
              let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            return .unavailable
        }
        do {
            try await store.requestAuthorization(toShare: [], read: [stepType])
            let calendar = Calendar.autoupdatingCurrent
            let start = calendar.startOfDay(for: .now)
            let predicate = HKQuery.predicateForSamples(withStart: start, end: .now)
            let value: Double = try await withCheckedThrowingContinuation { continuation in
                let query = HKStatisticsQuery(
                    quantityType: stepType,
                    quantitySamplePredicate: predicate,
                    options: .cumulativeSum
                ) { _, statistics, error in
                    if let error { continuation.resume(throwing: error); return }
                    continuation.resume(returning: statistics?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                }
                store.execute(query)
            }
            return .value(Int(value.rounded()))
        } catch {
            return store.authorizationStatus(for: stepType) == .sharingDenied ? .denied : .unavailable
        }
    }
}

struct PreviewStepCountProvider: StepCountProviding {
    var state: StepCountState = .value(9_420)
    func todaySteps() async -> StepCountState { state }
}
