import Foundation

protocol TimelineRepository: Sendable {
    func events() async throws -> [TimelineEvent]
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
}

struct PreviewTimelineRepository: TimelineRepository {
    var result: Result<[TimelineEvent], Error> = .success(PreviewData.events)
    func events() async throws -> [TimelineEvent] { try result.get() }
}
