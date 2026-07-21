import Foundation

enum PreviewData {
    static let photoBase = EventBase(
        id: "photo-event",
        occurredAt: Date(timeIntervalSince1970: 1_752_710_400),
        timezone: "Europe/Prague",
        note: nil
    )
    static let measurementBase = EventBase(
        id: "measurement-event",
        occurredAt: Date(timeIntervalSince1970: 1_752_710_400),
        timezone: "Europe/Prague",
        note: nil
    )
    static let events: [TimelineEvent] = [
        .progressPhoto(photoBase, []),
        .measurements(measurementBase, BodyMeasurements(
            weightKg: 78.4, waistCm: 81, chestCm: 104, neckCm: nil,
            leftBicepCm: nil, rightBicepCm: nil, leftThighCm: nil,
            rightThighCm: nil, leftCalfCm: nil, rightCalfCm: nil
        ))
    ]
}
