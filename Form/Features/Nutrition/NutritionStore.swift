import Foundation
import Observation

@MainActor
@Observable
final class NutritionStore {
    enum State: Equatable { case idle, loading, loaded, failed }

    private(set) var state: State = .idle
    private(set) var entries: [FoodEntry] = []
    private(set) var products: [NutritionProduct] = []
    private(set) var isSearching = false
    var selectedDate: Date

    let repository: any NutritionRepository
    private let calendar: Calendar
    private let timezone: TimeZone

    init(
        repository: any NutritionRepository,
        selectedDate: Date = .now,
        calendar: Calendar = .current,
        timezone: TimeZone = .current
    ) {
        self.repository = repository
        self.calendar = calendar
        self.timezone = timezone
        self.selectedDate = calendar.startOfDay(for: selectedDate)
    }

    var summary: NutritionSummary { NutritionSummary(entries: entries) }

    func entries(for meal: MealType) -> [FoodEntry] {
        entries.filter { $0.mealType == meal }
    }

    func load() async {
        state = .loading
        do {
            entries = try await repository.entries(date: selectedDate, timezone: timezone)
            state = .loaded
        } catch {
            state = .failed
        }
    }

    func moveDay(_ offset: Int) async {
        guard let date = calendar.date(byAdding: .day, value: offset, to: selectedDate) else { return }
        selectedDate = calendar.startOfDay(for: date)
        await load()
    }

    func select(date: Date) async {
        selectedDate = calendar.startOfDay(for: date)
        await load()
    }

    func search(_ query: String) async {
        isSearching = true
        defer { isSearching = false }
        do {
            products = try await repository.search(query: query, page: 1).items
        } catch {
            products = []
        }
    }

    func add(product: NutritionProduct, meal: MealType, quantity: FoodQuantity) async throws {
        let entry = try await repository.record(
            product: product, meal: meal, quantity: quantity,
            date: calendar.date(bySettingHour: 12, minute: 0, second: 0, of: selectedDate) ?? selectedDate,
            timezone: timezone
        )
        entries.append(entry)
    }

    func update(entry: FoodEntry, meal: MealType, quantity: FoodQuantity, date: Date) async throws {
        let updated = try await repository.update(
            entry: entry, meal: meal, quantity: quantity,
            date: calendar.date(bySettingHour: 12, minute: 0, second: 0, of: date) ?? date,
            timezone: timezone
        )
        entries.removeAll { $0.id == entry.id }
        if calendar.isDate(date, inSameDayAs: selectedDate) { entries.append(updated) }
    }

    func delete(entry: FoodEntry) async throws {
        try await repository.delete(entryID: entry.id)
        entries.removeAll { $0.id == entry.id }
    }

    func reset() {
        entries = []
        products = []
        state = .idle
    }
}
