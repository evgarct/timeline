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

    func testReportSummaryAggregatesFiberSugarsAndSaturatedFat() {
        let summary = NutritionReportSummary(nutrients: PreviewNutrition.nutrients + [
            NutrientValue(key: "saturated_fat", label: "Saturated fat", value: 0.1, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated)
        ])
        XCTAssertEqual(summary.fiber, 2.6)
        XCTAssertEqual(summary.sugars, 12.2)
        XCTAssertEqual(summary.saturatedFat, 0.1)
        XCTAssertEqual(summary.unsaturatedFat, 0.2, accuracy: 0.0001)
        XCTAssertEqual(summary.complexCarbs, 10.6, accuracy: 0.0001)
    }

    func testReportSummaryClampsProxySplitsWhenComponentsExceedTotals() {
        // Estimated/rounded values can make a sub-component appear larger than its parent macro;
        // the proxy splits must never go negative in that case.
        let summary = NutritionReportSummary(nutrients: [
            NutrientValue(key: "fat", label: "Fat", value: 1, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .estimated),
            NutrientValue(key: "saturated_fat", label: "Saturated fat", value: 1.5, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .estimated),
            NutrientValue(key: "carbohydrates", label: "Carbohydrates", value: 1, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .estimated),
            NutrientValue(key: "sugars", label: "Sugars", value: 1.5, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .estimated)
        ])
        XCTAssertEqual(summary.unsaturatedFat, 0)
        XCTAssertEqual(summary.complexCarbs, 0)
    }

    func testReportSummaryIgnoresNutrientsWithoutMatchingKeys() {
        XCTAssertEqual(NutritionReportSummary(), NutritionReportSummary(nutrients: []))
    }

    func testReportSummaryFlagsWhichBreakdownsWereExplicitlyStated() {
        // Only fat/carbohydrates were logged today — no fiber, sugars, or saturated fat on any entry.
        let unstated = NutritionReportSummary(nutrients: [
            NutrientValue(key: "fat", label: "Fat", value: 10, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
            NutrientValue(key: "carbohydrates", label: "Carbohydrates", value: 20, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated)
        ])
        XCTAssertFalse(unstated.hasFiber)
        XCTAssertFalse(unstated.hasSugars)
        XCTAssertFalse(unstated.hasSaturatedFat)

        let stated = NutritionReportSummary(nutrients: PreviewNutrition.nutrients + [
            NutrientValue(key: "saturated_fat", label: "Saturated fat", value: 0.1, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated)
        ])
        XCTAssertTrue(stated.hasFiber)
        XCTAssertTrue(stated.hasSugars)
        XCTAssertTrue(stated.hasSaturatedFat)
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
