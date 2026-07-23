import Foundation

protocol NutritionRepository: Sendable {
    func entries(date: Date, timezone: TimeZone) async throws -> [FoodEntry]
    func search(query: String, page: Int) async throws -> ProductSearchPage
    func record(product: NutritionProduct, meal: MealType, quantity: FoodQuantity, date: Date, timezone: TimeZone) async throws -> FoodEntry
    func update(entry: FoodEntry, meal: MealType, quantity: FoodQuantity, date: Date, timezone: TimeZone) async throws -> FoodEntry
    func delete(entryID: String) async throws
}

actor RemoteNutritionRepository: NutritionRepository {
    private let baseURL: URL
    private let session: FormSession

    init(baseURL: URL, session: FormSession) {
        self.baseURL = baseURL
        self.session = session
    }

    func entries(date: Date, timezone: TimeZone) async throws -> [FoodEntry] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timezone
        formatter.dateFormat = "yyyy-MM-dd"
        var components = URLComponents(url: baseURL.appending(path: "api/nutrition/entries"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "date", value: formatter.string(from: date)),
            URLQueryItem(name: "timezone", value: timezone.identifier)
        ]
        return try await request(components.url!)
    }

    func search(query: String, page: Int) async throws -> ProductSearchPage {
        var components = URLComponents(url: baseURL.appending(path: "api/nutrition/products"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "query", value: query),
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "pageSize", value: "30")
        ]
        return try await request(components.url!)
    }

    func record(product: NutritionProduct, meal: MealType, quantity: FoodQuantity, date: Date, timezone: TimeZone) async throws -> FoodEntry {
        try await request(
            baseURL.appending(path: "api/nutrition/entries"),
            method: "POST",
            body: RecordBody(
                productId: product.id, mealType: meal, quantity: quantity,
                occurredAt: date, timezone: timezone.identifier, idempotencyKey: UUID().uuidString
            )
        )
    }

    func update(entry: FoodEntry, meal: MealType, quantity: FoodQuantity, date: Date, timezone: TimeZone) async throws -> FoodEntry {
        try await request(
            baseURL.appending(path: "api/nutrition/entries/\(entry.id)"),
            method: "PUT",
            body: UpdateBody(mealType: meal, quantity: quantity, occurredAt: date, timezone: timezone.identifier)
        )
    }

    func delete(entryID: String) async throws {
        var request = URLRequest(url: baseURL.appending(path: "api/nutrition/entries/\(entryID)"))
        request.httpMethod = "DELETE"
        let (_, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw TimelineRepositoryError.invalidResponse
        }
    }

    private func request<T: Decodable>(_ url: URL) async throws -> T {
        try await request(url, method: "GET", body: Optional<String>.none)
    }

    private func request<T: Decodable, Body: Encodable>(_ url: URL, method: String, body: Body?) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder.formAPI.encode(body)
        }
        let (data, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw TimelineRepositoryError.invalidResponse }
        guard http.statusCode != 401 else { throw TimelineRepositoryError.unauthorized }
        guard (200..<300).contains(http.statusCode) else { throw TimelineRepositoryError.server(http.statusCode) }
        return try JSONDecoder.formAPI.decode(T.self, from: data)
    }

    private struct RecordBody: Encodable {
        let productId: String
        let mealType: MealType
        let quantity: FoodQuantity
        let occurredAt: Date
        let timezone: String
        let idempotencyKey: String
    }

    private struct UpdateBody: Encodable {
        let mealType: MealType
        let quantity: FoodQuantity
        let occurredAt: Date
        let timezone: String
    }
}

struct PreviewNutritionRepository: NutritionRepository {
    var entriesValue = PreviewNutrition.entries
    var productsValue = PreviewNutrition.products

    func entries(date: Date, timezone: TimeZone) async throws -> [FoodEntry] { entriesValue }
    func search(query: String, page: Int) async throws -> ProductSearchPage {
        let values = productsValue.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) }
        return ProductSearchPage(items: values, page: page, pageSize: 30, hasMore: false)
    }
    func record(product: NutritionProduct, meal: MealType, quantity: FoodQuantity, date: Date, timezone: TimeZone) async throws -> FoodEntry {
        FoodEntry(
            id: UUID().uuidString, type: "nutrition_entry", occurredAt: date, timezone: timezone.identifier,
            note: nil, productId: product.id, mealType: meal, quantity: quantity,
            productSnapshot: FoodProductSnapshot(name: product.name, brand: product.brand, nutrients: product.nutrientBases[0].nutrients)
        )
    }
    func update(entry: FoodEntry, meal: MealType, quantity: FoodQuantity, date: Date, timezone: TimeZone) async throws -> FoodEntry {
        FoodEntry(
            id: entry.id, type: entry.type, occurredAt: date, timezone: timezone.identifier,
            note: entry.note, productId: entry.productId, mealType: meal, quantity: quantity,
            productSnapshot: entry.productSnapshot
        )
    }
    func delete(entryID: String) async throws {}
}

extension JSONEncoder {
    static var formAPI: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}
