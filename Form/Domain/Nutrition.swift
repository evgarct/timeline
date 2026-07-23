import Foundation

enum NutrientProvenance: String, Codable, Sendable {
    case stated, calculated, estimated
}

struct NutrientValue: Codable, Identifiable, Hashable, Sendable {
    var id: String { "\(key ?? label)-\(unit)-\(label)" }
    let key: String?
    let label: String
    let value: Double?
    let unit: String
    let qualifier: String?
    let originalText: String?
    let dailyValuePercent: Double?
    let provenance: NutrientProvenance
}

struct NutrientBase: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let amount: Double
    let unit: String
    let nutrients: [NutrientValue]
}

struct PieceSizeOption: Codable, Identifiable, Hashable, Sendable {
    var id: String { size }
    let size: String
    let grams: Double
    let provenance: NutrientProvenance
}

struct NutritionProduct: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let brand: String?
    let barcode: String?
    let baseUnit: String
    let nutrientBases: [NutrientBase]
    let pieceSizes: [PieceSizeOption]
    let createdAt: Date
    let updatedAt: Date
}

enum FoodQuantity: Codable, Hashable, Sendable {
    case grams(Double)
    case milliliters(Double)
    case pieces(Double, size: String)

    private enum CodingKeys: String, CodingKey { case unit, amount, size }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let unit = try container.decode(String.self, forKey: .unit)
        let amount = try container.decode(Double.self, forKey: .amount)
        switch unit {
        case "g": self = .grams(amount)
        case "ml": self = .milliliters(amount)
        case "piece": self = .pieces(amount, size: try container.decode(String.self, forKey: .size))
        default:
            throw DecodingError.dataCorruptedError(forKey: .unit, in: container, debugDescription: "Unknown food unit")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .grams(amount):
            try container.encode("g", forKey: .unit)
            try container.encode(amount, forKey: .amount)
        case let .milliliters(amount):
            try container.encode("ml", forKey: .unit)
            try container.encode(amount, forKey: .amount)
        case let .pieces(amount, size):
            try container.encode("piece", forKey: .unit)
            try container.encode(amount, forKey: .amount)
            try container.encode(size, forKey: .size)
        }
    }

    var amount: Double {
        switch self {
        case let .grams(value), let .milliliters(value), let .pieces(value, _): value
        }
    }

    var unitLabel: String {
        switch self {
        case .grams: "g"
        case .milliliters: "ml"
        case let .pieces(_, size): size
        }
    }
}

enum MealType: String, CaseIterable, Codable, Sendable {
    case breakfast, lunch, dinner, snack
}

struct FoodProductSnapshot: Codable, Hashable, Sendable {
    let name: String
    let brand: String?
    let nutrients: [NutrientValue]
}

struct FoodEntryPayload: Codable, Hashable, Sendable {
    let productId: String
    let mealType: MealType
    let quantity: FoodQuantity
    let productSnapshot: FoodProductSnapshot
}

struct FoodEntry: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let type: String
    let occurredAt: Date
    let timezone: String
    let note: String?
    let productId: String
    let mealType: MealType
    let quantity: FoodQuantity
    let productSnapshot: FoodProductSnapshot
}

struct ProductSearchPage: Codable, Sendable {
    let items: [NutritionProduct]
    let page: Int
    let pageSize: Int
    let hasMore: Bool
}

struct NutritionSummary: Equatable, Sendable {
    var calories = 0.0
    var protein = 0.0
    var fat = 0.0
    var carbohydrates = 0.0

    init(entries: [FoodEntry] = []) {
        for nutrient in entries.flatMap(\.productSnapshot.nutrients) {
            guard let value = nutrient.value else { continue }
            switch nutrient.key {
            case "energy_kcal": calories += value
            case "protein": protein += value
            case "fat": fat += value
            case "carbohydrates": carbohydrates += value
            default: break
            }
        }
    }
}
