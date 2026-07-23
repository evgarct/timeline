import XCTest
@testable import Form

final class TimelineEventTests: XCTestCase {
    func testDecodesProgressPhotoWithFractionalDate() throws {
        let data = Data(#"[{"id":"event-1","type":"progress_photo","occurredAt":"2026-07-17T12:00:00.000Z","timezone":"Europe/Prague","photos":[{"id":"photo-1","assetId":"asset-1","url":"https://example.com/photo.jpg","alt":"Front"}]}]"#.utf8)
        let events = try JSONDecoder.formAPI.decode([TimelineEvent].self, from: data)

        guard case let .progressPhoto(base, photos) = events.first else {
            return XCTFail("Expected progress photo")
        }
        XCTAssertEqual(base.id, "event-1")
        XCTAssertEqual(photos.first?.id, "photo-1")
    }

    func testUnknownEventTypeIsPreservedAsUnsupported() throws {
        let data = Data(#"[{"id":"event-2","type":"future_event","occurredAt":"2026-07-17T12:00:00Z","timezone":"UTC"}]"#.utf8)
        let events = try JSONDecoder.formAPI.decode([TimelineEvent].self, from: data)

        guard case let .unsupported(base, type) = events.first else {
            return XCTFail("Expected unsupported event")
        }
        XCTAssertEqual(base.id, "event-2")
        XCTAssertEqual(type, "future_event")
    }

    func testDecodesNutritionEntryWithMicronutrients() throws {
        let data = Data(#"[{"id":"event-food","type":"nutrition_entry","occurredAt":"2026-07-23T12:00:00Z","timezone":"Europe/Prague","productId":"product-1","mealType":"breakfast","quantity":{"unit":"g","amount":150},"productSnapshot":{"name":"Yoghurt","nutrients":[{"key":"salt","label":"Salt","value":0.2,"unit":"g","provenance":"stated"},{"key":"vitamin_c","label":"Vitamin C","value":12,"unit":"mg","provenance":"stated"}]}}]"#.utf8)
        let events = try JSONDecoder.formAPI.decode([TimelineEvent].self, from: data)

        guard case let .nutritionEntry(_, payload) = events.first else {
            return XCTFail("Expected nutrition entry")
        }
        XCTAssertEqual(payload.mealType, .breakfast)
        XCTAssertEqual(payload.productSnapshot.nutrients.count, 2)
    }
}
