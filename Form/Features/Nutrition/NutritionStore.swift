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
    private(set) var searchError: String?
    private(set) var saveError: String?

    private(set) var mealHistoryProducts: [NutritionProduct] = []
    private(set) var mealHistoryHasMore = false
    private(set) var isLoadingMealHistory = false
    private var mealHistoryPage = 0

    private(set) var discoverProducts: [NutritionProduct] = []
    private(set) var discoverHasMore = false
    private(set) var isLoadingDiscover = false
    private var discoverPage = 0
    private(set) var todaySummary = NutritionSummary()
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

    func summary(for date: Date) async throws -> NutritionSummary {
        let entries = try await repository.entries(
            date: calendar.startOfDay(for: date),
            timezone: timezone
        )
        return NutritionSummary(entries: entries)
    }

    func refreshTodaySummary() async {
        if let value = try? await summary(for: .now) { todaySummary = value }
    }

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
            searchError = nil
        } catch {
            products = []
            searchError = error.localizedDescription
        }
    }

    /// Resets and loads the first page of both product browse sections for a meal's add-product sheet.
    func beginBrowsing(meal: MealType) async {
        mealHistoryProducts = []
        mealHistoryHasMore = false
        mealHistoryPage = 0
        discoverProducts = []
        discoverHasMore = false
        discoverPage = 0
        async let history: () = loadMoreMealHistory(meal: meal)
        async let discover: () = loadMoreDiscoverProducts()
        _ = await (history, discover)
    }

    func loadMoreMealHistory(meal: MealType) async {
        guard !isLoadingMealHistory else { return }
        isLoadingMealHistory = true
        defer { isLoadingMealHistory = false }
        do {
            let nextPage = mealHistoryPage + 1
            let page = try await repository.recentProducts(forMeal: meal, page: nextPage, pageSize: 20)
            mealHistoryProducts.append(contentsOf: page.items)
            mealHistoryHasMore = page.hasMore
            mealHistoryPage = nextPage
        } catch {
            mealHistoryHasMore = false
        }
    }

    /// Loads more of "everything else" by recency, skipping products already surfaced in the meal-history section.
    func loadMoreDiscoverProducts() async {
        guard !isLoadingDiscover else { return }
        isLoadingDiscover = true
        defer { isLoadingDiscover = false }
        do {
            let nextPage = discoverPage + 1
            let page = try await repository.recentProducts(page: nextPage, pageSize: 20)
            let excluded = Set(mealHistoryProducts.map(\.id))
            discoverProducts.append(contentsOf: page.items.filter { !excluded.contains($0.id) })
            discoverHasMore = page.hasMore
            discoverPage = nextPage
        } catch {
            discoverHasMore = false
        }
    }

    func add(product: NutritionProduct, meal: MealType, quantity: FoodQuantity) async throws {
        saveError = nil
        do {
            let entry = try await repository.record(
                product: product, meal: meal, quantity: quantity,
                date: calendar.date(bySettingHour: 12, minute: 0, second: 0, of: selectedDate) ?? selectedDate,
                timezone: timezone
            )
            entries.append(entry)
            await refreshTodaySummary()
        } catch {
            saveError = error.localizedDescription
            throw error
        }
    }

    func update(entry: FoodEntry, meal: MealType, quantity: FoodQuantity, date: Date) async throws {
        saveError = nil
        do {
            let updated = try await repository.update(
                entry: entry, meal: meal, quantity: quantity,
                date: calendar.date(bySettingHour: 12, minute: 0, second: 0, of: date) ?? date,
                timezone: timezone
            )
            entries.removeAll { $0.id == entry.id }
            if calendar.isDate(date, inSameDayAs: selectedDate) { entries.append(updated) }
            await refreshTodaySummary()
        } catch {
            saveError = error.localizedDescription
            throw error
        }
    }

    func delete(entry: FoodEntry) async throws {
        saveError = nil
        do {
            try await repository.delete(entryID: entry.id)
            entries.removeAll { $0.id == entry.id }
            await refreshTodaySummary()
        } catch {
            saveError = error.localizedDescription
            throw error
        }
    }

    func clearSaveError() {
        saveError = nil
    }

    func reset() {
        entries = []
        products = []
        mealHistoryProducts = []
        discoverProducts = []
        todaySummary = NutritionSummary()
        state = .idle
    }
}
