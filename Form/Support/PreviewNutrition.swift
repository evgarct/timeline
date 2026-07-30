import Foundation

enum PreviewNutrition {
    static let nutrients = [
        NutrientValue(key: "energy_kcal", label: "Energy", value: 89, unit: "kcal", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
        NutrientValue(key: "protein", label: "Protein", value: 1.1, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
        NutrientValue(key: "fat", label: "Fat", value: 0.3, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
        NutrientValue(key: "carbohydrates", label: "Carbohydrates", value: 22.8, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
        NutrientValue(key: "sugars", label: "Sugars", value: 12.2, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
        NutrientValue(key: "fiber", label: "Fiber", value: 2.6, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .estimated),
        NutrientValue(key: "potassium", label: "Potassium", value: 358, unit: "mg", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .estimated)
    ]
    static let banana = NutritionProduct(
        id: "00000000-0000-0000-0000-000000000001", name: "Banana", brand: nil, barcode: nil,
        baseUnit: "g", nutrientBases: [NutrientBase(id: "per-100-g", label: "100 g", amount: 100, unit: "g", nutrients: nutrients)],
        pieceSizes: [PieceSizeOption(size: "medium", grams: 118, provenance: .estimated)],
        servingSizes: [],
        type: LocalizedText(en: "Fruit", ru: "Фрукт", cs: "Ovoce"), genericName: nil,
        createdAt: .now, updatedAt: .now
    )
    static let proteinMilkNutrients = [
        NutrientValue(key: "energy_kcal", label: "Energy", value: 52, unit: "kcal", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
        NutrientValue(key: "protein", label: "Protein", value: 6, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
        NutrientValue(key: "fat", label: "Fat", value: 0.9, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated),
        NutrientValue(key: "carbohydrates", label: "Carbohydrates", value: 5.2, unit: "g", qualifier: nil, originalText: nil, dailyValuePercent: nil, provenance: .stated)
    ]
    static let proteinMilk = NutritionProduct(
        id: "00000000-0000-0000-0000-000000000002", name: "Protein Milk", brand: nil, barcode: nil,
        baseUnit: "ml", nutrientBases: [NutrientBase(id: "per-100-ml", label: "100 ml", amount: 100, unit: "ml", nutrients: proteinMilkNutrients)],
        pieceSizes: [],
        servingSizes: [ServingSizeOption(label: "1 пачка (330 мл)", amount: 330, provenance: .stated)],
        type: LocalizedText(en: "Protein drink", ru: "Протеиновый напиток", cs: "Proteinový nápoj"), genericName: nil,
        createdAt: .now, updatedAt: .now
    )
    static let products = [banana, proteinMilk]
    static let entries = [
        FoodEntry(
            id: "entry-1", type: "nutrition_entry", occurredAt: .now, timezone: "Europe/Prague", note: nil,
            productId: banana.id, mealType: .breakfast, quantity: .pieces(1, size: "medium"),
            productSnapshot: FoodProductSnapshot(name: "Banana", brand: nil, nutrients: nutrients, type: banana.type, genericName: nil)
        )
    ]
}
