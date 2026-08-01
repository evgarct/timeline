import Foundation

protocol TimelineRepository: Sendable {
    func events() async throws -> [TimelineEvent]
    func createMeasurements(occurredAt: Date, timezone: TimeZone, values: BodyMeasurements) async throws -> TimelineEvent
}

enum TimelineRepositoryError: Error, Equatable {
    case unauthorized
    case invalidResponse
    case server(Int)
}

actor RemoteTimelineRepository: TimelineRepository {
    private let baseURL: URL
    private let session: FormSession

    init(baseURL: URL, session: FormSession) {
        self.baseURL = baseURL
        self.session = session
    }

    func events() async throws -> [TimelineEvent] {
        var request = URLRequest(url: baseURL.appending(path: "api/events"))
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw TimelineRepositoryError.invalidResponse }
        guard http.statusCode != 401 else { throw TimelineRepositoryError.unauthorized }
        guard (200..<300).contains(http.statusCode) else { throw TimelineRepositoryError.server(http.statusCode) }
        return try JSONDecoder.formAPI.decode([TimelineEvent].self, from: data)
    }

    func createMeasurements(occurredAt: Date, timezone: TimeZone, values: BodyMeasurements) async throws -> TimelineEvent {
        struct RequestBody: Encodable {
            let id: String
            let type = "measurements"
            let occurredAt: String
            let timezone: String
            let values: BodyMeasurements
        }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var request = URLRequest(url: baseURL.appending(path: "api/events"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(RequestBody(
            id: UUID().uuidString.lowercased(),
            occurredAt: formatter.string(from: occurredAt),
            timezone: timezone.identifier,
            values: values
        ))
        let (data, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw TimelineRepositoryError.invalidResponse }
        guard http.statusCode != 401 else { throw TimelineRepositoryError.unauthorized }
        guard (200..<300).contains(http.statusCode) else { throw TimelineRepositoryError.server(http.statusCode) }
        return try JSONDecoder.formAPI.decode(TimelineEvent.self, from: data)
    }
}

struct PreviewTimelineRepository: TimelineRepository {
    var result: Result<[TimelineEvent], Error> = .success(PreviewData.events)
    func events() async throws -> [TimelineEvent] { try result.get() }
    func createMeasurements(occurredAt: Date, timezone: TimeZone, values: BodyMeasurements) async throws -> TimelineEvent {
        .measurements(EventBase(id: UUID().uuidString, occurredAt: occurredAt, timezone: timezone.identifier, note: nil), values)
    }
}
