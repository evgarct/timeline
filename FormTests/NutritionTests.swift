import XCTest
@testable import Form

@MainActor
final class NutritionTests: XCTestCase {
    func testSummaryUsesOnlyCanonicalMacrosAndPreservesMicronutrients() {
        let summary = NutritionSummary(entries: PreviewNutrition.entries)
        XCTAssertEqual(summary.calories, 89)
        XCTAssertEqual(summary.protein, 1.1)
        XCTAssertEqual(summary.fat, 0.3)
        XCTAssertEqual(summary.carbohydrates, 22.8)
        XCTAssertNotNil(PreviewNutrition.nutrients.first { $0.key == "potassium" })
        XCTAssertNotNil(PreviewNutrition.nutrients.first { $0.key == "fiber" })
    }

    func testStoreNavigatesIntoFuture() async {
        let store = NutritionStore(repository: PreviewNutritionRepository())
        let initial = store.selectedDate
        await store.moveDay(1)
        XCTAssertEqual(
            Calendar.current.dateComponents([.day], from: initial, to: store.selectedDate).day,
            1
        )
    }

    func testFoodQuantityRoundTripsAllUnits() throws {
        for quantity in [FoodQuantity.grams(120), .milliliters(250), .pieces(1, size: "medium")] {
            let data = try JSONEncoder.formAPI.encode(quantity)
            XCTAssertEqual(try JSONDecoder.formAPI.decode(FoodQuantity.self, from: data), quantity)
        }
    }
}
