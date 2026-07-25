import Foundation

protocol NutritionRepository: Sendable {
    func entries(date: Date, timezone: TimeZone) async throws -> [FoodEntry]
    func search(query: String, page: Int) async throws -> ProductSearchPage
    /// Products ordered by most recent use/edit, for browsing without a search query.
    func recentProducts(page: Int, pageSize: Int) async throws -> ProductSearchPage
    /// Products previously logged for a specific meal, most recent first.
    func recentProducts(forMeal meal: MealType, page: Int, pageSize: Int) async throws -> ProductSearchPage
    func record(product: NutritionProduct, meal: MealType, quantity: FoodQuantity, date: Date, timezone: TimeZone) async throws -> FoodEntry
    func update(entry: FoodEntry, meal: MealType, quantity: FoodQuantity, date: Date, timezone: TimeZone) async throws -> FoodEntry
    func delete(entryID: String) async throws
    func submitReport(pdf: Data, ogImage: Data, reportDate: Date, timezone: TimeZone) async throws -> NutritionReportUploadResult
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

    func recentProducts(page: Int, pageSize: Int) async throws -> ProductSearchPage {
        var components = URLComponents(url: baseURL.appending(path: "api/nutrition/products"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "query", value: ""),
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "pageSize", value: String(pageSize))
        ]
        return try await request(components.url!)
    }

    func recentProducts(forMeal meal: MealType, page: Int, pageSize: Int) async throws -> ProductSearchPage {
        var components = URLComponents(url: baseURL.appending(path: "api/nutrition/products/recent"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "mealType", value: meal.rawValue),
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "pageSize", value: String(pageSize))
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

    func submitReport(pdf: Data, ogImage: Data, reportDate: Date, timezone: TimeZone) async throws -> NutritionReportUploadResult {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timezone
        formatter.dateFormat = "yyyy-MM-dd"

        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        body.appendMultipartField(name: "reportDate", value: formatter.string(from: reportDate), boundary: boundary)
        body.appendMultipartField(name: "timezone", value: timezone.identifier, boundary: boundary)
        body.appendMultipartFile(name: "pdf", filename: "report.pdf", contentType: "application/pdf", data: pdf, boundary: boundary)
        body.appendMultipartFile(name: "ogImage", filename: "og.jpg", contentType: "image/jpeg", data: ogImage, boundary: boundary)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        var request = URLRequest(url: baseURL.appending(path: "api/nutrition/reports"))
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = body

        let (data, response) = try await session.urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw TimelineRepositoryError.invalidResponse }
        guard http.statusCode != 401 else { throw TimelineRepositoryError.unauthorized }
        guard (200..<300).contains(http.statusCode) else { throw TimelineRepositoryError.server(http.statusCode) }
        return try JSONDecoder.formAPI.decode(NutritionReportUploadResult.self, from: data)
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
    func recentProducts(page: Int, pageSize: Int) async throws -> ProductSearchPage {
        paginate(productsValue, page: page, pageSize: pageSize)
    }
    func recentProducts(forMeal meal: MealType, page: Int, pageSize: Int) async throws -> ProductSearchPage {
        var seen = Set<String>()
        let productIds = entriesValue.filter { $0.mealType == meal }.compactMap(\.productId).filter { seen.insert($0).inserted }
        let products = productIds.compactMap { id in productsValue.first { $0.id == id } }
        return paginate(products, page: page, pageSize: pageSize)
    }
    private func paginate(_ values: [NutritionProduct], page: Int, pageSize: Int) -> ProductSearchPage {
        let offset = (page - 1) * pageSize
        let items = Array(values.dropFirst(offset).prefix(pageSize))
        return ProductSearchPage(items: items, page: page, pageSize: pageSize, hasMore: offset + pageSize < values.count)
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
    func submitReport(pdf: Data, ogImage: Data, reportDate: Date, timezone: TimeZone) async throws -> NutritionReportUploadResult {
        NutritionReportUploadResult(reportId: "preview-report", shareURL: URL(string: "https://example.com/r/preview-report")!)
    }
}

private extension Data {
    mutating func appendMultipartField(name: String, value: String, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        append(value.data(using: .utf8)!)
        append("\r\n".data(using: .utf8)!)
    }

    mutating func appendMultipartFile(name: String, filename: String, contentType: String, data: Data, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        append("Content-Type: \(contentType)\r\n\r\n".data(using: .utf8)!)
        append(data)
        append("\r\n".data(using: .utf8)!)
    }
}

extension JSONEncoder {
    static var formAPI: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}
