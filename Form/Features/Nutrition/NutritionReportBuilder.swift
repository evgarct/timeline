import Foundation

/// One day's macro totals within a `WeeklyNutritionSnapshot` — `nil` totals mean nothing was logged
/// (or the day hasn't happened yet), distinct from a day genuinely logged as all zeros.
struct DailyNutritionTotal: Identifiable, Equatable, Sendable {
    let date: Date
    let summary: NutritionSummary?
    var id: Date { date }
}

/// A 7-day (Mon–Sun) macro history ending on the report's date — mirrors `WeeklyActivitySnapshot`'s
/// shape so the cover page's nutrition chart can be built the same way as its activity chart.
struct WeeklyNutritionSnapshot: Equatable, Sendable {
    let days: [DailyNutritionTotal]
    let selectedDate: Date

    private var loggedSummaries: [NutritionSummary] {
        days.compactMap(\.summary)
    }

    var averageCalories: Double { average { $0.calories } }
    var averageProtein: Double { average { $0.protein } }
    var averageFat: Double { average { $0.fat } }
    var averageCarbohydrates: Double { average { $0.carbohydrates } }

    private func average(_ value: (NutritionSummary) -> Double) -> Double {
        let values = loggedSummaries.map(value)
        guard !values.isEmpty else { return 0 }
        return values.reduce(0, +) / Double(values.count)
    }
}

/// Everything a nutrition report (PDF + share preview image) needs to render, assembled once per
/// export so the rendering views stay pure functions of this payload.
struct NutritionReportPayload {
    let date: Date
    let entriesByMeal: [MealType: [FoodEntry]]
    let summary: NutritionReportSummary
    /// `nil` when HealthKit is unavailable/denied/not wired up — the report renders without an
    /// activity section rather than blocking export on Health permission.
    let activity: WeeklyActivitySnapshot?
    let stepGoal: Int
    /// User-set macro targets, entirely optional per field — drives the achieved/under/over signals
    /// on the cover page, shown only for macros the person actually configured a goal for.
    let goals: NutritionGoals
    /// 7-day calorie/macro history for the cover page's trend chart — `nil` if it couldn't be fetched
    /// (the report still renders fine without it, just without that chart).
    let weeklyNutrition: WeeklyNutritionSnapshot?

    init(
        date: Date, entries: [FoodEntry], activity: WeeklyActivitySnapshot?, stepGoal: Int,
        goals: NutritionGoals = NutritionGoals(), weeklyNutrition: WeeklyNutritionSnapshot? = nil
    ) {
        self.date = date
        entriesByMeal = Dictionary(grouping: entries, by: \.mealType)
        summary = NutritionReportSummary(entries: entries)
        self.activity = activity
        self.stepGoal = stepGoal
        self.goals = goals
        self.weeklyNutrition = weeklyNutrition
    }

    var allEntries: [FoodEntry] {
        entriesByMeal.values.flatMap { $0 }
    }

    func entries(for meal: MealType) -> [FoodEntry] {
        entriesByMeal[meal] ?? []
    }

    func summary(for meal: MealType) -> NutritionReportSummary {
        NutritionReportSummary(entries: entries(for: meal))
    }
}

enum NutritionReportBuilder {
    @MainActor
    static func payload(for store: NutritionStore, stepGoal: Int, goals: NutritionGoals) async -> NutritionReportPayload {
        let date = store.selectedDate
        async let activityState = store.activitySnapshot(for: date)
        async let weeklyNutrition = store.weeklyNutritionSnapshot(for: date)
        let resolvedActivityState = await activityState
        let resolvedWeeklyNutrition = await weeklyNutrition
        let activity: WeeklyActivitySnapshot?
        if case let .value(snapshot) = resolvedActivityState {
            activity = snapshot
        } else {
            activity = nil
        }
        return NutritionReportPayload(
            date: date, entries: store.entries, activity: activity, stepGoal: stepGoal,
            goals: goals, weeklyNutrition: resolvedWeeklyNutrition
        )
    }
}
