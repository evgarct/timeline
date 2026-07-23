import Foundation

struct ProgressPhoto: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let assetId: String?
    let url: URL?
    let thumbnailUrl: URL?
    let width: Int?
    let height: Int?
    let alt: String
}

struct BodyMeasurements: Codable, Equatable, Sendable {
    let weightKg: Double?
    let waistCm: Double?
    let chestCm: Double?
    let neckCm: Double?
    let leftBicepCm: Double?
    let rightBicepCm: Double?
    let leftThighCm: Double?
    let rightThighCm: Double?
    let leftCalfCm: Double?
    let rightCalfCm: Double?
}

enum TimelineEvent: Identifiable, Equatable, Sendable {
    case progressPhoto(EventBase, [ProgressPhoto])
    case measurements(EventBase, BodyMeasurements)
    case workout(EventBase, completed: Bool, muscleGroups: [String])
    case inbody(EventBase)
    case nutritionEntry(EventBase, FoodEntryPayload)
    case unsupported(EventBase, type: String)

    var base: EventBase {
        switch self {
        case let .progressPhoto(base, _), let .measurements(base, _),
             let .workout(base, _, _), let .inbody(base), let .nutritionEntry(base, _),
             let .unsupported(base, _): base
        }
    }

    var id: String { base.id }
}

struct EventBase: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let occurredAt: Date
    let timezone: String
    let note: String?
}

extension TimelineEvent: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, type, occurredAt, timezone, note, photos, values, completed, muscleGroups
        case productId, mealType, quantity, productSnapshot
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let base = EventBase(
            id: try container.decode(String.self, forKey: .id),
            occurredAt: try container.decode(Date.self, forKey: .occurredAt),
            timezone: try container.decode(String.self, forKey: .timezone),
            note: try container.decodeIfPresent(String.self, forKey: .note)
        )
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "progress_photo":
            self = .progressPhoto(base, try container.decode([ProgressPhoto].self, forKey: .photos))
        case "measurements":
            self = .measurements(base, try container.decode(BodyMeasurements.self, forKey: .values))
        case "workout":
            self = .workout(
                base,
                completed: try container.decode(Bool.self, forKey: .completed),
                muscleGroups: try container.decode([String].self, forKey: .muscleGroups)
            )
        case "inbody": self = .inbody(base)
        case "nutrition_entry":
            self = .nutritionEntry(base, FoodEntryPayload(
                productId: try container.decode(String.self, forKey: .productId),
                mealType: try container.decode(MealType.self, forKey: .mealType),
                quantity: try container.decode(FoodQuantity.self, forKey: .quantity),
                productSnapshot: try container.decode(FoodProductSnapshot.self, forKey: .productSnapshot)
            ))
        default: self = .unsupported(base, type: type)
        }
    }
}

extension JSONDecoder {
    static var formAPI: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let basic = ISO8601DateFormatter()
            if let date = fractional.date(from: value) ?? basic.date(from: value) { return date }
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Invalid ISO-8601 date"
            )
        }
        return decoder
    }
}
