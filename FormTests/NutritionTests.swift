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

    func testProductSummaryScalesToServingSize() {
        let milk = PreviewNutrition.proteinMilk
        let wholePack = milk.servingSizes.first { $0.label.contains("330") }
        XCTAssertNotNil(wholePack)
        let summary = milk.summary(for: .milliliters(wholePack!.amount))
        let reference = milk.referenceSummary
        XCTAssertEqual(summary.calories, reference.calories * 3.3, accuracy: 0.01)
        XCTAssertEqual(summary.protein, reference.protein * 3.3, accuracy: 0.01)
    }

    func testProductSummaryForPieceSize() {
        let banana = PreviewNutrition.banana
        let summary = banana.summary(for: .pieces(1, size: "medium"))
        XCTAssertEqual(summary.calories, banana.referenceSummary.calories * 1.18, accuracy: 0.01)
    }

    func testAlternateBaseExposesDirectlyStatedValuesWithoutScaling() {
        let servingNutrients = [
            NutrientValue(key: "energy_kcal", label: "Energy", value: 261, unit: "kcal", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
            NutrientValue(key: "protein", label: "Protein", value: 33, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated)
        ]
        let product = NutritionProduct(
            id: "product-with-serving-base", name: "Shake", brand: nil, barcode: nil,
            baseUnit: "ml",
            nutrientBases: [
                NutrientBase(id: "per100ml", label: "per 100 ml", amount: 100, unit: "ml", nutrients: PreviewNutrition.proteinMilkNutrients),
                NutrientBase(id: "perServing330ml", label: "per portion (330 ml)", amount: 330, unit: "ml", nutrients: servingNutrients)
            ],
            pieceSizes: [], servingSizes: [], createdAt: .now, updatedAt: .now
        )
        XCTAssertEqual(product.alternateBases.count, 1)
        XCTAssertEqual(product.alternateBases.first?.id, "perServing330ml")
    }
}
