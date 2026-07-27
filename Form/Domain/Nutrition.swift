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

struct ServingSizeOption: Codable, Identifiable, Hashable, Sendable {
    var id: String { label }
    let label: String
    let amount: Double
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
    let servingSizes: [ServingSizeOption]
    let createdAt: Date
    let updatedAt: Date
}

enum FoodQuantity: Codable, Hashable, Sendable {
    case grams(Double)
    case milliliters(Double)
    case pieces(Double, size: String)
    case serving(Double, label: String?, servingSizeId: String?)
    case asConsumed(label: String)

    private enum CodingKeys: String, CodingKey { case unit, amount, size, label, servingSizeId }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let unit = try container.decode(String.self, forKey: .unit)
        switch unit {
        case "g": self = .grams(try container.decode(Double.self, forKey: .amount))
        case "ml": self = .milliliters(try container.decode(Double.self, forKey: .amount))
        case "piece":
            self = .pieces(
                try container.decode(Double.self, forKey: .amount),
                size: try container.decode(String.self, forKey: .size)
            )
        case "serving":
            self = .serving(
                try container.decode(Double.self, forKey: .amount),
                label: try container.decodeIfPresent(String.self, forKey: .label),
                servingSizeId: try container.decodeIfPresent(String.self, forKey: .servingSizeId)
            )
        case "as_consumed":
            self = .asConsumed(label: try container.decode(String.self, forKey: .label))
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
        case let .serving(amount, label, servingSizeId):
            try container.encode("serving", forKey: .unit)
            try container.encode(amount, forKey: .amount)
            try container.encodeIfPresent(label, forKey: .label)
            try container.encodeIfPresent(servingSizeId, forKey: .servingSizeId)
        case let .asConsumed(label):
            try container.encode("as_consumed", forKey: .unit)
            try container.encode(label, forKey: .label)
        }
    }

    var amount: Double {
        switch self {
        case let .grams(value), let .milliliters(value): value
        case let .pieces(value, _): value
        case let .serving(value, _, _): value
        case .asConsumed: 1
        }
    }

    var unitLabel: String {
        switch self {
        case .grams: "g"
        case .milliliters: "ml"
        case let .pieces(_, size): size
        case let .serving(_, label, servingSizeId): label ?? servingSizeId ?? "serving"
        case .asConsumed(let label): label
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
    let productId: String?
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
    let productId: String?
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
        self.init(nutrients: entries.flatMap(\.productSnapshot.nutrients))
    }

    init(nutrients: [NutrientValue]) {
        for nutrient in nutrients {
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

/// Day-level nutrition report aggregation: canonical macros plus fiber and the fat/carb sub-splits
/// shown in the exportable nutrition report. Kept separate from `NutritionSummary` (used in every
/// compact list row) so ordinary rows don't pay for summing nutrients the report-only UI needs.
struct NutritionReportSummary: Equatable, Sendable {
    var calories = 0.0
    var protein = 0.0
    var fat = 0.0
    var carbohydrates = 0.0
    var fiber = 0.0
    var sugars = 0.0
    var saturatedFat = 0.0

    /// Whether at least one logged item explicitly carried this nutrient — as opposed to it summing to
    /// zero because nothing logged today stated it. Drives whether the report shows the breakdown at
    /// all: a proxy split derived from an unstated value is misleading, not just imprecise.
    private(set) var hasFiber = false
    private(set) var hasSugars = false
    private(set) var hasSaturatedFat = false

    /// Saturated fat skews toward animal sources, unsaturated toward plant sources — a composition-based
    /// proxy, not a precise origin classification (the underlying nutrient data has no such field).
    var unsaturatedFat: Double { max(fat - saturatedFat, 0) }

    /// Sugars approximate "fast" carbs; the remainder (starches, fiber) approximates "slow" carbs — a
    /// composition-based proxy, not a precise glycemic classification.
    var complexCarbs: Double { max(carbohydrates - sugars, 0) }

    init(entries: [FoodEntry] = []) {
        self.init(nutrients: entries.flatMap(\.productSnapshot.nutrients))
    }

    init(nutrients: [NutrientValue]) {
        for nutrient in nutrients {
            guard let value = nutrient.value else { continue }
            switch nutrient.key {
            case "energy_kcal": calories += value
            case "protein": protein += value
            case "fat": fat += value
            case "carbohydrates": carbohydrates += value
            case "fiber": fiber += value; hasFiber = true
            case "sugars": sugars += value; hasSugars = true
            case "saturated_fat": saturatedFat += value; hasSaturatedFat = true
            default: break
            }
        }
    }
}

/// User-set daily macro targets — entirely optional per field, so the app never fabricates a target
/// the person hasn't actually configured. Persisted via `@AppStorage` (see `RawRepresentable` below);
/// edited from `NutritionView`'s overflow menu.
struct NutritionGoals: Equatable, Sendable {
    var calories: Double?
    var protein: Double?
    var fat: Double?
    var carbohydrates: Double?
}

extension NutritionGoals: RawRepresentable {
    /// Encodes/decodes through this private nested type rather than making `NutritionGoals` itself
    /// `Codable` — a `Codable` type that also conforms to `RawRepresentable` picks up the stdlib's
    /// `RawRepresentable where Self: Encodable, RawValue: Encodable` default `encode(to:)`, which calls
    /// `rawValue`, which (as written below) called `JSONEncoder().encode(self)`, which calls
    /// `encode(to:)` again — infinite recursion that overflows the stack and crashes on first save.
    private struct Storage: Codable {
        var calories: Double?
        var protein: Double?
        var fat: Double?
        var carbohydrates: Double?
    }

    init?(rawValue: String) {
        guard let data = rawValue.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(Storage.self, from: data) else { return nil }
        self.init(calories: decoded.calories, protein: decoded.protein, fat: decoded.fat, carbohydrates: decoded.carbohydrates)
    }

    var rawValue: String {
        let storage = Storage(calories: calories, protein: protein, fat: fat, carbohydrates: carbohydrates)
        guard let data = try? JSONEncoder().encode(storage), let string = String(data: data, encoding: .utf8) else { return "{}" }
        return string
    }
}

/// Result of publishing a day's nutrition report: the id and the public HTML landing page URL to share
/// (not the raw PDF URL — the landing page carries the Open Graph tags Telegram needs to unfurl a preview).
struct NutritionReportUploadResult: Codable, Sendable {
    let reportId: String
    let shareURL: URL

    private enum CodingKeys: String, CodingKey {
        case reportId
        case shareURL = "shareUrl"
    }
}

extension NutritionProduct {
    /// The reference nutrient base used for scaling (matches the product's own base unit).
    var referenceBase: NutrientBase? {
        nutrientBases.first(where: { $0.unit == baseUnit }) ?? nutrientBases.first
    }

    /// Macro summary for the reference base amount (e.g. "per 100 g"), for display in lists.
    var referenceSummary: NutritionSummary {
        NutritionSummary(nutrients: referenceBase?.nutrients ?? [])
    }

    /// Additional stated bases (e.g. "per portion (330 ml)") beyond the reference base, matching the
    /// product's own unit. These carry directly stated values and should not be re-scaled.
    var alternateBases: [NutrientBase] {
        nutrientBases.filter { $0.unit == baseUnit && $0.id != referenceBase?.id }
    }

    /// Macro summary scaled to an arbitrary quantity, mirroring the backend's snapshot calculation for live preview.
    func summary(for quantity: FoodQuantity) -> NutritionSummary {
        guard let base = referenceBase, base.amount > 0 else { return NutritionSummary() }
        let amountInBaseUnit: Double
        switch quantity {
        case let .grams(value), let .milliliters(value):
            amountInBaseUnit = value
        case let .pieces(count, size):
            guard let option = pieceSizes.first(where: { $0.size == size }) else { return NutritionSummary() }
            amountInBaseUnit = option.grams * count
        case .serving, .asConsumed:
            // Server-computed only: the client doesn't have the product's servingSizes catalog here.
            return NutritionSummary()
        }
        let multiplier = amountInBaseUnit / base.amount
        let scaled = base.nutrients.map { nutrient in
            NutrientValue(
                key: nutrient.key, label: nutrient.label,
                value: nutrient.value.map { $0 * multiplier }, unit: nutrient.unit,
                qualifier: nutrient.qualifier, originalText: nutrient.originalText,
                dailyValuePercent: nutrient.dailyValuePercent, provenance: nutrient.provenance
            )
        }
        return NutritionSummary(nutrients: scaled)
    }
}
