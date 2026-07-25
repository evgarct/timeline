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
    private let stepProvider: (any StepCountProviding)?
    private let calendar: Calendar
    private let timezone: TimeZone

    init(
        repository: any NutritionRepository,
        stepProvider: (any StepCountProviding)? = nil,
        selectedDate: Date = .now,
        calendar: Calendar = .current,
        timezone: TimeZone = .current
    ) {
        self.repository = repository
        self.stepProvider = stepProvider
        self.calendar = calendar
        self.timezone = timezone
        self.selectedDate = calendar.startOfDay(for: selectedDate)
    }

    /// Activity for the report export — `nil` (rather than `.unavailable`) when no provider was
    /// injected at all, distinguishing "not wired up" from "HealthKit denied/unavailable".
    func activitySnapshot(for date: Date, now: Date = .now) async -> WeeklyActivityState? {
        guard let stepProvider else { return nil }
        return await stepProvider.activitySnapshot(for: date, now: now)
    }

    var summary: NutritionSummary { NutritionSummary(entries: entries) }

    func summary(for date: Date) async throws -> NutritionSummary {
        let entries = try await repository.entries(
            date: calendar.startOfDay(for: date),
            timezone: timezone
        )
        return NutritionSummary(entries: entries)
    }

    /// 7-day (Mon–Sun) macro history for the report's weekly trend chart. Days after `date` (a
    /// future/not-yet-happened part of the week) are omitted rather than fetched as empty, so they
    /// don't pull the average down as if they were logged-and-zero.
    func weeklyNutritionSnapshot(for date: Date) async -> WeeklyNutritionSnapshot {
        let today = calendar.startOfDay(for: .now)
        let selected = calendar.startOfDay(for: date)
        let weekStart = WeeklyActivitySnapshot.monday(containing: selected, calendar: calendar)
        var days: [DailyNutritionTotal] = []
        for offset in 0..<7 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: weekStart) else { continue }
            guard day <= today else {
                days.append(DailyNutritionTotal(date: day, summary: nil))
                continue
            }
            let summary = try? await summary(for: day)
            days.append(DailyNutritionTotal(date: day, summary: summary))
        }
        return WeeklyNutritionSnapshot(days: days, selectedDate: selected)
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

    private(set) var isExportingReport = false

    /// Renders the currently selected day as a PDF + share-preview image, uploads both, and returns
    /// the share-sheet payload (fixed Russian greeting + public link) — or `nil` on failure, surfaced
    /// through the same `saveError` alert every other store action already uses.
    func exportReport(stepGoal: Int, goals: NutritionGoals) async -> NutritionReportSharePayload? {
        guard !isExportingReport else { return nil }
        isExportingReport = true
        defer { isExportingReport = false }

        let payload = await NutritionReportBuilder.payload(for: self, stepGoal: stepGoal, goals: goals)
        let renderLocale = Locale(identifier: "ru_RU")
        guard let pdf = NutritionReportRenderer.pdf(payload: payload, locale: renderLocale),
              let ogImage = NutritionReportRenderer.ogImage(payload: payload, locale: renderLocale)?
                .jpegData(compressionQuality: 0.85)
        else {
            saveError = String(localized: "nutrition.export.error")
            return nil
        }

        do {
            let result = try await repository.submitReport(
                pdf: pdf, ogImage: ogImage, reportDate: payload.date, timezone: timezone
            )
            return NutritionReportSharePayload(text: shareGreeting(for: payload.date), url: result.shareURL)
        } catch {
            saveError = error.localizedDescription
            return nil
        }
    }

    /// Fixed Russian greeting regardless of device locale, per spec — not routed through
    /// `Localizable.xcstrings`.
    private func shareGreeting(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ru_RU")
        formatter.dateFormat = "EEEE, d MMMM"
        return "привет, отчет за \(formatter.string(from: date))"
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
