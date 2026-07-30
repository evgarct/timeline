import SwiftUI
import XCTest
@testable import Form

/// Not a correctness test — renders a realistic sample report to disk so it can be visually reviewed
/// (PDF + share-preview image) outside Xcode. Writes to the simulator's tmp directory and prints the
/// path; safe to delete once the review is done.
@MainActor
final class NutritionReportRendererTests: XCTestCase {
    func testRendersSampleReportForVisualReview() throws {
        let payload = Self.realCatalogPayload()
        let locale = Locale(identifier: "ru_RU")

        guard let pdfData = NutritionReportRenderer.pdf(payload: payload, locale: locale) else {
            XCTFail("PDF rendering returned nil")
            return
        }
        guard let ogImage = NutritionReportRenderer.ogImage(payload: payload, locale: locale),
              let ogPNG = ogImage.pngData() else {
            XCTFail("OG image rendering returned nil")
            return
        }

        let dir = FileManager.default.temporaryDirectory
        let pdfURL = dir.appendingPathComponent("nutrition-report-sample.pdf")
        let ogURL = dir.appendingPathComponent("nutrition-report-sample-og.png")
        try pdfData.write(to: pdfURL)
        try ogPNG.write(to: ogURL)

        print("SAMPLE_PDF_PATH=\(pdfURL.path)")
        print("SAMPLE_OG_PATH=\(ogURL.path)")
    }

    /// Every value below (name, id, per-100g/ml nutrient base) is copied verbatim from the user's real
    /// personal product database (`search_products` via the nutrition MCP) — including each product's
    /// actual stated-vs-estimated split (the coffee, milkshake, oats, shake, and cranberry mix all have
    /// stated labels; the banana and pancakes are estimated only). Quantities are scaled from each
    /// product's own per-100g/ml base the same way the app itself scales a logged quantity, and spread
    /// across all four meals so the full-table and per-meal-goal-% features have real data to show
    /// throughout the day, not just one meal. Goal numbers are illustrative (chosen to show all three
    /// achieved/under/over signal states), not the user's actual configured goals.
    private static func realCatalogPayload() -> NutritionReportPayload {
        func nutrient(_ key: String, _ label: String, _ value: Double, _ unit: String, _ provenance: NutrientProvenance) -> NutrientValue {
            NutrientValue(key: key, label: label, value: value, unit: unit, qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: provenance)
        }
        func entry(_ id: String, _ name: String, _ brand: String?, _ productId: String, _ meal: MealType, _ quantity: FoodQuantity, at hour: Int, minute: Int, _ nutrients: [NutrientValue], type: LocalizedText? = nil, baseAmount: FoodBaseAmount? = nil) -> FoodEntry {
            var components = DateComponents(year: 2026, month: 7, day: 25, hour: hour, minute: minute)
            components.timeZone = TimeZone(identifier: "Europe/Prague")
            let occurredAt = Calendar(identifier: .gregorian).date(from: components)!
            return FoodEntry(
                id: id, type: "nutrition_entry", occurredAt: occurredAt, timezone: "Europe/Prague", note: nil,
                productId: productId, mealType: meal, quantity: quantity,
                productSnapshot: FoodProductSnapshot(name: name, brand: brand, nutrients: nutrients, type: type, genericName: nil, baseAmount: baseAmount)
            )
        }

        // Ovsené vločky jemné (Crownfield/Lidl), per 100 g, stated — 50 g portion.
        let oats = entry(
            "demo-oats", "Ovsené vločky jemné", "Crownfield (Lidl)", "a5f59920-14fc-454c-978f-2c966b88267a",
            .breakfast, .grams(50), at: 7, minute: 30, [
                nutrient("energy_kcal", "Energetická hodnota", 175.5, "kcal", .stated),
                nutrient("fat", "Tuky", 2.3, "g", .stated),
                nutrient("saturated_fat", "z toho nasytené mastné kyseliny", 0.4, "g", .stated),
                nutrient("carbohydrates", "Sacharidy", 30.5, "g", .stated),
                nutrient("sugars", "z toho cukry", 0.5, "g", .stated),
                nutrient("fiber", "Vláknina", 4.7, "g", .stated),
                nutrient("protein", "Bílkoviny", 6, "g", .stated),
                nutrient("salt", "Sůl", 0.005, "g", .stated)
            ]
        )
        // Protein Milkshake Vanilla (Vilgain), per-portion (330 ml) base, stated.
        let milkshake = entry(
            "demo-milkshake", "Protein Milkshake Vanilla", "Vilgain", "e0595485-8831-4f10-809e-bf9069ace860",
            .breakfast, .milliliters(330), at: 7, minute: 35, [
                nutrient("energy_kcal", "Energy (kcal)", 261, "kcal", .stated),
                nutrient("fat", "Fat", 5.9, "g", .stated),
                nutrient("saturated_fat", "of which saturates", 3.3, "g", .stated),
                nutrient("carbohydrates", "Carbohydrate", 16, "g", .stated),
                nutrient("sugars", "of which sugars", 16, "g", .stated),
                nutrient("protein", "Protein", 33, "g", .stated),
                nutrient("salt", "Salt", 0.56, "g", .stated)
            ], type: LocalizedText(en: "Protein drink", ru: "Протеиновый напиток", cs: "Proteinový nápoj")
        )
        // HERO All-in-One (Fruit Shake) (Extrifit), per 100 g, stated — 1 scoop (~50 g per label).
        let shake = entry(
            "demo-hero-shake", "HERO All-in-One (Fruit Shake)", "Extrifit", "7c651406-6082-4f5a-bd39-f6d4340765b7",
            .lunch, .grams(50), at: 13, minute: 0, [
                nutrient("energy_kcal", "Energie / Energy", 183, "kcal", .stated),
                nutrient("fat", "Tuky / Fat", 2, "g", .stated),
                nutrient("saturated_fat", "nasycené mastné kyseliny", 1.15, "g", .stated),
                nutrient("carbohydrates", "Sacharidy / Carbohydrates", 13, "g", .stated),
                nutrient("sugars", "cukry / sugars", 8, "g", .stated),
                nutrient("fiber", "Vláknina / Fiber", 0.7, "g", .stated),
                nutrient("protein", "Bílkoviny / Protein", 22, "g", .stated),
                nutrient("salt", "Sůl / Salt", 0.415, "g", .stated)
            ]
        )
        // Snack Mix with Cranberries (Alesto/Lidl), per 100 g, stated — 30 g portion.
        let trailMix = entry(
            "demo-trail-mix", "Snack Mix with Cranberries", "Alesto (Lidl)", "0e9772e2-8a97-4e88-9bcf-fd4ae78829cd",
            .lunch, .grams(30), at: 13, minute: 5, [
                nutrient("energy_kcal", "Wartość energetyczna / Energie", 171.6, "kcal", .stated),
                nutrient("fat", "Tłuszcz / Tuky", 12.78, "g", .stated),
                nutrient("saturated_fat", "w tym kwasy nasycone", 1.17, "g", .stated),
                nutrient("carbohydrates", "Węglowodany / Sacharidy", 8.16, "g", .stated),
                nutrient("sugars", "w tym cukry", 6.03, "g", .stated),
                nutrient("fiber", "Błonnik / Vláknina", 2.49, "g", .stated),
                nutrient("protein", "Białko / Bílkoviny", 4.74, "g", .stated),
                nutrient("salt", "Sól / Sůl", 0, "g", .stated)
            ]
        )
        // Оладьи домашние (без сахара) — the user's own ad-hoc product, estimated only, 240 g.
        let pancakes = entry(
            "demo-pancakes", "Оладьи домашние (без сахара)", nil, "b60eed2f-3785-41d1-83d3-85136f2f2896",
            .dinner, .grams(240), at: 19, minute: 30, [
                nutrient("energy_kcal", "Энергия", 480, "kcal", .estimated),
                nutrient("fat", "Жиры", 14.4, "g", .estimated),
                nutrient("carbohydrates", "Углеводы", 72, "g", .estimated),
                nutrient("sugars", "в т.ч. сахар", 2.4, "g", .estimated),
                nutrient("protein", "Белки", 14.4, "g", .estimated)
            ]
        )
        // Банан — estimated per-100g base, "Средний банан" serving (118 g).
        let banana = entry(
            "demo-banana", "Банан", nil, "d50df4df-8574-49e6-bcdc-a5518f2b5153",
            .snack, .grams(118), at: 16, minute: 0, [
                nutrient("energy_kcal", "Энергия", 105.02, "kcal", .estimated),
                nutrient("fat", "Жиры", 0.354, "g", .estimated),
                nutrient("carbohydrates", "Углеводы", 26.904, "g", .estimated),
                nutrient("sugars", "в т.ч. сахар", 14.396, "g", .estimated),
                nutrient("fiber", "Клетчатка", 3.068, "g", .estimated),
                nutrient("protein", "Белки", 1.298, "g", .estimated)
            ]
        )
        // Café au Lait (Bellarom/Lidl), per 100 ml, stated — logged as 2x "1 капсула" servings (180 ml
        // each per the product's servingSizes), exercising the g/ml-normalized display instead of a raw
        // "2 capsules" quantity label.
        let coffee = entry(
            "demo-coffee", "Café au Lait", "Bellarom (Lidl)", "065c246b-4f0a-473b-8502-07e51e09d0af",
            .snack, .serving(2, label: "1 капсула", servingSizeId: nil), at: 16, minute: 10, [
                nutrient("energy_kcal", "Valor energético / Energetická hodnota", 57.6, "kcal", .stated),
                nutrient("fat", "Grasas / Tuky / Grăsimi", 2.4, "g", .stated),
                nutrient("saturated_fat", "de las cuales, saturadas", 1.68, "g", .stated),
                nutrient("carbohydrates", "Hidratos de carbono / Sacharidy", 5.52, "g", .stated),
                nutrient("sugars", "de los cuales, azúcares", 5.04, "g", .stated),
                nutrient("protein", "Proteínas / Bílkoviny", 3.6, "g", .stated),
                nutrient("salt", "Sal / Sůl / Sarata", 0.12, "g", .stated)
            ], type: LocalizedText(en: "Coffee", ru: "Кофе", cs: "Káva"), baseAmount: FoodBaseAmount(amount: 360, unit: "ml")
        )

        let calendar = Calendar(identifier: .gregorian)
        let reportDate = calendar.date(from: DateComponents(year: 2026, month: 7, day: 25))!
        let activity = WeeklyActivitySnapshot.preview(
            selectedDate: reportDate,
            now: calendar.date(from: DateComponents(year: 2026, month: 7, day: 25, hour: 22, minute: 47))!,
            selectedSteps: 8_883,
            selectedDistanceMeters: 7_100
        )
        // Illustrative goals covering all three signal states against this day's real totals
        // (~1434 kcal / 85 g protein / 40 g fat / 172 g carbs): calories & fat land near their goal,
        // protein under, carbs over.
        let goals = NutritionGoals(calories: 1_500, protein: 100, fat: 38, carbohydrates: 140)

        func weeklyCalories(_ value: Double) -> NutritionSummary {
            NutritionSummary(nutrients: [
                NutrientValue(key: "energy_kcal", label: "Energy", value: value, unit: "kcal", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated)
            ])
        }
        let weekStart = calendar.date(byAdding: .day, value: -5, to: reportDate)! // Monday of this week
        let weeklyDayCalories: [Double?] = [1_900, 2_100, 1_750, 2_450, 1_600, 1_433.72, nil]
        let weeklyNutrition = WeeklyNutritionSnapshot(
            days: weeklyDayCalories.enumerated().map { offset, calories in
                DailyNutritionTotal(
                    date: calendar.date(byAdding: .day, value: offset, to: weekStart)!,
                    summary: calories.map(weeklyCalories)
                )
            },
            selectedDate: reportDate
        )

        return NutritionReportPayload(
            date: reportDate, entries: [oats, milkshake, shake, trailMix, pancakes, banana, coffee],
            activity: activity, stepGoal: 12_000, goals: goals, weeklyNutrition: weeklyNutrition
        )
    }
}
